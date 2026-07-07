import webpush from 'web-push'
import prisma from '../lib/prisma.js'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function sendPushToUser(userId, payload) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) {
    console.log(`[Push] Keine Subscriptions für userId=${userId}`)
    return
  }
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
      console.log(`[Push] ✓ Gesendet an ...${sub.endpoint.slice(-20)}`)
    } catch (err) {
      console.error(`[Push] Fehler beim Senden an ...${sub.endpoint.slice(-20)}: ${err.statusCode} ${err.message}`)
      // 410/404: push service says the subscription itself is gone.
      // 401/403: our VAPID keys no longer match what the subscription was
      // created with (e.g. after a key rotation) - the endpoint will never
      // accept a push from us again either, so it's just as dead.
      if ([401, 403, 404, 410].includes(err.statusCode)) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } })
      }
    }
  }
}

export async function sendPushToAll(payload) {
  const users = await prisma.user.findMany({ where: { approved: true } })
  for (const user of users) {
    await sendPushToUser(user.id, payload)
  }
}
