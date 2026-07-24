import { useRegisterSW } from 'virtual:pwa-register/react'
import Button from './ui/Button.jsx'

// Hinweis, sobald ein neuer Build bereitliegt (Redesign Phase 3c). Behebt das
// stille Stale-App-Problem: statt dass die neue Version erst nach komplettem
// Schließen aller PWA-Fenster greift, kann der Nutzer sofort neu laden.
// useRegisterSW registriert zugleich den Service Worker (vite.config.js hat
// deshalb injectRegister: false).
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed top-0 inset-x-0 z-40 flex justify-center px-4 pt-[env(safe-area-inset-top)]">
      <div className="mt-2 flex items-center gap-3 bg-primary-container text-on-primary-container rounded-card px-4 py-2 shadow-e2">
        <span className="text-sm">Neue Version verfügbar</span>
        <Button
          variant="primary"
          onClick={() => updateServiceWorker(true)}
          className="px-3 py-1.5 text-xs"
          data-testid="update-reload"
        >
          Neu laden
        </Button>
      </div>
    </div>
  )
}
