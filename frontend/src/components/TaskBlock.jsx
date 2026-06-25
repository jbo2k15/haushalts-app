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

export default function TaskBlock({ type, tasks, onToggle }) {
  const config = BLOCK_CONFIG[type]
  if (!tasks || tasks.length === 0) return null

  const overdue = tasks.filter(t => ((t.overdueDay1 || t.overdueDay2) && type === 'daily' || t.isOverdue) && !t.completed)
  const rest = tasks.filter(t => !overdue.includes(t))
  const sortedOverdue = sortTasks(overdue)
  const sortedRest = sortTasks(rest)
  const sorted = [...sortedOverdue, ...sortedRest]

  const todayWeekday = new Date().getDay()
  const todayDayOfMonth = new Date().getDate()

  const markedTasks = sorted.map(t => ({
    ...t,
    pinned:
      (type === 'weekly' && t.fixedWeekday != null) ||
      (type === 'monthly' && t.fixedDayOfMonth != null) ||
      (type === 'weekly' && t.fixedWeekday === todayWeekday) ||
      (type === 'monthly' && t.fixedDayOfMonth === todayDayOfMonth),
  }))

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-base">{config.icon}</span>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{config.label}</span>
        <span className="ml-auto text-xs text-gray-400">
          {tasks.filter(t => t.completed).length}/{tasks.length}
        </span>
      </div>
      {markedTasks.map(task => (
        <TaskRow key={task.id} task={task} onToggle={onToggle} />
      ))}
    </div>
  )
}
