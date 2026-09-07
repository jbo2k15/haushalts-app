import prisma from '../lib/prisma.js'
import { sendPushToUser } from './push.js'
import { listLowStockItems } from '../domain/storage.js'

// Push-Benachrichtigung bei neu knappem Vorrat (TODO.md "Vorratsschrank-
// Verwaltung"). Anders als beim Abfallkalender (siehe waste-calendar.js,
// syncUnmatchedStatus) NICHT per Cron/Polling ausgeloest, sondern
// event-getrieben direkt nach jeder Mengen-Aenderung (siehe routes/storage.js) -
// dort kennt die App den neuen Bestand bereits selbst, ein periodischer Check
// wuerde nur unnoetig verzoegern. Die Dedupe-Logik (nicht bei jedem Aufruf
// erneut pushen, solange derselbe Artikel weiter knapp bleibt) ist dieselbe
// wie beim Abfallkalender-Muster, nur ersetzt statt ergaenzt: notifiedItemIds
// wird bei jedem Check komplett durch die AKTUELL knappen IDs ersetzt, damit
// ein wieder aufgefuellter Artikel automatisch wieder "frisch" ist und bei
// erneutem Absinken erneut meldet.
export async function checkLowStockAlerts() {
  const lowStockItems = await listLowStockItems()
  const currentIds = lowStockItems.map(i => i.id)

  const status = await prisma.storageAlertStatus.findUnique({ where: { id: 'singleton' } })
  const previouslyNotified = status?.notifiedItemIds ? JSON.parse(status.notifiedItemIds) : []
  const newlyLow = lowStockItems.filter(i => !previouslyNotified.includes(i.id))

  await prisma.storageAlertStatus.upsert({
    where: { id: 'singleton' },
    update: { checkedAt: new Date(), notifiedItemIds: JSON.stringify(currentIds) },
    create: { id: 'singleton', checkedAt: new Date(), notifiedItemIds: JSON.stringify(currentIds) },
  })

  if (newlyLow.length === 0) return
  try {
    await notifyLowStock(newlyLow)
  } catch (err) {
    console.error('Vorrat: Fehler beim Versenden der Knapp-Benachrichtigung:', err.message)
  }
}

async function notifyLowStock(newlyLow) {
  const users = await prisma.user.findMany({ where: { approved: true, vacationMode: false } })
  const body = newlyLow.length === 1
    ? `"${newlyLow[0].name}" ist knapp im Vorrat.`
    : `${newlyLow.length} Artikel sind knapp im Vorrat: ${newlyLow.map(i => i.name).join(', ')}`
  await Promise.all(users.map(u => sendPushToUser(u.id, { title: 'Haushalt', body })))
}
