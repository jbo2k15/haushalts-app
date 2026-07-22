import { useEffect } from 'react'

// Ref-counted so two overlays open at once (e.g. the header menu still open
// when the exit-confirmation appears) don't have the first one to close
// unlock scrolling while the second is still up.
let lockCount = 0

function lock() {
  if (lockCount === 0) document.body.style.overflow = 'hidden'
  lockCount++
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) document.body.style.overflow = ''
}

export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
