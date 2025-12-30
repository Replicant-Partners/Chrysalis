/**
 * Cryptographically secure random operations
 * 
 * Uses Node.js crypto.randomBytes (backed by OS entropy)
 */

import { randomBytes as cryptoRandomBytes } from 'crypto';

/**
 * Generate cryptographically secure random bytes
 * 
 * Properties:
 * - Unpredictable: Cannot predict next value from previous values
 * - Uniform distribution: Each value equally probable
 * - Independence: Each output independent
 * 
 * Uses OS-level entropy (/dev/urandom on Unix, CryptGenRandom on Windows)
 */
export function randomBytes(length: number): Uint8Array {
  if (length < 0) {
    throw new Error('Length must be non-negative');
  }
  
  return new Uint8Array(cryptoRandomBytes(length));
}

/**
 * Generate random integer in range [0, max)
 * 
 * Uses rejection sampling to avoid modulo bias
 */
export function randomInt(max: number): number {
  if (max <= 0) {
    throw new Error('Max must be positive');
  }
  
  if (max === 1) {
    return 0;
  }
  
  // Calculate number of bytes needed
  const bitsNeeded = Math.ceil(Math.log2(max));
  const bytesNeeded = Math.ceil(bitsNeeded / 8);
  const mask = (1 << bitsNeeded) - 1;
  
  // Rejection sampling: keep generating until value < max
  while (true) {
    const bytes = randomBytes(bytesNeeded);
    let value = 0;
    
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
    }
    
    value &= mask;
    
    if (value < max) {
      return value;
    }
    
    // Reject and retry (avoids modulo bias)
  }
}

/**
 * Generate random integer in range [min, max)
 */
export function randomIntRange(min: number, max: number): number {
  if (min >= max) {
    throw new Error('Min must be less than max');
  }
  
  return min + randomInt(max - min);
}

/**
 * Select random element from array
 */
export function randomSelect<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot select from empty array');
  }
  
  const index = randomInt(array.length);
  return array[index];
}

/**
 * Select k random elements from array without replacement
 * 
 * Uses Fisher-Yates shuffle for unbiased sampling
 */
export function randomSample<T>(array: T[], k: number): T[] {
  if (k < 0) {
    throw new Error('Sample size must be non-negative');
  }
  
  if (k > array.length) {
    throw new Error('Sample size cannot exceed array length');
  }
  
  if (k === 0) {
    return [];
  }
  
  // Make a copy to avoid mutating original
  const copy = [...array];
  const result: T[] = [];
  
  // Fisher-Yates shuffle for first k elements
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(copy.length - i);
    
    // Swap
    [copy[i], copy[j]] = [copy[j], copy[i]];
    result.push(copy[i]);
  }
  
  return result;
}

/**
 * Shuffle array in-place (Fisher-Yates)
 */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  
  return array;
}

/**
 * Generate random UUID v4
 */
export function randomUUID(): string {
  const bytes = randomBytes(16);
  
  // Set version to 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  
  // Set variant to RFC4122
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  // Format as UUID string
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
