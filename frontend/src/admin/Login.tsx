import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { useAuth } from './auth'
import { Logo } from './Shell'

export default function Login() {
  const { me, login } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const from = (loc.state as { from?: string } | null)?.from ?? '/'

  if (me) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    setPending(true)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="login min-h-screen">
      <div className="login-glow" aria-hidden />
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <Logo />
        <div>
          <h1 className="login-title">Sign in</h1>
          <p className="muted">Read what your guests said today, branch by branch.</p>
        </div>
        <Field label="Username">
          <input
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Password" error={error}>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button variant="primary" type="submit" pending={pending} disabled={!username || !password}>
          Sign in
        </Button>
      </form>
    </main>
  )
}
