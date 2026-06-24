import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

export default function Settings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [settings, setSettings] = useState({ dailyTime: '21:00', weeklyDay: 6, weeklyTime: '09:00' })
  const [globalSettings, setGlobalSettings] = useState(null)
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    setPushSupported('serviceWorker' in navigator && 'PushManager' in window)
    api.get('/users/notifications').then(data => {
      if (data.user) setSettings(data.user)
      else if (data.global) setSettings(data.global)
      if (data.global) setGlobalSettings(data.global)
    }).catch(() => {})

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => setPushEnabled(!!sub))
      })
    }
  }, [])

  async function togglePush() {
    const reg = await navigator.serviceWorker.ready
    if (pushEnabled) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await api.delete('/users/push-subscription', { endpoint: sub.endpoint })
      }
      setPushEnabled(false)
    } else {
      const keyData = await api.get('/vapid-public-key')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.key),
      })
      const json = sub.toJSON()
      await api.post('/users/push-subscription', { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
      setPushEnabled(true)
    }
  }

  async function saveName() {
    setNameError('')
    try {
      const updated = await api.put('/users/me', { name })
      setUser(updated)
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2000)
    } catch (err) {
      setNameError(err.message)
    }
  }

  async function saveSettings() {
    await api.put('/users/notifications', settings)
    if (user.role === 'admin') await api.put('/users/notifications/global', settings)
    setSaved(true)
    setTimeout(() => navigate('/'), 1000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <div className="flex items-center gap-3 py-4">
          <button onClick={() => navigate('/')} className="text-purple-600 text-sm">← Zurück</button>
          <h1 className="text-xl font-semibold">Einstellungen</h1>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
            <h2 className="font-medium text-gray-800">Mein Profil</h2>
            {nameError && <p className="text-sm text-red-600">{nameError}</p>}
            <div>
              <label className="block text-sm text-gray-600 mb-1">E-Mail</label>
              <p className="text-sm text-gray-500 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Anzeigename</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <button onClick={saveName} className="bg-purple-600 text-white rounded-xl px-4 py-2 text-sm font-medium">
              {nameSaved ? 'Gespeichert ✓' : 'Name speichern'}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
            <h2 className="font-medium text-gray-800">Push-Benachrichtigungen</h2>
            {!pushSupported ? (
              <p className="text-sm text-gray-400">Dein Browser unterstützt keine Push-Benachrichtigungen.</p>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Auf diesem Gerät aktivieren</span>
                <button
                  onClick={togglePush}
                  className={`w-11 h-6 rounded-full transition-colors ${pushEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${pushEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
            <h2 className="font-medium text-gray-800">Erinnerungszeiten {user.role === 'admin' && <span className="text-xs text-gray-400 font-normal">(gilt für alle)</span>}</h2>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Tägliche Erinnerung um</label>
              <input
                type="time"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={settings.dailyTime}
                onChange={e => setSettings(s => ({ ...s, dailyTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Wöchentliche Erinnerung am</label>
              <div className="flex gap-2">
                <select
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={settings.weeklyDay}
                  onChange={e => setSettings(s => ({ ...s, weeklyDay: Number(e.target.value) }))}
                >
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <input
                  type="time"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={settings.weeklyTime}
                  onChange={e => setSettings(s => ({ ...s, weeklyTime: e.target.value }))}
                />
              </div>
            </div>
            <button
              onClick={saveSettings}
              className="bg-purple-600 text-white rounded-xl px-4 py-2 text-sm font-medium"
            >
              {saved ? 'Gespeichert ✓' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}
