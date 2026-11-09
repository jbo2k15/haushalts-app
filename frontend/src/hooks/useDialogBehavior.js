import { useEffect, useRef } from 'react'
import { useBodyScrollLock } from './useBodyScrollLock.js'

// Gemeinsames Verhalten fuer einfache Dialoge: Escape schliesst, die Seite
// darunter scrollt nicht mit (wie im Bearbeiten-Dialog der Verwaltung und im
// ConfirmDialog).
export function useDialogBehavior(active, onClose) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useBodyScrollLock(active)
  useEffect(() => {
    if (!active) return
    function handleKeyDown(event) {
      if (event.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active])
}
