import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { api } from '../api/client.js'
import PasswordStrength, { validatePassword } from '../components/PasswordStrength.jsx'
import Button from '../components/ui/Button.jsx'

const inputCls = 'w-full border border-outline rounded-control px-3 py-2.5 text-sm bg-surface-container-high text-ink focus:outline-hidden focus:ring-2 focus:ring-primary'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validatePassword(password)) {
      setError('Das Passwort erfüllt nicht alle Anforderungen.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token: params.get('token'), newPassword: password })
      navigate('/login')
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
          <h1 className="text-2xl font-semibold text-ink">Neues Passwort</h1>
        </div>
        <form onSubmit={handleSubmit} className="bg-surface-container rounded-card border border-outline p-6 space-y-4">
          {error && <div className="bg-danger-container border border-danger text-on-danger-container rounded-card p-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm text-ink-muted mb-1">Neues Passwort</label>
            <input
              type="password" required
              className={inputCls}
              value={password} onChange={e => setPassword(e.target.value)}
            />
            <PasswordStrength password={password} />
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
            {loading ? 'Speichern…' : 'Passwort speichern'}
          </Button>
        </form>
      </main>
    </div>
  )
}
