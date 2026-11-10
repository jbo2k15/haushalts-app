import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

// Fragt das Backend, ob die Selbst-Registrierung eingeschaltet ist
// (REGISTRATION_ENABLED, Standard: aus). null = noch nicht bekannt.
// Schlägt die Abfrage fehl, gilt "aus" - der Server lehnt POST /register
// ohnehin selbst ab, hier geht es nur um die Anzeige.
export function useRegistrationEnabled() {
  const [enabled, setEnabled] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.get('/auth/config')
      .then(cfg => { if (!cancelled) setEnabled(cfg?.registrationEnabled === true) })
      .catch(() => { if (!cancelled) setEnabled(false) })
    return () => { cancelled = true }
  }, [])

  return enabled
}
