import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf8'))
const notes = JSON.parse(readFileSync(path.join(__dirname, '../data/release-notes.json'), 'utf8'))

const router = Router()

// Returns the current version's release note (if one exists and the user
// hasn't seen it yet) so the frontend can decide whether to show the modal.
router.get('/', requireAuth, async (req, res) => {
  const note = notes[version] || null
  res.json({ version, note, seen: req.user.lastSeenVersion === version })
})

router.put('/seen', requireAuth, async (req, res) => {
  const { version: seenVersion } = req.body
  if (typeof seenVersion !== 'string' || seenVersion.length > 20) {
    return res.status(400).json({ error: 'Ungültige Version' })
  }
  await prisma.user.update({ where: { id: req.user.id }, data: { lastSeenVersion: seenVersion } })
  res.json({ message: 'Gespeichert' })
})

export default router
