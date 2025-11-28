import { defineConfig } from 'tsup'

/**
 * Root tsup configuration for Lesca monorepo
 * Supports both ESM and CJS output with automatic path alias resolution
 * Each package can optionally override specific settings via tsup.config.ts
 */

export default defineConfig({
  entry: {
    cli: 'packages/cli/src/index.ts',
    core: 'packages/core/src/index.ts',
    auth: 'packages/auth/src/index.ts',
    'api-client': 'packages/api-client/src/index.ts',
    'browser-automation': 'packages/browser-automation/src/index.ts',
    scrapers: 'packages/scrapers/src/index.ts',
    converters: 'packages/converters/src/index.ts',
    storage: 'packages/storage/src/index.ts',
    'shared-types': 'shared/types/src/index.ts',
    'shared-config': 'shared/config/src/index.ts',
    'shared-utils': 'shared/utils/src/index.ts',
    'shared-error': 'shared/error/src/index.ts',
  },

  outDir: 'dist',

  format: ['esm', 'cjs'],
  target: 'es2022',

  dts: false,
  sourcemap: true,
  clean: true,

  splitting: false,
  shims: true,

  external: [
    'commander',
    'chalk',
    'ora',
    'inquirer',
    'cli-progress',
    'lodash-es',
    'yaml',
    'zod',
    'playwright',
    'turndown',
    'glob',
    'p-throttle',
  ],

  tsconfig: './tsconfig.json',

  esbuildOptions: (options) => {
    options.minify = false
  },
})
