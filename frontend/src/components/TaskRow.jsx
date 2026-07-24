import { memo, useState, useRef } from 'react'
import { api } from '../api/client.js'
import Badge from './ui/Badge.jsx'

// Prioritäts-Indikator am linken Rand - eigene, feste Kennfarben (nicht Teil
// der semantischen Token-Palette): Violett = hoch, Grau = niedrig.
const PRIORITY_COLORS = {
  high: '#7F77DD',
  normal: 'transparent',
  low: '#B4B2A9',
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

const TaskRow = memo(function TaskRow({ task, onToggle }) {
  const isDaily = task.type === 'daily'
  // Only daily/weekly tasks explicitly configured for it (Admin -> "Mehrfach
  // erledigbar") get the increment/undo behavior. Everything else keeps the
  // original single toggle. Skip ("heute nicht nötig") stays daily-only —
  // there's no equivalent "skip this week" concept.
  const isMulti = (task.type === 'daily' || task.type === 'weekly') && task.allowMultiple

  const [optimistic, setOptimistic] = useState(null) // 'completed' | 'uncompleted' | 'skipped' | null
  // Multi-completion tasks can be completed several times per day, so a
  // boolean optimistic flag isn't enough — track a pending +1/-1 instead.
  const [optimisticDelta, setOptimisticDelta] = useState(0)
  const pendingRef = useRef(false)

  const count = isMulti ? Math.max(0, (task.count ?? 0) + optimisticDelta) : null
  const completed = isMulti ? count > 0
    : optimistic === 'completed' ? true
    : optimistic === 'uncompleted' ? false
    : task.completed
  const skipped = optimistic === 'skipped'

  const isOverdueVisible = task.isOverdue && !completed
  const borderColor = isOverdueVisible ? '#EF4444' : (PRIORITY_COLORS[task.priority] || 'transparent')
  const hasBorder = isOverdueVisible || task.priority !== 'normal'

  // Touch devices often fire a delayed synthetic 'click' ~300ms after
  // 'touchend' (double-tap-zoom detection). If that arrives after our
  // request already finished and released the lock, it reads as a brand
  // new click and immediately re-toggles the task. Keep the lock held for
  // a short grace period after the request completes to absorb it.
  const RELEASE_DELAY_MS = 400

  function releaseAfterDelay() {
    setTimeout(() => { pendingRef.current = false }, RELEASE_DELAY_MS)
  }

  async function handleClick() {
    if (pendingRef.current) return
    pendingRef.current = true

    if (isMulti) {
      setOptimisticDelta(d => d + 1)
      try {
        await api.post(`/tasks/${task.id}/complete`, {})
        await onToggle()
      } finally {
        setOptimisticDelta(0)
        releaseAfterDelay()
      }
      return
    }

    setOptimistic(task.completed ? 'uncompleted' : 'completed')
    try {
      await api.post(`/tasks/${task.id}/complete`, {})
      await onToggle()
    } finally {
      setOptimistic(null)
      releaseAfterDelay()
    }
  }

  async function handleUndo(e) {
    e.stopPropagation()
    if (pendingRef.current) return
    pendingRef.current = true
    setOptimisticDelta(d => d - 1)
    try {
      await api.post(`/tasks/${task.id}/uncomplete-last`, {})
      await onToggle()
    } finally {
      setOptimisticDelta(0)
      releaseAfterDelay()
    }
  }

  async function handleSkip(e) {
    e.stopPropagation()
    if (pendingRef.current) return
    pendingRef.current = true
    setOptimistic('skipped')
    try {
      await api.post(`/tasks/${task.id}/skip`, {})
      await onToggle()
    } finally {
      setOptimistic(null)
      releaseAfterDelay()
    }
  }

  let rowBg = 'bg-surface-container'
  if (task.isOverdue && !completed) rowBg = 'bg-danger-container'
  else if (task.pinned) rowBg = 'bg-primary-container'

  return (
    <div
      className={`flex items-center gap-3 px-3 py-3 border-b border-outline last:border-b-0 ${rowBg} cursor-pointer select-none touch-manipulation`}
      style={{ borderLeft: hasBorder ? `3px solid ${borderColor}` : '3px solid transparent' }}
      onClick={handleClick}
      data-testid="task-row"
      data-task-title={task.title}
      data-completed={completed}
      data-count={isMulti ? count : undefined}
    >
      <div className={`w-5 h-5 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
        completed ? 'bg-green-500 border-green-500' : task.isOverdue ? 'border-danger' : 'border-outline-strong'
      }`}>
        {completed && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`flex-1 text-sm ${completed ? 'line-through text-ink-faint' : 'text-ink'}`}>
        {task.title}
        {isMulti && count > 1 && (
          <Badge tone="success" className="ml-1.5">×{count}</Badge>
        )}
        {task.isOnce && task.dueDate && (
          <Badge tone="primary" className="ml-1.5">{task.dueDate.split('-').reverse().join('.')}</Badge>
        )}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {task.fixedWeekday != null && (
          <span className="text-xs text-primary font-medium">{WEEKDAYS[task.fixedWeekday]}</span>
        )}
        {task.fixedDayOfMonth != null && (
          <span className="text-xs text-primary font-medium">{task.fixedDayOfMonth}.</span>
        )}
        {task.isAutoGenerated && (
          <Badge tone="neutral">Abfall</Badge>
        )}
        {task.systemCompleted && (
          <Badge tone="info">☔ Wegen Regen entfallen</Badge>
        )}
        {task.isOverdue && !completed && (
          <span className="text-xs text-danger">überfällig</span>
        )}
      </div>
      {isMulti && completed && (
        <button
          onClick={handleUndo}
          title="Letzte Erledigung zurücknehmen"
          aria-label="Letzte Erledigung zurücknehmen"
          data-testid="undo-completion"
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full border border-outline-strong bg-surface-container-high text-ink-muted hover:bg-surface-container transition-colors text-lg font-semibold leading-none touch-manipulation"
        >
          −
        </button>
      )}
      {isDaily && !completed && !skipped && (
        <button
          onClick={handleSkip}
          title="Heute nicht nötig"
          aria-label="Heute nicht nötig"
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-danger-container text-on-danger-container hover:opacity-80 transition-opacity text-sm font-semibold leading-none touch-manipulation"
        >
          ✕
        </button>
      )}
    </div>
  )
})

export default TaskRow
