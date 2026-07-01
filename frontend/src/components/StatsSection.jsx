import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'

export default function StatsSection({ refreshKey }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState([])

  useEffect(() => {
    api.get('/tasks/stats').then(setStats).catch(() => {})
  }, [refreshKey])

  const { maxDay, maxWeek, maxMonth } = useMemo(() => ({
    maxDay: stats.length ? Math.max(...stats.map(s => s.curDay)) : 0,
    maxWeek: stats.length ? Math.max(...stats.map(s => s.curWeek)) : 0,
    maxMonth: stats.length ? Math.max(...stats.map(s => s.curMonth)) : 0,
  }), [stats])

  if (stats.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Statistik</span>
        </div>
        <button
          onClick={() => navigate('/hall-of-fame')}
          className="text-xs text-orange-600 dark:text-orange-400 font-medium"
        >
          🏆 Ruhmeshalle
        </button>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <div className="flex items-center gap-2 px-4 py-1.5">
          <span className="flex-1" />
          <span className="w-14 text-center text-xs text-gray-400 dark:text-gray-500 font-medium">Heute</span>
          <span className="w-14 text-center text-xs text-gray-400 dark:text-gray-500 font-medium">Woche</span>
          <span className="w-14 text-center text-xs text-gray-400 dark:text-gray-500 font-medium">Monat</span>
        </div>

        {stats.map(userStat => {
          const dayLeader = maxDay > 0 && userStat.curDay === maxDay
          const weekLeader = maxWeek > 0 && userStat.curWeek === maxWeek
          const monthLeader = maxMonth > 0 && userStat.curMonth === maxMonth
          return (
            <div key={userStat.id} className="flex items-center gap-2 px-4 py-2.5">
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{userStat.name}</span>
              <span className={`w-14 text-center text-sm font-semibold rounded-lg py-0.5 ${dayLeader ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'text-gray-400 dark:text-gray-500'}`}>
                {userStat.curDay}
              </span>
              <span className={`w-14 text-center text-sm font-semibold rounded-lg py-0.5 ${weekLeader ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'text-gray-400 dark:text-gray-500'}`}>
                {userStat.curWeek}
              </span>
              <span className={`w-14 text-center text-sm font-semibold rounded-lg py-0.5 ${monthLeader ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'text-gray-400 dark:text-gray-500'}`}>
                {userStat.curMonth}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
