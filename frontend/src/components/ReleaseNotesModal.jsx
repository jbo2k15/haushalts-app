import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useModalGate } from '../context/ModalGateContext.jsx'

export default function ReleaseNotesModal() {
  const [notes, setNotes] = useState([])
  const { setModalOpen, setReleaseNotesOpen } = useModalGate()

  useEffect(() => {
    // Tell the backend which version this browser is actually running - the
    // service worker only takes over a new bundle once the app is fully
    // closed and reopened, so the frontend can lag behind an already-
    // redeployed backend for a while. Without this, the modal (and what
    // counts as "seen") would be driven by the backend's version instead of
    // what's really on screen, showing notes for features that haven't
    // actually loaded yet.
    api.get(`/release-notes?clientVersion=${encodeURIComponent(__APP_VERSION__)}`)
      .then(data => {
        if (data.notes?.length > 0) setNotes(data.notes)
      })
      .catch(() => {})
  }, [])

  // Reports to PageCarousel so it can disable swipe navigation while this
  // is up - two competing gesture surfaces at once is asking for bugs.
  useEffect(() => {
    setModalOpen(notes.length > 0)
    setReleaseNotesOpen(notes.length > 0)
    return () => {
      setModalOpen(false)
      setReleaseNotesOpen(false)
    }
  }, [notes.length, setModalOpen, setReleaseNotesOpen])

  async function dismiss() {
    setNotes([])
    try {
      await api.put('/release-notes/seen', { clientVersion: __APP_VERSION__ })
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
          <button onClick={dismiss} aria-label="Schließen" className="shrink-0 w-11 h-11 -my-2 -mr-2 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">✕</button>
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
