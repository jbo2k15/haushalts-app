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
      role: 'user',
      approved: true,
    },
  })

  await prisma.task.create({
    data: {
      title: 'E2E Test Task',
      type: 'daily',
      priority: 'normal',
    },
  })

  console.log('e2e-seed: user + task created')
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
