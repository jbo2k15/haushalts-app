import { useFairnessConfig } from './useFairnessConfig.js'

// Hinweis in der Ruhmeshalle, wonach die Pokale vergeben werden.
export default function CountModeNote() {
  const config = useFairnessConfig()
  if (!config?.enabled) return null
  return (
    <p className="text-xs text-ink-faint mt-1" data-testid="count-mode-note">
      {config.countMode === 'weighted'
        ? 'Gezählt werden Punkte nach Aufwand: Leicht 1, Mittel 2, Aufwändig 3.'
        : 'Gezählt wird die Anzahl erledigter Aufgaben.'}
    </p>
  )
}
