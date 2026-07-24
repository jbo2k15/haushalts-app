import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client.js'
import PasswordStrength, { validatePassword } from '../components/PasswordStrength.jsx'
import Button from '../components/ui/Button.jsx'

const inputCls = 'w-full border border-outline rounded-control px-3 py-2.5 text-sm bg-surface-container-high text-ink focus:outline-hidden focus:ring-2 focus:ring-primary'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', website: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const passwordOk = validatePassword(form.password)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!passwordOk) return
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/register', form)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <main className="w-full max-w-sm text-center">
          <div className="bg-surface-container rounded-card border border-outline p-6">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-lg font-medium text-ink mb-2">Registrierung erfolgreich</h2>
            <p className="text-ink-muted text-sm">Dein Account wurde angelegt und wartet auf Freischaltung durch einen Admin. Du wirst per E-Mail benachrichtigt.</p>
            <Link to="/login" className="mt-4 inline-block text-primary text-sm">Zur Anmeldung</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <main className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-ink">Haushalt</h1>
          <p className="text-ink-muted text-sm mt-1">Neuen Account erstellen</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-surface-container rounded-card border border-outline p-6 space-y-4">
          {error && <div className="bg-danger-container border border-danger text-on-danger-container rounded-card p-3 text-sm">{error}</div>}
          {/* Honeypot: verstecktes Feld gegen einfache Bots, für Menschen unsichtbar */}
          <div className="absolute left-[-9999px]" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off"
              value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-ink-muted mb-1">Name</label>
            <input type="text" required className={inputCls}
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-ink-muted mb-1">E-Mail</label>
            <input type="email" required className={inputCls}
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-ink-muted mb-1">Passwort</label>
            <input type="password" required className={inputCls}
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <PasswordStrength password={form.password} />
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={loading || !passwordOk} className="w-full">
            {loading ? 'Registrieren…' : 'Registrieren'}
          </Button>
          <div className="text-center text-sm text-ink-muted">
            Bereits registriert? <Link to="/login" className="text-primary">Anmelden</Link>
          </div>
        </form>
      </main>
    </div>
  )
}
