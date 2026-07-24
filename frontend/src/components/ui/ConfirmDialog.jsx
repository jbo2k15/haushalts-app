import { useEffect, useRef } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js'
import Button from './Button.jsx'

// Eigener Bestätigungs-/Hinweis-Dialog (Redesign Phase 2) als Ersatz für die
// nativen confirm()/alert(). Wird zentral vom DialogProvider gerendert; die
// Fokus-Falle (Hintergrund inert) liegt dort. Hier: Token-Optik, Escape/
// Backdrop schließen, Autofokus auf die sichere Aktion, Hintergrund-Scroll-
// Sperre.
export default function ConfirmDialog({ mode = 'confirm', title, message, confirmLabel, cancelLabel = 'Abbrechen', tone = 'default', onConfirm, onCancel }) {
  const confirmRef = useRef(null)
  const cancelRef = useRef(null)

  useBodyScrollLock(true)

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    // Sichere Aktion vorfokussieren: bei confirm der Abbrechen-Button (kein
    // versehentliches Bestätigen per Enter), bei alert der einzige OK-Button.
    const focusTarget = mode === 'confirm' ? cancelRef.current : confirmRef.current
    focusTarget?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [mode, onCancel])

  const resolvedConfirmLabel = confirmLabel || (mode === 'alert' ? 'OK' : 'Bestätigen')
  const labelProps = title ? { 'aria-labelledby': 'confirm-dialog-heading' } : { 'aria-label': message }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel} data-testid="confirm-dialog">
      <div
        className="bg-surface-container rounded-modal w-full max-w-sm p-4 space-y-4"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        {...labelProps}
      >
        <div>
          {title && <h2 id="confirm-dialog-heading" className="text-sm font-semibold text-ink">{title}</h2>}
          {message && <p className={`text-sm text-ink-muted ${title ? 'mt-1' : ''}`}>{message}</p>}
        </div>
        <div className="flex gap-2">
          {mode === 'confirm' && (
            <Button ref={cancelRef} onClick={onCancel} data-testid="confirm-dialog-cancel" variant="secondary" className="flex-1">
              {cancelLabel}
            </Button>
          )}
          <Button ref={confirmRef} onClick={onConfirm} data-testid="confirm-dialog-confirm" variant={tone === 'danger' ? 'danger' : 'primary'} className="flex-1">
            {resolvedConfirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
