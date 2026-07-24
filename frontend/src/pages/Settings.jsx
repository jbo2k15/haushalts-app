import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useZoom, ZOOM_LEVELS, DEFAULT_ZOOM } from '../context/ZoomContext.jsx'
import { urlBase64ToUint8Array } from '../lib/push.js'
import HeaderMenu from '../components/HeaderMenu.jsx'
import { HIDE_EXIT_CONFIRM_KEY } from '../components/ExitConfirmModal.jsx'
import Card from '../components/ui/Card.jsx'
import Switch from '../components/ui/Switch.jsx'
import Button from '../components/ui/Button.jsx'
import UsersTab from '../components/admin/UsersTab.jsx'

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
  const [users, setUsers] = useState([])

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

  // Nutzerverwaltung ist seit dem IA-Umbau (siehe REDESIGN.md) hier statt in
  // der Verwaltung angesiedelt - nur für Admins geladen und angezeigt.
  useEffect(() => {
    if (user?.role !== 'admin') return
    loadUsers()
  }, [user?.role])

  async function loadUsers() {
    try { setUsers(await api.get('/users')) } catch {}
  }

  async function toggleUser(id) {
    const userRecord = users.find(u => u.id === id)
    if (userRecord?.approved) {
      if (!confirm(`Möchtest du "${userRecord.name}" wirklich sperren? Der Nutzer verliert sofort den Zugriff.`)) return
    }
    try {
      await api.post(`/users/${id}/approve`)
      loadUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  async function deleteUser(id) {
    const userRecord = users.find(u => u.id === id)
    if (!confirm(`Möchtest du "${userRecord.name}" (${userRecord.email}) wirklich dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return
    try {
      await api.delete(`/users/${id}`)
      loadUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  async function toggleRole(id) {
    const userRecord = users.find(u => u.id === id)
    const action = userRecord?.role === 'admin' ? 'zum normalen Nutzer machen' : 'zum Admin machen'
    if (!confirm(`Möchtest du "${userRecord.name}" wirklich ${action}?`)) return
    try {
      await api.post(`/users/${id}/role`)
      loadUsers()
    } catch (err) {
      alert(err.message)
    }
  }

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

  const inputCls = 'border border-outline rounded-control px-3 py-2 text-sm bg-surface-container-high text-ink focus:outline-hidden focus:ring-2 focus:ring-primary'

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <header className="flex items-center justify-between py-4">
          <h1 className="text-xl font-semibold text-ink">Einstellungen</h1>
          <HeaderMenu />
        </header>

        <main className="space-y-4">

          {/* Erscheinungsbild */}
          <Card className="p-4 space-y-3">
            <h2 className="font-medium text-ink">Erscheinungsbild</h2>
            <div className="flex gap-2">
              {THEME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  data-testid={`theme-${opt.value}`}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-control border text-xs font-medium transition-colors ${
                    theme === opt.value
                      ? 'bg-primary border-primary text-on-primary'
                      : 'bg-surface-container-high border-outline text-ink-muted hover:border-primary'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="border-t border-outline pt-3 flex items-center justify-between">
              <span className="text-sm text-ink-muted">Zoom</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={decreaseZoom}
                  disabled={zoom === ZOOM_LEVELS[0]}
                  data-testid="zoom-decrease"
                  className="w-11 h-11 flex items-center justify-center rounded-control border border-outline text-ink-muted font-medium disabled:opacity-40"
                >
                  −
                </button>
                <span data-testid="zoom-level" className="text-sm font-medium text-ink w-12 text-center">{zoom}%</span>
                <button
                  type="button"
                  onClick={increaseZoom}
                  disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                  data-testid="zoom-increase"
                  className="w-11 h-11 flex items-center justify-center rounded-control border border-outline text-ink-muted font-medium disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
            {zoom !== DEFAULT_ZOOM && (
              <button type="button" onClick={resetZoom} data-testid="zoom-reset" className="text-xs text-primary hover:underline">
                Auf Standardgröße zurücksetzen
              </button>
            )}
          </Card>

          {/* Profil */}
          <Card className="p-4 space-y-4">
            <h2 className="font-medium text-ink">Mein Profil</h2>
            {nameError && <p className="text-sm text-danger">{nameError}</p>}
            <div>
              <label className="block text-sm text-ink-muted mb-1">E-Mail</label>
              <p className="text-sm text-ink-muted px-3 py-2 bg-surface-container-high rounded-control border border-outline">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm text-ink-muted mb-1">Anzeigename</label>
              <input
                type="text"
                data-testid="name-input"
                className={`w-full ${inputCls}`}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <Button variant="primary" onClick={saveName} data-testid="save-name">
              {nameSaved ? 'Gespeichert ✓' : 'Name speichern'}
            </Button>
          </Card>

          {/* Push */}
          <Card className="p-4 space-y-4">
            <h2 className="font-medium text-ink">Push-Benachrichtigungen</h2>
            {!pushSupported ? (
              <p className="text-sm text-ink-faint">Dein Browser unterstützt keine Push-Benachrichtigungen.</p>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Auf diesem Gerät aktivieren</span>
                <Switch checked={pushEnabled} onChange={togglePush} />
              </div>
            )}
            <div className="border-t border-outline pt-3 flex items-center justify-between">
              <div className="pr-3">
                <span className="text-sm text-ink-muted">Wetterbedingt erledigte Aufgaben</span>
                <p className="text-xs text-ink-faint mt-0.5">Benachrichtigt dich, wenn eine Aufgabe wegen Regen automatisch erledigt wurde.</p>
              </div>
              <Switch
                checked={weatherNotify}
                onChange={toggleWeatherNotify}
                data-testid="weather-notify-toggle"
                data-weather-notify-enabled={weatherNotify}
              />
            </div>
          </Card>

          {/* Urlaub */}
          <Card className="p-4 space-y-3">
            <h2 className="font-medium text-ink">Urlaubsmodus</h2>
            <p className="text-sm text-ink-muted">Im Urlaubsmodus erhältst du keine Push-Benachrichtigungen.</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">Aktivieren</span>
              <Switch
                checked={vacationMode}
                onChange={toggleVacation}
                data-testid="vacation-toggle"
                data-vacation-enabled={vacationMode}
              />
            </div>
          </Card>

          {/* Navigation */}
          <Card className="p-4 space-y-3">
            <h2 className="font-medium text-ink">Navigation</h2>
            <div className="flex items-center justify-between">
              <div className="pr-3">
                <span className="text-sm text-ink-muted">Bestätigung beim Schließen der App</span>
                <p className="text-xs text-ink-faint mt-0.5">Fragt nach, bevor ein Zurück-Tastendruck auf der Startseite die App verlässt.</p>
              </div>
              <Switch
                checked={exitConfirmEnabled}
                onChange={toggleExitConfirm}
                data-testid="exit-confirm-toggle"
                data-exit-confirm-enabled={exitConfirmEnabled}
              />
            </div>
          </Card>

          {/* Erinnerungszeiten */}
          <Card className="p-4 space-y-4">
            <h2 className="font-medium text-ink">Erinnerungszeiten {user.role === 'admin' && <span className="text-xs text-ink-faint font-normal">(gilt für alle)</span>}</h2>
            <div>
              <label className="block text-sm text-ink-muted mb-1">Tägliche Erinnerung um</label>
              <input
                type="time"
                data-testid="daily-time"
                className={inputCls}
                value={settings.dailyTime}
                onChange={e => setSettings(s => ({ ...s, dailyTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-ink-muted mb-1">Wöchentliche Erinnerung am</label>
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
              <label className="block text-sm text-ink-muted mb-1">Monatliche Erinnerung am</label>
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
            <Button variant="primary" onClick={saveSettings} data-testid="save-notification-settings">
              {saved ? 'Gespeichert ✓' : 'Speichern'}
            </Button>
          </Card>

          {/* Nutzerverwaltung - seit dem IA-Umbau hier statt in der Verwaltung
              (siehe REDESIGN.md); nur für Admins sichtbar. */}
          {user?.role === 'admin' && (
            <section className="space-y-2">
              <h2 className="font-medium text-ink">Nutzerverwaltung <span className="text-xs text-ink-faint font-normal">(gilt für alle)</span></h2>
              <UsersTab
                users={users}
                currentUserId={user?.id}
                onToggleRole={toggleRole}
                onToggleApprove={toggleUser}
                onDeleteUser={deleteUser}
              />
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
