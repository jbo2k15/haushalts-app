import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

export default function ReleaseNotesModal() {
  const [notes, setNotes] = useState([])

  useEffect(() => {
    api.get('/release-notes')
      .then(data => {
        if (data.notes?.length > 0) setNotes(data.notes)
      })
      .catch(() => {})
  }, [])

  async function dismiss() {
    setNotes([])
    try {
      await api.put('/release-notes/seen', {})
    } catch {}
  }

  if (notes.length === 0) return null

  const latest = notes[notes.length - 1].version

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={dismiss}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        data-testid="release-notes-modal"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Was ist neu — v{latest}</h2>
          <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">✕</button>
        </div>
        <div className="space-y-4">
          {notes.map(n => (
            <div key={n.version} data-testid="release-note-entry" data-version={n.version}>
              {notes.length > 1 && (
                <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1">v{n.version}</p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{n.note}</p>
            </div>
          ))}
        </div>
        <button
          onClick={dismiss}
          data-testid="release-notes-dismiss"
          className="w-full bg-orange-600 text-white rounded-xl py-2 text-sm font-medium"
        >
          Verstanden
        </button>
      </div>
    </div>
  )
}
