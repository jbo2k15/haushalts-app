import { memo, useMemo } from 'react'
import TaskRow from './TaskRow.jsx'

const BLOCK_CONFIG = {
  once: { label: 'Einmalig', icon: '📌' },
  daily: { label: 'Täglich', icon: '☀️' },
  weekly: { label: 'Wöchentlich', icon: '📅' },
  monthly: { label: 'Monatlich', icon: '🗓️' },
}

const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 }

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const pinA = a.fixedWeekday != null || a.fixedDayOfMonth != null ? 0 : 1
    const pinB = b.fixedWeekday != null || b.fixedDayOfMonth != null ? 0 : 1
    if (pinA !== pinB) return pinA - pinB
    const prioA = PRIORITY_ORDER[a.priority] ?? 1
    const prioB = PRIORITY_ORDER[b.priority] ?? 1
    if (prioA !== prioB) return prioA - prioB
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })
}

const TaskBlock = memo(function TaskBlock({ type, tasks, onToggle }) {
  const config = BLOCK_CONFIG[type]

  const markedTasks = useMemo(() => {
    if (!tasks || tasks.length === 0) return []
    const overdue = tasks.filter(t => t.isOverdue && !t.completed)
    const overdueSet = new Set(overdue.map(t => t.id))
    const rest = tasks.filter(t => !overdueSet.has(t.id))
    const sorted = [...sortTasks(overdue), ...sortTasks(rest)]
    return sorted.map(t => ({
      ...t,
      pinned:
        (type === 'weekly' && t.fixedWeekday != null) ||
        (type === 'monthly' && t.fixedDayOfMonth != null),
    }))
  }, [tasks, type])

  if (!markedTasks.length) return null

  const completedCount = tasks.filter(t => t.completed).length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <span className="text-base">{config.icon}</span>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{config.label}</span>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          {completedCount}/{tasks.length}
        </span>
      </div>
      {markedTasks.map(task => (
        <TaskRow key={task.id} task={task} onToggle={onToggle} />
      ))}
    </div>
  )
})

export default TaskBlock
