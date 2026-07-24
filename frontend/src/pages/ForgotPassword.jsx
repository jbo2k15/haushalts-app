import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client.js'
import Button from '../components/ui/Button.jsx'

const inputCls = 'w-full border border-outline rounded-control px-3 py-2.5 text-sm bg-surface-container-high text-ink focus:outline-hidden focus:ring-2 focus:ring-primary'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try { await api.post('/auth/forgot-password', { email }) } catch {}
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <main className="w-full max-w-sm bg-surface-container rounded-card border border-outline p-6 text-center">
          <p className="text-ink text-sm">Falls die E-Mail-Adresse registriert ist, hast du einen Link zum Zurücksetzen des Passworts erhalten.</p>
          <Link to="/login" className="mt-4 inline-block text-primary text-sm">Zur Anmeldung</Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <main className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-ink">Passwort vergessen</h1>
        </div>
        <form onSubmit={handleSubmit} className="bg-surface-container rounded-card border border-outline p-6 space-y-4">
          <div>
            <label className="block text-sm text-ink-muted mb-1">E-Mail</label>
            <input
              type="email" required
              className={inputCls}
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
            {loading ? 'Senden…' : 'Link senden'}
          </Button>
          <div className="text-center"><Link to="/login" className="text-sm text-primary">Zurück zur Anmeldung</Link></div>
        </form>
      </main>
    </div>
  )
}
