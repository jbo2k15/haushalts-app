/**
 * Initialize nextDueMonth for existing monthly tasks
 *
 * After adding monthlyInterval feature, existing monthly tasks without
 * nextDueMonth need to be initialized. This script sets nextDueMonth
 * to the current month (YYYY-MM format) for all affected tasks.
 *
 * Run before migration:
 *   node scripts/initialize-monthly-interval.js
 */

import prisma from '../src/lib/prisma.js'

// Helper: Get current month in YYYY-MM format
function getCurrentMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

async function main() {
  console.log('🔄 Initializing nextDueMonth for monthly tasks...\n')

  const currentMonth = getCurrentMonth()
  console.log(`Current month: ${currentMonth}`)

  // Find all monthly tasks with NULL nextDueMonth
  const tasksToUpdate = await prisma.task.findMany({
    where: {
      type: 'monthly',
      nextDueMonth: null,
    },
  })

  if (tasksToUpdate.length === 0) {
    console.log('✅ No tasks to update — all monthly tasks already initialized.')
    await prisma.$disconnect()
    return
  }

  console.log(`\nFound ${tasksToUpdate.length} task(s) to update:\n`)

  // Update each task
  let successCount = 0
  for (const task of tasksToUpdate) {
    try {
      await prisma.task.update({
        where: { id: task.id },
        data: { nextDueMonth: currentMonth },
      })
      console.log(`✅ "${task.title}" → nextDueMonth=${currentMonth}`)
      successCount++
    } catch (error) {
      console.error(`❌ Failed to update "${task.title}": ${error.message}`)
    }
  }

  console.log(`\n✨ Complete: ${successCount}/${tasksToUpdate.length} tasks initialized.`)
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error('❌ Script failed:', error)
  await prisma.$disconnect()
  process.exit(1)
})
