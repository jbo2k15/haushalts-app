import { useLocation, useNavigate } from 'react-router'
import { ListChecks, Trophy, Wrench, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

// Einheitliche Bottom-Navigation (Redesign Phase 3) - ersetzt das frühere
// Header-Menü. Zeigt die aktive Position und ist zugleich Tap-Shortcut zu
// allen Zielen. Aufgaben/Ruhmeshalle sind Carousel-Slides (replace-Navigation,
// konsistent mit dem Wischen), Verwaltung/Einstellungen eigene Routen (push).
const ITEMS = [
  { path: '/', label: 'Aufgaben', testid: 'nav-home', Icon: ListChecks, replace: true },
  { path: '/hall-of-fame', label: 'Ruhmeshalle', testid: 'nav-hall-of-fame', Icon: Trophy, replace: true },
  { path: '/admin', label: 'Verwaltung', testid: 'nav-admin', Icon: Wrench, adminOnly: true },
  { path: '/settings', label: 'Einstellungen', testid: 'nav-settings', Icon: Settings },
]

// Login/Registrierung/Passwort-Flows haben keine Bottom-Nav.
const HIDDEN_ON = ['/login', '/register', '/forgot-password', '/reset-password', '/change-password']

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (!user || HIDDEN_ON.includes(location.pathname)) return null

  const items = ITEMS.filter(item => !item.adminOnly || user.role === 'admin')

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed bottom-0 inset-x-0 z-30 flex justify-around bg-surface-container border-t border-outline pb-[env(safe-area-inset-bottom)]"
    >
      {items.map(({ path, label, testid, Icon, replace }) => {
        const active = location.pathname === path
        return (
          <button
            key={path}
            type="button"
            data-testid={testid}
            onClick={() => navigate(path, replace ? { replace: true } : undefined)}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 min-h-[3.25rem] flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
              active ? 'text-primary' : 'text-ink-faint'
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
