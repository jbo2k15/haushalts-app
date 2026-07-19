import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { inputCls } from './constants.js'

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
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-3">
      <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">⏸ Alle Aufgaben pausieren</span>
        <button onClick={load} className="text-xs text-orange-600 dark:text-orange-400 hover:underline">Aktualisieren</button>
      </div>
      <div className="p-4 space-y-3">
        {loading && <p className="text-sm text-gray-400 dark:text-gray-500">Lädt…</p>}
        {!loading && !pause && (
          <form onSubmit={startPause} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="date" required className={inputCls} value={pauseFrom} onChange={e => setPauseFrom(e.target.value)} />
              <input type="date" required className={inputCls} value={pauseTo} onChange={e => setPauseTo(e.target.value)} />
            </div>
            <button type="submit" className="w-full bg-orange-600 text-white rounded-xl py-2 text-sm font-medium">Pause starten</button>
          </form>
        )}
        {!loading && pause && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Von</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{formatDate(pause.pauseFrom)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Bis</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{formatDate(pause.pauseTo)}</span>
            </div>
            <button onClick={endPause} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl py-2 text-sm font-medium">
              Beenden
            </button>
          </>
        )}
      </div>
    </div>
  )
}
