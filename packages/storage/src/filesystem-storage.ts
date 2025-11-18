import { mkdir, writeFile, readFile, unlink, access, readdir } from 'fs/promises'
import { join, dirname, basename } from 'path'

import type { StorageAdapter } from '@/shared/types/src/index.js'
import { StorageError } from '@/shared/types/src/index.js'

/**
 * File system storage adapter
 * Saves content as files in a directory structure
 */
export class FileSystemStorage implements StorageAdapter {
  constructor(
    private basePath: string,
    private options: {
      atomicWrites?: boolean // Use temp file + rename for atomic writes
      createDirs?: boolean // Auto-create directories
      encoding?: BufferEncoding
    } = {}
  ) {
    this.options = {
      atomicWrites: true,
      createDirs: true,
      encoding: 'utf-8',
      ...options,
    }
  }

  /**
   * Save content to a file
   * @param key - File path relative to base path
   * @param content - Content to save
   * @param metadata - Optional metadata (saved as .meta.json)
   */
  async save(key: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    try {
      const filePath = join(this.basePath, key)

      // Create directory if needed
      if (this.options.createDirs) {
        await this.ensureDirectory(dirname(filePath))
      }

      // Write content
      if (this.options.atomicWrites) {
        await this.atomicWrite(filePath, content)
      } else {
        await writeFile(filePath, content, this.options.encoding)
      }

      // Save metadata if provided
      if (metadata) {
        const metaPath = this.getMetadataPath(filePath)
        await writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8')
      }
    } catch (error) {
      throw new StorageError(
        `Failed to save file ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Load content from a file
   */
  async load(key: string): Promise<string | null> {
    try {
      const filePath = join(this.basePath, key)

      // Check if file exists
      if (!(await this.exists(key))) {
        return null
      }

      const content = await readFile(filePath, this.options.encoding)
      return String(content)
    } catch (error) {
      throw new StorageError(
        `Failed to load file ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Check if a file exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const filePath = join(this.basePath, key)
      await access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Delete a file
   */
  async delete(key: string): Promise<void> {
    try {
      const filePath = join(this.basePath, key)

      if (!(await this.exists(key))) {
        return // Already deleted
      }

      await unlink(filePath)

      // Delete metadata file if exists
      const metaPath = this.getMetadataPath(filePath)
      try {
        await unlink(metaPath)
      } catch {
        // Ignore if metadata doesn't exist
      }
    } catch (error) {
      throw new StorageError(
        `Failed to delete file ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * List all files matching a pattern
   * Pattern can be a glob-like string (simple * support)
   */
  async list(pattern?: string): Promise<string[]> {
    try {
      const files = await this.listRecursive(this.basePath)

      if (!pattern) {
        return files
      }

      // Simple pattern matching (* wildcard)
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')

      return files.filter((file) => regex.test(file))
    } catch (error) {
      throw new StorageError(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Load metadata for a file
   */
  async loadMetadata(key: string): Promise<Record<string, unknown> | null> {
    try {
      const filePath = join(this.basePath, key)
      const metaPath = this.getMetadataPath(filePath)

      try {
        await access(metaPath)
      } catch {
        return null // No metadata file
      }

      const content = await readFile(metaPath, 'utf-8')
      return JSON.parse(content) as Record<string, unknown>
    } catch (error) {
      throw new StorageError(
        `Failed to load metadata for ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get the absolute path for a key
   */
  getAbsolutePath(key: string): string {
    return join(this.basePath, key)
  }

  /**
   * Get base path
   */
  getBasePath(): string {
    return this.basePath
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw new StorageError(
        `Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Atomic write using temp file + rename
   * More reliable than direct write
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`

    try {
      // Write to temp file
      await writeFile(tempPath, content, this.options.encoding)

      // Rename to final path (atomic operation)
      await this.rename(tempPath, filePath)
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }

      throw error
    }
  }

  /**
   * Rename file (Node.js doesn't export rename from fs/promises in all versions)
   */
  private async rename(oldPath: string, newPath: string): Promise<void> {
    const fs = await import('fs')
    return new Promise((resolve, reject) => {
      fs.rename(oldPath, newPath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * Get metadata file path
   */
  private getMetadataPath(filePath: string): string {
    const dir = dirname(filePath)
    const base = basename(filePath)
    return join(dir, `.${base}.meta.json`)
  }

  /**
   * Recursively list all files in a directory
   */
  private async listRecursive(dirPath: string, relativeTo?: string): Promise<string[]> {
    const baseDir = relativeTo || dirPath
    const entries = await readdir(dirPath, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        // Skip hidden directories
        if (entry.name.startsWith('.')) {
          continue
        }

        // Recurse into subdirectory
        const subFiles = await this.listRecursive(fullPath, baseDir)
        files.push(...subFiles)
      } else if (entry.isFile()) {
        // Skip metadata files and hidden files
        if (entry.name.startsWith('.')) {
          continue
        }

        // Get path relative to base
        const relativePath = fullPath.slice(baseDir.length + 1)
        files.push(relativePath)
      }
    }

    return files
  }

  /**
   * Create a storage instance with directory structure
   */
  static withStructure(
    basePath: string,
    structure: {
      problems?: string
      discussions?: string
      images?: string
      [key: string]: string | undefined
    }
  ): { [K in keyof typeof structure]: FileSystemStorage } {
    const storages: Record<string, FileSystemStorage> = {}

    for (const [name, subPath] of Object.entries(structure)) {
      if (subPath) {
        storages[name] = new FileSystemStorage(join(basePath, subPath))
      }
    }

    return storages as { [K in keyof typeof structure]: FileSystemStorage }
  }
}
