import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import Button from '../components/ui/Button.jsx'

const inputCls = 'w-full border border-outline rounded-control px-3 py-2.5 text-sm bg-surface-container-high text-ink focus:outline-hidden focus:ring-2 focus:ring-primary'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.post('/auth/login', form)
      login(data.token, data.user)
      navigate(data.user.mustChangePassword ? '/change-password' : '/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <main className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-ink">Haushalt</h1>
          <p className="text-ink-muted text-sm mt-1">Anmelden</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-surface-container rounded-card border border-outline p-6 space-y-4">
          {error && <div className="bg-danger-container border border-danger text-on-danger-container rounded-card p-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm text-ink-muted mb-1">E-Mail</label>
            <input
              type="email" required autoComplete="email"
              className={inputCls}
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-ink-muted mb-1">Passwort</label>
            <input
              type="password" required autoComplete="current-password"
              className={inputCls}
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
            {loading ? 'Anmelden…' : 'Anmelden'}
          </Button>
          <div className="text-center text-sm text-ink-muted space-y-1 pt-1">
            <div><Link to="/forgot-password" className="text-primary">Passwort vergessen?</Link></div>
            <div>Noch kein Account? <Link to="/register" className="text-primary">Registrieren</Link></div>
          </div>
        </form>
      </main>
    </div>
  )
}
