import { useEffect, useRef, useState } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js'
import Button from './ui/Button.jsx'

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
        className="bg-surface-container rounded-modal w-full max-w-sm p-4 space-y-4"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-confirm-heading"
      >
        <div>
          <h2 id="exit-confirm-heading" className="text-sm font-semibold text-ink">App schließen?</h2>
          <p className="text-sm text-ink-muted mt-1">Möchtest du die App wirklich schließen?</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            data-testid="exit-confirm-dont-ask-again"
            checked={dontAskAgain}
            onChange={e => setDontAskAgain(e.target.checked)}
            className="accent-primary"
          />
          Nicht mehr fragen
        </label>
        <div className="flex gap-2">
          <Button ref={cancelRef} onClick={onCancel} data-testid="exit-confirm-cancel" variant="secondary" className="flex-1">
            Abbrechen
          </Button>
          <Button onClick={() => onConfirm(dontAskAgain)} data-testid="exit-confirm-confirm" variant="primary" className="flex-1">
            Schließen
          </Button>
        </div>
      </div>
    </div>
  )
}
