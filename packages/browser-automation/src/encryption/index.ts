/**
 * Encryption module for browser automation
 *
 * Provides AES-256-GCM encryption for session and cookie data,
 * protecting sensitive authentication tokens at rest.
 *
 * @module browser-automation/encryption
 *
 * @example
 * ```typescript
 * import { EncryptionService } from '@lesca/browser-automation'
 *
 * // Create encryption service (reads key from LESCA_ENCRYPTION_KEY env var)
 * const encryption = new EncryptionService({ enabled: true })
 *
 * // Encrypt session data
 * const encrypted = encryption.encrypt(JSON.stringify(sessionData))
 *
 * // Check if data is encrypted and decrypt
 * if (encryption.isEncrypted(fileContent)) {
 *   const decrypted = encryption.decrypt(fileContent)
 * }
 * ```
 */

export {
  EncryptionService,
  resolveEncryptionConfig,
  type EncryptionConfig,
  type EncryptedPayload,
  type ResolvedEncryptionConfig,
} from './encryption-service'
