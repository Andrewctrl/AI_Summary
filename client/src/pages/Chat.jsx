import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { db } from '../db'

const TABS = ['summary', 'quiz', 'flashcards']
const LABELS = { summary: 'Summary', quiz: 'Quiz', flashcards: 'Flashcards' }

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
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Nav */}
        <div style={styles.nav}>
          <Link to="/" style={styles.backLink}>← Back</Link>
        </div>

        {/* Title */}
        <h1 style={styles.title}>{chat?.title ?? 'Loading...'}</h1>

        {/* Tab bar */}
        <div style={styles.tabBar}>
          {TABS.map((type) => {
            const exists = !!getOutput(type)
            const isActive = activeType === type
            return (
              <button
                key={type}
                onClick={() => exists ? setActiveType(type) : handleGenerate(type)}
                disabled={loading}
                style={{
                  ...styles.tab,
                  ...(isActive && exists ? styles.tabActive : {}),
                  ...(loading ? styles.tabDisabled : {}),
                }}
              >
                {loading && activeType !== type && !exists
                  ? LABELS[type]
                  : exists
                    ? LABELS[type]
                    : `+ ${LABELS[type]}`}
                {exists && <span style={styles.tabDot} />}
              </button>
            )
          })}
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {/* Content */}
        <div style={styles.content}>
          {getOutput(activeType)
            ? <OutputView output={getOutput(activeType)} />
            : (
              <div style={styles.emptyState}>
                <p style={styles.emptyText}>No {LABELS[activeType].toLowerCase()} yet.</p>
                <p style={styles.emptyHint}>Click "+ {LABELS[activeType]}" above to generate one.</p>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}

function OutputView({ output }) {
  const { type, content } = output

  if (type === 'summary') return <SummaryView content={content} />
  if (type === 'quiz') return <QuizView content={content} />
  if (type === 'flashcards') return <FlashcardsView content={content} />
  return null
}

/* ── Summary ── */
function SummaryView({ content }) {
  return (
    <div style={styles.summaryWrap}>
      {content.tldr && (
        <div style={styles.tldrBox}>
          <span style={styles.tldrLabel}>TL;DR</span>
          <p style={styles.tldrText}>{content.tldr}</p>
        </div>
      )}

      {content.sections?.map((s, i) => (
        <div key={i} style={styles.section}>
          <h3 style={styles.sectionHeading}>{s.heading}</h3>
          <p style={styles.sectionContent}>{s.content}</p>
        </div>
      ))}

      {content.key_points?.length > 0 && (
        <div style={styles.keyPointsBox}>
          <h4 style={styles.keyPointsTitle}>Key points</h4>
          <ul style={styles.keyPointsList}>
            {content.key_points.map((point, i) => (
              <li key={i} style={styles.keyPoint}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ── Quiz ── */
function QuizView({ content }) {
  const [answers, setAnswers] = useState({})

  const select = (qi, opt) => {
    if (answers[qi] !== undefined) return
    setAnswers((prev) => ({ ...prev, [qi]: opt }))
  }

  const correct = Object.entries(answers).filter(
    ([i, ans]) => ans[0] === content.questions?.[i]?.correct
  ).length

  return (
    <div style={styles.quizWrap}>
      {Object.keys(answers).length === content.questions?.length && (
        <div style={styles.scoreBox}>
          <span style={styles.scoreText}>
            {correct} / {content.questions.length} correct
          </span>
        </div>
      )}

      {content.questions?.map((q, i) => {
        const chosen = answers[i]
        const isCorrect = chosen?.[0] === q.correct

        return (
          <div key={i} style={styles.questionCard}>
            <p style={styles.questionNum}>Question {i + 1}</p>
            <p style={styles.questionText}>{q.question}</p>
            <div style={styles.optionList}>
              {q.options?.map((opt, j) => {
                const letter = opt[0]
                const isChosen = chosen === opt
                const isAnswer = letter === q.correct

                let optStyle = styles.option
                if (chosen !== undefined) {
                  if (isAnswer) optStyle = { ...styles.option, ...styles.optionCorrect }
                  else if (isChosen) optStyle = { ...styles.option, ...styles.optionWrong }
                  else optStyle = { ...styles.option, ...styles.optionDimmed }
                }

                return (
                  <button
                    key={j}
                    onClick={() => select(i, opt)}
                    style={optStyle}
                  >
                    <span style={styles.optionLetter}>{letter}</span>
                    <span>{opt.slice(2).trim()}</span>
                    {chosen !== undefined && isAnswer && <span style={styles.checkmark}>✓</span>}
                    {isChosen && !isAnswer && <span style={styles.cross}>✗</span>}
                  </button>
                )
              })}
            </div>
            {chosen !== undefined && (
              <div style={{ ...styles.explanation, ...(isCorrect ? styles.explanationCorrect : styles.explanationWrong) }}>
                <strong>{isCorrect ? 'Correct!' : `Correct answer: ${q.correct}`}</strong>
                {q.explanation && <span> — {q.explanation}</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Flashcards ── */
function FlashcardsView({ content }) {
  const [flipped, setFlipped] = useState(new Set())

  const toggle = (i) => setFlipped((prev) => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })

  return (
    <div style={styles.cardsGrid}>
      {content.cards?.map((card, i) => {
        const isFlipped = flipped.has(i)
        return (
          <div
            key={i}
            onClick={() => toggle(i)}
            style={styles.flashcard}
          >
            <div style={{ ...styles.flashcardInner, ...(isFlipped ? styles.flashcardFlipped : {}) }}>
              <div style={styles.flashcardFront}>
                <span style={styles.flashcardHint}>FRONT</span>
                <p style={styles.flashcardText}>{card.front}</p>
              </div>
              <div style={styles.flashcardBack}>
                <span style={styles.flashcardHint}>BACK</span>
                <p style={styles.flashcardText}>{card.back}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f0f0f',
    padding: '32px 16px 80px',
  },
  container: {
    maxWidth: '700px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
  },
  backLink: {
    color: '#666',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'color 0.15s',
  },
  title: {
    margin: 0,
    fontSize: '26px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.3px',
    lineHeight: 1.3,
  },
  tabBar: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '999px',
    border: '1px solid #2a2a2a',
    background: '#1a1a1a',
    color: '#aaa',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#6366f1',
    borderColor: '#6366f1',
    color: '#fff',
  },
  tabDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  tabDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.4)',
  },
  error: {
    margin: 0,
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '13px',
  },
  content: {
    minHeight: '200px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyText: {
    margin: '0 0 6px',
    fontSize: '16px',
    color: '#555',
  },
  emptyHint: {
    margin: 0,
    fontSize: '13px',
    color: '#3f3f3f',
  },

  /* Summary */
  summaryWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  tldrBox: {
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: '12px',
    padding: '16px 20px',
  },
  tldrLabel: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#818cf8',
    marginBottom: '6px',
  },
  tldrText: {
    margin: 0,
    fontSize: '15px',
    color: '#d0d0d0',
    lineHeight: 1.6,
  },
  section: {
    borderLeft: '2px solid #2a2a2a',
    paddingLeft: '16px',
  },
  sectionHeading: {
    margin: '0 0 8px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  sectionContent: {
    margin: 0,
    fontSize: '14px',
    color: '#999',
    lineHeight: 1.65,
  },
  keyPointsBox: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '16px 20px',
  },
  keyPointsTitle: {
    margin: '0 0 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  keyPointsList: {
    margin: 0,
    paddingLeft: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  keyPoint: {
    fontSize: '14px',
    color: '#ccc',
    lineHeight: 1.5,
  },

  /* Quiz */
  quizWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  scoreBox: {
    padding: '12px 20px',
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: '10px',
    textAlign: 'center',
  },
  scoreText: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#818cf8',
  },
  questionCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  questionNum: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: '#555',
    textTransform: 'uppercase',
  },
  questionText: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 500,
    color: '#e0e0e0',
    lineHeight: 1.5,
  },
  optionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: '#232323',
    border: '1px solid #2e2e2e',
    borderRadius: '8px',
    color: '#ccc',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s',
  },
  optionCorrect: {
    background: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.4)',
    color: '#86efac',
  },
  optionWrong: {
    background: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.4)',
    color: '#fca5a5',
  },
  optionDimmed: {
    opacity: 0.4,
    cursor: 'default',
  },
  optionLetter: {
    flexShrink: 0,
    fontWeight: 700,
    color: '#555',
    width: '16px',
  },
  checkmark: {
    marginLeft: 'auto',
    color: '#4ade80',
    fontWeight: 700,
  },
  cross: {
    marginLeft: 'auto',
    color: '#f87171',
    fontWeight: 700,
  },
  explanation: {
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  explanationCorrect: {
    background: 'rgba(34,197,94,0.08)',
    color: '#86efac',
  },
  explanationWrong: {
    background: 'rgba(239,68,68,0.08)',
    color: '#fca5a5',
  },

  /* Flashcards */
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '14px',
  },
  flashcard: {
    height: '160px',
    cursor: 'pointer',
    perspective: '1000px',
  },
  flashcardInner: {
    position: 'relative',
    width: '100%',
    height: '100%',
    transition: 'transform 0.45s',
    transformStyle: 'preserve-3d',
  },
  flashcardFlipped: {
    transform: 'rotateY(180deg)',
  },
  flashcardFront: {
    position: 'absolute',
    inset: 0,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  },
  flashcardBack: {
    position: 'absolute',
    inset: 0,
    background: '#1e1e2e',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    transform: 'rotateY(180deg)',
  },
  flashcardHint: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#444',
    marginBottom: '8px',
  },
  flashcardText: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 500,
    color: '#ddd',
    lineHeight: 1.5,
  },
}
