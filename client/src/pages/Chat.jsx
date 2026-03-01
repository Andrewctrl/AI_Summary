import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { db } from '../db'

export default function Chat() {
  const { id } = useParams()
  const { user } = db.useAuth()
  const [activeType, setActiveType] = useState('summary')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const { data } = db.useQuery({
    chats: {
      $: { where: { id } },
      outputs: {},
    },
  })

  const chat = data?.chats?.[0]
  const outputs = chat?.outputs ?? []

  const getOutput = (type) => outputs.find((o) => o.type === type)

  const handleGenerate = async (type) => {
    const summary = getOutput('summary')
    if (!summary) return

    const summaryText = JSON.stringify(summary.content)
    const formData = new FormData()
    const textFile = new Blob([summaryText], { type: 'text/plain' })
    formData.append('file', textFile, 'summary.txt')
    formData.append('outputType', type)
    if (user?.id) formData.append('userId', user.id)
    formData.append('chatId', id)

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/generate', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      setActiveType(type)
    } catch {
      setError('Generation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Link to="/">← Back</Link>
      <h1>{chat?.title ?? 'Loading...'}</h1>

      <div>
        {['summary', 'quiz', 'flashcards'].map((type) => (
          <button
            key={type}
            onClick={() => {
              if (getOutput(type)) setActiveType(type)
              else handleGenerate(type)
            }}
            aria-pressed={activeType === type}
            disabled={loading}
          >
            {getOutput(type) ? type : `Generate ${type}`}
          </button>
        ))}
      </div>

      {error && <p>{error}</p>}

      <div>
        {getOutput(activeType)
          ? <OutputView output={getOutput(activeType)} />
          : <p>No {activeType} yet.</p>
        }
      </div>
    </div>
  )
}

function OutputView({ output }) {
  const { type, content } = output

  if (type === 'summary') return (
    <div>
      <p>{content.tldr}</p>
      {content.sections?.map((s, i) => (
        <div key={i}>
          <h3>{s.heading}</h3>
          <p>{s.content}</p>
        </div>
      ))}
      <ul>
        {content.key_points?.map((point, i) => <li key={i}>{point}</li>)}
      </ul>
    </div>
  )

  if (type === 'quiz') return (
    <div>
      {content.questions?.map((q, i) => (
        <div key={i}>
          <p><strong>{q.question}</strong></p>
          <ul>
            {q.options?.map((opt, j) => <li key={j}>{opt}</li>)}
          </ul>
          <p>Answer: {q.correct} — {q.explanation}</p>
        </div>
      ))}
    </div>
  )

  if (type === 'flashcards') return (
    <div>
      {content.cards?.map((card, i) => (
        <div key={i}>
          <p><strong>{card.front}</strong></p>
          <p>{card.back}</p>
        </div>
      ))}
    </div>
  )

  return null
}
