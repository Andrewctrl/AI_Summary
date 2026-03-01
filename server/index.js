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
    const result = await generateContent(req.file, outputType)
    if (chatId) {
      await addOutputToChat(chatId, result)
      return res.json(result)
    }
    if (userId) {
      const { chatId: newChatId } = await saveToDb(userId, result)
      return res.json({ ...result, chatId: newChatId })
    }
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Generation failed. Please try again.' })
  }
})

app.listen(3001, () => console.log('Server running at http://localhost:3001'))
