import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'

export default function StatsSection({ refreshKey }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState([])

  useEffect(() => {
    api.get('/tasks/stats').then(setStats).catch(() => {})
  }, [refreshKey])

  if (stats.length === 0) return null

  const { maxDay, maxWeek, maxMonth } = useMemo(() => ({
    maxDay: Math.max(...stats.map(s => s.curDay)),
    maxWeek: Math.max(...stats.map(s => s.curWeek)),
    maxMonth: Math.max(...stats.map(s => s.curMonth)),
  }), [stats])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statistik</span>
        </div>
        <button
          onClick={() => navigate('/hall-of-fame')}
          className="text-xs text-orange-600 font-medium"
        >
          🏆 Ruhmeshalle
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        <div className="flex items-center gap-2 px-4 py-1.5">
          <span className="flex-1" />
          <span className="w-14 text-center text-xs text-gray-400 font-medium">Heute</span>
          <span className="w-14 text-center text-xs text-gray-400 font-medium">Woche</span>
          <span className="w-14 text-center text-xs text-gray-400 font-medium">Monat</span>
        </div>

        {stats.map(userStat => {
          const dayLeader = maxDay > 0 && userStat.curDay === maxDay
          const weekLeader = maxWeek > 0 && userStat.curWeek === maxWeek
          const monthLeader = maxMonth > 0 && userStat.curMonth === maxMonth
          return (
            <div key={userStat.id} className="flex items-center gap-2 px-4 py-2.5">
              <span className="flex-1 text-sm text-gray-700 truncate">{userStat.name}</span>
              <span className={`w-14 text-center text-sm font-semibold rounded-lg py-0.5 ${dayLeader ? 'text-orange-600 bg-orange-50' : 'text-gray-400'}`}>
                {userStat.curDay}
              </span>
              <span className={`w-14 text-center text-sm font-semibold rounded-lg py-0.5 ${weekLeader ? 'text-orange-600 bg-orange-50' : 'text-gray-400'}`}>
                {userStat.curWeek}
              </span>
              <span className={`w-14 text-center text-sm font-semibold rounded-lg py-0.5 ${monthLeader ? 'text-orange-600 bg-orange-50' : 'text-gray-400'}`}>
                {userStat.curMonth}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
