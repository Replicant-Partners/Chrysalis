/**
 * Encryption Utilities - Cryptographic operations for shadow data
 *
 * Provides AES-256-GCM encryption, PBKDF2 key derivation,
 * and RSA digital signatures.
 */

import * as crypto from 'crypto';
import type { EncryptedShadow, ShadowData } from './FrameworkAdapter';

// ============================================================================
// Constants - Named for clarity and maintainability
// ============================================================================

/** AES-256-GCM provides authenticated encryption */
const ALGORITHM = 'aes-256-gcm';
/** 256-bit key for AES-256 */
const KEY_LENGTH = 32;
/** 128-bit IV is standard for GCM mode */
const IV_LENGTH = 16;
/** 128-bit authentication tag */
const AUTH_TAG_LENGTH = 16;
/** PBKDF2 iterations - OWASP recommends 100k+ for SHA-256 */
const PBKDF2_ITERATIONS = 100000;

// ============================================================================
// Types - Replacing `any` with specific types
// ============================================================================

/**
 * JSON-serializable data that can be encrypted.
 * This type represents any value that JSON.stringify can handle.
 */
export type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | JsonSerializable[]
  | { [key: string]: JsonSerializable };

/**
 * Encryption result
 */
export interface EncryptionResult {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}

/**
 * Derive encryption key from fingerprint using PBKDF2
 */
export function deriveKey(fingerprint: string, salt: string): Buffer {
  return crypto.pbkdf2Sync(
    fingerprint,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256'
  );
}

/**
 * Encrypt data with AES-256-GCM
 * @param data - JSON-serializable data to encrypt
 * @param fingerprint - Agent fingerprint used for key derivation
 */
export function encrypt(
  data: JsonSerializable,
  fingerprint: string
): EncryptionResult {
  // Generate random salt and IV
  const salt = crypto.randomBytes(16).toString('base64');
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from fingerprint
  const key = deriveKey(fingerprint, salt);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt data
  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    salt
  };
}

/**
 * Decrypt data with AES-256-GCM
 * @returns The decrypted JSON data
 */
export function decrypt(
  encryptedData: string,
  iv: string,
  authTag: string,
  fingerprint: string,
  salt: string
): JsonSerializable {
  // Derive key from fingerprint
  const key = deriveKey(fingerprint, salt);

  // Create decipher
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64')
  );

  // Set auth tag
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  // Decrypt data
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, 'base64')),
    decipher.final()
  ]);

  // Parse JSON
  return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Generate SHA-256 checksum
 * @param data - JSON-serializable data to hash
 */
export function generateChecksum(data: JsonSerializable): string {
  const json = JSON.stringify(data);
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Verify checksum using constant-time comparison.
 *
 * SECURITY NOTE: We use crypto.timingSafeEqual to prevent timing attacks.
 * An attacker observing response times could otherwise infer checksum
 * characters one-by-one by measuring how long comparisons take.
 */
export function verifyChecksum(data: JsonSerializable, expectedChecksum: string): boolean {
  const actualChecksum = generateChecksum(data);

  // Convert to buffers for timing-safe comparison
  const actualBuf = Buffer.from(actualChecksum, 'utf8');
  const expectedBuf = Buffer.from(expectedChecksum, 'utf8');

  // Different lengths means different checksums, but we still do a
  // constant-time operation to avoid leaking length information
  if (actualBuf.length !== expectedBuf.length) {
    crypto.timingSafeEqual(actualBuf, actualBuf); // Maintain constant timing
    return false;
  }

  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

/**
 * Create digital signature
 */
export function createSignature(
  data: string,
  privateKey: string
): string {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

/**
 * Verify digital signature
 */
export function verifySignature(
  data: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    return false;
  }
}

/**
 * Generate agent fingerprint from identity
 */
export function generateFingerprint(identity: {
  name: string;
  designation: string;
  created?: string;
  id?: string;
}): string {
  const data = JSON.stringify({
    name: identity.name,
    designation: identity.designation,
    created: identity.created || Date.now(),
    id: identity.id || crypto.randomUUID()
  });

  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Encrypt shadow data
 */
export function encryptShadow(
  shadow: ShadowData,
  fingerprint: string,
  privateKey?: string
): EncryptedShadow {
  // Add checksum
  shadow.checksum = generateChecksum(shadow.data);

  // Encrypt
  const encrypted = encrypt(shadow, fingerprint);

  // Create data to sign
  const dataToSign = `${encrypted.encrypted}:${encrypted.iv}:${encrypted.authTag}:${fingerprint}`;

  // Sign (use hash if no private key)
  const signature = privateKey
    ? createSignature(dataToSign, privateKey)
    : crypto.createHash('sha256').update(dataToSign).digest('base64');

  return {
    encrypted: encrypted.encrypted,
    algorithm: ALGORITHM,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    signature,
    metadata: {
      framework: shadow.framework,
      version: shadow.version,
      timestamp: shadow.timestamp,
      checksum: shadow.checksum
    }
  };
}

/**
 * Decrypt shadow data
 */
export function decryptShadow(
  encrypted: EncryptedShadow,
  restorationKey: string,
  fingerprint: string,
  publicKey?: string
): ShadowData {
  // Parse restoration key
  const [salt, authTag] = restorationKey.split(':');

  if (!salt || !authTag) {
    throw new Error('Invalid restoration key format. Expected "salt:authTag"');
  }

  // Verify signature if public key provided
  if (publicKey) {
    const dataToSign = `${encrypted.encrypted}:${encrypted.iv}:${authTag}:${fingerprint}`;
    const valid = verifySignature(dataToSign, encrypted.signature, publicKey);

    if (!valid) {
      throw new Error('Signature verification failed - agent identity cannot be confirmed');
    }
  }

  // Decrypt
  const decrypted = decrypt(
    encrypted.encrypted,
    encrypted.iv,
    authTag,
    fingerprint,
    salt
  );

  // Verify checksum
  if (decrypted.checksum) {
    const valid = verifyChecksum(decrypted.data, decrypted.checksum);
    if (!valid) {
      throw new Error('Checksum verification failed - data may be corrupted');
    }
  }

  return decrypted;
}

/**
 * Generate restoration key
 */
export function generateRestorationKey(salt: string, authTag: string): string {
  return `${salt}:${authTag}`;
}

/**
 * Generate RSA key pair
 */
export function generateKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'pkcs1',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem'
    }
  });

  return { publicKey, privateKey };
}
