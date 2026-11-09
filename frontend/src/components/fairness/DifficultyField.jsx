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
      <div className="grid grid-cols-3 gap-1.5 bg-surface-container-high rounded-control p-1">
        {DIFFICULTY_LEVELS.map(level => {
          const active = current === level.value
          return (
            <button
              type="button"
              key={level.value}
              aria-pressed={active}
              data-testid={`difficulty-${level.value}`}
              onClick={() => setForm(f => ({ ...f, difficulty: level.value }))}
              className={`min-h-11 rounded-lg px-1 py-1.5 text-center ${active ? 'bg-surface-container text-ink shadow-sm' : 'text-ink-muted'}`}
            >
              <span className="block text-sm font-semibold">{level.label}</span>
              <span className="block text-xs">{level.points}</span>
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
