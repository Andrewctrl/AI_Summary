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
        <div style={styles.logoArea}>
          <div style={styles.logo}>Cramly</div>
          <p style={styles.logoTagline}>Turn any file into study material! 📚</p>
        </div>
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
      .catch((err) => setError(err.body?.message || 'Something went wrong. Please try again.'))
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.formHeader}>
        <h2 style={styles.heading}>Welcome back</h2>
        <p style={styles.subheading}>
          Drop your email below and we'll send a sign-in code straight to your inbox — no password needed.
        </p>
      </div>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Email address</label>
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          style={styles.input}
        />
      </div>
      {error && <p style={styles.error}>{error}</p>}
      <button type="submit" style={styles.btn}>Send me a code</button>
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
        setError(err.body?.message || 'That code didn\'t work. Please try again.')
      })
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.formHeader}>
        <h2 style={styles.heading}>Check your inbox</h2>
        <p style={styles.subheading}>
          We sent a 6-digit code to <strong style={{ color: '#3D405B' }}>{sentEmail}</strong>. It should arrive in a few seconds.
        </p>
      </div>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Sign-in code</label>
        <input
          name="code"
          type="text"
          inputMode="numeric"
          placeholder="000000"
          required
          autoComplete="one-time-code"
          style={{ ...styles.input, letterSpacing: '0.2em', fontSize: '20px', textAlign: 'center' }}
        />
      </div>
      {error && <p style={styles.error}>{error}</p>}
      <button type="submit" style={styles.btn}>Sign me in</button>
    </form>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #E8EAF6 0%, #E3F2FD 50%, #FFF8E8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: '#FFFFFF',
    borderRadius: '24px',
    padding: '40px 36px',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    boxShadow: '0 4px 40px rgba(100, 110, 180, 0.12)',
  },
  logoArea: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  logo: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#3D405B',
    letterSpacing: '-0.3px',
  },
  logoTagline: {
    margin: 0,
    fontSize: '13px',
    color: '#9199B0',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  heading: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    color: '#3D405B',
    letterSpacing: '-0.2px',
  },
  subheading: {
    margin: 0,
    fontSize: '14px',
    color: '#7B8099',
    lineHeight: 1.6,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#5C6070',
  },
  input: {
    padding: '12px 14px',
    background: '#F5F6FA',
    border: '1.5px solid #DDE0F0',
    borderRadius: '10px',
    color: '#3D405B',
    fontSize: '15px',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  },
  error: {
    margin: 0,
    padding: '10px 14px',
    background: 'rgba(239, 100, 100, 0.08)',
    border: '1px solid rgba(239, 100, 100, 0.2)',
    borderRadius: '8px',
    color: '#C0392B',
    fontSize: '13px',
  },
  btn: {
    width: '100%',
    padding: '13px',
    background: '#7986CB',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '4px',
    transition: 'background 0.15s',
    letterSpacing: '0.01em',
  },
}
