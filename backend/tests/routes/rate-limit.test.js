import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'

// app.js only wires up express-rate-limit when NODE_ENV !== 'test' (to avoid
// the limiter interfering with every other test file, which all share one
// IP - '::ffff:127.0.0.1' - and would otherwise trip the limits within a
// handful of requests). To verify the limiter itself is actually wired up
// correctly, build one extra app instance with NODE_ENV briefly flipped away
// from 'test', scoped to this file only.
function createAppWithRateLimiting() {
  const original = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    return createApp()
  } finally {
    process.env.NODE_ENV = original
  }
}

describe('Rate limiting (nur aktiv außerhalb von NODE_ENV=test)', () => {
  it('blockiert nach 10 Login-Versuchen innerhalb des Zeitfensters', async () => {
    const limitedApp = createAppWithRateLimiting()

    let lastStatus
    for (let i = 0; i < 11; i++) {
      const res = await request(limitedApp).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'wrong' })
      lastStatus = res.status
    }
    expect(lastStatus).toBe(429)
  })

  it('lässt Anfragen an andere Routen durch, solange deren eigenes Limit nicht erreicht ist', async () => {
    const limitedApp = createAppWithRateLimiting()
    const res = await request(limitedApp).get('/api/health')
    expect(res.status).toBe(200)
  })
})
