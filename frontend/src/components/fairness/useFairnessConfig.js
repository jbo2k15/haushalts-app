import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'

// Fairness-Statistik: ob das Feature serverseitig an ist (FAIRNESS_ENABLED)
// und ob der angemeldete Nutzer die Karte sehen darf. Einmal pro Seitenaufruf
// geladen und zwischen allen Komponenten geteilt; refreshFairnessConfig()
// laedt neu (z. B. nachdem ein Admin seine eigene Freigabe geaendert hat).
const EVENT = 'fairness-config-changed'
const DISABLED = { enabled: false, canView: false }
let cached = null
let pending = null

function load() {
  if (!pending) {
    pending = api.get('/fairness/config')
      .then(cfg => (cached = { enabled: cfg?.enabled === true, canView: cfg?.canView === true }))
      .catch(() => (cached = DISABLED))
      .finally(() => { pending = null })
  }
  return pending
}

export function refreshFairnessConfig() {
  cached = null
  return load().then(cfg => {
    window.dispatchEvent(new Event(EVENT))
    return cfg
  })
}

export function useFairnessConfig() {
  const [config, setConfig] = useState(cached)
  useEffect(() => {
    let active = true
    const update = () => { if (active) setConfig(cached) }
    if (!cached) load().then(update)
    window.addEventListener(EVENT, update)
    return () => { active = false; window.removeEventListener(EVENT, update) }
  }, [])
  return config
}
