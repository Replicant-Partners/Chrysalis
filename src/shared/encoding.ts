/**
 * Cross-platform encoding utilities
 * 
 * Provides Base64 encoding/decoding that works in both Node.js and browser environments.
 * 
 * @module shared/encoding
 * @version 1.0.0
 */

/**
 * Encode a string to Base64.
 * Works in both Node.js and browser environments.
 * 
 * @param str - The string to encode
 * @returns Base64 encoded string
 */
export function base64Encode(str: string): string {
  // Browser environment
  if (typeof btoa !== 'undefined') {
    // Handle Unicode characters by encoding to UTF-8 first
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch {
      // Fallback for simple ASCII
      return btoa(str);
    }
  }
  
  // Node.js environment
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  
  throw new Error('No Base64 encoding method available');
}

/**
 * Decode a Base64 string.
 * Works in both Node.js and browser environments.
 * 
 * @param str - The Base64 string to decode
 * @returns Decoded string
 */
export function base64Decode(str: string): string {
  // Browser environment
  if (typeof atob !== 'undefined') {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch {
      // Fallback for simple ASCII
      return atob(str);
    }
  }
  
  // Node.js environment
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('utf-8');
  }
  
  throw new Error('No Base64 decoding method available');
}

/**
 * Encode credentials for Basic authentication.
 * 
 * @param username - The username
 * @param password - The password
 * @returns Base64 encoded credentials string
 */
export function encodeBasicAuth(username: string, password: string): string {
  return base64Encode(`${username}:${password}`);
}

/**
 * Check if we're running in a browser environment.
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

/**
 * Check if we're running in a Node.js environment.
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && 
         process.versions != null && 
         process.versions.node != null;
}

export default {
  base64Encode,
  base64Decode,
  encodeBasicAuth,
  isBrowser,
  isNode
};
