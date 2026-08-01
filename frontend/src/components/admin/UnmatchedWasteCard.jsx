import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'

function formatCheckedAt(str) {
  return new Date(str).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Zeigt Kalendereinträge aus dem Abfallkalender-Feed, die der Matcher (feste
// Wortliste in backend/src/services/waste-calendar.js) nicht erkannt hat —
// dafür wurde KEINE Aufgabe angelegt. Bewusst nur sichtbar, wenn es etwas zu
// melden gibt (kein Dauer-Rauschen im Normalfall); Admins bekommen zusätzlich
// einmalig eine Push-Benachrichtigung, sobald ein Eintrag neu auftaucht.
export default function UnmatchedWasteCard() {
  const [status, setStatus] = useState(null)

  function load() {
    api.get('/waste/status').then(setStatus).catch(() => setStatus(null))
  }

  useEffect(() => { load() }, [])

  if (!status?.unmatchedSummaries?.length) return null

  return (
    <div className="overflow-hidden mb-3 rounded-card border border-danger bg-danger-container text-on-danger-container">
      <div className="px-4 py-2.5 border-b border-danger flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide">⚠️ Unbekannte Kalendereinträge</span>
        <button onClick={load} className="text-xs hover:underline">Aktualisieren</button>
      </div>
      <div className="p-4 space-y-2">
        <p className="text-sm">
          Für folgende Einträge im Abfallkalender-Feed wurde <strong>keine Aufgabe</strong> angelegt — die Bezeichnung passt zu keinem bekannten Tonnentyp:
        </p>
        <ul className="text-sm list-disc list-inside" data-testid="unmatched-waste-list">
          {status.unmatchedSummaries.map(s => <li key={s}>{s}</li>)}
        </ul>
        <p className="text-xs opacity-80">
          Zuletzt geprüft: {status.checkedAt ? formatCheckedAt(status.checkedAt) : '—'}
        </p>
      </div>
    </div>
  )
}
