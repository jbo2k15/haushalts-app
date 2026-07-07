import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './tests/global-setup.js',
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      TZ: 'UTC',
      JWT_SECRET: 'test-secret-key-that-is-long-enough-32chars!!',
      FRONTEND_URL: 'http://localhost:3000',
      DATABASE_URL: 'file:./test.db',
      DOTENV_CONFIG_QUIET: 'true',
      VAPID_EMAIL: 'mailto:test@example.com',
      // Throwaway key pair generated solely for this test config - never
      // reuse a real/production VAPID key here (see GitGuardian incident
      // 2026-07-04, a prior real key was accidentally committed this way).
      VAPID_PUBLIC_KEY: 'BM0_MgXrWfyRUM3T3xHFp_nY1TB2Y3_Rk5NXj__J6-Sk5rsFfnI95kMYFYezUupToHUYavrJlQ32__9eukK_zg0',
      VAPID_PRIVATE_KEY: 'dAgHpsSib6vc44tkUUka-lnMQnKwciPp11MpR58L2So',
    },
  },
})
