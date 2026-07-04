// Seeds a fresh e2e test database with one approved user and one always-due
// daily task, so Playwright tests have something to click without depending
// on production data. Run against DATABASE_URL pointing at a throwaway DB.
import bcrypt from 'bcryptjs'
import prisma from '../src/lib/prisma.js'

export const E2E_EMAIL = 'e2e@example.com'
export const E2E_PASSWORD = 'E2eTest1234!'

async function main() {
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 4) // low rounds, speed over security in tests
  await prisma.user.create({
    data: {
      email: E2E_EMAIL,
      passwordHash,
      name: 'E2E Test User',
      role: 'admin', // needed for the drag-and-drop reorder test (admin-only route)
      approved: true,
    },
  })

  await prisma.task.create({
    data: {
      title: 'E2E Test Task',
      type: 'daily',
      priority: 'normal',
      sortOrder: 0,
      // allowMultiple defaults to false — this task covers the normal,
      // single-toggle-per-day behavior.
    },
  })

  // Two more same-type tasks to drag-and-drop reorder in the Admin UI.
  await prisma.task.create({
    data: { title: 'E2E Sort Task A', type: 'daily', priority: 'normal', sortOrder: 1 },
  })
  await prisma.task.create({
    data: { title: 'E2E Sort Task B', type: 'daily', priority: 'normal', sortOrder: 2 },
  })

  // Dedicated task for testing the "complete multiple times per day" feature.
  await prisma.task.create({
    data: { title: 'E2E Multi Task', type: 'daily', priority: 'normal', sortOrder: 3, allowMultiple: true },
  })

  console.log('e2e-seed: user + tasks created')
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
