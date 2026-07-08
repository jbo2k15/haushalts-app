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

const VERSION_REGEX = /^\d+\.\d+\.\d+$/

// The frontend's own __APP_VERSION__ can lag behind the backend's for a
// while after a deploy: the service worker only activates a new bundle once
// every tab is fully closed and reopened (no skipWaiting/clients.claim), so
// a browser can keep running the old JS for some time while the already-
// redeployed backend reports the new version. Capping at whatever the
// client says it's actually running avoids showing/marking-as-seen notes
// for a version the user's screen doesn't reflect yet - falls back to the
// backend's own version if the client didn't send a valid one (e.g. an old
// cached frontend that predates this parameter).
function effectiveVersion(clientVersion) {
  if (typeof clientVersion === 'string' && VERSION_REGEX.test(clientVersion) && compareVersions(clientVersion, CURRENT_VERSION) < 0) {
    return clientVersion
  }
  return CURRENT_VERSION
}

// Returns every release note strictly newer than `lastSeen` up to (and
// including) the effective app version, oldest first — so a user who
// skipped several releases sees all of them, not just the latest.
export function unseenNotes(lastSeen, upTo = CURRENT_VERSION) {
  return Object.entries(notes)
    .filter(([v]) => compareVersions(v, upTo) <= 0 && (!lastSeen || compareVersions(v, lastSeen) > 0))
    .sort(([a], [b]) => compareVersions(a, b))
    .map(([version, note]) => ({ version, note }))
}

router.get('/', requireAuth, async (req, res) => {
  const version = effectiveVersion(req.query.clientVersion)
  res.json({ version, notes: unseenNotes(req.user.lastSeenVersion, version) })
})

// Marks the effective version (see above) as seen, not necessarily the
// backend's own current version - covers everything up to it in one go,
// since the modal shows all pending notes together.
router.put('/seen', requireAuth, async (req, res) => {
  const version = effectiveVersion(req.body?.clientVersion)
  await prisma.user.update({ where: { id: req.user.id }, data: { lastSeenVersion: version } })
  res.json({ message: 'Gespeichert' })
})

export default router
