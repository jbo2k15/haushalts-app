import { execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'

export function setup() {
  if (existsSync('./test.db')) unlinkSync('./test.db')
  execSync('npx prisma db push --force-reset --url file:./test.db', {
    stdio: 'inherit',
    // CHECKPOINT_DISABLE: Prismas Update-Check kann bei langsamem Netzwerk
    // den Testlauf-Start deutlich verzoegern (siehe playwright.config.js).
    env: { ...process.env, NODE_ENV: 'test', PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'ja', CHECKPOINT_DISABLE: '1' },
  })
}

export function teardown() {
  if (existsSync('./test.db')) unlinkSync('./test.db')
}
