import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext.jsx'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js'

// Shared header menu for every page except Login/Register/password flows -
// replaces the old per-page "← Zurück" buttons. Home and Hall of Fame are
// also reachable by swiping between them (see PageCarousel.jsx), but this
// menu is the one constant, always-available way to reach any page from
// anywhere, including Settings and Admin which aren't part of the carousel.
export default function HeaderMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const firstItemRef = useRef(null)

  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    firstItemRef.current?.focus()
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  // Replace, not push, for the two carousel routes - keeps history consistent
  // with the carousel's own swipe navigation (see PageCarousel.jsx), which
  // also only replaces. Mixing push and replace between the menu and swiping
  // created extra history entries that could point at a stale URL.
  function goCarousel(path) {
    setOpen(false)
    navigate(path, { replace: true })
  }

  // Settings/Admin sit outside the carousel entirely, so the history-mismatch
  // issue above doesn't apply here - push normally instead, so the native
  // browser/OS back gesture (and hardware back button on Android) actually
  // works to leave these pages, not just the menu.
  function goPush(path) {
    setOpen(false)
    navigate(path)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-700 dark:text-orange-400 font-medium text-sm"
        onClick={() => setOpen(o => !o)}
        data-testid="header-menu-toggle"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {user?.name?.[0]?.toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 top-11 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xs w-48 z-10 overflow-hidden" data-testid="header-menu" role="menu">
          <button ref={firstItemRef} role="menuitem" className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5" onClick={() => goCarousel('/')}>
            <span>📋</span> Aufgabenübersicht
          </button>
          <button role="menuitem" className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2.5" onClick={() => goPush('/settings')}>
            <span>⚙️</span> Einstellungen
          </button>
          <button role="menuitem" className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2.5" onClick={() => goCarousel('/hall-of-fame')}>
            <span>🏆</span> Ruhmeshalle
          </button>
          {user?.role === 'admin' && (
            <button role="menuitem" className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2.5" onClick={() => goPush('/admin')}>
              <span>🛠️</span> Verwaltung
            </button>
          )}
          <button role="menuitem" className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2.5" onClick={logout}>
            <span>🚪</span> Abmelden
          </button>
        </div>
      )}
    </div>
  )
}
