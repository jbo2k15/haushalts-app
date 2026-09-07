import { describe, it, expect, vi, afterEach } from 'vitest'
import prisma from '../../src/lib/prisma.js'
import { createLocation, createCategory, createItem, setQuantity } from '../../src/domain/storage.js'

vi.mock('../../src/services/push.js', () => ({ sendPushToUser: vi.fn() }))
const { sendPushToUser } = await import('../../src/services/push.js')
const { checkLowStockAlerts } = await import('../../src/services/storage-alerts.js')

afterEach(() => vi.mocked(sendPushToUser).mockReset())

async function makeItem(quantity, minQuantity = 1) {
  const location = await createLocation({ name: 'Garage' })
  const category = await createCategory(location.id, { name: 'Konserven' })
  return createItem(category.id, { name: 'Tomaten', quantity, minQuantity })
}

async function createUser(overrides = {}) {
  return prisma.user.create({
    data: { email: `${Math.random().toString(36).slice(2)}@test.com`, passwordHash: 'x', name: 'Test', role: 'user', approved: true, ...overrides },
  })
}

describe('checkLowStockAlerts', () => {
  it('pusht einmalig, wenn ein Artikel neu unter die Mindestmenge fällt', async () => {
    const user = await createUser()
    const item = await makeItem(0, 1)

    await checkLowStockAlerts()

    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    expect(sendPushToUser).toHaveBeenCalledWith(user.id, expect.objectContaining({ body: expect.stringContaining('Tomaten') }))
  })

  it('pusht nicht erneut, solange derselbe Artikel weiter knapp bleibt', async () => {
    await createUser()
    const item = await makeItem(0, 1)

    await checkLowStockAlerts()
    await checkLowStockAlerts()

    expect(sendPushToUser).toHaveBeenCalledTimes(1)
  })

  it('pusht nicht, wenn kein Artikel knapp ist', async () => {
    await createUser()
    await makeItem(5, 1)

    await checkLowStockAlerts()

    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('meldet einen wieder aufgefüllten und dann erneut knappen Artikel erneut', async () => {
    await createUser()
    const item = await makeItem(0, 1)

    await checkLowStockAlerts() // 1. Meldung
    await setQuantity(item.id, 5) // aufgefüllt
    await checkLowStockAlerts() // Bestand ok, keine Meldung, aber notifiedItemIds bereinigt
    await setQuantity(item.id, 0) // erneut knapp
    await checkLowStockAlerts() // 2. Meldung, da "frisch"

    expect(sendPushToUser).toHaveBeenCalledTimes(2)
  })

  it('bündelt mehrere neu knappe Artikel in einer Nachricht', async () => {
    const user = await createUser()
    const location = await createLocation({ name: 'Garage' })
    const category = await createCategory(location.id, { name: 'Konserven' })
    await createItem(category.id, { name: 'Milch', quantity: 0, minQuantity: 1 })
    await createItem(category.id, { name: 'Mehl', quantity: 0, minQuantity: 1 })

    await checkLowStockAlerts()

    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    const body = vi.mocked(sendPushToUser).mock.calls[0][1].body
    expect(body).toContain('Milch')
    expect(body).toContain('Mehl')
  })
})
