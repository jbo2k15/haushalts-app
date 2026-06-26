import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
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
  const [error, setError] = useState('')
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
      setLogRefreshKey(k => k + 1)
    } catch {
      setError('Keine Verbindung zum Server. Bitte überprüfe deine Internetverbindung.')
    }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) loadTasks()
    }, 30000)
    return () => clearInterval(interval)
  }, [loadTasks])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <div className="flex items-center justify-between py-2">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Haushalt</h1>
            <p className="text-xs text-gray-400 mt-0.5">{dateLabel}</p>
          </div>
          <HeaderIllustration />
          <div className="relative">
            <button
              className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-medium text-sm"
              onClick={() => setMenuOpen(o => !o)}
            >
              {user?.name?.[0]?.toUpperCase()}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 bg-white border border-gray-200 rounded-xl shadow-sm w-48 z-10 overflow-hidden">
                <button className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5" onClick={() => { setMenuOpen(false); navigate('/settings') }}>
                  <span>⚙️</span> Einstellungen
                </button>
                <button className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 flex items-center gap-2.5" onClick={() => { setMenuOpen(false); navigate('/hall-of-fame') }}>
                  <span>🏆</span> Ruhmeshalle
                </button>
                {user?.role === 'admin' && (
                  <button className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 flex items-center gap-2.5" onClick={() => { setMenuOpen(false); navigate('/admin') }}>
                    <span>🛠️</span> Verwaltung
                  </button>
                )}
                <button className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-gray-50 border-t border-gray-100 flex items-center gap-2.5" onClick={logout}>
                  <span>🚪</span> Abmelden
                </button>
              </div>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>}

        <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 mb-2">
          <p className="text-sm text-orange-800 font-medium">
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
      </div>
    </div>
  )
}
