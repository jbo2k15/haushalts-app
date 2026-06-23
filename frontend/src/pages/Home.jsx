import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import TaskBlock from '../components/TaskBlock.jsx'
import StatsSection from '../components/StatsSection.jsx'
import LogSection from '../components/LogSection.jsx'

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export default function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState({ daily: [], weekly: [], monthly: [] })
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const now = new Date()
  const dateLabel = `${WEEKDAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  const loadTasks = useCallback(async () => {
    try {
      const data = await api.get('/tasks')
      setTasks(data)
    } catch {
      setError('Keine Verbindung zum Server. Bitte überprüfe deine Internetverbindung.')
    }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  useEffect(() => {
    const interval = setInterval(loadTasks, 30000)
    return () => clearInterval(interval)
  }, [loadTasks])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <div className="flex items-center justify-between py-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Haushalt</h1>
            <p className="text-xs text-gray-400 mt-0.5">{dateLabel}</p>
          </div>
          <div className="relative">
            <button
              className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-medium text-sm"
              onClick={() => setMenuOpen(o => !o)}
            >
              {user?.name?.[0]?.toUpperCase()}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 bg-white border border-gray-200 rounded-xl shadow-sm w-44 z-10 overflow-hidden">
                <button className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50" onClick={() => { setMenuOpen(false); navigate('/settings') }}>
                  Einstellungen
                </button>
                {user?.role === 'admin' && (
                  <button className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100" onClick={() => { setMenuOpen(false); navigate('/admin') }}>
                    Verwaltung
                  </button>
                )}
                <button className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-gray-50 border-t border-gray-100" onClick={logout}>
                  Abmelden
                </button>
              </div>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>}

        <div className="space-y-4">
          <TaskBlock type="daily" tasks={tasks.daily} onToggle={loadTasks} />
          <TaskBlock type="weekly" tasks={tasks.weekly} onToggle={loadTasks} />
          <TaskBlock type="monthly" tasks={tasks.monthly} onToggle={loadTasks} />
          <StatsSection />
          <LogSection />
        </div>
      </div>
    </div>
  )
}
