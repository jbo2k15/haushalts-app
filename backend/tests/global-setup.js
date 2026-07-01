import { execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'

export function setup() {
  if (existsSync('./test.db')) unlinkSync('./test.db')
  execSync('npx prisma db push --force-reset --url file:./test.db', {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'ja' },
  })
}

export function teardown() {
  if (existsSync('./test.db')) unlinkSync('./test.db')
}
