import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'

const OUTPUT_TYPES = ['summary', 'quiz', 'flashcards']

const LABELS = {
  summary: 'Summary',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
}

const SOURCE_ICONS = {
  pdf: '📄',
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  text: '📝',
}

function getSourceIcon(sourceType) {
  if (!sourceType) return '📄'
  const t = sourceType.toLowerCase()
  if (t.includes('pdf')) return SOURCE_ICONS.pdf
  if (t.includes('image') || t.includes('jpg') || t.includes('png')) return SOURCE_ICONS.image
  if (t.includes('video') || t.includes('mp4')) return SOURCE_ICONS.video
  if (t.includes('audio') || t.includes('mp3')) return SOURCE_ICONS.audio
  return SOURCE_ICONS.text
}

export default function Home() {
  const { user } = db.useAuth()
  const navigate = useNavigate()
  const [outputType, setOutputType] = useState('summary')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [page, setPage] = useState(0)
  const fileInputRef = useRef(null)

  const handleLogout = async () => {
    await db.auth.signOut()
    navigate('/login')
  }

  const { data } = db.useQuery({
    chats: {
      $: {
        where: { '$user.id': user.id },
        order: { createdAt: 'desc' },
        limit: 6,           // fetch one extra to detect next page
        offset: page * 5,
      },
      outputs: {},
    },
  })

  const chats = data?.chats?.slice(0, 5) ?? []
  const hasNext = (data?.chats?.length ?? 0) > 5
  const hasPrev = page > 0

  const handleDelete = (e, chat) => {
    e.stopPropagation()
    const outputIds = chat.outputs?.map((o) => o.id) ?? []
    db.transact([
      db.tx.chats[chat.id].delete(),
      ...outputIds.map((oid) => db.tx.outputs[oid].delete()),
    ])
    setConfirmId(null)
  }

  const handleFileChange = (file) => {
    if (file) setSelectedFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      setSelectedFile(file)
      // sync to the hidden input
      const dt = new DataTransfer()
      dt.items.add(file)
      fileInputRef.current.files = dt.files
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const file = selectedFile || e.target.file.files[0]
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
      if (result.chatId) navigate(`/chat/${result.chatId}`, { state: { initialTab: outputType } })
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Notes AI</h1>
            <p style={styles.subtitle}>Upload a file and get instant summaries, quizzes, or flashcards</p>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>Log out</button>
        </div>

        {/* Upload card */}
        <div style={styles.card}>
          <form onSubmit={handleSubmit}>
            {/* Output type pills */}
            <div style={styles.pillRow}>
              {OUTPUT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOutputType(type)}
                  style={{
                    ...styles.pill,
                    ...(outputType === type ? styles.pillActive : styles.pillInactive),
                  }}
                >
                  {LABELS[type]}
                </button>
              ))}
            </div>

            {/* Drop zone */}
            <div
              style={{
                ...styles.dropZone,
                ...(dragOver ? styles.dropZoneActive : {}),
                ...(selectedFile ? styles.dropZoneSelected : {}),
              }}
              onClick={() => fileInputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                name="file"
                type="file"
                accept=".mp4,.txt,.jpg,.jpeg,.png,.webp,.mp3,.pdf,.mpg"
                style={{ display: 'none' }}
                onChange={(e) => handleFileChange(e.target.files[0])}
              />
              {selectedFile ? (
                <div style={styles.filePreview}>
                  <span style={styles.fileIcon}>{getSourceIcon(selectedFile.type)}</span>
                  <div>
                    <p style={styles.fileName}>{selectedFile.name}</p>
                    <p style={styles.fileSize}>{(selectedFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
              ) : (
                <div style={styles.dropPrompt}>
                  <span style={styles.uploadIcon}>↑</span>
                  <p style={styles.dropText}>Click to upload or drag & drop</p>
                  <p style={styles.dropHint}>PDF, MP4, MP3, images, or text files</p>
                </div>
              )}
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button
              type="submit"
              disabled={loading || !selectedFile}
              style={{
                ...styles.generateBtn,
                ...(loading || !selectedFile ? styles.generateBtnDisabled : {}),
              }}
            >
              {loading ? (
                <span style={styles.loadingRow}>
                  <span style={styles.spinner} /> Generating...
                </span>
              ) : (
                `Generate ${LABELS[outputType]}`
              )}
            </button>
          </form>
        </div>

        {/* Past sessions */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Recent sessions</h2>
          {chats.length === 0 && page === 0 && (
            <p style={styles.empty}>No sessions yet. Upload a file to get started.</p>
          )}
          <div style={styles.sessionList}>
            {chats.map((chat) => {
              const confirming = confirmId === chat.id
              return (
                <div
                  key={chat.id}
                  style={confirming ? { ...styles.sessionCard, ...styles.sessionCardConfirm } : styles.sessionCard}
                  onClick={() => !confirming && navigate(`/chat/${chat.id}`)}
                  onMouseEnter={(e) => !confirming && Object.assign(e.currentTarget.style, styles.sessionCardHover)}
                  onMouseLeave={(e) => !confirming && Object.assign(e.currentTarget.style, styles.sessionCard)}
                >
                  <span style={styles.sessionIcon}>{getSourceIcon(chat.sourceType)}</span>
                  <div style={styles.sessionInfo}>
                    <p style={styles.sessionTitle}>{chat.title}</p>
                    <p style={styles.sessionMeta}>{chat.sourceType}</p>
                  </div>
                  {confirming ? (
                    <div style={styles.confirmRow} onClick={(e) => e.stopPropagation()}>
                      <span style={styles.confirmLabel}>Delete?</span>
                      <button style={styles.confirmBtn} onClick={(e) => handleDelete(e, chat)}>Yes</button>
                      <button style={styles.cancelBtn} onClick={() => setConfirmId(null)}>No</button>
                    </div>
                  ) : (
                    <button
                      style={styles.deleteBtn}
                      onClick={(e) => { e.stopPropagation(); setConfirmId(chat.id) }}
                      title="Delete session"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {(hasPrev || hasNext) && (
            <div style={styles.pagination}>
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={!hasPrev}
                style={{ ...styles.pageBtn, ...(!hasPrev ? styles.pageBtnDisabled : {}) }}
              >
                ← Prev
              </button>
              <span style={styles.pageNum}>Page {page + 1}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!hasNext}
                style={{ ...styles.pageBtn, ...(!hasNext ? styles.pageBtnDisabled : {}) }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f0f0f',
    padding: '40px 16px 80px',
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    textAlign: 'left',
  },
  logoutBtn: {
    flexShrink: 0,
    padding: '6px 14px',
    borderRadius: '999px',
    border: '1px solid #2a2a2a',
    background: 'transparent',
    color: '#666',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '32px',
    fontWeight: 700,
    letterSpacing: '-0.5px',
    color: '#fff',
  },
  subtitle: {
    margin: 0,
    fontSize: '15px',
    color: '#888',
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  pillRow: {
    display: 'flex',
    gap: '8px',
  },
  pill: {
    padding: '8px 18px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  pillActive: {
    background: '#6366f1',
    color: '#fff',
  },
  pillInactive: {
    background: '#2a2a2a',
    color: '#aaa',
  },
  dropZone: {
    border: '2px dashed #2e2e2e',
    borderRadius: '12px',
    padding: '32px 24px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZoneActive: {
    borderColor: '#6366f1',
    background: 'rgba(99, 102, 241, 0.06)',
  },
  dropZoneSelected: {
    borderColor: '#3f3f3f',
    borderStyle: 'solid',
  },
  dropPrompt: {
    textAlign: 'center',
    pointerEvents: 'none',
  },
  uploadIcon: {
    fontSize: '28px',
    display: 'block',
    marginBottom: '8px',
    color: '#555',
  },
  dropText: {
    margin: '0 0 4px',
    fontSize: '14px',
    color: '#ccc',
  },
  dropHint: {
    margin: 0,
    fontSize: '12px',
    color: '#555',
  },
  filePreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    width: '100%',
  },
  fileIcon: {
    fontSize: '28px',
    flexShrink: 0,
  },
  fileName: {
    margin: '0 0 2px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#e8e8e8',
    wordBreak: 'break-all',
  },
  fileSize: {
    margin: 0,
    fontSize: '12px',
    color: '#666',
  },
  error: {
    margin: '4px 0 0',
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '13px',
  },
  generateBtn: {
    width: '100%',
    padding: '13px',
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  generateBtnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  empty: {
    margin: 0,
    color: '#555',
    fontSize: '14px',
  },
  sessionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sessionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  sessionCardHover: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    background: '#212121',
    border: '1px solid #3a3a3a',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  sessionIcon: {
    fontSize: '22px',
    flexShrink: 0,
  },
  sessionInfo: {
    flex: 1,
    minWidth: 0,
  },
  sessionTitle: {
    margin: '0 0 2px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sessionMeta: {
    margin: 0,
    fontSize: '12px',
    color: '#555',
  },
  sessionArrow: {
    color: '#444',
    fontSize: '16px',
    flexShrink: 0,
  },
  sessionCardConfirm: {
    background: 'rgba(239,68,68,0.06)',
    borderColor: 'rgba(239,68,68,0.25)',
    cursor: 'default',
  },
  deleteBtn: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    color: '#444',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: '6px',
    lineHeight: 1,
    transition: 'color 0.15s',
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  confirmLabel: {
    fontSize: '13px',
    color: '#f87171',
    fontWeight: 500,
  },
  confirmBtn: {
    padding: '4px 10px',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '6px',
    color: '#f87171',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '4px 10px',
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    color: '#888',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '8px',
  },
  pageBtn: {
    padding: '6px 14px',
    borderRadius: '999px',
    border: '1px solid #2a2a2a',
    background: '#1a1a1a',
    color: '#aaa',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  pageBtnDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  pageNum: {
    fontSize: '13px',
    color: '#555',
  },
}
