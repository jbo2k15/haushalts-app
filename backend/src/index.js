import 'dotenv/config'

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET fehlt oder ist zu kurz (min. 32 Zeichen). Starte nicht.')
  process.exit(1)
}

// FRONTEND_URL steuert die CORS-Origin (und die Links in E-Mails). Fehlt sie,
// spiegelt das cors-Paket "*" - in Produktion ein Konfigurationsfehler, der
// nicht still durchrutschen soll.
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  console.error('FATAL: FRONTEND_URL fehlt. Starte nicht.')
  process.exit(1)
}

const _origLog = console.log.bind(console)
const _origError = console.error.bind(console)
function ts() {
  const d = new Date()
  return `[${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}]`
}
console.log = (...a) => _origLog(ts(), ...a)
console.error = (...a) => _origError(ts(), ...a)

import { createApp } from './app.js'
import { startScheduler } from './services/scheduler.js'

const app = createApp()

startScheduler()

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`))

async function shutdown() {
  const { default: prisma } = await import('./lib/prisma.js')
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
