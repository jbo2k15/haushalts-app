import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
  if (!adminEmail) {
    console.log('ADMIN_EMAIL not set, skipping seed.')
    return
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (existing) {
    console.log('Admin already exists, skipping seed.')
    return
  }

  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) throw new Error('ADMIN_PASSWORD muss in der .env gesetzt sein')
  const passwordHash = await bcrypt.hash(adminPassword, 12)
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      name: 'Admin',
      role: 'admin',
      approved: true,
      mustChangePassword: true,
    },
  })

  const existingSettings = await prisma.notificationSettings.findFirst({ where: { userId: null } })
  if (!existingSettings) await prisma.notificationSettings.create({ data: {} })

  console.log(`Admin account created: ${adminEmail}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
