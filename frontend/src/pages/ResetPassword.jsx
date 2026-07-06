import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { api } from '../api/client.js'
import PasswordStrength, { validatePassword } from '../components/PasswordStrength.jsx'

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Neues Passwort</h1>
        </div>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 rounded-xl p-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Neues Passwort</label>
            <input
              type="password" required
              className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-orange-400"
              value={password} onChange={e => setPassword(e.target.value)}
            />
            <PasswordStrength password={password} />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-orange-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
            {loading ? 'Speichern…' : 'Passwort speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
