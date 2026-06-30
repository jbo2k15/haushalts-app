import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Stale-while-revalidate für /api/tasks:
// Cached-Antwort wird sofort zurückgegeben, im Hintergrund wird aktualisiert.
registerRoute(
  ({ url }) => url.pathname === '/api/tasks',
  new StaleWhileRevalidate({
    cacheName: 'api-tasks-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 300 }),
    ],
  })
)

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
