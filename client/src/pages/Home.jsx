import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'

const OUTPUT_TYPES = ['summary', 'quiz', 'flashcards']

export default function Home() {
  const { user } = db.useAuth()
  const navigate = useNavigate()
  const [outputType, setOutputType] = useState('summary')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const { data } = db.useQuery({
    chats: {
      $: {
        where: { '$user.id': user.id },
        order: { createdAt: 'desc' },
        limit: 5,
      },
    },
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const file = e.target.file.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('outputType', outputType)
    if (user?.id) formData.append('userId', user.id)

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/generate', { method: 'POST', body: formData })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      if (result.chatId) navigate(`/chat/${result.chatId}`)
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Notes AI</h1>

      <form onSubmit={handleSubmit}>
        <div>
          {OUTPUT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setOutputType(type)}
              aria-pressed={outputType === type}
            >
              {type}
            </button>
          ))}
        </div>

        <input
          name="file"
          type="file"
          accept=".mp4,.txt,.jpg,.jpeg,.png,.webp,.mp3,.jpg,.pdf,.mpg"
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Generate'}
        </button>

        {error && <p>{error}</p>}
      </form>

      <section>
        <h2>Past sessions</h2>
        {data?.chats?.length === 0 && <p>No sessions yet.</p>}
        {data?.chats?.map((chat) => (
          <div key={chat.id} onClick={() => navigate(`/chat/${chat.id}`)}>
            <p>{chat.title}</p>
            <small>{chat.sourceType}</small>
          </div>
        ))}
      </section>
    </div>
  )
}
