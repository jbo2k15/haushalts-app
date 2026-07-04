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
      VAPID_PUBLIC_KEY: 'BCWQd_gapX4Ud_v3z5OGIEKPMvPRUZtFSgbZ1SIgAjTtROEyYhIQDnXitrITE0PnW4LDE7-bmtTR9UVf2H1PzE4',
      VAPID_PRIVATE_KEY: 'phYQBWDo3xBUIFXoMRIFqNNAGrS-D6NzirfmxrPPUU4',
    },
  },
})
