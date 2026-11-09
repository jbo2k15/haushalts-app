import { useState } from 'react'
import Button from '../ui/Button.jsx'
import { useFairnessConfig } from './useFairnessConfig.js'

const KEY = 'fairness-rating-hint-dismissed'

function readDismissed() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

// Einmaliger Hinweis in der Verwaltung, den Aufwand der Aufgaben einzustufen.
export default function RatingHint() {
  const config = useFairnessConfig()
  const [dismissed, setDismissed] = useState(readDismissed)
  if (!config?.enabled || dismissed) return null

  function dismiss() {
    try { localStorage.setItem(KEY, '1') } catch {}
    setDismissed(true)
  }

  return (
    <div className="p-4 rounded-card bg-info-container" data-testid="fairness-rating-hint">
      <p className="text-sm text-on-info-container">
        Stufe den Aufwand deiner Aufgaben ein, damit die Fairness-Statistik stimmt: Leicht zählt 1, Mittel 2, Aufwändig 3 Punkte.
        Bis dahin zählt jede Aufgabe als Mittel.
      </p>
      <Button variant="secondary" onClick={dismiss} className="mt-3">Verstanden</Button>
    </div>
  )
}
