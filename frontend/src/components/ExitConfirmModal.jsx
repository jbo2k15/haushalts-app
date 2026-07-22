import { useEffect, useRef, useState } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js'

export const HIDE_EXIT_CONFIRM_KEY = 'hideExitConfirm'

export default function ExitConfirmModal({ onCancel, onConfirm }) {
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const cancelRef = useRef(null)

  useBodyScrollLock(true)

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    // Focus the non-destructive default action, not the checkbox - a stray
    // Enter press should cancel, not accidentally confirm-and-hide-forever.
    cancelRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel} data-testid="exit-confirm-modal">
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-4 space-y-4"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-confirm-heading"
      >
        <div>
          <h2 id="exit-confirm-heading" className="text-sm font-semibold text-gray-800 dark:text-gray-200">App schließen?</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Möchtest du die App wirklich schließen?</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            data-testid="exit-confirm-dont-ask-again"
            checked={dontAskAgain}
            onChange={e => setDontAskAgain(e.target.checked)}
            className="accent-orange-600"
          />
          Nicht mehr fragen
        </label>
        <div className="flex gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            data-testid="exit-confirm-cancel"
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl py-2 text-sm font-medium"
          >
            Abbrechen
          </button>
          <button
            onClick={() => onConfirm(dontAskAgain)}
            data-testid="exit-confirm-confirm"
            className="flex-1 bg-orange-600 text-white rounded-xl py-2 text-sm font-medium"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}
