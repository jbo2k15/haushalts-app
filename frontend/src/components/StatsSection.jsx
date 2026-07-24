import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client.js'
import Card from './ui/Card.jsx'

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
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline bg-surface-container-high">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Statistik</span>
        </div>
        <button
          onClick={() => navigate('/hall-of-fame', { replace: true })}
          className="text-xs text-primary font-medium"
        >
          🏆 Ruhmeshalle
        </button>
      </div>

      <div className="divide-y divide-outline">
        <div className="flex items-center gap-2 px-4 py-1.5">
          <span className="flex-1" />
          <span className="w-14 text-center text-xs text-ink-faint font-medium">Heute</span>
          <span className="w-14 text-center text-xs text-ink-faint font-medium">Woche</span>
          <span className="w-14 text-center text-xs text-ink-faint font-medium">Monat</span>
        </div>

        {stats.map(userStat => {
          const dayLeader = maxDay > 0 && userStat.curDay === maxDay
          const weekLeader = maxWeek > 0 && userStat.curWeek === maxWeek
          const monthLeader = maxMonth > 0 && userStat.curMonth === maxMonth
          return (
            <div key={userStat.id} className="flex items-center gap-2 px-4 py-2.5">
              <span className="flex-1 text-sm text-ink truncate">{userStat.name}</span>
              <span className={`w-14 text-center text-sm font-semibold rounded-lg py-0.5 ${dayLeader ? 'text-on-primary-container bg-primary-container' : 'text-ink-faint'}`}>
                {userStat.curDay}
              </span>
              <span className={`w-14 text-center text-sm font-semibold rounded-lg py-0.5 ${weekLeader ? 'text-on-primary-container bg-primary-container' : 'text-ink-faint'}`}>
                {userStat.curWeek}
              </span>
              <span className={`w-14 text-center text-sm font-semibold rounded-lg py-0.5 ${monthLeader ? 'text-on-primary-container bg-primary-container' : 'text-ink-faint'}`}>
                {userStat.curMonth}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
