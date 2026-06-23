import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 text-center">
          <p className="text-gray-700 text-sm">Falls die E-Mail-Adresse registriert ist, hast du einen Link zum Zurücksetzen des Passworts erhalten.</p>
          <Link to="/login" className="mt-4 inline-block text-purple-600 text-sm">Zur Anmeldung</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold">Passwort vergessen</h1>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">E-Mail</label>
            <input
              type="email" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-purple-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
            {loading ? 'Senden…' : 'Link senden'}
          </button>
          <div className="text-center"><Link to="/login" className="text-sm text-purple-600">Zurück zur Anmeldung</Link></div>
        </form>
      </div>
    </div>
  )
}
