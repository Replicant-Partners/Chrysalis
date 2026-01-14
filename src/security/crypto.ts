/**
 * Cryptographic utilities for secure canvas and key management
 *
 * Uses Web Crypto API (Node.js crypto module) for:
 * - AES-256-GCM encryption for data at rest
 * - PBKDF2 for key derivation from passwords
 * - Secure random generation
 *
 * @module security/crypto
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt, createHash, timingSafeEqual, ScryptOptions } from 'crypto';
import { promisify } from 'util';

// Type-safe promisified scrypt function
const scryptAsync = promisify<
  string | Buffer,    // password
  string | Buffer,    // salt
  number,             // keylen
  ScryptOptions,      // options
  Buffer              // return type
>(scrypt);

/**
 * Encryption algorithm constants
 */
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const SCRYPT_N = 16384; // CPU/memory cost parameter
const SCRYPT_R = 8; // Block size
const SCRYPT_P = 1; // Parallelization

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  // Base64 encoded ciphertext
  ciphertext: string;
  // Base64 encoded IV
  iv: string;
  // Base64 encoded auth tag
  authTag: string;
  // Base64 encoded salt (for password-derived keys)
  salt?: string;
  // Algorithm identifier
  algorithm: string;
  // Version for future compatibility
  version: 1;
}

/**
 * Generate a random encryption key
 */
export function generateKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

/**
 * Generate a random salt
 */
export function generateSalt(): Buffer {
  return randomBytes(SALT_LENGTH);
}

/**
 * Generate a random IV
 */
export function generateIV(): Buffer {
  return randomBytes(IV_LENGTH);
}

/**
 * Derive a key from a password using scrypt
 * @param password - User password
 * @param salt - Random salt (use generateSalt())
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Buffer
): Promise<Buffer> {
  return scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });
}

/**
 * Hash a string using SHA-256
 */
export function hash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Encrypt data with a key
 */
export function encrypt(
  plaintext: string | Buffer,
  key: Buffer
): EncryptedData {
  const iv = generateIV();
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });

  const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf-8') : plaintext;

  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    algorithm: ALGORITHM,
    version: 1
  };
}

/**
 * Decrypt data with a key
 */
export function decrypt(
  encryptedData: EncryptedData,
  key: Buffer
): Buffer {
  if (encryptedData.version !== 1) {
    throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
  }

  if (encryptedData.algorithm !== ALGORITHM) {
    throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`);
  }

  const iv = Buffer.from(encryptedData.iv, 'base64');
  const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
}

/**
 * Decrypt data to string
 */
export function decryptToString(
  encryptedData: EncryptedData,
  key: Buffer
): string {
  return decrypt(encryptedData, key).toString('utf-8');
}

/**
 * Encrypt with password (includes salt in output)
 */
export async function encryptWithPassword(
  plaintext: string | Buffer,
  password: string
): Promise<EncryptedData> {
  const salt = generateSalt();
  const key = await deriveKeyFromPassword(password, salt);

  const encrypted = encrypt(plaintext, key);
  encrypted.salt = salt.toString('base64');

  return encrypted;
}

/**
 * Decrypt with password
 */
export async function decryptWithPassword(
  encryptedData: EncryptedData,
  password: string
): Promise<Buffer> {
  if (!encryptedData.salt) {
    throw new Error('Encrypted data missing salt for password decryption');
  }

  const salt = Buffer.from(encryptedData.salt, 'base64');
  const key = await deriveKeyFromPassword(password, salt);

  return decrypt(encryptedData, key);
}

/**
 * Decrypt with password to string
 */
export async function decryptWithPasswordToString(
  encryptedData: EncryptedData,
  password: string
): Promise<string> {
  const decrypted = await decryptWithPassword(encryptedData, password);
  return decrypted.toString('utf-8');
}

/**
 * Secure memory wipe (best effort in JavaScript)
 */
export function secureWipe(buffer: Buffer): void {
  buffer.fill(0);
  // Additional overwrites for paranoia
  buffer.fill(0xff);
  buffer.fill(0x00);
  randomBytes(buffer.length).copy(buffer);
  buffer.fill(0);
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Constant-time comparison to prevent timing attacks.
 * Uses Node.js crypto.timingSafeEqual for cryptographically safe comparison.
 *
 * Note: The early return on length mismatch is intentional - in most security
 * contexts (password/token comparison), different lengths already indicate
 * failure, and the timing leak is minimal. For strict constant-time behavior
 * regardless of length, pad both strings to the same length first.
 */
export function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // If lengths differ, we still do a constant-time comparison
  // but with a dummy buffer to avoid timing leaks
  if (bufA.length !== bufB.length) {
    // Compare bufA against itself to maintain constant timing
    // then return false
    timingSafeEqual(bufA, bufA);
    return false;
  }

  // Use Node.js built-in constant-time comparison
  return timingSafeEqual(bufA, bufB);
}
