import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

export default function ReleaseNotesModal() {
  const [note, setNote] = useState(null)
  const [version, setVersion] = useState(null)

  useEffect(() => {
    api.get('/release-notes')
      .then(data => {
        if (data.note && !data.seen) {
          setNote(data.note)
          setVersion(data.version)
        }
      })
      .catch(() => {})
  }, [])

  async function dismiss() {
    setNote(null)
    try {
      await api.put('/release-notes/seen', { version })
    } catch {}
  }

  if (!note) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={dismiss}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-3"
        onClick={e => e.stopPropagation()}
        data-testid="release-notes-modal"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Was ist neu — v{version}</h2>
          <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">✕</button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{note}</p>
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
