import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { db } from '../db'

const TABS = ['summary', 'quiz', 'flashcards']
const LABELS = { summary: 'Summary', quiz: 'Quiz', flashcards: 'Flashcards' }

export default function Chat() {
  const { id } = useParams()
  const { user } = db.useAuth()
  const location = useLocation()
  const [activeType, setActiveType] = useState(location.state?.initialTab || 'summary')
  const [loading, setLoading] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)
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
    const source = getOutput('summary') || getOutput('quiz') || getOutput('flashcards')
    if (!source) return

    const sourceText = JSON.stringify(source.content)
    const formData = new FormData()
    const textFile = new Blob([sourceText], { type: 'text/plain' })
    formData.append('file', textFile, 'source.txt')
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

  const handleRegenerate = async () => {
    const existing = getOutput('quiz')
    const source = getOutput('summary') || getOutput('flashcards')
    if (!source) return
    setRegenLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', new Blob([JSON.stringify(source.content)], { type: 'text/plain' }), 'source.txt')
      formData.append('outputType', 'quiz')
      if (user?.id) formData.append('userId', user.id)
      formData.append('chatId', id)
      const res = await fetch('/api/generate', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      // Delete old AFTER new is saved — no blank gap
      if (existing) await db.transact(db.tx.outputs[existing.id].delete())
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('Regeneration failed. Please try again.')
    } finally {
      setRegenLoading(false)
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
                disabled={loading || regenLoading}
                style={{
                  ...styles.tab,
                  ...(isActive && exists ? styles.tabActive : {}),
                  ...((loading || regenLoading) ? styles.tabDisabled : {}),
                }}
              >
                {loading && activeType !== type && !exists
                  ? LABELS[type]
                  : exists
                    ? LABELS[type]
                    : `+ ${LABELS[type]}`}
                {exists && <span style={{ ...styles.tabDot, background: isActive ? 'rgba(255,255,255,0.7)' : '#7986CB' }} />}
              </button>
            )
          })}
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {/* Content */}
        <div style={styles.content}>
          {getOutput(activeType)
            ? <OutputView key={getOutput(activeType).id} output={getOutput(activeType)} onRegenerate={activeType === 'quiz' ? handleRegenerate : undefined} regenLoading={regenLoading} />
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

function OutputView({ output, onRegenerate, regenLoading }) {
  const { type, content } = output

  if (type === 'summary') return <SummaryView content={content} />
  if (type === 'quiz') return <QuizView content={content} onRegenerate={onRegenerate} regenLoading={regenLoading} />
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
function QuizView({ content, onRegenerate, regenLoading }) {
  const [answers, setAnswers] = useState({})
  const [detailed, setDetailed] = useState(false)

  const select = (qi, opt) => {
    if (answers[qi] !== undefined || regenLoading) return
    setAnswers((prev) => ({ ...prev, [qi]: opt }))
  }

  const correct = Object.entries(answers).filter(
    ([i, ans]) => ans[0] === content.questions?.[i]?.correct
  ).length

  return (
    <div style={styles.quizWrap}>
      {/* Toolbar */}
      <div style={styles.quizToolbar}>
        <div style={styles.modeToggle}>
          <button onClick={() => setDetailed(false)} style={{ ...styles.modeBtn, ...(detailed ? {} : styles.modeBtnActive) }}>Regular</button>
          <button onClick={() => setDetailed(true)} style={{ ...styles.modeBtn, ...(detailed ? styles.modeBtnActive : {}) }}>Detailed</button>
        </div>
        {onRegenerate && (
          <button onClick={onRegenerate} disabled={regenLoading} style={styles.regenBtn}>
            {regenLoading ? 'Regenerating...' : '↻ New Quiz'}
          </button>
        )}
      </div>

      <div style={{ ...styles.quizContent, ...(regenLoading ? styles.quizFreezeOverlay : {}) }}>
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
                <span> — {detailed && q.detail ? q.detail : q.explanation}</span>
              </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}

/* ── Flashcards ── */
function FlashcardsView({ content }) {
  const cards = content.cards ?? []
  const [index, setIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [slideDir, setSlideDir] = useState(null)
  const [slideKey, setSlideKey] = useState(0)

  const goTo = (i, dir) => {
    setSlideDir(dir)
    setSlideKey((k) => k + 1)
    setIndex(i)
    setIsFlipped(false)
  }
  const prev = () => { if (index > 0) goTo(index - 1, 'right') }
  const next = () => { if (index < cards.length - 1) goTo(index + 1, 'left') }

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === ' ') { e.preventDefault(); setIsFlipped((f) => !f) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [index, cards.length])

  const card = cards[index]
  if (!card) return null

  const slideAnim = slideDir === 'left'
    ? 'slideInFromRight 0.22s ease'
    : slideDir === 'right'
      ? 'slideInFromLeft 0.22s ease'
      : undefined

  return (
    <div style={styles.fcWrap}>
      <style>{`
        @keyframes slideInFromRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInFromLeft  { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      <span style={styles.fcCounter}>{index + 1} / {cards.length}</span>

      <div style={styles.fcRow}>
        <button
          onClick={prev}
          disabled={index === 0}
          style={{ ...styles.fcNavBtn, ...(index === 0 ? styles.fcNavBtnDisabled : {}) }}
        >←</button>

        <div key={slideKey} style={{ ...styles.fcCard, animation: slideAnim }} onClick={() => setIsFlipped(!isFlipped)}>
          <div style={{ ...styles.fcInner, ...(isFlipped ? styles.fcFlipped : {}) }}>
            <div style={styles.fcFront}>
              <span style={styles.fcSideLabel}>QUESTION</span>
              <p style={styles.fcText}>{card.front}</p>
            </div>
            <div style={styles.fcBack}>
              <span style={styles.fcSideLabel}>ANSWER</span>
              <p style={styles.fcText}>{card.back}</p>
            </div>
          </div>
        </div>

        <button
          onClick={next}
          disabled={index === cards.length - 1}
          style={{ ...styles.fcNavBtn, ...(index === cards.length - 1 ? styles.fcNavBtnDisabled : {}) }}
        >→</button>
      </div>

      <p style={styles.fcHint}>Click card to flip</p>

      {cards.length <= 20 && (
        <div style={styles.fcDots}>
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{ ...styles.fcDot, ...(i === index ? styles.fcDotActive : {}) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #E8EAF6 0%, #E3F2FD 50%, #FFF8E8 100%)',
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
    color: '#7B8099',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'color 0.15s',
    textDecoration: 'none',
  },
  title: {
    margin: 0,
    fontSize: '26px',
    fontWeight: 700,
    color: '#3D405B',
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
    border: '1.5px solid #DDE0F0',
    background: '#FFFFFF',
    color: '#7B8099',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#7986CB',
    borderColor: '#7986CB',
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
    background: 'rgba(255,255,255,0.6)',
  },
  error: {
    margin: 0,
    padding: '10px 14px',
    background: 'rgba(239,100,100,0.08)',
    border: '1px solid rgba(239,100,100,0.2)',
    borderRadius: '8px',
    color: '#C0392B',
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
    color: '#7B8099',
  },
  emptyHint: {
    margin: 0,
    fontSize: '13px',
    color: '#B0B4C8',
  },

  /* Summary */
  summaryWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  tldrBox: {
    background: 'rgba(121,134,203,0.08)',
    border: '1px solid rgba(121,134,203,0.25)',
    borderRadius: '12px',
    padding: '16px 20px',
  },
  tldrLabel: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#7986CB',
    marginBottom: '6px',
  },
  tldrText: {
    margin: 0,
    fontSize: '15px',
    color: '#3D405B',
    lineHeight: 1.6,
  },
  section: {
    borderLeft: '2px solid #DDE0F0',
    paddingLeft: '16px',
  },
  sectionHeading: {
    margin: '0 0 8px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#3D405B',
  },
  sectionContent: {
    margin: 0,
    fontSize: '14px',
    color: '#7B8099',
    lineHeight: 1.65,
  },
  keyPointsBox: {
    background: '#F5F6FA',
    border: '1.5px solid #DDE0F0',
    borderRadius: '12px',
    padding: '16px 20px',
  },
  keyPointsTitle: {
    margin: '0 0 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#9199B0',
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
    color: '#3D405B',
    lineHeight: 1.5,
  },

  /* Quiz */
  quizToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  modeToggle: {
    display: 'flex',
    background: '#EEF0F8',
    border: '1.5px solid #DDE0F0',
    borderRadius: '999px',
    padding: '3px',
    gap: '2px',
  },
  modeBtn: {
    padding: '5px 14px',
    borderRadius: '999px',
    border: 'none',
    background: 'transparent',
    color: '#7B8099',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  modeBtnActive: {
    background: '#FFFFFF',
    color: '#3D405B',
    boxShadow: '0 1px 4px rgba(100,110,180,0.12)',
  },
  regenBtn: {
    padding: '6px 14px',
    borderRadius: '999px',
    border: '1.5px solid #DDE0F0',
    background: '#FFFFFF',
    color: '#7B8099',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  quizWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  quizContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  quizFreezeOverlay: {
    opacity: 0.4,
    pointerEvents: 'none',
    userSelect: 'none',
  },
  scoreBox: {
    padding: '12px 20px',
    background: 'rgba(121,134,203,0.08)',
    border: '1px solid rgba(121,134,203,0.25)',
    borderRadius: '10px',
    textAlign: 'center',
  },
  scoreText: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#7986CB',
  },
  questionCard: {
    background: '#FFFFFF',
    border: '1.5px solid #E8EAF6',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 2px 12px rgba(100,110,180,0.07)',
  },
  questionNum: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: '#9199B0',
    textTransform: 'uppercase',
  },
  questionText: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 500,
    color: '#3D405B',
    lineHeight: 1.5,
  },
  optionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: '#F5F6FA',
    border: '1.5px solid #DDE0F0',
    borderRadius: '8px',
    color: '#3D405B',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s',
  },
  optionCorrect: {
    background: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.35)',
    color: '#166534',
  },
  optionWrong: {
    background: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.35)',
    color: '#991B1B',
  },
  optionDimmed: {
    opacity: 0.4,
    cursor: 'default',
  },
  optionLetter: {
    flexShrink: 0,
    fontWeight: 700,
    color: '#9199B0',
    width: '16px',
  },
  checkmark: {
    marginLeft: 'auto',
    color: '#16a34a',
    fontWeight: 700,
  },
  cross: {
    marginLeft: 'auto',
    color: '#dc2626',
    fontWeight: 700,
  },
  explanation: {
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  explanationCorrect: {
    background: 'rgba(34,197,94,0.07)',
    color: '#166534',
  },
  explanationWrong: {
    background: 'rgba(239,68,68,0.07)',
    color: '#991B1B',
  },

  /* Flashcards */
  fcWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  fcCounter: {
    fontSize: '13px',
    color: '#9199B0',
    fontWeight: 500,
  },
  fcRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    width: '100%',
  },
  fcNavBtn: {
    flexShrink: 0,
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '1.5px solid #DDE0F0',
    background: '#FFFFFF',
    color: '#7B8099',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    boxShadow: '0 1px 6px rgba(100,110,180,0.08)',
  },
  fcNavBtnDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  fcCard: {
    flex: 1,
    height: '260px',
    cursor: 'pointer',
    perspective: '1200px',
  },
  fcInner: {
    position: 'relative',
    width: '100%',
    height: '100%',
    transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
    transformStyle: 'preserve-3d',
  },
  fcFlipped: {
    transform: 'rotateX(180deg)',
  },
  fcFront: {
    position: 'absolute',
    inset: 0,
    background: '#FFFFFF',
    border: '1.5px solid #E8EAF6',
    borderRadius: '16px',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    boxShadow: '0 4px 20px rgba(100,110,180,0.10)',
  },
  fcBack: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, #EEF0FB 0%, #E8F4FD 100%)',
    border: '1.5px solid rgba(121,134,203,0.3)',
    borderRadius: '16px',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    transform: 'rotateX(180deg)',
    boxShadow: '0 4px 20px rgba(100,110,180,0.10)',
  },
  fcSideLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#9199B0',
    marginBottom: '16px',
    display: 'block',
  },
  fcText: {
    margin: 0,
    fontSize: '17px',
    fontWeight: 500,
    color: '#3D405B',
    lineHeight: 1.55,
  },
  fcHint: {
    margin: 0,
    fontSize: '12px',
    color: '#B0B4C8',
  },
  fcDots: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '400px',
  },
  fcDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    border: 'none',
    background: '#DDE0F0',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.15s',
  },
  fcDotActive: {
    background: '#7986CB',
  },
}
