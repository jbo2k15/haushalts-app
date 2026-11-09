import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WEEKDAY_LABELS, PRIORITY_LABELS, TYPE_LABELS } from './constants.js'
import Badge from '../ui/Badge.jsx'
import DifficultyBadge from '../fairness/DifficultyBadge.jsx' // Fairness-Statistik

export default function SortableTask({ task, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  // Gleiche Tagesermittlung wie das Backend (dateStringInBerlin) - lokale
  // Date-Methoden würden je nach Browser-Zeitzone des Admins abweichen.
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
  const hasPauseRange = task.pauseFrom && task.pauseTo
  const isPausedNow = hasPauseRange && task.pauseFrom <= today && today <= task.pauseTo
  const isPausePlanned = hasPauseRange && task.pauseFrom > today

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-3 border-b border-outline last:border-b-0 bg-surface-container" data-testid="sortable-task" data-task-title={task.title}>
      <div {...attributes} {...listeners} style={{ touchAction: 'none' }} className="text-ink-faint cursor-grab active:cursor-grabbing text-lg" data-testid="drag-handle">⠿</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink truncate">{task.title}</span>
          <DifficultyBadge task={task} />
          {!task.isActive && <Badge tone="warning" className="shrink-0">Inaktiv</Badge>}
        </div>
        <div className="text-xs text-ink-faint mt-0.5">
          {TYPE_LABELS[task.type]} · {PRIORITY_LABELS[task.priority]}
          {task.fixedWeekday != null && ` · ${WEEKDAY_LABELS[task.fixedWeekday]}`}
          {task.fixedDayOfMonth != null && ` · ${task.fixedDayOfMonth}.`}
          {task.weekdays?.length > 0 && ` · ${task.weekdays.map(d => WEEKDAY_LABELS[d]).join(', ')}`}
          {task.allowMultiple && (task.type === 'daily' ? ' · Mehrfach am Tag' : ' · Mehrfach pro Woche')}
          {task.weatherDependent && ' · ☔ Wetterabhängig'}
          {isPausedNow && ' · ⏸ Pausiert'}
          {isPausePlanned && ' · ⏳ Pause geplant'}
        </div>
      </div>
      <div className="flex shrink-0">
        <button onClick={() => onEdit(task)} className="min-h-11 px-2 text-xs text-primary hover:underline">Bearb.<span className="sr-only"> {task.title}</span></button>
        <button onClick={() => onDelete(task.id)} className="min-h-11 px-2 -mr-2 text-xs text-danger hover:underline">Löschen<span className="sr-only"> {task.title}</span></button>
      </div>
    </div>
  )
}
