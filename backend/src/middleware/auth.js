import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

// While a user still has to change their password, only these endpoints are
// reachable - everything else is blocked server-side (the frontend already
// redirects here, but the API must not rely on the client to enforce it, or
// a user with a temporary password could just call the API directly).
const PW_CHANGE_ALLOWED = new Set(['/api/auth/change-password', '/api/auth/me'])

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht autorisiert' })

  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user || !user.approved) return res.status(401).json({ error: 'Nicht autorisiert' })
    if (user.mustChangePassword && !PW_CHANGE_ALLOWED.has(req.originalUrl.split('?')[0])) {
      return res.status(403).json({ error: 'Passwort muss geändert werden', mustChangePassword: true })
    }
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Ungültiger Token' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Kein Zugriff' })
  next()
}
