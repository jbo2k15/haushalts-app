/**
 * One-off fix script - 2026-07-02
 *
 * 1. Mark "Finger und Fußnägel schneiden" as completed for this week
 *    without creating a statistics log entry.
 * 2. Deactivate "Papiertonne rausstellen" (already completed, scheduler
 *    missed it because dueDate === today at midnight → isPast was false).
 *
 * Run on the server:
 *   node scripts/fix-tasks-2026-07-02.js
 */

import prisma from '../src/lib/prisma.js'
import { currentWeekStart } from '../src/lib/dates.js'

const weekStart = currentWeekStart()

// --- Fix 1: weekly task completion (no log entry) ---
const nagel = await prisma.task.findFirst({
  where: { title: { contains: 'Finger' }, type: 'weekly', isActive: true },
})

if (!nagel) {
  console.log('⚠️  Aufgabe "Finger und Fußnägel schneiden" nicht gefunden oder nicht aktiv')
} else {
  console.log(`✓  Aufgabe gefunden: "${nagel.title}" (id=${nagel.id})`)
  const existing = await prisma.taskCompletion.findUnique({
    where: { taskId_forDate: { taskId: nagel.id, forDate: weekStart } },
  })
  if (existing) {
    console.log(`   Completion für ${weekStart} existiert bereits — nichts zu tun.`)
  } else {
    await prisma.taskCompletion.create({
      data: { taskId: nagel.id, forDate: weekStart },
      // completedBy intentionally omitted → no statistics impact
    })
    console.log(`   ✅ Completion für ${weekStart} eingetragen (kein Log-Eintrag).`)
  }
}

// --- Fix 2: deactivate completed once task ---
const papiertonne = await prisma.task.findFirst({
  where: { title: { contains: 'Papiertonne' }, type: 'once', isActive: true },
})

if (!papiertonne) {
  console.log('⚠️  Aufgabe "Papiertonne rausstellen" nicht gefunden oder bereits inaktiv.')
} else {
  console.log(`✓  Aufgabe gefunden: "${papiertonne.title}" (id=${papiertonne.id}, dueDate=${papiertonne.dueDate})`)
  const completion = await prisma.taskCompletion.findFirst({
    where: { taskId: papiertonne.id },
  })
  if (!completion) {
    console.log('   ⚠️  Keine Completion gefunden — Aufgabe wird NICHT deaktiviert.')
  } else {
    await prisma.task.update({ where: { id: papiertonne.id }, data: { isActive: false } })
    console.log(`   ✅ Aufgabe deaktiviert (Completion vom ${completion.forDate} vorhanden).`)
  }
}

await prisma.$disconnect()
