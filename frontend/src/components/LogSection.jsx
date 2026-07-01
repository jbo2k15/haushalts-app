import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

function formatDate(str) {
  return new Date(str).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function LogSection({ refreshKey }) {
  const [logs, setLogs] = useState([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    api.get('/tasks/log').then(setLogs).catch(() => {})
  }, [refreshKey])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-base">📋</span>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Verlauf</span>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
          {logs.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 p-4 text-center">Noch keine Einträge</p>}
          {logs.map(log => (
            <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{log.taskTitle}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                log.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : log.status === 'skipped' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                : log.taskId === null ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                {log.status === 'completed' ? 'erledigt'
                : log.status === 'skipped' ? 'abgelehnt'
                : log.taskId === null ? 'gelöscht'
                : 'verfallen'}
              </span>
              {log.userName && <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{log.userName}</span>}
              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{formatDate(log.loggedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
