import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht autorisiert' })

  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user || !user.approved) return res.status(401).json({ error: 'Nicht autorisiert' })
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
