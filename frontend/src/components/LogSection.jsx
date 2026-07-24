import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Card from './ui/Card.jsx'
import Badge from './ui/Badge.jsx'

function formatDate(str) {
  return new Date(str).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS = {
  completed: { tone: 'success', label: 'erledigt' },
  'system-completed': { tone: 'info', label: '☔ automatisch' },
  skipped: { tone: 'primary', label: 'abgelehnt' },
}

function statusBadge(log) {
  if (STATUS[log.status]) return STATUS[log.status]
  if (log.taskId === null) return { tone: 'neutral', label: 'gelöscht' }
  return { tone: 'danger', label: 'verfallen' }
}

export default function LogSection({ refreshKey }) {
  const [logs, setLogs] = useState([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    api.get('/tasks/log').then(setLogs).catch(() => {})
  }, [refreshKey])

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-outline bg-surface-container-high"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-base">📋</span>
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Verlauf</span>
        <span className="ml-auto text-xs text-ink-faint">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="divide-y divide-outline max-h-96 overflow-y-auto">
          {logs.length === 0 && <p className="text-sm text-ink-faint p-4 text-center">Noch keine Einträge</p>}
          {logs.map(log => {
            const badge = statusBadge(log)
            return (
              <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-sm text-ink truncate">{log.taskTitle}</span>
                <Badge tone={badge.tone} className="shrink-0">{badge.label}</Badge>
                {log.userName && <span className="text-xs text-ink-faint shrink-0">{log.userName}</span>}
                <span className="text-xs text-ink-faint shrink-0">{formatDate(log.loggedAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
