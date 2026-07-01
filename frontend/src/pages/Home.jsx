import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { api, getAccessToken } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import TaskBlock from '../components/TaskBlock.jsx'
import StatsSection from '../components/StatsSection.jsx'
import LogSection from '../components/LogSection.jsx'
import PushPromptBanner from '../components/PushPromptBanner.jsx'
import HeaderIllustration from '../components/HeaderIllustration.jsx'

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return 'Guten Morgen'
  if (h >= 11 && h < 14) return 'Mahlzeit'
  if (h >= 14 && h < 18) return 'Schönen Nachmittag'
  if (h >= 18 && h < 22) return 'Guten Abend'
  return 'Gute Nacht'
}

function getGreetingMessage(firstName, dailyTasks) {
  const completed = dailyTasks.filter(t => t.completed).length
  const open = dailyTasks.filter(t => !t.completed).length
  if (dailyTasks.length === 0) return `${getGreeting()}, ${firstName}!`
  if (open === 0) return `${getGreeting()}, ${firstName} — heute gibt es nichts mehr zu tun! 🎉`
  if (completed === 0) return `${getGreeting()}, ${firstName} — heute ${open === 1 ? 'liegt noch 1 Aufgabe' : `liegen noch ${open} Aufgaben`} vor dir.`
  return `${getGreeting()}, ${firstName} — heute hast du schon ${completed} Aufgabe${completed === 1 ? '' : 'n'} erledigt.`
}

export default function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState({ once: [], daily: [], weekly: [], monthly: [] })
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [logRefreshKey, setLogRefreshKey] = useState(0)

  const dateLabel = useMemo(() => {
    const now = new Date()
    return `${WEEKDAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]} ${now.getFullYear()}`
  }, [])

  const loadTasks = useCallback(async () => {
    try {
      const data = await api.get('/tasks')
      setTasks(data)
      setError(false)
      setLoaded(true)
      setLogRefreshKey(k => k + 1)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  // SSE: sofortiges Update wenn anderer Nutzer eine Aufgabe ändert
  useEffect(() => {
    let es = null
    let retryTimeout = null

    function connect() {
      const token = getAccessToken()
      if (!token) return
      es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`)
      es.addEventListener('tasks-updated', () => loadTasks())
      es.onerror = () => {
        es?.close()
        es = null
        retryTimeout = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      es?.close()
      clearTimeout(retryTimeout)
    }
  }, [loadTasks])

  // Fallback-Polling (greift wenn SSE nicht verbunden ist)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) loadTasks()
    }, 30000)
    return () => clearInterval(interval)
  }, [loadTasks])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <div className="flex items-center justify-between py-2">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Haushalt</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{dateLabel}</p>
          </div>
          <HeaderIllustration />
          <div className="relative">
            <button
              className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-700 dark:text-orange-400 font-medium text-sm"
              onClick={() => setMenuOpen(o => !o)}
            >
              {user?.name?.[0]?.toUpperCase()}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm w-48 z-10 overflow-hidden">
                <button className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5" onClick={() => { setMenuOpen(false); navigate('/settings') }}>
                  <span>⚙️</span> Einstellungen
                </button>
                <button className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2.5" onClick={() => { setMenuOpen(false); navigate('/hall-of-fame') }}>
                  <span>🏆</span> Ruhmeshalle
                </button>
                {user?.role === 'admin' && (
                  <button className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2.5" onClick={() => { setMenuOpen(false); navigate('/admin') }}>
                    <span>🛠️</span> Verwaltung
                  </button>
                )}
                <button className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2.5" onClick={logout}>
                  <span>🚪</span> Abmelden
                </button>
              </div>
            )}
          </div>
        </div>

        {error && !loaded && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="text-4xl">📡</div>
            <p className="text-gray-700 dark:text-gray-300 font-medium">Server nicht erreichbar</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Bitte überprüfe deine Internetverbindung.</p>
            <button
              onClick={loadTasks}
              className="mt-2 px-4 py-2 bg-orange-500 text-white text-sm rounded-xl font-medium"
            >
              Erneut versuchen
            </button>
          </div>
        )}
        {error && loaded && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 rounded-xl p-3 text-sm mb-4">
            Verbindung unterbrochen — Daten könnten veraltet sein.
          </div>
        )}

        {!loaded && !error && (
          <div className="flex justify-center py-24">
            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {(loaded || error) && <>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40 rounded-2xl px-4 py-3 mb-2">
            <p className="text-sm text-orange-800 dark:text-orange-300 font-medium">
              {getGreetingMessage(user?.name?.split(' ')[0] || '', tasks.daily)}
            </p>
          </div>

          <PushPromptBanner />

          <div className="space-y-4">
            <TaskBlock type="once" tasks={tasks.once} onToggle={loadTasks} />
            <TaskBlock type="daily" tasks={tasks.daily} onToggle={loadTasks} />
            <TaskBlock type="weekly" tasks={tasks.weekly} onToggle={loadTasks} />
            <TaskBlock type="monthly" tasks={tasks.monthly} onToggle={loadTasks} />
            <StatsSection refreshKey={logRefreshKey} />
            <LogSection refreshKey={logRefreshKey} />
          </div>
        </>}
      </div>
    </div>
  )
}
