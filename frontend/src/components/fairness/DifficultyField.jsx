import { useFairnessConfig } from './useFairnessConfig.js'

export const DIFFICULTY_LEVELS = [
  { value: 1, label: 'Leicht', points: '1 Punkt' },
  { value: 2, label: 'Mittel', points: '2 Punkte' },
  { value: 3, label: 'Aufwändig', points: '3 Punkte' },
]

// Aufwand im Aufgaben-Formular. Nur sichtbar, wenn die Fairness-Statistik an
// ist; einmalige Aufgaben zaehlen dort nicht, daher ohne Auswahl.
export default function DifficultyField({ form, setForm }) {
  const config = useFairnessConfig()
  if (!config?.enabled || form.type === 'once') return null
  const current = form.difficulty ?? 2

  return (
    <fieldset className="space-y-1.5">
      <legend className="block text-sm text-ink-muted mb-1">Aufwand</legend>
      <div className="flex gap-2">
        {DIFFICULTY_LEVELS.map(level => {
          const active = current === level.value
          return (
            <button
              type="button"
              key={level.value}
              aria-pressed={active}
              data-testid={`difficulty-${level.value}`}
              onClick={() => setForm(f => ({ ...f, difficulty: level.value }))}
              className={`flex-1 flex flex-col items-center gap-0.5 min-h-11 py-2 rounded-control border text-xs font-medium transition-colors ${active ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-high border-outline text-ink-muted hover:border-primary'}`}
            >
              <span className="text-sm font-semibold">{level.label}</span>
              <span>{level.points}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-ink-faint">
        Zählt in der Fairness-Statistik. Gilt für künftige Erledigungen und für Einträge von vor dem Start der Statistik.
      </p>
    </fieldset>
  )
}
