require('dotenv').config()
const path = require('path')
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { generateContent } = require('./gemini')
const { saveToDb, addOutputToChat } = require('./db')

const app = express()

// ── Security headers ──────────────────────────────────────────────
app.use(helmet())

// ── CORS ──────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))

// ── Rate limiting ─────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 30,                    // 30 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
})
app.use('/generate', limiter)

// ── File upload ───────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'audio/mpeg',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`))
    }
  },
})

// ── Input validation ──────────────────────────────────────────────
const ALLOWED_OUTPUT_TYPES = new Set(['summary', 'quiz', 'flashcards'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateBody(req, res, next) {
  const { outputType, userId, chatId } = req.body

  if (!ALLOWED_OUTPUT_TYPES.has(outputType)) {
    return res.status(400).json({ error: 'Invalid output type.' })
  }
  if (userId && !UUID_RE.test(userId)) {
    return res.status(400).json({ error: 'Invalid userId.' })
  }
  if (chatId && !UUID_RE.test(chatId)) {
    return res.status(400).json({ error: 'Invalid chatId.' })
  }

  next()
}

// ── Route ─────────────────────────────────────────────────────────
app.post('/api/generate', upload.single('file'), validateBody, async (req, res) => {
  const { outputType, userId, chatId } = req.body

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided.' })
  }

  console.log('POST /generate — file:', req.file.originalname, 'type:', outputType)

  try {
    // Adding output to an existing chat — generate from the existing content
    if (chatId) {
      const result = await generateContent(req.file, outputType)
      await addOutputToChat(chatId, result)
      return res.json(result)
    }

    // New upload: always generate summary from the original file first
    const summary = await generateContent(req.file, 'summary')

    if (!userId) return res.json(summary)

    const { chatId: newChatId } = await saveToDb(userId, summary)

    // If the user asked for quiz or flashcards, generate it from the summary
    if (outputType !== 'summary') {
      const summaryFile = {
        buffer: Buffer.from(JSON.stringify(summary)),
        mimetype: 'text/plain',
      }
      const output = await generateContent(summaryFile, outputType)
      await addOutputToChat(newChatId, output)
      return res.json({ ...output, chatId: newChatId })
    }

    return res.json({ ...summary, chatId: newChatId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Generation failed. Please try again.' })
  }
})

// ── Serve Vite build in production ───────────────────────────────
const clientDist = path.join(__dirname, '../client/dist')
app.use(express.static(clientDist))
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))

// ── Multer error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 25 MB.' })
  }
  if (err.message?.startsWith('Unsupported file type')) {
    return res.status(415).json({ error: err.message })
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`))
