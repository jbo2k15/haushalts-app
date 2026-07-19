import prisma from '../src/lib/prisma.js'

beforeEach(async () => {
  await prisma.taskLog.deleteMany()
  await prisma.taskCompletion.deleteMany()
  await prisma.taskPause.deleteMany()
  await prisma.globalPause.deleteMany()
  await prisma.task.deleteMany()
  await prisma.pushSubscription.deleteMany()
  await prisma.notificationSettings.deleteMany()
  await prisma.passwordResetToken.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.weatherStatus.deleteMany()
  await prisma.user.deleteMany()
})
