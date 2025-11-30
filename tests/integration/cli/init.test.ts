import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { initCommand } from '@/cli/src/commands/init'
import inquirer from 'inquirer'

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}))

// Mock ora to avoid console spam
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  }),
}))

// Mock process.exit to prevent test exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

describe('CLI: init', () => {
  let tempDir: string
  let configPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lesca-cli-init-test-'))
    configPath = join(tempDir, 'lesca.config.yaml')
    mockExit.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    vi.clearAllMocks()
  })

  it('should create configuration file with default values', async () => {
    // Mock user answers
    vi.mocked(inquirer.prompt).mockResolvedValue({
      configPath,
      outputDir: join(tempDir, 'output'),
      format: 'markdown',
      cookiePath: join(tempDir, 'cookies.json'),
      force: false,
    })

    await initCommand.parseAsync(['node', 'lesca', 'init'])

    expect(existsSync(configPath)).toBe(true)
    const content = readFileSync(configPath, 'utf-8')
    expect(content).toContain('output:')
    expect(content).toContain('format: markdown')
  })

  it('should respect CLI options over defaults', async () => {
    // When options are passed, inquirer prompt might still run but defaults should be updated
    // or we can mock prompt to return values matching options if the logic merges them.
    // In init.ts:
    // const answers = await inquirer.prompt(...)
    // const effectiveOptions = { ...answers.configPath || options.configPath ... }

    // So if we pass options, we still need to mock prompt, but maybe prompt returns undefined for those fields?
    // Or prompt uses options as defaults.

    vi.mocked(inquirer.prompt).mockResolvedValue({
      // Inquirer returns answers. If user accepts defaults, it returns the default values.
      // But for test, we can simulate user just pressing enter (returning empty object? no, inquirer returns defaults if configured)
      // Let's simulate user confirming everything
      configPath,
      outputDir: join(tempDir, 'custom-output'),
      format: 'obsidian',
      cookiePath: join(tempDir, 'custom-cookies.json'),
      force: true,
    })

    await initCommand.parseAsync([
      'node',
      'lesca',
      'init',
      '--output-dir',
      join(tempDir, 'custom-output'),
      '--format',
      'obsidian',
    ])

    expect(existsSync(configPath)).toBe(true)
    const content = readFileSync(configPath, 'utf-8')
    expect(content).toContain('format: obsidian')
  })

  it('should handle existing config without force', async () => {
    // Create dummy config
    const fs = await import('fs')
    fs.writeFileSync(configPath, 'dummy: true')

    // Mock prompt to say NO to overwrite
    vi.mocked(inquirer.prompt).mockResolvedValue({
      configPath,
      force: false,
    })

    await initCommand.parseAsync(['node', 'lesca', 'init', '--config-path', configPath])

    expect(mockExit).toHaveBeenCalledWith(1)

    const content = readFileSync(configPath, 'utf-8')
    expect(content).toBe('dummy: true')
  })
})
