import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { db } from '../db'

export default function Login() {
  const { user } = db.useAuth()
  const [sentEmail, setSentEmail] = useState('')

  if (user) return <Navigate to="/" replace />

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>Notes AI</div>
        {sentEmail
          ? <CodeStep sentEmail={sentEmail} />
          : <EmailStep onSendEmail={setSentEmail} />
        }
      </div>
    </div>
  )
}

function EmailStep({ onSendEmail }) {
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const email = e.target.email.value
    db.auth.sendMagicCode({ email })
      .then(() => onSendEmail(email))
      .catch((err) => setError(err.body?.message || 'Something went wrong.'))
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.formHeader}>
        <h2 style={styles.heading}>Sign in</h2>
        <p style={styles.subheading}>Enter your email to receive a sign-in code</p>
      </div>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Email</label>
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          style={styles.input}
        />
      </div>
      {error && <p style={styles.error}>{error}</p>}
      <button type="submit" style={styles.btn}>Send code</button>
    </form>
  )
}

function CodeStep({ sentEmail }) {
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const code = e.target.code.value
    db.auth.signInWithMagicCode({ email: sentEmail, code })
      .catch((err) => {
        e.target.code.value = ''
        setError(err.body?.message || 'Invalid code. Please try again.')
      })
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.formHeader}>
        <h2 style={styles.heading}>Check your email</h2>
        <p style={styles.subheading}>
          We sent a code to <strong style={{ color: '#e0e0e0' }}>{sentEmail}</strong>
        </p>
      </div>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Code</label>
        <input
          name="code"
          type="text"
          placeholder="Enter 6-digit code"
          required
          autoComplete="one-time-code"
          style={{ ...styles.input, letterSpacing: '0.15em', fontSize: '18px' }}
        />
      </div>
      {error && <p style={styles.error}>{error}</p>}
      <button type="submit" style={styles.btn}>Verify</button>
    </form>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f0f0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '20px',
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  logo: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.3px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  heading: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff',
  },
  subheading: {
    margin: 0,
    fontSize: '13px',
    color: '#777',
    lineHeight: 1.5,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#888',
  },
  input: {
    padding: '11px 14px',
    background: '#111',
    border: '1px solid #2e2e2e',
    borderRadius: '8px',
    color: '#e8e8e8',
    fontSize: '15px',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
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
  btn: {
    width: '100%',
    padding: '12px',
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '4px',
  },
}
