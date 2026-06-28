import webpush from 'web-push'
import prisma from '../lib/prisma.js'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function sendPushToUser(userId, payload) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    } catch (err) {
      console.error(`[Push] Fehler beim Senden an ${sub.endpoint.slice(-20)}: ${err.statusCode} ${err.message}`)
      if (err.statusCode === 410 || err.statusCode === 404) {
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
