import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import Card from '../ui/Card.jsx'

function formatCheckedAt(str) {
  return new Date(str).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Zeigt den letzten Stand des Wetter-Checks (siehe backend/src/services/weather.js)
// - Regenmenge seit Mitternacht, konfigurierte Schwelle, Zeitpunkt der letzten
// erfolgreichen Messung. Rein informativ, keine Einstellungen hier (die
// Schwelle wird bewusst nur per ENV konfiguriert, siehe TODO.md).
export default function WeatherStatusCard() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    api.get('/weather/status').then(setStatus).catch(() => setStatus(null)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <Card className="overflow-hidden mb-3">
      <div className="px-4 py-2.5 bg-surface-container-high border-b border-outline flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">☔ Wetter-Status</span>
        <button onClick={load} className="text-xs text-primary hover:underline">Aktualisieren</button>
      </div>
      <div className="p-4 space-y-2">
        {loading && <p className="text-sm text-ink-faint">Lädt…</p>}
        {!loading && !status?.configured && (
          <p className="text-sm text-ink-faint">
            Nicht konfiguriert — <code className="text-xs">WEATHER_LAT</code>/<code className="text-xs">WEATHER_LON</code> in der Server-Konfiguration setzen, damit wetterabhängige Aufgaben automatisch erledigt werden.
          </p>
        )}
        {!loading && status?.configured && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Regen seit Mitternacht</span>
              <span className="font-medium text-ink" data-testid="weather-rain-mm">
                {status.rainMM != null ? `${status.rainMM.toFixed(1)} mm` : 'noch keine Messung'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Konfigurierte Schwelle</span>
              <span className="font-medium text-ink" data-testid="weather-threshold-mm">{status.thresholdMM} mm</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Zuletzt geprüft</span>
              <span className="text-ink-muted">{status.checkedAt ? formatCheckedAt(status.checkedAt) : '—'}</span>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
