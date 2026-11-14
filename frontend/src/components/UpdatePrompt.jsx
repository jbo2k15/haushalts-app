import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import Button from './ui/Button.jsx'

// Hinweis, sobald ein neuer Build bereitliegt (Redesign Phase 3c). Behebt das
// stille Stale-App-Problem: statt dass die neue Version erst nach komplettem
// Schließen aller PWA-Fenster greift, kann der Nutzer sofort neu laden.
// useRegisterSW registriert zugleich den Service Worker (vite.config.js hat
// deshalb injectRegister: false).
//
// Position unten ueber der Navigation statt am oberen Rand: oben lag der Knopf
// auf manchen Smartphones im Bereich der Statusleiste bzw. Kamera-Aussparung
// (Geraet meldet keinen Sicherheitsabstand) und liess sich nicht antippen.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const [busy, setBusy] = useState(false)

  if (!needRefresh) return null

  // Uebergabe an die neue Version absichern: Normalfall ist
  // updateServiceWorker(true) -> neuer Worker uebernimmt -> Seite laedt neu.
  // Auf manchen Geraeten kommt diese Uebergabe nicht an; dann die Nachricht
  // direkt an den wartenden Worker schicken und spaetestens nach 4 s selbst
  // neu laden, damit der Tipp nie ohne sichtbare Wirkung bleibt.
  async function applyUpdate() {
    if (busy) return
    setBusy(true)
    let reloaded = false
    const reload = () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }
    try {
      navigator.serviceWorker?.addEventListener('controllerchange', reload, { once: true })
    } catch {}
    try {
      await updateServiceWorker(true)
    } catch {}
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
    } catch {}
    setTimeout(reload, 4000)
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4" role="status">
      <div className="flex items-center gap-3 bg-primary-container text-on-primary-container rounded-card pl-4 pr-2 py-2 shadow-e2">
        <span className="text-sm">Neue Version verfügbar</span>
        <Button
          variant="primary"
          onClick={applyUpdate}
          disabled={busy}
          className="min-h-11 px-4 text-sm"
          data-testid="update-reload"
        >
          {busy ? 'Lädt neu …' : 'Neu laden'}
        </Button>
      </div>
    </div>
  )
}
