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
        limit: 6,
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
            <h1 style={styles.title}>🧠 Cramly</h1>
            <p style={styles.subtitle}>Turn any file into something you can actually study</p>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>Log out</button>
        </div>

        {/* Upload card */}
        <div style={styles.card}>
          <form onSubmit={handleSubmit} style={styles.form}>
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
    background: 'linear-gradient(160deg, #E8EAF6 0%, #E3F2FD 50%, #FFF8E8 100%)',
    padding: '40px 16px 80px',
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  logoutBtn: {
    flexShrink: 0,
    padding: '7px 16px',
    borderRadius: '999px',
    border: '1.5px solid #C5CAE9',
    background: 'transparent',
    color: '#7986CB',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  title: {
    margin: '0 0 4px',
    fontSize: '30px',
    fontWeight: 700,
    color: '#3D405B',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#7B8099',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 4px 24px rgba(100,110,180,0.10)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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
    fontWeight: 600,
    transition: 'all 0.15s',
  },
  pillActive: {
    background: '#7986CB',
    color: '#fff',
  },
  pillInactive: {
    background: '#EEF0FB',
    color: '#7B8099',
  },
  dropZone: {
    border: '2px dashed #C5CAE9',
    borderRadius: '12px',
    padding: '32px 24px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FAFBFF',
  },
  dropZoneActive: {
    borderColor: '#7986CB',
    background: 'rgba(121,134,203,0.06)',
  },
  dropZoneSelected: {
    borderColor: '#9FA8DA',
    borderStyle: 'solid',
    background: '#FAFBFF',
  },
  dropPrompt: {
    textAlign: 'center',
    pointerEvents: 'none',
  },
  uploadIcon: {
    fontSize: '28px',
    display: 'block',
    marginBottom: '8px',
    color: '#9FA8DA',
  },
  dropText: {
    margin: '0 0 4px',
    fontSize: '14px',
    color: '#3D405B',
    fontWeight: 500,
  },
  dropHint: {
    margin: 0,
    fontSize: '12px',
    color: '#9FA8DA',
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
    fontWeight: 600,
    color: '#3D405B',
    wordBreak: 'break-all',
  },
  fileSize: {
    margin: 0,
    fontSize: '12px',
    color: '#9FA8DA',
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
  generateBtn: {
    width: '100%',
    padding: '13px',
    background: '#7986CB',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    letterSpacing: '0.01em',
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
    border: '2px solid rgba(255,255,255,0.35)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '12px',
    fontWeight: 700,
    color: '#9FA8DA',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  empty: {
    margin: 0,
    color: '#9FA8DA',
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
    background: '#FFFFFF',
    border: '1.5px solid #E8EAF6',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: '0 2px 8px rgba(100,110,180,0.06)',
  },
  sessionCardHover: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    background: '#FFFFFF',
    border: '1.5px solid #9FA8DA',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 16px rgba(100,110,180,0.12)',
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
    fontWeight: 600,
    color: '#3D405B',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sessionMeta: {
    margin: 0,
    fontSize: '12px',
    color: '#9FA8DA',
  },
  sessionCardConfirm: {
    background: 'rgba(239,100,100,0.05)',
    borderColor: 'rgba(239,100,100,0.25)',
    cursor: 'default',
    boxShadow: 'none',
  },
  deleteBtn: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    color: '#C5CAE9',
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
    color: '#C0392B',
    fontWeight: 600,
  },
  confirmBtn: {
    padding: '4px 10px',
    background: 'rgba(239,100,100,0.1)',
    border: '1px solid rgba(239,100,100,0.25)',
    borderRadius: '6px',
    color: '#C0392B',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '4px 10px',
    background: '#EEF0FB',
    border: '1px solid #C5CAE9',
    borderRadius: '6px',
    color: '#7B8099',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '4px',
  },
  pageBtn: {
    padding: '6px 16px',
    borderRadius: '999px',
    border: '1.5px solid #C5CAE9',
    background: '#FFFFFF',
    color: '#7986CB',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  pageBtnDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  pageNum: {
    fontSize: '13px',
    color: '#9FA8DA',
    fontWeight: 500,
  },
}
