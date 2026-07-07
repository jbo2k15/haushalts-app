import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { urlBase64ToUint8Array } from '../lib/push.js'

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
    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-2xl px-4 py-3 mb-2">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">🔔</span>
        <div className="flex-1 min-w-0">
          {denied ? (
            <>
              <p className="text-sm font-medium text-orange-900 dark:text-orange-300">Push-Benachrichtigungen blockiert</p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                Bitte erlaube Benachrichtigungen in den Browser-Einstellungen für diese Seite.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-orange-900 dark:text-orange-300">Push-Benachrichtigungen aktivieren?</p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                Erhalte Erinnerungen an offene Aufgaben.
              </p>
            </>
          )}
          <div className="flex gap-2 mt-2">
            {!denied && (
              <button
                onClick={enable}
                disabled={loading}
                className="bg-orange-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
              >
                {loading ? 'Wird aktiviert…' : 'Einschalten'}
              </button>
            )}
            <button
              onClick={remindTomorrow}
              className="text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-700 rounded-lg px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800"
            >
              Morgen erinnern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
