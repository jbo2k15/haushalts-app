import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client.js'
import PasswordStrength, { validatePassword } from '../components/PasswordStrength.jsx'

const inputCls = 'w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-orange-400'

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Registrierung erfolgreich</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Dein Account wurde angelegt und wartet auf Freischaltung durch einen Admin. Du wirst per E-Mail benachrichtigt.</p>
            <Link to="/login" className="mt-4 inline-block text-orange-600 dark:text-orange-400 text-sm">Zur Anmeldung</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Haushalt</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Neuen Account erstellen</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 rounded-xl p-3 text-sm">{error}</div>}
          {/* Honeypot: verstecktes Feld gegen einfache Bots, für Menschen unsichtbar */}
          <div className="absolute left-[-9999px]" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off"
              value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Name</label>
            <input type="text" required className={inputCls}
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">E-Mail</label>
            <input type="email" required className={inputCls}
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Passwort</label>
            <input type="password" required className={inputCls}
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <PasswordStrength password={form.password} />
          </div>
          <button type="submit" disabled={loading || !passwordOk}
            className="w-full bg-orange-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
            {loading ? 'Registrieren…' : 'Registrieren'}
          </button>
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            Bereits registriert? <Link to="/login" className="text-orange-600 dark:text-orange-400">Anmelden</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
