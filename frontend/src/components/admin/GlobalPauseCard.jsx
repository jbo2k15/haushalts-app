import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { inputCls } from './constants.js'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'

function formatDate(str) {
  return str.split('-').reverse().join('.')
}

// Haushaltsweite Pause ("Alle pausieren") - separat von den individuellen
// Pausenzeiträumen pro Aufgabe (siehe TaskFormFields.jsx). Wirkt additiv
// (ODER-verknüpft), überschreibt individuelle Zeiträume nicht.
export default function GlobalPauseCard() {
  const [pause, setPause] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pauseFrom, setPauseFrom] = useState('')
  const [pauseTo, setPauseTo] = useState('')

  function load() {
    setLoading(true)
    api.get('/pauses/global').then(setPause).catch(() => setPause(null)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function startPause(e) {
    e.preventDefault()
    try {
      await api.put('/pauses/global', { pauseFrom, pauseTo })
      setPauseFrom('')
      setPauseTo('')
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  async function endPause() {
    if (!confirm('Globale Pause wirklich beenden?')) return
    try {
      await api.delete('/pauses/global')
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <Card className="overflow-hidden mb-3">
      <div className="px-4 py-2.5 bg-surface-container-high border-b border-outline flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">⏸ Alle Aufgaben pausieren</span>
        <button onClick={load} className="text-xs text-primary hover:underline">Aktualisieren</button>
      </div>
      <div className="p-4 space-y-3">
        {loading && <p className="text-sm text-ink-faint">Lädt…</p>}
        {!loading && !pause && (
          <form onSubmit={startPause} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="date" required className={inputCls} value={pauseFrom} onChange={e => setPauseFrom(e.target.value)} />
              <input type="date" required className={inputCls} value={pauseTo} onChange={e => setPauseTo(e.target.value)} />
            </div>
            <Button type="submit" variant="primary" className="w-full">Pause starten</Button>
          </form>
        )}
        {!loading && pause && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Von</span>
              <span className="font-medium text-ink">{formatDate(pause.pauseFrom)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Bis</span>
              <span className="font-medium text-ink">{formatDate(pause.pauseTo)}</span>
            </div>
            <Button onClick={endPause} variant="secondary" className="w-full">
              Beenden
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
