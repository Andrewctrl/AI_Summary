import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { db } from '../db'

export default function Login() {
  const { user } = db.useAuth()
  const [sentEmail, setSentEmail] = useState('')

  if (user) return <Navigate to="/" replace />

  return sentEmail ? (
    <CodeStep sentEmail={sentEmail} />
  ) : (
    <EmailStep onSendEmail={setSentEmail} />
  )
}

function EmailStep({ onSendEmail }) {
  const handleSubmit = (e) => {
    e.preventDefault()
    const email = e.target.email.value
    db.auth.sendMagicCode({ email })
      .then(() => onSendEmail(email))
      .catch((err) => alert('Uh oh: ' + err.body?.message))
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Sign in</h2>
      <input name="email" type="email" placeholder="Enter your email" required />
      <button type="submit">Send code</button>
    </form>
  )
}

function CodeStep({ sentEmail }) {
  const handleSubmit = (e) => {
    e.preventDefault()
    const code = e.target.code.value
    db.auth.signInWithMagicCode({ email: sentEmail, code })
      .catch((err) => {
        e.target.code.value = ''
        alert('Uh oh: ' + err.body?.message)
      })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Check your email</h2>
      <p>We sent a code to <strong>{sentEmail}</strong></p>
      <input name="code" type="text" placeholder="Enter code" required />
      <button type="submit">Verify</button>
    </form>
  )
}
