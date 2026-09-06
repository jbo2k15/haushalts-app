import { describe, it, expect } from 'vitest'
import prisma from '../../src/lib/prisma.js'
import {
  effectiveMinQuantity,
  createLocation,
  createCategory,
  createItem,
  reorderCategories,
  reorderItems,
} from '../../src/domain/storage.js'

async function makeLocation(name = 'Kühlschrank Garage') {
  return createLocation({ name })
}

describe('effectiveMinQuantity', () => {
  it('nutzt den Kategorie-Default, wenn der Artikel keine eigene Mindestmenge hat', () => {
    const item = { minQuantity: null, category: { defaultMinQuantity: 3 } }
    expect(effectiveMinQuantity(item)).toBe(3)
  })

  it('nutzt den Artikel-Override, wenn gesetzt', () => {
    const item = { minQuantity: 5, category: { defaultMinQuantity: 3 } }
    expect(effectiveMinQuantity(item)).toBe(5)
  })

  it('erlaubt 0 als expliziten Override (nicht mit "nicht gesetzt" verwechseln)', () => {
    const item = { minQuantity: 0, category: { defaultMinQuantity: 3 } }
    expect(effectiveMinQuantity(item)).toBe(0)
  })
})

describe('createCategory', () => {
  it('lehnt eine doppelte Kategorie am selben Lagerort ab', async () => {
    const location = await makeLocation()
    await createCategory(location.id, { name: 'Konserven' })
    await expect(createCategory(location.id, { name: 'Konserven' })).rejects.toMatchObject({ status: 409 })
  })

  it('erlaubt denselben Kategorienamen an unterschiedlichen Lagerorten', async () => {
    const locationA = await makeLocation('Kühlschrank Garage')
    const locationB = await makeLocation('Vorratsschrank Haus')
    await createCategory(locationA.id, { name: 'Konserven' })
    await expect(createCategory(locationB.id, { name: 'Konserven' })).resolves.toMatchObject({ name: 'Konserven' })
  })

  it('lehnt einen leeren Namen ab', async () => {
    const location = await makeLocation()
    await expect(createCategory(location.id, { name: '  ' })).rejects.toMatchObject({ status: 400 })
  })
})

describe('reorderCategories — Ownership-Schutz', () => {
  it('lehnt eine ID ab, die zu einem anderen Lagerort gehört', async () => {
    const locationA = await makeLocation('A')
    const locationB = await makeLocation('B')
    const catA = await createCategory(locationA.id, { name: 'Konserven' })
    const catB = await createCategory(locationB.id, { name: 'Getränke' })

    await expect(reorderCategories(locationA.id, [catA.id, catB.id])).rejects.toMatchObject({ status: 400 })
  })

  it('speichert eine gültige Reihenfolge innerhalb desselben Lagerorts', async () => {
    const location = await makeLocation()
    const catA = await createCategory(location.id, { name: 'Konserven' })
    const catB = await createCategory(location.id, { name: 'Getränke' })

    await reorderCategories(location.id, [catB.id, catA.id])

    const updatedA = await prisma.storageCategory.findUnique({ where: { id: catA.id } })
    const updatedB = await prisma.storageCategory.findUnique({ where: { id: catB.id } })
    expect(updatedB.sortOrder).toBeLessThan(updatedA.sortOrder)
  })
})

describe('reorderItems — Ownership-Schutz', () => {
  it('lehnt eine ID ab, die zu einer anderen Kategorie gehört', async () => {
    const location = await makeLocation()
    const catA = await createCategory(location.id, { name: 'Konserven' })
    const catB = await createCategory(location.id, { name: 'Getränke' })
    const itemA = await createItem(catA.id, { name: 'Tomaten' })
    const itemB = await createItem(catB.id, { name: 'Wasser' })

    await expect(reorderItems(catA.id, [itemA.id, itemB.id])).rejects.toMatchObject({ status: 400 })
  })
})

describe('createItem', () => {
  it('übernimmt den Lagerort automatisch von der Kategorie', async () => {
    const location = await makeLocation()
    const category = await createCategory(location.id, { name: 'Konserven' })
    const item = await createItem(category.id, { name: 'Tomaten', quantity: 3 })
    expect(item.locationId).toBe(location.id)
  })

  it('lehnt eine negative Menge ab', async () => {
    const location = await makeLocation()
    const category = await createCategory(location.id, { name: 'Konserven' })
    await expect(createItem(category.id, { name: 'Tomaten', quantity: -1 })).rejects.toMatchObject({ status: 400 })
  })
})
