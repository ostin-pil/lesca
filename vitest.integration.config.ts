import { resolve } from 'path'

import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration for slow integration tests
 * - Runs on release only for full validation
 * - Includes end-to-end workflows and cross-package integration
 * - May interact with external services (with proper mocking/fixtures)
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only run integration tests
    include: ['tests/integration/**/*.test.ts', '**/*.integration.test.ts', '**/*.e2e.test.ts'],
    exclude: ['node_modules', 'dist', 'archive', 'tests/benchmarks/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/*.{test,spec}.ts', '**/types/', '**/*.d.ts'],
      all: true,
    },
    // Retry flaky tests once
    retry: 1,
    // Longer timeout for integration tests
    testTimeout: 30000,
    // Run integration tests sequentially to avoid conflicts
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@lesca/core': resolve(__dirname, './packages/core/src'),
      '@lesca/auth': resolve(__dirname, './packages/auth/src'),
      '@lesca/api-client': resolve(__dirname, './packages/api-client/src'),
      '@lesca/browser-automation': resolve(__dirname, './packages/browser-automation/src'),
      '@lesca/scrapers': resolve(__dirname, './packages/scrapers/src'),
      '@lesca/converters': resolve(__dirname, './packages/converters/src'),
      '@lesca/storage': resolve(__dirname, './packages/storage/src'),
      '@lesca/cli': resolve(__dirname, './packages/cli/src'),
      '@lesca/shared/types': resolve(__dirname, './shared/types/src'),
      '@lesca/shared/config': resolve(__dirname, './shared/config/src'),
      '@lesca/shared/utils': resolve(__dirname, './shared/utils/src'),
      '@lesca/error': resolve(__dirname, './shared/error/src'),
    },
  },
})
