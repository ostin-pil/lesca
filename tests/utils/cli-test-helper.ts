import { execSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * CLI Test Helper
 * Utilities for testing CLI commands in isolation with temporary directories
 */
export class CLITestHelper {
  public readonly tempDir: string
  private readonly originalCwd: string

  constructor() {
    this.tempDir = mkdtempSync(join(tmpdir(), 'lesca-cli-test-'))
    this.originalCwd = process.cwd()
  }

  /**
   * Execute a CLI command in the test temp directory
   */
  execCommand(
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
  ): {
    stdout: string
    stderr: string
    exitCode: number
    error?: Error
  } {
    const cwd = options.cwd || this.tempDir
    const env = { ...process.env, ...options.env }

    try {
      // Execute via npm run cli to use the actual built CLI
      const command = `npm run cli -- ${args.join(' ')}`
      const stdout = execSync(command, {
        cwd,
        env,
        encoding: 'utf-8',
        stdio: 'pipe',
      })

      return {
        stdout: stdout.toString(),
        stderr: '',
        exitCode: 0,
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
        const execError = error as { stdout: Buffer; stderr: Buffer; status: number | null }
        return {
          stdout: execError.stdout?.toString() || '',
          stderr: execError.stderr?.toString() || '',
          exitCode: execError.status || 1,
          error: error as Error,
        }
      }
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  /**
   * Write a config file to the temp directory
   */
  writeConfig(config: Record<string, unknown>, filename = '.lesca.config.json'): void {
    const configPath = join(this.tempDir, filename)
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  /**
   * Write a cookie file to the temp directory
   */
  writeCookieFile(cookies: Record<string, string>, filename = 'cookies.json'): void {
    const cookiePath = join(this.tempDir, filename)
    writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), 'utf-8')
  }

  /**
   * Read an output file from the temp directory
   */
  readOutputFile(relativePath: string): string {
    const filePath = join(this.tempDir, relativePath)
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${relativePath}`)
    }
    return readFileSync(filePath, 'utf-8')
  }

  /**
   * Check if a file exists in the temp directory
   */
  fileExists(relativePath: string): boolean {
    return existsSync(join(this.tempDir, relativePath))
  }

  /**
   * Create a subdirectory in the temp directory
   */
  mkdir(relativePath: string): void {
    mkdirSync(join(this.tempDir, relativePath), { recursive: true })
  }

  /**
   * Write an arbitrary file to the temp directory
   */
  writeFile(relativePath: string, content: string): void {
    const filePath = join(this.tempDir, relativePath)
    const dir = join(filePath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(filePath, content, 'utf-8')
  }

  /**
   * Get the absolute path to a file in the temp directory
   */
  getPath(relativePath: string): string {
    return join(this.tempDir, relativePath)
  }

  /**
   * Clean up the temp directory
   */
  cleanup(): void {
    try {
      rmSync(this.tempDir, { recursive: true, force: true })
    } catch {
      // Silently ignore cleanup errors in tests - temp directories will be cleaned by OS
    }
  }

  /**
   * Change to the temp directory
   */
  chdir(): void {
    process.chdir(this.tempDir)
  }

  /**
   * Restore original working directory
   */
  restore(): void {
    process.chdir(this.originalCwd)
  }
}
