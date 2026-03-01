require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const { generateContent } = require('./gemini')
const { saveToDb, addOutputToChat } = require('./db')

const app = express()
const upload = multer({ storage: multer.memoryStorage() })

app.use(cors({ origin: 'http://localhost:5173' }))

app.post('/generate', upload.single('file'), async (req, res) => {
  const { outputType, userId, chatId } = req.body
  console.log('POST /generate — file:', req.file?.originalname, 'type:', outputType)

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

app.listen(3001, () => console.log('Server running at http://localhost:3001'))
