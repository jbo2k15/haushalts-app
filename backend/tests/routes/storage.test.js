import { describe, it, expect } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'

const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET

async function createUser(overrides = {}) {
  const passwordHash = await bcrypt.hash('Test1234!x', 4)
  return prisma.user.create({
    data: { email: `${Math.random().toString(36).slice(2)}@test.com`, passwordHash, name: 'Test User', role: 'user', approved: true, ...overrides },
  })
}

function authHeader(userId) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' })
  return { Authorization: `Bearer ${token}` }
}

async function setupLocationWithCategory(admin) {
  const locRes = await request(app).post('/api/storage/locations').set(authHeader(admin.id)).send({ name: 'Kühlschrank Garage' })
  const catRes = await request(app).post(`/api/storage/locations/${locRes.body.id}/categories`).set(authHeader(admin.id)).send({ name: 'Konserven' })
  return { location: locRes.body, category: catRes.body }
}

describe('GET /api/storage/locations', () => {
  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/storage/locations')
    expect(res.status).toBe(401)
  })

  it('gibt verschachtelte Orte/Kategorien/Artikel zurück', async () => {
    const admin = await createUser({ role: 'admin' })
    const { category } = await setupLocationWithCategory(admin)
    await request(app).post(`/api/storage/categories/${category.id}/items`).set(authHeader(admin.id)).send({ name: 'Tomaten', quantity: 3 })

    const res = await request(app).get('/api/storage/locations').set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body[0].categories[0].items[0]).toMatchObject({ name: 'Tomaten', quantity: 3 })
  })
})

describe('Lagerorte — Admin-only', () => {
  it('lehnt POST /locations für Nicht-Admins ab', async () => {
    const user = await createUser()
    const res = await request(app).post('/api/storage/locations').set(authHeader(user.id)).send({ name: 'Keller' })
    expect(res.status).toBe(403)
  })

  it('lehnt Umsortieren von Lagerorten für Nicht-Admins ab', async () => {
    const admin = await createUser({ role: 'admin' })
    const user = await createUser()
    const { location } = await setupLocationWithCategory(admin)
    const res = await request(app).post('/api/storage/locations/reorder').set(authHeader(user.id)).send({ orderedIds: [location.id] })
    expect(res.status).toBe(403)
  })

  it('erlaubt Admins das Anlegen, Umbenennen und Löschen', async () => {
    const admin = await createUser({ role: 'admin' })
    const create = await request(app).post('/api/storage/locations').set(authHeader(admin.id)).send({ name: 'Keller' })
    expect(create.status).toBe(201)

    const rename = await request(app).put(`/api/storage/locations/${create.body.id}`).set(authHeader(admin.id)).send({ name: 'Gefriertruhe Keller' })
    expect(rename.status).toBe(200)
    expect(rename.body.name).toBe('Gefriertruhe Keller')

    const del = await request(app).delete(`/api/storage/locations/${create.body.id}`).set(authHeader(admin.id))
    expect(del.status).toBe(200)
  })
})

describe('Kategorien + Artikel — offen für alle Haushaltsmitglieder', () => {
  it('erlaubt normalen Nutzern das Anlegen einer Kategorie', async () => {
    const admin = await createUser({ role: 'admin' })
    const user = await createUser()
    const locRes = await request(app).post('/api/storage/locations').set(authHeader(admin.id)).send({ name: 'Garage' })

    const res = await request(app)
      .post(`/api/storage/locations/${locRes.body.id}/categories`)
      .set(authHeader(user.id))
      .send({ name: 'Getränke', defaultMinQuantity: 2 })
    expect(res.status).toBe(201)
    expect(res.body.defaultMinQuantity).toBe(2)
  })

  it('erlaubt normalen Nutzern, die Menge eines Artikels zu ändern (Stepper)', async () => {
    const admin = await createUser({ role: 'admin' })
    const user = await createUser()
    const { category } = await setupLocationWithCategory(admin)
    const itemRes = await request(app).post(`/api/storage/categories/${category.id}/items`).set(authHeader(admin.id)).send({ name: 'Tomaten', quantity: 3 })

    const res = await request(app).patch(`/api/storage/items/${itemRes.body.id}/quantity`).set(authHeader(user.id)).send({ quantity: 5 })
    expect(res.status).toBe(200)
    expect(res.body.quantity).toBe(5)
  })

  it('erlaubt normalen Nutzern das komplette Löschen eines Artikels', async () => {
    const admin = await createUser({ role: 'admin' })
    const user = await createUser()
    const { category } = await setupLocationWithCategory(admin)
    const itemRes = await request(app).post(`/api/storage/categories/${category.id}/items`).set(authHeader(admin.id)).send({ name: 'Tomaten', quantity: 3 })

    const res = await request(app).delete(`/api/storage/items/${itemRes.body.id}`).set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(await prisma.storageItem.findUnique({ where: { id: itemRes.body.id } })).toBeNull()
  })

  it('erlaubt Menge auf 0 zu setzen, ohne den Artikel zu löschen', async () => {
    const admin = await createUser({ role: 'admin' })
    const { category } = await setupLocationWithCategory(admin)
    const itemRes = await request(app).post(`/api/storage/categories/${category.id}/items`).set(authHeader(admin.id)).send({ name: 'Tomaten', quantity: 3 })

    const res = await request(app).patch(`/api/storage/items/${itemRes.body.id}/quantity`).set(authHeader(admin.id)).send({ quantity: 0 })
    expect(res.status).toBe(200)
    expect(res.body.quantity).toBe(0)
    expect(await prisma.storageItem.findUnique({ where: { id: itemRes.body.id } })).toBeTruthy()
  })
})

describe('GET /api/storage/autocomplete', () => {
  it('liefert distincte Artikel- und Kategorienamen über mehrere Lagerorte hinweg', async () => {
    const admin = await createUser({ role: 'admin' })
    const locA = await request(app).post('/api/storage/locations').set(authHeader(admin.id)).send({ name: 'Garage' })
    const locB = await request(app).post('/api/storage/locations').set(authHeader(admin.id)).send({ name: 'Haus' })
    const catA = await request(app).post(`/api/storage/locations/${locA.body.id}/categories`).set(authHeader(admin.id)).send({ name: 'Konserven' })
    const catB = await request(app).post(`/api/storage/locations/${locB.body.id}/categories`).set(authHeader(admin.id)).send({ name: 'Konserven' })
    await request(app).post(`/api/storage/categories/${catA.body.id}/items`).set(authHeader(admin.id)).send({ name: 'Milch' })
    await request(app).post(`/api/storage/categories/${catB.body.id}/items`).set(authHeader(admin.id)).send({ name: 'Milch' })

    const res = await request(app).get('/api/storage/autocomplete').set(authHeader(admin.id))
    expect(res.body.itemNames).toEqual(['Milch'])
    expect(res.body.categoryNames).toEqual(['Konserven'])
  })
})
