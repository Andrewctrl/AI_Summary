require('dotenv').config()
const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const multer = require('multer')
const { generateContent } = require('./gemini')
const { saveToDb } = require('./db')

const app = express()
const upload = multer({ storage: multer.memoryStorage() })

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many requests, please try again later.' }
})

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.post('/generate', limiter, upload.single('file'), async (req, res) => {
  const { outputType, userId } = req.body

  try {
    const result = await generateContent(req.file, outputType)

    if (userId) {
      const { chatId } = await saveToDb(userId, result)
      return res.json({ ...result, chatId })
    }

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Generation failed. Please try again.' })
  }
})

const server = app.listen(0, () => {
  const { port } = server.address()
  console.log(`Server running at http://localhost:${port}`)
})
