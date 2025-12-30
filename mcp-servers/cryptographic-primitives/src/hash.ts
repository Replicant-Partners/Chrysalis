/**
 * Hash function operations using @noble/hashes
 * 
 * Provides cryptographic hash functions with proven security properties:
 * - Preimage resistance
 * - Second preimage resistance  
 * - Collision resistance
 */

import { sha256 } from '@noble/hashes/sha256';
import { sha512, sha384 } from '@noble/hashes/sha512';
import { blake3 } from '@noble/hashes/blake3';

export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512' | 'BLAKE3';

/**
 * Hash data using specified algorithm
 */
export function hash(data: Uint8Array, algorithm: HashAlgorithm = 'SHA-256'): Uint8Array {
  switch (algorithm) {
    case 'SHA-256':
      return sha256(data);
    case 'SHA-384':
      return sha384(data);
    case 'SHA-512':
      return sha512(data);
    case 'BLAKE3':
      return blake3(data);
    default:
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }
}

/**
 * Verify data matches expected hash
 */
export function verifyHash(
  data: Uint8Array,
  expectedHash: Uint8Array,
  algorithm: HashAlgorithm = 'SHA-256'
): boolean {
  const computed = hash(data, algorithm);
  
  if (computed.length !== expectedHash.length) {
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed[i] ^ expectedHash[i];
  }
  
  return diff === 0;
}

/**
 * Hash string (UTF-8 encoded)
 */
export function hashString(str: string, algorithm: HashAlgorithm = 'SHA-256'): Uint8Array {
  const encoder = new TextEncoder();
  return hash(encoder.encode(str), algorithm);
}

/**
 * Convert hash bytes to hex string
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to bytes
 */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  
  return bytes;
}
