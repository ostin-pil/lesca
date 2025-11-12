import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', 'archive'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.{test,spec}.ts',
        '**/types/',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
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
    },
  },
})
