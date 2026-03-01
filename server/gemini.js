const { GoogleGenerativeAI } = require('@google/generative-ai')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const prompts = {
  summary: `Analyze this content and return a summary. Return raw JSON only — no markdown, no code fences, no extra text.
Schema: { "type": "summary", "metadata": { "source_type": "mp4|image|txt|pdf", "title": "Auto-generated title" }, "tldr": "One sentence overview", "sections": [{ "heading": "...", "content": "..." }], "key_points": ["..."] }`,

  quiz: `Generate a quiz from this content. Return raw JSON only — no markdown, no code fences, no extra text.
Schema: { "type": "quiz", "metadata": { "source_type": "mp4|image|txt|pdf", "title": "Auto-generated title" }, "questions": [{ "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": "A", "explanation": "..." }] }`,

  flashcards: `Generate flashcards from this content. Return raw JSON only — no markdown, no code fences, no extra text.
Schema: { "type": "flashcards", "metadata": { "source_type": "mp4|image|txt|pdf", "title": "Auto-generated title" }, "cards": [{ "front": "...", "back": "..." }] }`
}

async function generateContent(file, outputType) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json' } })
  const prompt = prompts[outputType] || prompts.summary

  const parts = file.mimetype === 'text/plain'
    ? [prompt, file.buffer.toString('utf-8')]
    : [prompt, { inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype } }]

  const result = await model.generateContent(parts)
  const raw = result.response.text()

  // Strip markdown code fences if the model included them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch (err) {
    console.error('Gemini returned invalid JSON:', cleaned.slice(0, 500))
    throw new Error('AI returned malformed response. Please try again.')
  }
}

module.exports = { generateContent }
