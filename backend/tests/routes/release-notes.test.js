import { describe, it, expect } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { readFileSync } from 'fs'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'
import { compareVersions } from '../../src/routes/release-notes.js'

const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
const allNotes = JSON.parse(readFileSync(new URL('../../src/data/release-notes.json', import.meta.url), 'utf8'))
const notesUpToCurrent = Object.keys(allNotes).filter(v => compareVersions(v, version) <= 0).length

async function createUser(overrides = {}) {
  const passwordHash = await bcrypt.hash('Test1234!x', 4)
  return prisma.user.create({
    data: {
      email: 'release-notes@test.com',
      passwordHash,
      name: 'Test User',
      role: 'user',
      approved: true,
      ...overrides,
    },
  })
}

function authHeader(userId) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' })
  return { Authorization: `Bearer ${token}` }
}

describe('compareVersions', () => {
  it('erkennt kleinere Version', () => {
    expect(compareVersions('1.4.0', '1.5.0')).toBeLessThan(0)
  })

  it('erkennt größere Version', () => {
    expect(compareVersions('1.5.1', '1.5.0')).toBeGreaterThan(0)
  })

  it('erkennt gleiche Version', () => {
    expect(compareVersions('1.5.0', '1.5.0')).toBe(0)
  })

  it('vergleicht Patch-Versionen korrekt, nicht als String', () => {
    // Als String wäre '1.5.10' < '1.5.9' — numerisch muss es andersrum sein
    expect(compareVersions('1.5.10', '1.5.9')).toBeGreaterThan(0)
  })
})

describe('GET /api/release-notes', () => {
  it('gibt alle Notizen bis zur aktuellen Version zurück für einen neuen Nutzer', async () => {
    const user = await createUser()
    const res = await request(app).get('/api/release-notes').set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body.version).toBe(version)
    expect(res.body.notes).toHaveLength(notesUpToCurrent)
  })

  it('gibt eine leere Liste zurück, nachdem die aktuelle Version als gesehen markiert wurde', async () => {
    const user = await createUser()
    await request(app).put('/api/release-notes/seen').set(authHeader(user.id))

    const res = await request(app).get('/api/release-notes').set(authHeader(user.id))
    expect(res.body.notes).toEqual([])

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.lastSeenVersion).toBe(version)
  })

  it('zeigt alle übersprungenen Versionen an, wenn der Nutzer mehrere Releases verpasst hat', async () => {
    const user = await createUser({ lastSeenVersion: '0.0.1' })
    const res = await request(app).get('/api/release-notes').set(authHeader(user.id))
    expect(res.body.notes).toHaveLength(notesUpToCurrent)
    // aufsteigend sortiert (älteste zuerst)
    for (let i = 1; i < res.body.notes.length; i++) {
      expect(compareVersions(res.body.notes[i].version, res.body.notes[i - 1].version)).toBeGreaterThan(0)
    }
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/release-notes')
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/release-notes/seen', () => {
  it('setzt lastSeenVersion immer auf die aktuelle Server-Version', async () => {
    const user = await createUser()
    const res = await request(app).put('/api/release-notes/seen').set(authHeader(user.id))
    expect(res.status).toBe(200)
    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.lastSeenVersion).toBe(version)
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).put('/api/release-notes/seen')
    expect(res.status).toBe(401)
  })
})
