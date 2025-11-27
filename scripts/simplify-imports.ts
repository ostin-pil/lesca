#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'glob'

// Replacement mappings
const replacements = [
  { from: '@/api-client/', to: '@/api-client/' },
  { from: '@/auth/', to: '@/auth/' },
  { from: '@/browser-automation/', to: '@/browser-automation/' },
  { from: '@/cli/', to: '@/cli/' },
  { from: '@/converters/', to: '@/converters/' },
  { from: '@/core/', to: '@/core/' },
  { from: '@/scrapers/', to: '@/scrapers/' },
  { from: '@/storage/', to: '@/storage/' },
]

// Find all TypeScript files
const files = globSync('**/*.ts', {
  ignore: ['node_modules/**', 'dist/**', '**/dist/**'],
})

console.log(`Found ${files.length} TypeScript files to process\n`)

let totalReplacements = 0
const modifiedFiles: string[] = []

// Process each file
for (const file of files) {
  let content = readFileSync(file, 'utf-8')
  let modified = false
  let fileReplacements = 0

  // Apply each replacement
  for (const { from, to } of replacements) {
    const before = content
    content = content.replace(new RegExp(from.replace(/\//g, '\\/'), 'g'), to)

    if (content !== before) {
      const count = (before.match(new RegExp(from.replace(/\//g, '\\/'), 'g')) || []).length
      fileReplacements += count
      modified = true
    }
  }

  // Write back if modified
  if (modified) {
    writeFileSync(file, content, 'utf-8')
    modifiedFiles.push(file)
    totalReplacements += fileReplacements
    console.log(`✓ ${file} (${fileReplacements} replacements)`)
  }
}

console.log(`\n✅ Complete!`)
console.log(`   Modified: ${modifiedFiles.length} files`)
console.log(`   Total replacements: ${totalReplacements}`)
console.log(`\nNext steps:`)
console.log(`  1. Run: npm run typecheck`)
console.log(`  2. Run: npm run lint:fix`)
console.log(`  3. Run: npm run test:all`)
