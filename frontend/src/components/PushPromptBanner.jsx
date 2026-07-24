import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { urlBase64ToUint8Array } from '../lib/push.js'
import Button from './ui/Button.jsx'

const SNOOZE_KEY = 'pushSnoozedUntil'

function isSnoozed() {
  const until = localStorage.getItem(SNOOZE_KEY)
  return until && Date.now() < Number(until)
}

function snoozeUntilTomorrow() {
  localStorage.setItem(SNOOZE_KEY, Date.now() + 24 * 60 * 60 * 1000)
}

export default function PushPromptBanner() {
  const [visible, setVisible] = useState(false)
  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (isSnoozed()) return

    async function check() {
      const permission = Notification.permission
      if (permission === 'denied') {
        setDenied(true)
        setVisible(true)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub || permission !== 'granted') {
        setVisible(true)
        return
      }
      // The browser keeps a subscription object regardless of whether the
      // server still recognizes it (e.g. after a VAPID key rotation the
      // old subscription is dead server-side, but getSubscription() above
      // has no way to know that) - confirm with the backend too.
      try {
        const { exists } = await api.get(`/users/push-subscription?endpoint=${encodeURIComponent(sub.endpoint)}`)
        if (!exists) setVisible(true)
      } catch {}
    }
    check()
  }, [])

  async function enable() {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setDenied(true)
        setLoading(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      // A stale subscription from before a VAPID key rotation (still
      // present in the browser even though the server no longer has it)
      // must be dropped first - browsers refuse to subscribe() with a new
      // applicationServerKey while one is already active.
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
      const keyData = await api.get('/vapid-public-key')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.key),
      })
      const json = sub.toJSON()
      await api.post('/users/push-subscription', {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      })
      setVisible(false)
    } catch {
      snoozeUntilTomorrow()
      setVisible(false)
    }
    setLoading(false)
  }

  function remindTomorrow() {
    snoozeUntilTomorrow()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="bg-primary-container rounded-card px-4 py-3 mb-2">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">🔔</span>
        <div className="flex-1 min-w-0">
          {denied ? (
            <>
              <p className="text-sm font-medium text-on-primary-container">Push-Benachrichtigungen blockiert</p>
              <p className="text-xs text-on-primary-container mt-0.5">
                Bitte erlaube Benachrichtigungen in den Browser-Einstellungen für diese Seite.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-on-primary-container">Push-Benachrichtigungen aktivieren?</p>
              <p className="text-xs text-on-primary-container mt-0.5">
                Erhalte Erinnerungen an offene Aufgaben.
              </p>
            </>
          )}
          <div className="flex gap-2 mt-2">
            {!denied && (
              <Button
                onClick={enable}
                disabled={loading}
                variant="primary"
                className="px-3 py-1.5 text-xs"
              >
                {loading ? 'Wird aktiviert…' : 'Einschalten'}
              </Button>
            )}
            <Button
              onClick={remindTomorrow}
              variant="secondary"
              className="px-3 py-1.5 text-xs bg-surface-container"
            >
              Morgen erinnern
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
