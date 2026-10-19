// Einmaliger Push an alle Admins - aufgerufen von scripts/deploy.sh bei einem
// fehlgeschlagenen Auto-Deploy (docker compose exec backend node ...). Bewusst
// kein HTTP-Endpunkt: kein neuer öffentlich erreichbarer Angriffsweg, nur die
// vorhandene Push-Logik im Container. Liegt unter src/, weil nur src/ ins
// Docker-Image kopiert wird.
import prisma from '../lib/prisma.js'
import { sendPushToUser } from '../services/push.js'

const body = process.argv.slice(2).join(' ').trim() || 'Deploy fehlgeschlagen'

try {
  const admins = await prisma.user.findMany({ where: { approved: true, role: 'admin' } })
  await Promise.all(admins.map(u => sendPushToUser(u.id, { title: 'Deploy', body })))
} finally {
  await prisma.$disconnect()
}
