import { describe, it, expect } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'
import { validateTaskInput } from '../../src/domain/tasks.js'

// Familien-Display, Etappe 1: optionale Tageszeit (morgens/mittags/abends) an
// Tagesaufgaben.
const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET

async function createAdmin() {
  return prisma.user.create({
    data: {
      email: 'admin-tod@test.com',
      passwordHash: await bcrypt.hash('Test1234!x', 4),
      name: 'Admin',
      role: 'admin',
      approved: true,
    },
  })
}

function authHeader(userId) {
  return { Authorization: `Bearer ${jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' })}` }
}

describe('validateTaskInput: Tageszeit', () => {
  const base = { title: 'Test', type: 'daily', priority: 'normal' }

  it('akzeptiert alle gültigen Tageszeiten an Tagesaufgaben', () => {
    for (const timeOfDay of ['morning', 'noon', 'evening']) {
      expect(validateTaskInput({ ...base, timeOfDay })).toBeNull()
    }
  })

  it('akzeptiert fehlende, leere und null-Tageszeit', () => {
    expect(validateTaskInput(base)).toBeNull()
    expect(validateTaskInput({ ...base, timeOfDay: '' })).toBeNull()
    expect(validateTaskInput({ ...base, timeOfDay: null })).toBeNull()
  })

  it('lehnt unbekannte Tageszeiten ab', () => {
    expect(validateTaskInput({ ...base, timeOfDay: 'night' })).toBe('Ungültige Tageszeit')
    expect(validateTaskInput({ ...base, timeOfDay: 5 })).toBe('Ungültige Tageszeit')
  })

  it('lehnt eine Tageszeit an Nicht-Tagesaufgaben ab', () => {
    expect(validateTaskInput({ ...base, type: 'weekly', timeOfDay: 'morning' })).toBe('Tageszeit ist nur für tägliche Aufgaben verfügbar')
  })
})

describe('Aufgaben-API: Tageszeit', () => {
  it('speichert die Tageszeit beim Anlegen und liefert sie in Verwaltung und Übersicht', async () => {
    const admin = await createAdmin()
    const res = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Betten machen', type: 'daily', timeOfDay: 'morning' })
    expect(res.status).toBe(200)
    expect(res.body.timeOfDay).toBe('morning')

    const list = await request(app).get('/api/tasks/admin').set(authHeader(admin.id))
    expect(list.body.find(t => t.id === res.body.id).timeOfDay).toBe('morning')

    const overview = await request(app).get('/api/tasks').set(authHeader(admin.id))
    expect(overview.body.daily.find(t => t.id === res.body.id).timeOfDay).toBe('morning')
  })

  it('legt ohne Angabe keine Tageszeit an', async () => {
    const admin = await createAdmin()
    const res = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Blumen gießen', type: 'daily' })
    expect(res.status).toBe(200)
    expect(res.body.timeOfDay).toBeNull()
  })

  it('lehnt eine ungültige Tageszeit mit 400 ab', async () => {
    const admin = await createAdmin()
    const res = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Kaputt', type: 'daily', timeOfDay: 'midnight' })
    expect(res.status).toBe(400)
  })

  it('ändert und entfernt die Tageszeit beim Bearbeiten', async () => {
    const admin = await createAdmin()
    const created = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Tisch decken', type: 'daily', timeOfDay: 'noon' })

    const changed = await request(app).put(`/api/tasks/admin/${created.body.id}`).set(authHeader(admin.id))
      .send({ title: 'Tisch decken', type: 'daily', timeOfDay: 'evening' })
    expect(changed.body.timeOfDay).toBe('evening')

    const cleared = await request(app).put(`/api/tasks/admin/${created.body.id}`).set(authHeader(admin.id))
      .send({ title: 'Tisch decken', type: 'daily', timeOfDay: null })
    expect(cleared.body.timeOfDay).toBeNull()
  })

  it('lässt die Tageszeit unverändert, wenn das Feld im Body fehlt (ältere App-Version)', async () => {
    const admin = await createAdmin()
    const created = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Zähne putzen', type: 'daily', timeOfDay: 'evening' })
    const updated = await request(app).put(`/api/tasks/admin/${created.body.id}`).set(authHeader(admin.id))
      .send({ title: 'Zähne putzen abends', type: 'daily' })
    expect(updated.body.timeOfDay).toBe('evening')
  })

  it('entfernt die Tageszeit, wenn die Aufgabe nicht mehr täglich ist', async () => {
    const admin = await createAdmin()
    const created = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Aufräumen', type: 'daily', timeOfDay: 'morning' })
    const updated = await request(app).put(`/api/tasks/admin/${created.body.id}`).set(authHeader(admin.id))
      .send({ title: 'Aufräumen', type: 'weekly' })
    expect(updated.body.timeOfDay).toBeNull()
  })

  it('exportiert und importiert die Tageszeit', async () => {
    const admin = await createAdmin()
    await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Export-Tageszeit', type: 'daily', timeOfDay: 'noon' })
    const exported = await request(app).get('/api/tasks/admin/export').set(authHeader(admin.id))
    expect(exported.body.find(t => t.title === 'Export-Tageszeit').timeOfDay).toBe('noon')

    await prisma.task.deleteMany()
    await request(app).post('/api/tasks/admin/import').set(authHeader(admin.id)).send(exported.body)
    const imported = await prisma.task.findFirst({ where: { title: 'Export-Tageszeit' } })
    expect(imported.timeOfDay).toBe('noon')
  })
})
