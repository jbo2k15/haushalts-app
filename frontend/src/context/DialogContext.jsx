import { createContext, useCallback, useContext, useState } from 'react'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'

// Promise-basierter Ersatz für native confirm()/alert() (Redesign Phase 2).
// useDialog() liefert `confirm(opts) -> Promise<boolean>` und
// `alert(opts|string) -> Promise<void>`. Aufrufstellen bleiben dadurch fast
// unverändert: aus `if (!confirm(...)) return` wird `if (!(await
// dialog.confirm(...))) return`.
const DialogContext = createContext({
  confirm: async () => false,
  alert: async () => {},
})

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)

  const confirm = useCallback((opts = {}) => new Promise(resolve => {
    setDialog({ mode: 'confirm', resolve, ...opts })
  }), [])

  const alert = useCallback((opts = {}) => new Promise(resolve => {
    const normalized = typeof opts === 'string' ? { message: opts } : opts
    setDialog({ mode: 'alert', resolve, ...normalized })
  }), [])

  function settle(result) {
    if (dialog) dialog.resolve(result)
    setDialog(null)
  }

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {/* Hintergrund inert, solange ein Dialog offen ist - Fokus-Falle,
          analog zu den anderen Modals (siehe REDESIGN.md). */}
      <div inert={dialog ? true : undefined}>{children}</div>
      {dialog && (
        <ConfirmDialog
          mode={dialog.mode}
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          tone={dialog.tone}
          onConfirm={() => settle(dialog.mode === 'confirm' ? true : undefined)}
          onCancel={() => settle(dialog.mode === 'confirm' ? false : undefined)}
        />
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  return useContext(DialogContext)
}
