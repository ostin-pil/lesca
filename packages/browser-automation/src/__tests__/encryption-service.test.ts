import { randomBytes } from 'crypto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  EncryptionService,
  resolveEncryptionConfig,
  type EncryptedPayload,
} from '../encryption/encryption-service'

vi.mock('@lesca/shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('EncryptionService', () => {
  const validKey = randomBytes(32).toString('base64')
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('resolveEncryptionConfig', () => {
    it('should use defaults when no config provided', () => {
      const config = resolveEncryptionConfig()

      expect(config.enabled).toBe(false)
      expect(config.keyEnvVar).toBe('LESCA_ENCRYPTION_KEY')
    })

    it('should use provided values', () => {
      const config = resolveEncryptionConfig({
        enabled: true,
        keyEnvVar: 'CUSTOM_KEY',
      })

      expect(config.enabled).toBe(true)
      expect(config.keyEnvVar).toBe('CUSTOM_KEY')
    })

    it('should handle partial config', () => {
      const config = resolveEncryptionConfig({ enabled: true })

      expect(config.enabled).toBe(true)
      expect(config.keyEnvVar).toBe('LESCA_ENCRYPTION_KEY')
    })
  })

  describe('isEnabled', () => {
    it('should return false when disabled', () => {
      const service = new EncryptionService({ enabled: false })

      expect(service.isEnabled()).toBe(false)
    })

    it('should return true when enabled', () => {
      const service = new EncryptionService({ enabled: true })

      expect(service.isEnabled()).toBe(true)
    })
  })

  describe('getKey', () => {
    it('should load key from environment variable', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })

      const key = service.getKey()

      expect(key.length).toBe(32)
    })

    it('should throw when key env var not set', () => {
      delete process.env['LESCA_ENCRYPTION_KEY']
      const service = new EncryptionService({ enabled: true })

      expect(() => service.getKey()).toThrow('Encryption key not found')
    })

    it('should throw when key is wrong length', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = randomBytes(16).toString('base64') // Too short
      const service = new EncryptionService({ enabled: true })

      expect(() => service.getKey()).toThrow('Invalid encryption key length')
    })

    it('should throw when key is not valid base64', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = '!!!invalid-base64!!!'
      const service = new EncryptionService({ enabled: true })

      // Invalid base64 will decode but may not be correct length
      expect(() => service.getKey()).toThrow()
    })

    it('should cache key after first load', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })

      const key1 = service.getKey()
      const key2 = service.getKey()

      expect(key1).toBe(key2) // Same reference (cached)
    })

    it('should use custom env var name', () => {
      process.env['MY_CUSTOM_KEY'] = validKey
      const service = new EncryptionService({ enabled: true, keyEnvVar: 'MY_CUSTOM_KEY' })

      const key = service.getKey()

      expect(key.length).toBe(32)
    })
  })

  describe('encrypt', () => {
    it('should encrypt data successfully', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const plaintext = 'Hello, World!'

      const encrypted = service.encrypt(plaintext)

      expect(encrypted).not.toBe(plaintext)
      expect(encrypted).toContain('"version"')
      expect(encrypted).toContain('"aes-256-gcm"')
    })

    it('should return plaintext when disabled', () => {
      const service = new EncryptionService({ enabled: false })
      const plaintext = 'Hello, World!'

      const result = service.encrypt(plaintext)

      expect(result).toBe(plaintext)
    })

    it('should produce valid encrypted payload structure', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const plaintext = JSON.stringify({ key: 'value' })

      const encrypted = service.encrypt(plaintext)
      const payload = JSON.parse(encrypted) as EncryptedPayload

      expect(payload.version).toBe(1)
      expect(payload.algorithm).toBe('aes-256-gcm')
      expect(typeof payload.iv).toBe('string')
      expect(typeof payload.authTag).toBe('string')
      expect(typeof payload.data).toBe('string')

      // Validate base64 lengths
      const ivBuffer = Buffer.from(payload.iv, 'base64')
      const authTagBuffer = Buffer.from(payload.authTag, 'base64')
      expect(ivBuffer.length).toBe(12) // 12 bytes IV
      expect(authTagBuffer.length).toBe(16) // 16 bytes auth tag
    })

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const plaintext = 'Same data'

      const encrypted1 = service.encrypt(plaintext)
      const encrypted2 = service.encrypt(plaintext)

      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should handle large data', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const largeData = JSON.stringify({
        cookies: Array(100)
          .fill(0)
          .map((_, i) => ({
            name: `cookie_${i}`,
            value: 'x'.repeat(1000),
            domain: '.example.com',
          })),
      })

      const encrypted = service.encrypt(largeData)

      expect(encrypted).toBeTruthy()
      expect(JSON.parse(encrypted)).toHaveProperty('version')
    })

    it('should handle unicode data', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const unicodeData = JSON.stringify({ text: '你好世界 🌍 émoji' })

      const encrypted = service.encrypt(unicodeData)
      const decrypted = service.decrypt(encrypted)

      expect(decrypted).toBe(unicodeData)
    })
  })

  describe('decrypt', () => {
    it('should decrypt encrypted data successfully', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const originalData = JSON.stringify({
        name: 'test-session',
        cookies: [{ name: 'LEETCODE_SESSION', value: 'secret' }],
      })

      const encrypted = service.encrypt(originalData)
      const decrypted = service.decrypt(encrypted)

      expect(decrypted).toBe(originalData)
    })

    it('should throw on invalid JSON', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })

      expect(() => service.decrypt('not valid json')).toThrow('Failed to parse encrypted payload')
    })

    it('should throw on missing payload fields', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const invalidPayload = JSON.stringify({ version: 1, algorithm: 'aes-256-gcm' })

      expect(() => service.decrypt(invalidPayload)).toThrow('Invalid encrypted payload structure')
    })

    it('should throw on unsupported version', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const futurePayload = JSON.stringify({
        version: 999,
        algorithm: 'aes-256-gcm',
        iv: 'AAAAAAAAAAAAAAAA',
        authTag: 'AAAAAAAAAAAAAAAAAAAAAAAAAA==',
        data: 'AAAA',
      })

      expect(() => service.decrypt(futurePayload)).toThrow('Unsupported encryption version')
    })

    it('should detect tampered data (auth tag failure)', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const originalData = 'test data'
      const encrypted = service.encrypt(originalData)

      // Tamper with the encrypted data
      const payload = JSON.parse(encrypted) as EncryptedPayload
      payload.data = Buffer.from('tampered data').toString('base64')
      const tamperedEncrypted = JSON.stringify(payload)

      expect(() => service.decrypt(tamperedEncrypted)).toThrow('Authentication failed')
    })

    it('should fail with wrong key', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service1 = new EncryptionService({ enabled: true })
      const encrypted = service1.encrypt('secret data')

      // Use different key
      process.env['LESCA_ENCRYPTION_KEY'] = randomBytes(32).toString('base64')
      const service2 = new EncryptionService({ enabled: true })

      expect(() => service2.decrypt(encrypted)).toThrow()
    })

    it('should throw on invalid IV length', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const badPayload = JSON.stringify({
        version: 1,
        algorithm: 'aes-256-gcm',
        iv: 'AAAA', // Too short (only 3 bytes after base64 decode)
        authTag: 'AAAAAAAAAAAAAAAAAAAAAAAAAA==',
        data: 'AAAA',
      })

      expect(() => service.decrypt(badPayload)).toThrow('Invalid IV length')
    })
  })

  describe('isEncrypted', () => {
    it('should return true for encrypted payload', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const encrypted = service.encrypt('data')

      expect(service.isEncrypted(encrypted)).toBe(true)
    })

    it('should return false for plain JSON', () => {
      const service = new EncryptionService({ enabled: true })
      const plainJson = JSON.stringify({ name: 'session', cookies: [] })

      expect(service.isEncrypted(plainJson)).toBe(false)
    })

    it('should return false for invalid JSON', () => {
      const service = new EncryptionService({ enabled: true })

      expect(service.isEncrypted('not json')).toBe(false)
    })

    it('should return false for empty string', () => {
      const service = new EncryptionService({ enabled: true })

      expect(service.isEncrypted('')).toBe(false)
    })

    it('should return false for whitespace-only string', () => {
      const service = new EncryptionService({ enabled: true })

      expect(service.isEncrypted('   ')).toBe(false)
    })

    it('should return false for partial encrypted payload', () => {
      const service = new EncryptionService({ enabled: true })
      const partial = JSON.stringify({ version: 1, algorithm: 'aes-256-gcm' })

      expect(service.isEncrypted(partial)).toBe(false)
    })

    it('should return false for wrong algorithm', () => {
      const service = new EncryptionService({ enabled: true })
      const wrongAlgo = JSON.stringify({
        version: 1,
        algorithm: 'aes-128-cbc',
        iv: 'a',
        authTag: 'b',
        data: 'c',
      })

      expect(service.isEncrypted(wrongAlgo)).toBe(false)
    })
  })

  describe('clearKeyCache', () => {
    it('should clear cached key', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })

      // Load key into cache
      const key1 = service.getKey()

      // Clear cache
      service.clearKeyCache()

      // Change env var
      const newKey = randomBytes(32).toString('base64')
      process.env['LESCA_ENCRYPTION_KEY'] = newKey

      // Should load new key
      const key2 = service.getKey()

      expect(key1).not.toBe(key2)
      expect(key2.toString('base64')).toBe(newKey)
    })
  })

  describe('round-trip encryption', () => {
    it('should encrypt and decrypt session data', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })

      const sessionData = {
        name: 'leetcode-auth',
        cookies: [
          {
            name: 'LEETCODE_SESSION',
            value: 'abc123def456',
            domain: '.leetcode.com',
            path: '/',
            expires: Date.now() / 1000 + 3600,
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
          },
          {
            name: 'csrftoken',
            value: 'csrf123',
            domain: '.leetcode.com',
            path: '/',
            expires: Date.now() / 1000 + 3600,
            httpOnly: false,
            secure: true,
            sameSite: 'Lax',
          },
        ],
        localStorage: { 'user-preference': 'dark-mode' },
        sessionStorage: { 'session-id': 'xyz789' },
        metadata: {
          created: Date.now(),
          lastUsed: Date.now(),
          description: 'Test session',
        },
      }

      const originalJson = JSON.stringify(sessionData)
      const encrypted = service.encrypt(originalJson)
      const decrypted = service.decrypt(encrypted)

      expect(decrypted).toBe(originalJson)
      expect(JSON.parse(decrypted)).toEqual(sessionData)
    })

    it('should handle empty objects', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const emptyData = JSON.stringify({})

      const encrypted = service.encrypt(emptyData)
      const decrypted = service.decrypt(encrypted)

      expect(decrypted).toBe(emptyData)
    })

    it('should handle arrays', () => {
      process.env['LESCA_ENCRYPTION_KEY'] = validKey
      const service = new EncryptionService({ enabled: true })
      const arrayData = JSON.stringify([1, 2, 3, 'test'])

      const encrypted = service.encrypt(arrayData)
      const decrypted = service.decrypt(encrypted)

      expect(decrypted).toBe(arrayData)
    })
  })
})
