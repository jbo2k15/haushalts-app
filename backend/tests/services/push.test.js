import { describe, it, expect, vi, afterEach } from 'vitest'
import webpush from 'web-push'
import prisma from '../../src/lib/prisma.js'
import { sendPushToUser } from '../../src/services/push.js'

async function createUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: 'push-test@example.com',
      passwordHash: 'irrelevant',
      name: 'Push Test User',
      role: 'user',
      approved: true,
      ...overrides,
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sendPushToUser', () => {
  it('sendet erfolgreich und behält die Subscription', async () => {
    vi.spyOn(webpush, 'sendNotification').mockResolvedValue({})
    const user = await createUser()
    await prisma.pushSubscription.create({ data: { userId: user.id, endpoint: 'https://push.example.com/ok', p256dh: 'k', auth: 'a' } })

    await sendPushToUser(user.id, { title: 'Test' })

    const remaining = await prisma.pushSubscription.findMany({ where: { userId: user.id } })
    expect(remaining).toHaveLength(1)
  })

  it.each([401, 403, 404, 410])('entfernt die Subscription bei HTTP %i (dauerhaft ungültig)', async (statusCode) => {
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue({ statusCode, message: 'fail' })
    const user = await createUser({ email: `push-${statusCode}@example.com` })
    await prisma.pushSubscription.create({ data: { userId: user.id, endpoint: `https://push.example.com/${statusCode}`, p256dh: 'k', auth: 'a' } })

    await sendPushToUser(user.id, { title: 'Test' })

    const remaining = await prisma.pushSubscription.findMany({ where: { userId: user.id } })
    expect(remaining).toHaveLength(0)
  })

  it('behält die Subscription bei einem transienten Fehler (z.B. 500 vom Push-Dienst)', async () => {
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue({ statusCode: 500, message: 'server error' })
    const user = await createUser({ email: 'push-500@example.com' })
    await prisma.pushSubscription.create({ data: { userId: user.id, endpoint: 'https://push.example.com/500', p256dh: 'k', auth: 'a' } })

    await sendPushToUser(user.id, { title: 'Test' })

    const remaining = await prisma.pushSubscription.findMany({ where: { userId: user.id } })
    expect(remaining).toHaveLength(1)
  })

  it('macht nichts, wenn der Nutzer keine Subscriptions hat', async () => {
    vi.spyOn(webpush, 'sendNotification')
    const user = await createUser({ email: 'push-none@example.com' })

    await sendPushToUser(user.id, { title: 'Test' })

    expect(webpush.sendNotification).not.toHaveBeenCalled()
  })
})
