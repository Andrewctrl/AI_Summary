const { GoogleGenerativeAI } = require('@google/generative-ai')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

const prompts = {
  summary: `Analyze this content and return a summary. Return raw JSON only — no markdown, no code fences, no extra text.
Schema: { "type": "summary", "metadata": { "source_type": "mp4|image|txt", "title": "Auto-generated title" }, "tldr": "One sentence overview", "sections": [{ "heading": "...", "content": "..." }], "key_points": ["..."] }`,

  quiz: `Generate a quiz from this content. Return raw JSON only — no markdown, no code fences, no extra text.
Schema: { "type": "quiz", "metadata": { "source_type": "mp4|image|txt", "title": "Auto-generated title" }, "questions": [{ "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": "A", "explanation": "..." }] }`,

  flashcards: `Generate flashcards from this content. Return raw JSON only — no markdown, no code fences, no extra text.
Schema: { "type": "flashcards", "metadata": { "source_type": "mp4|image|txt", "title": "Auto-generated title" }, "cards": [{ "front": "...", "back": "..." }] }`
}

async function generateContent(file, outputType) {
  const prompt = prompts[outputType] || prompts.summary
  const parts = [prompt]

  if (file.mimetype === 'text/plain') {
    // Text files: pass content directly as a string
    parts.push(file.buffer.toString('utf-8'))
  } else {
    // Images and video: pass as inline base64 data
    parts.push({
      inlineData: {
        mimeType: file.mimetype,
        data: file.buffer.toString('base64')
      }
    })
  }

  const response = await model.generateContent(parts)
  const text = response.response.text()
  return JSON.parse(text)
}

module.exports = { generateContent }
