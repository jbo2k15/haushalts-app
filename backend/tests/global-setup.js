import { execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'

export function setup() {
  if (existsSync('./test.db')) unlinkSync('./test.db')
  execSync('npx prisma db push --skip-generate --force-reset', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db', NODE_ENV: 'test' },
  })
}

export function teardown() {
  if (existsSync('./test.db')) unlinkSync('./test.db')
}
