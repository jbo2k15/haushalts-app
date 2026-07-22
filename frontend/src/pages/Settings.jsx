import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useZoom, ZOOM_LEVELS, DEFAULT_ZOOM } from '../context/ZoomContext.jsx'
import { urlBase64ToUint8Array } from '../lib/push.js'
import HeaderMenu from '../components/HeaderMenu.jsx'
import { HIDE_EXIT_CONFIRM_KEY } from '../components/ExitConfirmModal.jsx'

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: '💻' },
  { value: 'light',  label: 'Hell',   icon: '☀️' },
  { value: 'dark',   label: 'Dunkel', icon: '🌙' },
]

export default function Settings() {
  const { user, setUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const { zoom, increaseZoom, decreaseZoom, resetZoom } = useZoom()
  const navigate = useNavigate()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [settings, setSettings] = useState({ dailyTime: '21:00', weeklyDay: 6, weeklyTime: '09:00', monthlyDay: 1, monthlyTime: '09:00' })
  const [globalSettings, setGlobalSettings] = useState(null)
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState('')
  const [vacationMode, setVacationMode] = useState(user?.vacationMode || false)
  const [weatherNotify, setWeatherNotify] = useState(user?.notifyOnWeatherSkip ?? true)
  const [exitConfirmEnabled, setExitConfirmEnabled] = useState(() => localStorage.getItem(HIDE_EXIT_CONFIRM_KEY) !== 'true')

  useEffect(() => {
    setPushSupported('serviceWorker' in navigator && 'PushManager' in window)
    api.get('/users/notifications').then(data => {
      if (data.user) setSettings(data.user)
      else if (data.global) setSettings(data.global)
      if (data.global) setGlobalSettings(data.global)
    }).catch(() => {})

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(async reg => {
        const sub = await reg.pushManager.getSubscription()
        if (!sub) return setPushEnabled(false)
        // The browser keeps a subscription regardless of whether the server
        // still recognizes it (e.g. after a VAPID key rotation) - confirm
        // with the backend so the toggle reflects reality.
        try {
          const { exists } = await api.get(`/users/push-subscription?endpoint=${encodeURIComponent(sub.endpoint)}`)
          setPushEnabled(exists)
        } catch {
          setPushEnabled(true)
        }
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
      // A stale subscription from before a VAPID key rotation can still be
      // present even though pushEnabled reads false server-side - browsers
      // refuse to subscribe() with a new applicationServerKey while one is
      // already active, so drop it first.
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
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

  async function toggleVacation() {
    try {
      const updated = await api.put('/users/me/vacation', { vacationMode: !vacationMode })
      setVacationMode(updated.vacationMode)
      setUser(updated)
    } catch {}
  }

  function toggleExitConfirm() {
    const next = !exitConfirmEnabled
    setExitConfirmEnabled(next)
    if (next) localStorage.removeItem(HIDE_EXIT_CONFIRM_KEY)
    else localStorage.setItem(HIDE_EXIT_CONFIRM_KEY, 'true')
  }

  async function toggleWeatherNotify() {
    try {
      const updated = await api.put('/users/me/weather-notifications', { enabled: !weatherNotify })
      setWeatherNotify(updated.notifyOnWeatherSkip)
      setUser(updated)
    } catch {}
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
    try {
      await api.put('/users/notifications', settings)
      if (user.role === 'admin') await api.put('/users/notifications/global', settings)
      setSaved(true)
      setTimeout(() => navigate('/'), 1000)
    } catch {}
  }

  const inputCls = 'border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-orange-400'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <div className="flex items-center justify-between py-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Einstellungen</h1>
          <HeaderMenu />
        </div>

        <div className="space-y-4">

          {/* Erscheinungsbild */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <h2 className="font-medium text-gray-800 dark:text-gray-200">Erscheinungsbild</h2>
            <div className="flex gap-2">
              {THEME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  data-testid={`theme-${opt.value}`}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                    theme === opt.value
                      ? 'bg-orange-600 border-orange-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-orange-300 dark:hover:border-orange-600'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Zoom</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={decreaseZoom}
                  disabled={zoom === ZOOM_LEVELS[0]}
                  data-testid="zoom-decrease"
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium disabled:opacity-40"
                >
                  −
                </button>
                <span data-testid="zoom-level" className="text-sm font-medium text-gray-800 dark:text-gray-200 w-12 text-center">{zoom}%</span>
                <button
                  type="button"
                  onClick={increaseZoom}
                  disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                  data-testid="zoom-increase"
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
            {zoom !== DEFAULT_ZOOM && (
              <button type="button" onClick={resetZoom} data-testid="zoom-reset" className="text-xs text-orange-600 dark:text-orange-400 hover:underline">
                Auf Standardgröße zurücksetzen
              </button>
            )}
          </div>

          {/* Profil */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h2 className="font-medium text-gray-800 dark:text-gray-200">Mein Profil</h2>
            {nameError && <p className="text-sm text-red-600 dark:text-red-400">{nameError}</p>}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">E-Mail</label>
              <p className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Anzeigename</label>
              <input
                type="text"
                data-testid="name-input"
                className={`w-full ${inputCls}`}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <button onClick={saveName} data-testid="save-name" className="bg-orange-600 text-white rounded-xl px-4 py-2 text-sm font-medium">
              {nameSaved ? 'Gespeichert ✓' : 'Name speichern'}
            </button>
          </div>

          {/* Push */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h2 className="font-medium text-gray-800 dark:text-gray-200">Push-Benachrichtigungen</h2>
            {!pushSupported ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Dein Browser unterstützt keine Push-Benachrichtigungen.</p>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Auf diesem Gerät aktivieren</span>
                <button
                  onClick={togglePush}
                  className={`w-11 h-6 rounded-full transition-colors ${pushEnabled ? 'bg-orange-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${pushEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            )}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-between">
              <div className="pr-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">Wetterbedingt erledigte Aufgaben</span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Benachrichtigt dich, wenn eine Aufgabe wegen Regen automatisch erledigt wurde.</p>
              </div>
              <button
                onClick={toggleWeatherNotify}
                data-testid="weather-notify-toggle"
                data-weather-notify-enabled={weatherNotify}
                className={`shrink-0 w-11 h-6 rounded-full transition-colors ${weatherNotify ? 'bg-orange-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${weatherNotify ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Urlaub */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <h2 className="font-medium text-gray-800 dark:text-gray-200">Urlaubsmodus</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Im Urlaubsmodus erhältst du keine Push-Benachrichtigungen.</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Aktivieren</span>
              <button
                onClick={toggleVacation}
                data-testid="vacation-toggle"
                data-vacation-enabled={vacationMode}
                className={`w-11 h-6 rounded-full transition-colors ${vacationMode ? 'bg-orange-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${vacationMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <h2 className="font-medium text-gray-800 dark:text-gray-200">Navigation</h2>
            <div className="flex items-center justify-between">
              <div className="pr-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">Bestätigung beim Schließen der App</span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Fragt nach, bevor ein Zurück-Tastendruck auf der Startseite die App verlässt.</p>
              </div>
              <button
                onClick={toggleExitConfirm}
                data-testid="exit-confirm-toggle"
                data-exit-confirm-enabled={exitConfirmEnabled}
                className={`shrink-0 w-11 h-6 rounded-full transition-colors ${exitConfirmEnabled ? 'bg-orange-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${exitConfirmEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Erinnerungszeiten */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h2 className="font-medium text-gray-800 dark:text-gray-200">Erinnerungszeiten {user.role === 'admin' && <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">(gilt für alle)</span>}</h2>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Tägliche Erinnerung um</label>
              <input
                type="time"
                data-testid="daily-time"
                className={inputCls}
                value={settings.dailyTime}
                onChange={e => setSettings(s => ({ ...s, dailyTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Wöchentliche Erinnerung am</label>
              <div className="flex gap-2">
                <select
                  data-testid="weekly-day"
                  className={inputCls}
                  value={settings.weeklyDay}
                  onChange={e => setSettings(s => ({ ...s, weeklyDay: Number(e.target.value) }))}
                >
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <input
                  type="time"
                  data-testid="weekly-time"
                  className={inputCls}
                  value={settings.weeklyTime}
                  onChange={e => setSettings(s => ({ ...s, weeklyTime: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Monatliche Erinnerung am</label>
              <div className="flex gap-2">
                <select
                  data-testid="monthly-day"
                  className={inputCls}
                  value={settings.monthlyDay}
                  onChange={e => setSettings(s => ({ ...s, monthlyDay: Number(e.target.value) }))}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}.</option>)}
                </select>
                <input
                  type="time"
                  data-testid="monthly-time"
                  className={inputCls}
                  value={settings.monthlyTime}
                  onChange={e => setSettings(s => ({ ...s, monthlyTime: e.target.value }))}
                />
              </div>
            </div>
            <button
              onClick={saveSettings}
              data-testid="save-notification-settings"
              className="bg-orange-600 text-white rounded-xl px-4 py-2 text-sm font-medium"
            >
              {saved ? 'Gespeichert ✓' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
