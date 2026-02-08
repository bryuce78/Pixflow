import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/server/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      include: ['src/server/**/*.ts'],
      exclude: [
        'src/server/**/*.test.ts',
        'src/server/smoke/**',
        'src/server/telemetry/report.ts',
        'src/server/telemetry/trends.ts',
        'src/server/telemetry/checkThresholds.ts',
        'src/server/telemetry/checkRegression.ts',
      ],
    },
  },
})
