import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import PasswordStrength, { validatePassword } from '../components/PasswordStrength.jsx'
import Button from '../components/ui/Button.jsx'

const inputCls = 'w-full border border-outline rounded-control px-3 py-2.5 text-sm bg-surface-container-high text-ink focus:outline-hidden focus:ring-2 focus:ring-primary'

export default function ChangePassword() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordOk = validatePassword(form.newPassword)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!passwordOk) return
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/change-password', form)
      setUser(u => ({ ...u, mustChangePassword: false }))
      navigate('/')
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
          <h1 className="text-2xl font-semibold text-ink">Passwort ändern</h1>
          <p className="text-ink-muted text-sm mt-1">Bitte ändere dein Passwort vor der ersten Nutzung.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-surface-container rounded-card border border-outline p-6 space-y-4">
          {error && <div className="bg-danger-container border border-danger text-on-danger-container rounded-card p-3 text-sm">{error}</div>}

          <div className="bg-info-container rounded-card p-3 text-xs text-on-info-container">
            Das Passwort muss mindestens 10 Zeichen lang sein und Groß- und Kleinbuchstaben, eine Zahl sowie ein Sonderzeichen enthalten.
          </div>

          <div>
            <label className="block text-sm text-ink-muted mb-1">Aktuelles Passwort</label>
            <input type="password" required className={inputCls}
              value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-ink-muted mb-1">Neues Passwort</label>
            <input type="password" required className={inputCls}
              value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} />
            <PasswordStrength password={form.newPassword} />
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={loading || !passwordOk} className="w-full">
            {loading ? 'Speichern…' : 'Passwort speichern'}
          </Button>
        </form>
      </main>
    </div>
  )
}
