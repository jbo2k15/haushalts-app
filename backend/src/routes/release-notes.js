import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { version: CURRENT_VERSION } = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf8'))
const notes = JSON.parse(readFileSync(path.join(__dirname, '../data/release-notes.json'), 'utf8'))

const router = Router()

// Compares two "x.y.z" version strings. Returns <0 if a<b, 0 if equal, >0 if a>b.
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

// Returns every release note strictly newer than `lastSeen` up to (and
// including) the current app version, oldest first — so a user who skipped
// several releases sees all of them, not just the latest.
export function unseenNotes(lastSeen) {
  return Object.entries(notes)
    .filter(([v]) => compareVersions(v, CURRENT_VERSION) <= 0 && (!lastSeen || compareVersions(v, lastSeen) > 0))
    .sort(([a], [b]) => compareVersions(a, b))
    .map(([version, note]) => ({ version, note }))
}

router.get('/', requireAuth, async (req, res) => {
  res.json({ version: CURRENT_VERSION, notes: unseenNotes(req.user.lastSeenVersion) })
})

// Marks the current app version as seen — covers everything up to it in one
// go, since the modal shows all pending notes together.
router.put('/seen', requireAuth, async (req, res) => {
  await prisma.user.update({ where: { id: req.user.id }, data: { lastSeenVersion: CURRENT_VERSION } })
  res.json({ message: 'Gespeichert' })
})

export default router
