import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from './AuthContext'
import styles from './LoginPage.module.css'

/** Turns a sign-in failure into a message a person can act on. The API returns
 *  one generic "invalid email or password" for both a missing account and a
 *  wrong password on purpose (so it doesn't reveal which emails have accounts),
 *  so this keeps that combined rather than saying which. */
function signInErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'That email and password don’t match. Please check them and try again.'
    if (err.status === 429)
      return 'Too many attempts. Please wait a few minutes and try again.'
    if (err.status === 0) return 'Couldn’t reach the server. Check your connection and try again.'
    return err.detail ?? 'Something went wrong signing in. Please try again.'
  }
  return 'Something went wrong signing in. Please try again.'
}

export function LoginPage() {
  const { signIn, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Once signed in, leave the login screen for the app - also covers landing on
  // /login while already authenticated.
  if (user) return <Navigate to="/tanks" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(signInErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={onSubmit}>
        <div className={styles.brand}>
          <h1>Wild West Cider</h1>
          <p>Cellar office</p>
        </div>

        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
