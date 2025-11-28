import { promises as fs } from 'fs'
import path from 'path'

import { defineConfig } from 'tsup'

/**
 * CLI-specific tsup configuration
 * - Preserves shebang for executable
 * - Minimal CJS for CLI entry point
 */

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  shims: true,
  external: ['@lesca/core', '@lesca/shared-config', '@lesca/shared-types', '@lesca/error'],
  tsconfig: '../../tsconfig.json',

  esbuildOptions: (options) => {
    options.minify = false
  },

  async onSuccess() {
    const distFile = path.join(__dirname, 'dist/index.js')
    const content = await fs.readFile(distFile, 'utf-8')
    if (!content.startsWith('#!/usr/bin/env node')) {
      await fs.writeFile(distFile, `#!/usr/bin/env node\n${content}`)
    }
  },
})
