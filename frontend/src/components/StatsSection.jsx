import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'

export default function StatsSection({ refreshKey }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState([])

  useEffect(() => {
    api.get('/tasks/stats').then(setStats).catch(() => {})
  }, [refreshKey])

  if (stats.length === 0) return null

  const byDay = [...stats].sort((a, b) => b.curDay - a.curDay)
  const byWeek = [...stats].sort((a, b) => b.curWeek - a.curWeek)
  const maxDay = byDay[0]?.curDay ?? 0
  const maxWeek = byWeek[0]?.curWeek ?? 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statistik</span>
        </div>
        <button
          onClick={() => navigate('/hall-of-fame')}
          className="text-xs text-purple-600 font-medium"
        >
          🏆 Ruhmeshalle
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Spaltenköpfe */}
        <div className="flex items-center gap-2 px-4 py-1.5">
          <span className="flex-1" />
          <span className="w-16 text-center text-xs text-gray-400 font-medium">Heute</span>
          <span className="w-16 text-center text-xs text-gray-400 font-medium">Woche</span>
        </div>

        {stats.map(u => {
          const dayLeader = maxDay > 0 && u.curDay === maxDay
          const weekLeader = maxWeek > 0 && u.curWeek === maxWeek
          return (
            <div key={u.id} className="flex items-center gap-2 px-4 py-2.5">
              <span className="flex-1 text-sm text-gray-700 truncate">{u.name}</span>
              <span className={`w-16 text-center text-sm font-semibold rounded-lg py-0.5 ${dayLeader ? 'text-purple-600 bg-purple-50' : 'text-gray-400'}`}>
                {u.curDay}
              </span>
              <span className={`w-16 text-center text-sm font-semibold rounded-lg py-0.5 ${weekLeader ? 'text-purple-600 bg-purple-50' : 'text-gray-400'}`}>
                {u.curWeek}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
