import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Prompt-für-Update-Fluss (vite.config.js registerType: 'prompt'): der von
// useRegisterSW (UpdatePrompt.jsx) ausgelöste updateServiceWorker() schickt
// diese Nachricht; erst dann übernimmt der wartende neue Worker. clients.claim
// sorgt dafür, dass die neue Version nach dem Aktivieren die offenen Seiten
// steuert (löst controllerchange → Reload aus).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// /api/tasks ist mutable Echtzeit-Zustand (Toggles, SSE-Updates) — bewusst
// NICHT über den Service Worker cachen. Ein Stale-While-Revalidate lieferte
// nach jedem Toggle erst die veraltete Antwort zurück und überschrieb damit
// den optimistischen UI-Status, bis der Cache im Hintergrund nachzog.

self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'Haushalt', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin) && 'focus' in c)
      if (existing) return existing.focus()
      return clients.openWindow('/')
    })
  )
})
