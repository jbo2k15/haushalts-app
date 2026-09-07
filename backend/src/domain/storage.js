// Vorratsschrank-Domänenlogik: Lagerorte > Kategorien > Artikel, jeweils mit
// eigener sortOrder. Berechtigungen (Orte = Admin, Rest = alle) werden auf
// Routen-Ebene per Middleware durchgesetzt (siehe routes/storage.js), nicht
// hier - Domänenfunktionen kennen keine Rollen.
import prisma from '../lib/prisma.js'
import { httpError } from '../lib/httpError.js'

// null bei item.minQuantity heisst "nutze den Kategorie-Default" - so muss
// nicht jeder Artikel einzeln gepflegt werden, kann aber ueberschrieben werden
// (z.B. Klopapier braucht mehr als ein Gewuerz, trotz gleicher Kategorie).
export function effectiveMinQuantity(item) {
  return item.minQuantity ?? item.category.defaultMinQuantity
}

const ITEM_ORDER = { orderBy: { sortOrder: 'asc' } }
const CATEGORY_INCLUDE = { items: ITEM_ORDER }

export async function listLocations() {
  return prisma.storageLocation.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      categories: {
        orderBy: { sortOrder: 'asc' },
        include: CATEGORY_INCLUDE,
      },
    },
  })
}

function validateName(name) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) return 'Name ist erforderlich'
  if (name.length > 100) return 'Name darf maximal 100 Zeichen haben'
  return null
}

async function nextSortOrder(model, where) {
  const max = await model.aggregate({ where, _max: { sortOrder: true } })
  return (max._max.sortOrder ?? -1) + 1
}

// Prueft, dass jede ID in orderedIds tatsaechlich zu genau den erwarteten
// Datensaetzen gehoert (verhindert, dass ein Reorder-Aufruf fremde
// Orte/Kategorien/Artikel per untergeschobener ID mitverschiebt).
async function verifyOwnership(model, where, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) throw httpError(400, 'Ungültige Reihenfolge')
  const existing = await model.findMany({ where: { ...where, id: { in: orderedIds } }, select: { id: true } })
  if (existing.length !== orderedIds.length) throw httpError(400, 'Unbekannte oder fremde ID in der Reihenfolge')
}

async function applyOrder(model, orderedIds) {
  await prisma.$transaction(orderedIds.map((id, i) => model.update({ where: { id }, data: { sortOrder: i } })))
}

// ── Lagerorte (Admin-only auf Routen-Ebene) ─────────────────────────────────

export async function createLocation({ name }) {
  const err = validateName(name)
  if (err) throw httpError(400, err)
  const sortOrder = await nextSortOrder(prisma.storageLocation, {})
  return prisma.storageLocation.create({ data: { name: name.trim(), sortOrder } })
}

export async function renameLocation(id, { name }) {
  const err = validateName(name)
  if (err) throw httpError(400, err)
  const location = await prisma.storageLocation.findUnique({ where: { id } })
  if (!location) throw httpError(404, 'Lagerort nicht gefunden')
  return prisma.storageLocation.update({ where: { id }, data: { name: name.trim() } })
}

export async function deleteLocation(id) {
  const location = await prisma.storageLocation.findUnique({ where: { id } })
  if (!location) throw httpError(404, 'Lagerort nicht gefunden')
  await prisma.storageLocation.delete({ where: { id } }) // kaskadiert Kategorien + Artikel
  return { message: 'Gelöscht' }
}

export async function reorderLocations(orderedIds) {
  await verifyOwnership(prisma.storageLocation, {}, orderedIds)
  await applyOrder(prisma.storageLocation, orderedIds)
  return { message: 'Reihenfolge gespeichert' }
}

// ── Kategorien (offen für alle Haushaltsmitglieder) ─────────────────────────

export async function createCategory(locationId, { name, defaultMinQuantity }) {
  const err = validateName(name)
  if (err) throw httpError(400, err)
  const location = await prisma.storageLocation.findUnique({ where: { id: locationId } })
  if (!location) throw httpError(404, 'Lagerort nicht gefunden')

  const sortOrder = await nextSortOrder(prisma.storageCategory, { locationId })
  try {
    return await prisma.storageCategory.create({
      data: {
        locationId,
        name: name.trim(),
        defaultMinQuantity: Number.isInteger(defaultMinQuantity) && defaultMinQuantity >= 0 ? defaultMinQuantity : 1,
        sortOrder,
      },
    })
  } catch (err) {
    if (err.code === 'P2002') throw httpError(409, 'Diese Kategorie gibt es an diesem Lagerort bereits')
    throw err
  }
}

export async function updateCategory(id, { name, defaultMinQuantity }) {
  const err = validateName(name)
  if (err) throw httpError(400, err)
  const category = await prisma.storageCategory.findUnique({ where: { id } })
  if (!category) throw httpError(404, 'Kategorie nicht gefunden')

  try {
    return await prisma.storageCategory.update({
      where: { id },
      data: {
        name: name.trim(),
        defaultMinQuantity: Number.isInteger(defaultMinQuantity) && defaultMinQuantity >= 0 ? defaultMinQuantity : category.defaultMinQuantity,
      },
    })
  } catch (err) {
    if (err.code === 'P2002') throw httpError(409, 'Diese Kategorie gibt es an diesem Lagerort bereits')
    throw err
  }
}

export async function deleteCategory(id) {
  const category = await prisma.storageCategory.findUnique({ where: { id } })
  if (!category) throw httpError(404, 'Kategorie nicht gefunden')
  await prisma.storageCategory.delete({ where: { id } }) // kaskadiert Artikel
  return { message: 'Gelöscht' }
}

export async function reorderCategories(locationId, orderedIds) {
  await verifyOwnership(prisma.storageCategory, { locationId }, orderedIds)
  await applyOrder(prisma.storageCategory, orderedIds)
  return { message: 'Reihenfolge gespeichert' }
}

// ── Artikel (offen für alle Haushaltsmitglieder) ────────────────────────────

function validateQuantity(quantity) {
  return Number.isInteger(quantity) && quantity >= 0
}

export async function createItem(categoryId, { name, quantity, unit, minQuantity }) {
  const err = validateName(name)
  if (err) throw httpError(400, err)
  if (quantity != null && !validateQuantity(quantity)) throw httpError(400, 'Menge muss eine nicht-negative Ganzzahl sein')
  if (minQuantity != null && !validateQuantity(minQuantity)) throw httpError(400, 'Mindestmenge muss eine nicht-negative Ganzzahl sein')

  const category = await prisma.storageCategory.findUnique({ where: { id: categoryId } })
  if (!category) throw httpError(404, 'Kategorie nicht gefunden')

  const sortOrder = await nextSortOrder(prisma.storageItem, { categoryId })
  return prisma.storageItem.create({
    data: {
      name: name.trim(),
      locationId: category.locationId,
      categoryId,
      quantity: quantity ?? 0,
      unit: unit?.trim() || null,
      minQuantity: minQuantity ?? null,
      sortOrder,
    },
  })
}

export async function updateItem(id, { name, quantity, unit, minQuantity, categoryId }) {
  const err = validateName(name)
  if (err) throw httpError(400, err)
  if (quantity != null && !validateQuantity(quantity)) throw httpError(400, 'Menge muss eine nicht-negative Ganzzahl sein')
  if (minQuantity !== undefined && minQuantity !== null && !validateQuantity(minQuantity)) throw httpError(400, 'Mindestmenge muss eine nicht-negative Ganzzahl sein')

  const item = await prisma.storageItem.findUnique({ where: { id } })
  if (!item) throw httpError(404, 'Artikel nicht gefunden')

  // Kategorie-Wechsel bewusst nicht per Drag, aber ueber Bearbeiten moeglich
  // (siehe TODO.md) - dabei den Lagerort der neuen Kategorie uebernehmen,
  // sonst wuerde locationId/categoryId auseinanderlaufen.
  let data = { name: name.trim(), unit: unit?.trim() || null, minQuantity: minQuantity ?? null }
  if (quantity != null) data.quantity = quantity
  if (categoryId && categoryId !== item.categoryId) {
    const newCategory = await prisma.storageCategory.findUnique({ where: { id: categoryId } })
    if (!newCategory) throw httpError(404, 'Kategorie nicht gefunden')
    data.categoryId = categoryId
    data.locationId = newCategory.locationId
  }

  return prisma.storageItem.update({ where: { id }, data })
}

export async function setQuantity(id, quantity) {
  if (!validateQuantity(quantity)) throw httpError(400, 'Menge muss eine nicht-negative Ganzzahl sein')
  const item = await prisma.storageItem.findUnique({ where: { id } })
  if (!item) throw httpError(404, 'Artikel nicht gefunden')
  return prisma.storageItem.update({ where: { id }, data: { quantity } })
}

export async function deleteItem(id) {
  const item = await prisma.storageItem.findUnique({ where: { id } })
  if (!item) throw httpError(404, 'Artikel nicht gefunden')
  await prisma.storageItem.delete({ where: { id } })
  return { message: 'Gelöscht' }
}

export async function reorderItems(categoryId, orderedIds) {
  await verifyOwnership(prisma.storageItem, { categoryId }, orderedIds)
  await applyOrder(prisma.storageItem, orderedIds)
  return { message: 'Reihenfolge gespeichert' }
}

// ── Autocomplete ─────────────────────────────────────────────────────────

// Einkaufsliste (TODO.md "Vorratsschrank-Verwaltung"): Artikel mit
// quantity <= effectiveMinQuantity, ueber alle Lagerorte hinweg. Reine
// Datenabfrage - Push-Benachrichtigung + Dedupe liegt bewusst in
// services/storage-alerts.js, nicht hier (Domain bleibt frei von
// Seiteneffekten wie push.js, analog zur bestehenden lib/services-Trennung).
export async function listLowStockItems() {
  const items = await prisma.storageItem.findMany({
    include: { category: true, location: true },
    orderBy: { name: 'asc' },
  })
  return items
    .filter(item => item.quantity <= effectiveMinQuantity(item))
    .map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      minQuantity: effectiveMinQuantity(item),
      locationName: item.location.name,
      categoryName: item.category.name,
    }))
}

export async function listAutocomplete() {
  const [items, categories] = await Promise.all([
    prisma.storageItem.findMany({ distinct: ['name'], select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.storageCategory.findMany({ distinct: ['name'], select: { name: true }, orderBy: { name: 'asc' } }),
  ])
  return {
    itemNames: items.map(i => i.name),
    categoryNames: categories.map(c => c.name),
  }
}
