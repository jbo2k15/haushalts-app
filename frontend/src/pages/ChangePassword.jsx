import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import PasswordStrength, { validatePassword } from '../components/PasswordStrength.jsx'

const inputCls = 'w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400'

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Passwort ändern</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Bitte ändere dein Passwort vor der ersten Nutzung.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 rounded-xl p-3 text-sm">{error}</div>}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-400">
            Das Passwort muss mindestens 10 Zeichen lang sein und Groß- und Kleinbuchstaben, eine Zahl sowie ein Sonderzeichen enthalten.
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Aktuelles Passwort</label>
            <input type="password" required className={inputCls}
              value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Neues Passwort</label>
            <input type="password" required className={inputCls}
              value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} />
            <PasswordStrength password={form.newPassword} />
          </div>
          <button type="submit" disabled={loading || !passwordOk}
            className="w-full bg-orange-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
            {loading ? 'Speichern…' : 'Passwort speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
