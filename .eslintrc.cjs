module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    // TypeScript specific - ZERO TOLERANCE
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error', // Changed from 'warn'
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'error', // Changed from 'warn'
    '@typescript-eslint/no-floating-promises': 'error', // Added
    '@typescript-eslint/require-await': 'error', // Added
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

    // Import organization
    // Enforces consistent import ordering across the codebase:
    // 1. Built-in Node.js modules (node:fs, node:path)
    // 2. External packages (npm dependencies)
    // 3. Internal monorepo packages (@/api-client, @/core, etc.)
    // 4. Shared modules (@/shared/*)
    // 5. Relative imports (./, ../)
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
        pathGroups: [
          {
            pattern: '@/api-client/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@/auth/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@/browser-automation/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@/cli/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@/converters/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@/core/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@/scrapers/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@/storage/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@/shared/**',
            group: 'internal',
            position: 'after',
          },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        distinctGroup: false, // Allow imports from same group without blank lines
      },
    ],
    'import/no-unresolved': 'off', // TypeScript handles this

    // General code quality - ZERO TOLERANCE
    'no-console': 'error', // No console statements allowed
    'prefer-const': 'error',
    'no-var': 'error',
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        ts: 'never',
        tsx: 'never',
        js: 'never',
        jsx: 'never',
      },
    ],
    'import/no-relative-parent-imports': 'off', // We want to allow ../ but discourage deep nesting
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      node: true,
    },
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    '*.cjs',
    '*.mjs',
    'archive',
    'graphql-test-*.json',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.bench.ts',
    'scripts/',
    'tests/',
  ],
}
