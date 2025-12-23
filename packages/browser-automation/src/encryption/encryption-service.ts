/**
 * Encryption Service
 *
 * Provides AES-256-GCM encryption for session and cookie data.
 * Uses Node.js built-in crypto module for authenticated encryption.
 *
 * ## Features
 * - AES-256-GCM authenticated encryption
 * - Key from environment variable
 * - Format versioning for future migration
 * - Backward compatible with plain JSON
 *
 * ## Usage
 * ```typescript
 * const encryption = new EncryptionService({ enabled: true })
 *
 * // Encrypt sensitive data
 * const encrypted = encryption.encrypt(JSON.stringify(sessionData))
 *
 * // Decrypt data
 * const decrypted = encryption.decrypt(encrypted)
 *
 * // Check if data is encrypted
 * if (encryption.isEncrypted(fileContent)) {
 *   const data = encryption.decrypt(fileContent)
 * }
 * ```
 *
 * @module browser-automation/encryption
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

import { BrowserError } from '@lesca/error'
import { logger } from '@lesca/shared/utils'

/** Default environment variable name for encryption key */
const DEFAULT_KEY_ENV_VAR = 'LESCA_ENCRYPTION_KEY'

/** AES-256-GCM requires 256-bit (32 byte) key */
const KEY_LENGTH = 32

/** GCM recommended IV length is 12 bytes */
const IV_LENGTH = 12

/** GCM auth tag length is 16 bytes */
const AUTH_TAG_LENGTH = 16

/** Current encryption format version */
const CURRENT_VERSION = 1

/**
 * Encryption configuration options
 */
export interface EncryptionConfig {
  /** Enable encryption. When false, data is stored as plain JSON. */
  enabled: boolean
  /** Environment variable name containing the encryption key. Default: LESCA_ENCRYPTION_KEY */
  keyEnvVar?: string
}

/**
 * Resolved encryption configuration with defaults applied
 */
export interface ResolvedEncryptionConfig {
  enabled: boolean
  keyEnvVar: string
}

/**
 * Encrypted data payload format
 *
 * Stored as JSON with version for future migration support.
 */
export interface EncryptedPayload {
  /** Format version for migration */
  version: number
  /** Encryption algorithm identifier */
  algorithm: 'aes-256-gcm'
  /** Base64-encoded initialization vector (12 bytes) */
  iv: string
  /** Base64-encoded authentication tag (16 bytes) */
  authTag: string
  /** Base64-encoded encrypted data */
  data: string
}

/**
 * Resolves encryption configuration with defaults
 *
 * @param config - Partial configuration
 * @returns Resolved configuration with all required fields
 */
export function resolveEncryptionConfig(
  config: Partial<EncryptionConfig> = {}
): ResolvedEncryptionConfig {
  return {
    enabled: config.enabled ?? false,
    keyEnvVar: config.keyEnvVar ?? DEFAULT_KEY_ENV_VAR,
  }
}

/**
 * Encryption Service
 *
 * Provides transparent encryption/decryption for session and cookie files.
 * Uses AES-256-GCM for authenticated encryption.
 */
export class EncryptionService {
  private readonly config: ResolvedEncryptionConfig
  private keyCache: Buffer | null = null

  /**
   * Creates a new EncryptionService instance.
   *
   * @param config - Encryption configuration
   *
   * @example
   * ```typescript
   * // Enable encryption with default env var
   * const encryption = new EncryptionService({ enabled: true })
   *
   * // Use custom env var name
   * const encryption = new EncryptionService({
   *   enabled: true,
   *   keyEnvVar: 'MY_APP_KEY'
   * })
   * ```
   */
  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = resolveEncryptionConfig(config)
  }

  /**
   * Check if encryption is enabled.
   *
   * @returns True if encryption is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Load encryption key from environment variable.
   *
   * Key must be a base64-encoded 32-byte value.
   *
   * @returns The encryption key as a Buffer
   * @throws {BrowserError} ENCRYPTION_KEY_MISSING - If env var not set
   * @throws {BrowserError} ENCRYPTION_KEY_INVALID - If key is wrong length
   */
  getKey(): Buffer {
    if (this.keyCache) {
      return this.keyCache
    }

    const keyBase64 = process.env[this.config.keyEnvVar]

    if (!keyBase64) {
      throw new BrowserError(
        'BROWSER_ENCRYPTION_KEY_MISSING',
        `Encryption key not found. Set ${this.config.keyEnvVar} environment variable with a base64-encoded 32-byte key.`,
        { context: { keyEnvVar: this.config.keyEnvVar } }
      )
    }

    let key: Buffer
    try {
      key = Buffer.from(keyBase64, 'base64')
    } catch {
      throw new BrowserError(
        'BROWSER_ENCRYPTION_KEY_INVALID',
        `Invalid encryption key format. Key must be base64-encoded.`,
        { context: { keyEnvVar: this.config.keyEnvVar } }
      )
    }

    if (key.length !== KEY_LENGTH) {
      throw new BrowserError(
        'BROWSER_ENCRYPTION_KEY_INVALID',
        `Invalid encryption key length: ${key.length} bytes. Expected ${KEY_LENGTH} bytes (256 bits).`,
        { context: { keyEnvVar: this.config.keyEnvVar, actualLength: key.length } }
      )
    }

    this.keyCache = key
    return key
  }

  /**
   * Encrypt plaintext data.
   *
   * Uses AES-256-GCM for authenticated encryption.
   * Returns a JSON string containing the encrypted payload.
   *
   * @param plaintext - The data to encrypt
   * @returns JSON string containing encrypted payload
   * @throws {BrowserError} ENCRYPTION_KEY_MISSING - If key not set
   * @throws {BrowserError} ENCRYPTION_KEY_INVALID - If key is invalid
   *
   * @example
   * ```typescript
   * const sessionJson = JSON.stringify(sessionData)
   * const encrypted = encryption.encrypt(sessionJson)
   * await fs.writeFile(path, encrypted)
   * ```
   */
  encrypt(plaintext: string): string {
    if (!this.config.enabled) {
      return plaintext
    }

    const key = this.getKey()
    const iv = randomBytes(IV_LENGTH)

    const cipher = createCipheriv('aes-256-gcm', key, iv)
    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const authTag = cipher.getAuthTag()

    const payload: EncryptedPayload = {
      version: CURRENT_VERSION,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      data: encrypted,
    }

    logger.debug('Data encrypted successfully', { algorithm: payload.algorithm })

    return JSON.stringify(payload, null, 2)
  }

  /**
   * Decrypt encrypted data.
   *
   * Verifies the authentication tag to detect tampering.
   *
   * @param ciphertext - JSON string containing encrypted payload
   * @returns Decrypted plaintext
   * @throws {BrowserError} DECRYPTION_FAILED - If decryption fails
   * @throws {BrowserError} DECRYPTION_AUTH_FAILED - If auth tag invalid
   *
   * @example
   * ```typescript
   * const content = await fs.readFile(path, 'utf-8')
   * if (encryption.isEncrypted(content)) {
   *   const decrypted = encryption.decrypt(content)
   *   const sessionData = JSON.parse(decrypted)
   * }
   * ```
   */
  decrypt(ciphertext: string): string {
    let payload: EncryptedPayload

    try {
      payload = JSON.parse(ciphertext) as EncryptedPayload
    } catch {
      throw new BrowserError('BROWSER_DECRYPTION_FAILED', 'Failed to parse encrypted payload', {
        context: { reason: 'Invalid JSON format' },
      })
    }

    // Validate payload structure
    if (!this.isEncryptedPayload(payload)) {
      throw new BrowserError('BROWSER_DECRYPTION_FAILED', 'Invalid encrypted payload structure', {
        context: { reason: 'Missing required fields' },
      })
    }

    // Check version compatibility
    if (payload.version > CURRENT_VERSION) {
      throw new BrowserError(
        'BROWSER_DECRYPTION_FAILED',
        `Unsupported encryption version: ${payload.version}. Max supported: ${CURRENT_VERSION}`,
        { context: { version: payload.version, maxSupported: CURRENT_VERSION } }
      )
    }

    const key = this.getKey()

    let iv: Buffer
    let authTag: Buffer
    let encryptedData: Buffer

    try {
      iv = Buffer.from(payload.iv, 'base64')
      authTag = Buffer.from(payload.authTag, 'base64')
      encryptedData = Buffer.from(payload.data, 'base64')
    } catch {
      throw new BrowserError('BROWSER_DECRYPTION_FAILED', 'Failed to decode encrypted payload', {
        context: { reason: 'Invalid base64 encoding' },
      })
    }

    // Validate IV length
    if (iv.length !== IV_LENGTH) {
      throw new BrowserError('BROWSER_DECRYPTION_FAILED', `Invalid IV length: ${iv.length}`, {
        context: { expectedLength: IV_LENGTH },
      })
    }

    // Validate auth tag length
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new BrowserError(
        'BROWSER_DECRYPTION_FAILED',
        `Invalid auth tag length: ${authTag.length}`,
        { context: { expectedLength: AUTH_TAG_LENGTH } }
      )
    }

    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(encryptedData, undefined, 'utf8')
      decrypted += decipher.final('utf8')

      logger.debug('Data decrypted successfully')

      return decrypted
    } catch (error) {
      // GCM auth tag verification failure
      if (error instanceof Error && error.message.includes('auth')) {
        throw new BrowserError(
          'BROWSER_DECRYPTION_AUTH_FAILED',
          'Authentication failed. Data may have been tampered with.',
          { cause: error }
        )
      }

      throw new BrowserError('BROWSER_DECRYPTION_FAILED', 'Failed to decrypt data', {
        cause: error as Error,
      })
    }
  }

  /**
   * Check if data is in encrypted format.
   *
   * Detects encrypted payloads by checking for version and algorithm fields.
   * Used to determine if decryption is needed for backward compatibility.
   *
   * @param data - Data to check
   * @returns True if data appears to be encrypted
   *
   * @example
   * ```typescript
   * const content = await fs.readFile(path, 'utf-8')
   * const jsonData = encryption.isEncrypted(content)
   *   ? encryption.decrypt(content)
   *   : content
   * const sessionData = JSON.parse(jsonData)
   * ```
   */
  isEncrypted(data: string): boolean {
    if (!data || data.trim().length === 0) {
      return false
    }

    try {
      const parsed = JSON.parse(data) as unknown

      return this.isEncryptedPayload(parsed)
    } catch {
      return false
    }
  }

  /**
   * Type guard for encrypted payload structure
   */
  private isEncryptedPayload(value: unknown): value is EncryptedPayload {
    if (typeof value !== 'object' || value === null) {
      return false
    }

    const obj = value as Record<string, unknown>

    return (
      typeof obj['version'] === 'number' &&
      obj['algorithm'] === 'aes-256-gcm' &&
      typeof obj['iv'] === 'string' &&
      typeof obj['authTag'] === 'string' &&
      typeof obj['data'] === 'string'
    )
  }

  /**
   * Clear the cached encryption key.
   *
   * Use when the key may have changed or to free memory.
   */
  clearKeyCache(): void {
    this.keyCache = null
  }
}
