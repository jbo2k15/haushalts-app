import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import PasswordStrength, { validatePassword } from '../components/PasswordStrength.jsx'

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold">Passwort ändern</h1>
          <p className="text-gray-500 text-sm mt-1">Bitte ändere dein Passwort vor der ersten Nutzung.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            Das Passwort muss mindestens 10 Zeichen lang sein und Groß- und Kleinbuchstaben, eine Zahl sowie ein Sonderzeichen enthalten.
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Aktuelles Passwort</label>
            <input
              type="password" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Neues Passwort</label>
            <input
              type="password" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
            />
            <PasswordStrength password={form.newPassword} />
          </div>
          <button
            type="submit"
            disabled={loading || !passwordOk}
            className="w-full bg-purple-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Speichern…' : 'Passwort speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
