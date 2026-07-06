import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client.js'

const TROPHY_TYPES = [
  { key: 'dayTrophies',   icon: '🥉', label: 'Tagessieger',   desc: 'Meiste erledigte Aufgaben an einem abgeschlossenen Tag' },
  { key: 'weekTrophies',  icon: '🥈', label: 'Wochensieger',  desc: 'Meiste erledigte Aufgaben in einer abgeschlossenen Woche' },
  { key: 'monthTrophies', icon: '🥇', label: 'Monatssieger',  desc: 'Meiste erledigte Aufgaben in einem abgeschlossenen Monat' },
]

const BADGE_STYLES = {
  '🥉': { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', iconSize: 'text-lg', label: 'Tag' },
  '🥈': { bg: 'bg-slate-50 dark:bg-slate-800/50',  border: 'border-slate-300 dark:border-slate-600',  text: 'text-slate-600 dark:text-slate-400',  iconSize: 'text-lg', label: 'Woche' },
  '🥇': { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-300 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-400', iconSize: 'text-lg', label: 'Monat' },
}

function TrophyBadge({ icon, count }) {
  if (count === 0) return null
  const s = BADGE_STYLES[icon]
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-1 ${s.bg} ${s.border}`}>
      <span className={s.iconSize}>{icon}</span>
      <span className={`text-xs font-bold ${s.text}`}>×{count}</span>
    </span>
  )
}

export default function HallOfFame() {
  const navigate = useNavigate()
  const [stats, setStats] = useState([])

  useEffect(() => {
    api.get('/tasks/stats').then(setStats).catch(() => {})
  }, [])

  const ranked = [...stats]
    .filter(userStat => userStat.dayTrophies > 0 || userStat.weekTrophies > 0 || userStat.monthTrophies > 0)
    .sort((a, b) =>
      (b.monthTrophies * 4 + b.weekTrophies * 2 + b.dayTrophies) -
      (a.monthTrophies * 4 + a.weekTrophies * 2 + a.dayTrophies)
    )

  const podium = ['🥇', '🥈', '🥉']

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <div className="flex items-center gap-3 py-4">
          <button onClick={() => navigate('/')} className="text-orange-600 dark:text-orange-400 text-sm">← Zurück</button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Ruhmeshalle</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Legende</p>
          <div className="space-y-3">
            {TROPHY_TYPES.map(({ icon, label, desc }) => {
              const s = BADGE_STYLES[icon]
              return (
                <div key={label} className="flex items-start gap-3">
                  <span className={`inline-flex flex-col items-center border rounded-xl px-2 py-1 shrink-0 w-14 ${s.bg} ${s.border}`}>
                    <span className={s.iconSize}>{icon}</span>
                    <span className={`text-xs font-semibold leading-none ${s.text}`}>{s.label}</span>
                  </span>
                  <div className="pt-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
            Pokale werden nur bei eindeutigem Sieger vergeben — kein Pokal bei Gleichstand.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <span className="text-base">🏆</span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Gesamtrangliste</span>
          </div>

          {ranked.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 p-6 text-center">Noch keine Pokale vergeben.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {ranked.map((userStat, i) => (
                <div key={userStat.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="text-xl w-7 text-center shrink-0">
                    {podium[i] ?? <span className="text-sm text-gray-400 dark:text-gray-500">{i + 1}.</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{userStat.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {userStat.dayTrophies + userStat.weekTrophies + userStat.monthTrophies} Pokal{userStat.dayTrophies + userStat.weekTrophies + userStat.monthTrophies !== 1 ? 'e' : ''} gesamt
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <TrophyBadge icon="🥉" count={userStat.dayTrophies} />
                    <TrophyBadge icon="🥈" count={userStat.weekTrophies} />
                    <TrophyBadge icon="🥇" count={userStat.monthTrophies} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {stats.filter(userStat => userStat.dayTrophies === 0 && userStat.weekTrophies === 0 && userStat.monthTrophies === 0).length > 0 && (
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Noch keine Pokale</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {stats.filter(userStat => userStat.dayTrophies === 0 && userStat.weekTrophies === 0 && userStat.monthTrophies === 0).map(userStat => (
                <div key={userStat.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl w-7 text-center shrink-0 text-gray-300 dark:text-gray-600">—</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{userStat.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
