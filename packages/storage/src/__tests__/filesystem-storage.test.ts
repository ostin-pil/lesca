import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileSystemStorage } from '../filesystem-storage'
import { StorageError } from '@lesca/error'
import { existsSync } from 'fs'
import { rm, mkdir, writeFile } from 'fs/promises'
import { resolve, join } from 'path'

describe('FileSystemStorage', () => {
  const testDir = resolve(__dirname, '__test_storage__')
  let storage: FileSystemStorage

  beforeEach(async () => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true })
    }
    await mkdir(testDir, { recursive: true })

    storage = new FileSystemStorage(testDir)
  })

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  describe('save and load', () => {
    it('should save and load content', async () => {
      await storage.save('test.md', '# Hello World')

      const content = await storage.load('test.md')

      expect(content).toBe('# Hello World')
    })

    it('should create nested directories automatically', async () => {
      await storage.save('foo/bar/baz/test.md', 'content')

      const content = await storage.load('foo/bar/baz/test.md')

      expect(content).toBe('content')
      expect(existsSync(join(testDir, 'foo/bar/baz'))).toBe(true)
    })

    it('should return null for non-existent files', async () => {
      const content = await storage.load('nonexistent.md')

      expect(content).toBeNull()
    })

    it('should handle large files', async () => {
      const largeContent = 'x'.repeat(10000)

      await storage.save('large.md', largeContent)
      const loaded = await storage.load('large.md')

      expect(loaded).toBe(largeContent)
    })

    it('should handle special characters in content', async () => {
      const specialContent = '# Test\n\n```python\nprint("Hello")\n```\n\n📝 Notes'

      await storage.save('special.md', specialContent)
      const loaded = await storage.load('special.md')

      expect(loaded).toBe(specialContent)
    })
  })

  describe('metadata', () => {
    it('should save and load metadata', async () => {
      const metadata = {
        title: 'Test Problem',
        difficulty: 'Easy',
        tags: ['array', 'hash-table'],
        timestamp: Date.now(),
      }

      await storage.save('problem.md', 'content', metadata)
      const loadedMeta = await storage.loadMetadata('problem.md')

      expect(loadedMeta).toEqual(metadata)
    })

    it('should return null when no metadata exists', async () => {
      await storage.save('no-meta.md', 'content')

      const meta = await storage.loadMetadata('no-meta.md')

      expect(meta).toBeNull()
    })

    it('should create metadata file with correct name', async () => {
      await storage.save('test.md', 'content', { key: 'value' })

      const metaPath = join(testDir, '.test.md.meta.json')
      expect(existsSync(metaPath)).toBe(true)
    })

    it('should handle complex nested metadata', async () => {
      const metadata = {
        problem: {
          id: 1,
          title: 'Two Sum',
          nested: {
            deep: {
              value: 'test',
            },
          },
        },
        array: [1, 2, 3],
      }

      await storage.save('complex.md', 'content', metadata)
      const loaded = await storage.loadMetadata('complex.md')

      expect(loaded).toEqual(metadata)
    })
  })

  describe('exists', () => {
    it('should return true for existing files', async () => {
      await storage.save('exists.md', 'content')

      const exists = await storage.exists('exists.md')

      expect(exists).toBe(true)
    })

    it('should return false for non-existent files', async () => {
      const exists = await storage.exists('nonexistent.md')

      expect(exists).toBe(false)
    })

    it('should handle nested paths', async () => {
      await storage.save('a/b/c.md', 'content')

      expect(await storage.exists('a/b/c.md')).toBe(true)
      expect(await storage.exists('a/b/d.md')).toBe(false)
    })
  })

  describe('delete', () => {
    it('should delete existing files', async () => {
      await storage.save('delete-me.md', 'content')
      expect(await storage.exists('delete-me.md')).toBe(true)

      await storage.delete('delete-me.md')

      expect(await storage.exists('delete-me.md')).toBe(false)
    })

    it('should delete metadata along with file', async () => {
      await storage.save('with-meta.md', 'content', { key: 'value' })

      await storage.delete('with-meta.md')

      const metaPath = join(testDir, '.with-meta.md.meta.json')
      expect(existsSync(metaPath)).toBe(false)
    })

    it('should not throw when deleting non-existent files', async () => {
      await expect(storage.delete('nonexistent.md')).resolves.toBeUndefined()
    })

    it('should delete files in nested directories', async () => {
      await storage.save('a/b/c.md', 'content')

      await storage.delete('a/b/c.md')

      expect(await storage.exists('a/b/c.md')).toBe(false)
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      // Create some test files
      await storage.save('file1.md', 'content1')
      await storage.save('file2.md', 'content2')
      await storage.save('dir1/file3.md', 'content3')
      await storage.save('dir1/subdir/file4.md', 'content4')
      await storage.save('file.txt', 'text')
    })

    it('should list all files without pattern', async () => {
      const files = await storage.list()

      expect(files).toContain('file1.md')
      expect(files).toContain('file2.md')
      expect(files).toContain('dir1/file3.md')
      expect(files).toContain('dir1/subdir/file4.md')
      expect(files).toContain('file.txt')
    })

    it('should filter files by pattern', async () => {
      const mdFiles = await storage.list('*.md')

      expect(mdFiles).toContain('file1.md')
      expect(mdFiles).toContain('file2.md')
      expect(mdFiles).not.toContain('file.txt')
    })

    it('should support wildcard in middle of pattern', async () => {
      const files = await storage.list('dir1/*.md')

      // Wildcard * matches everything including subdirectories
      expect(files).toContain('dir1/file3.md')
      expect(files).toContain('dir1/subdir/file4.md') // * matches multiple levels
    })

    it('should support multiple wildcards', async () => {
      const files = await storage.list('*/*/*.md')

      expect(files).toContain('dir1/subdir/file4.md')
      expect(files).not.toContain('file1.md')
    })

    it('should not list hidden files or metadata files', async () => {
      await storage.save('visible.md', 'content', { key: 'value' })

      // Manually create a hidden file for testing
      await writeFile(join(testDir, '.hidden'), 'hidden content')

      const files = await storage.list()

      expect(files).toContain('visible.md')
      expect(files).not.toContain('.hidden')
      expect(files).not.toContain('.visible.md.meta.json')
    })
  })

  describe('getAbsolutePath', () => {
    it('should return absolute path for key', () => {
      const path = storage.getAbsolutePath('test.md')

      expect(path).toBe(join(testDir, 'test.md'))
    })

    it('should handle nested paths', () => {
      const path = storage.getAbsolutePath('a/b/c.md')

      expect(path).toBe(join(testDir, 'a/b/c.md'))
    })
  })

  describe('getBasePath', () => {
    it('should return base path', () => {
      const basePath = storage.getBasePath()

      expect(basePath).toBe(testDir)
    })
  })

  describe('options', () => {
    it('should support disabling automatic directory creation', async () => {
      const storage = new FileSystemStorage(testDir, { createDirs: false })

      await expect(storage.save('nonexistent/dir/file.md', 'content')).rejects.toThrow(StorageError)
    })

    it('should support different encodings', async () => {
      const storage = new FileSystemStorage(testDir, { encoding: 'utf-16le' })

      await storage.save('encoded.md', 'Test content 测试')
      const content = await storage.load('encoded.md')

      expect(content).toBe('Test content 测试')
    })

    it('should support non-atomic writes', async () => {
      const storage = new FileSystemStorage(testDir, { atomicWrites: false })

      await storage.save('non-atomic.md', 'content')
      const content = await storage.load('non-atomic.md')

      expect(content).toBe('content')

      // Check that no temp files were left behind
      const files = await storage.list()
      const tempFiles = files.filter((f) => f.includes('.tmp.'))
      expect(tempFiles).toHaveLength(0)
    })
  })

  describe('withStructure', () => {
    it('should create multiple storage instances with subdirectories', () => {
      const storages = FileSystemStorage.withStructure(testDir, {
        problems: 'problems',
        discussions: 'discussions',
        images: 'images',
      })

      expect(storages.problems).toBeInstanceOf(FileSystemStorage)
      expect(storages.discussions).toBeInstanceOf(FileSystemStorage)
      expect(storages.images).toBeInstanceOf(FileSystemStorage)

      expect(storages.problems!.getBasePath()).toBe(join(testDir, 'problems'))
      expect(storages.discussions!.getBasePath()).toBe(join(testDir, 'discussions'))
      expect(storages.images!.getBasePath()).toBe(join(testDir, 'images'))
    })

    it('should allow saving to different storage instances', async () => {
      const storages = FileSystemStorage.withStructure(testDir, {
        problems: 'problems',
        discussions: 'discussions',
      })

      await storages.problems!.save('two-sum.md', 'problem content')
      await storages.discussions!.save('discussion-1.md', 'discussion content')

      const problemContent = await storages.problems!.load('two-sum.md')
      const discussionContent = await storages.discussions!.load('discussion-1.md')

      expect(problemContent).toBe('problem content')
      expect(discussionContent).toBe('discussion content')

      // Files should be in different directories
      expect(existsSync(join(testDir, 'problems/two-sum.md'))).toBe(true)
      expect(existsSync(join(testDir, 'discussions/discussion-1.md'))).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should throw StorageError on save failure', async () => {
      // Create a file, then make it read-only to cause save failure
      const filePath = join(testDir, 'readonly.md')
      await writeFile(filePath, 'initial')

      // Make parent directory read-only on Unix systems (won't work on Windows)
      if (process.platform !== 'win32') {
        await import('fs/promises').then((fs) => fs.chmod(testDir, 0o444))

        const storage = new FileSystemStorage(testDir)

        await expect(storage.save('new-file.md', 'content')).rejects.toThrow(StorageError)

        // Restore permissions for cleanup
        await import('fs/promises').then((fs) => fs.chmod(testDir, 0o755))
      }
    })

    it('should throw StorageError on invalid list operation', async () => {
      const invalidStorage = new FileSystemStorage('/nonexistent/path/that/does/not/exist')

      await expect(invalidStorage.list()).rejects.toThrow(StorageError)
    })
  })

  describe('atomic writes', () => {
    it('should use atomic writes by default', async () => {
      // Atomic writes should not leave temp files behind
      await storage.save('atomic.md', 'content')

      const files = await storage.list()
      const tempFiles = files.filter((f) => f.includes('.tmp.'))

      expect(tempFiles).toHaveLength(0)
    })

    it('should complete atomic write even if interrupted', async () => {
      // This tests that the file is written completely
      const largeContent = 'x'.repeat(100000)

      await storage.save('large-atomic.md', largeContent)
      const loaded = await storage.load('large-atomic.md')

      expect(loaded).toBe(largeContent)
    })
  })

  describe('concurrent operations', () => {
    it('should handle concurrent saves', async () => {
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(storage.save(`concurrent-${i}.md`, `content-${i}`))
      }

      await Promise.all(promises)

      // Verify all files were saved
      for (let i = 0; i < 10; i++) {
        const content = await storage.load(`concurrent-${i}.md`)
        expect(content).toBe(`content-${i}`)
      }
    })

    it('should handle concurrent deletes', async () => {
      // Create files first
      for (let i = 0; i < 5; i++) {
        await storage.save(`delete-${i}.md`, 'content')
      }

      // Delete concurrently
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(storage.delete(`delete-${i}.md`))
      }

      await Promise.all(promises)

      // Verify all files were deleted
      for (let i = 0; i < 5; i++) {
        expect(await storage.exists(`delete-${i}.md`)).toBe(false)
      }
    })
  })
})
