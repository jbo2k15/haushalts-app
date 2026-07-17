import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WEEKDAY_LABELS, PRIORITY_LABELS, TYPE_LABELS } from './constants.js'

export default function SortableTask({ task, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 bg-white dark:bg-gray-800" data-testid="sortable-task" data-task-title={task.title}>
      <div {...attributes} {...listeners} style={{ touchAction: 'none' }} className="text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing text-lg" data-testid="drag-handle">⠿</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
          {!task.isActive && <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded-sm shrink-0">Inaktiv</span>}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {TYPE_LABELS[task.type]} · {PRIORITY_LABELS[task.priority]}
          {task.fixedWeekday != null && ` · ${WEEKDAY_LABELS[task.fixedWeekday]}`}
          {task.fixedDayOfMonth != null && ` · ${task.fixedDayOfMonth}.`}
          {task.weekdays?.length > 0 && ` · ${task.weekdays.map(d => WEEKDAY_LABELS[d]).join(', ')}`}
          {task.allowMultiple && (task.type === 'daily' ? ' · Mehrfach am Tag' : ' · Mehrfach pro Woche')}
          {task.weatherDependent && ' · ☔ Wetterabhängig'}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => onEdit(task)} className="text-xs text-orange-600 dark:text-orange-400 hover:underline">Bearb.</button>
        <button onClick={() => onDelete(task.id)} className="text-xs text-red-500 dark:text-red-400 hover:underline">Löschen</button>
      </div>
    </div>
  )
}
