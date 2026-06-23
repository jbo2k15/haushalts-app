import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-lg font-medium mb-2">Registrierung erfolgreich</h2>
            <p className="text-gray-500 text-sm">Dein Account wurde angelegt und wartet auf Freischaltung durch einen Admin. Du wirst per E-Mail benachrichtigt.</p>
            <Link to="/login" className="mt-4 inline-block text-purple-600 text-sm">Zur Anmeldung</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Haushalt</h1>
          <p className="text-gray-500 text-sm mt-1">Neuen Account erstellen</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Name</label>
            <input
              type="text" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">E-Mail</label>
            <input
              type="email" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Passwort (min. 6 Zeichen)</label>
            <input
              type="password" required minLength={6}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-purple-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Registrieren…' : 'Registrieren'}
          </button>
          <div className="text-center text-sm text-gray-500">
            Bereits registriert? <Link to="/login" className="text-purple-600">Anmelden</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
