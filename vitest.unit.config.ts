import { resolve } from 'path'

import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration for fast unit tests
 * - Runs on every PR for quick feedback
 * - Excludes slow integration tests
 * - Target: < 30 seconds execution time
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only run unit tests (exclude integration tests)
    include: ['packages/**/__tests__/**/*.test.ts', 'shared/**/__tests__/**/*.test.ts', 'shared/**/**.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      'archive',
      'tests/integration/**',
      'tests/benchmarks/**',
      // Exclude slow tests that interact with external services
      '**/*.integration.test.ts',
      '**/*.e2e.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      exclude: ['node_modules/', 'dist/', '**/*.{test,spec}.ts', '**/types/', '**/*.d.ts'],
      // Per-package thresholds will be enforced by check-coverage script
      all: true,
    },
    // Retry flaky tests once
    retry: 1,
    // Timeout for individual tests (unit tests should be fast)
    testTimeout: 5000,
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
      '@lesca/shared/error': resolve(__dirname, './shared/error/src'),
    },
  },
})
