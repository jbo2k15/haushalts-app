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
    },
  },
})
