import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

export default function StatsSection() {
  const [stats, setStats] = useState([])

  useEffect(() => {
    api.get('/tasks/stats').then(setStats).catch(() => {})
  }, [])

  if (stats.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-base">📊</span>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statistik diesen Monat</span>
      </div>
      <div className="divide-y divide-gray-100">
        {stats.map(s => (
          <div key={s.name} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-700">{s.name}</span>
            <span className="text-sm font-medium text-purple-600">{s.count} erledigt</span>
          </div>
        ))}
      </div>
    </div>
  )
}
