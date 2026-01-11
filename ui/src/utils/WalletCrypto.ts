/**
 * WalletCrypto - Browser-compatible encryption for API key wallet
 * 
 * Implements production-grade encryption using Web Crypto API:
 * - AES-256-GCM for authenticated encryption
 * - PBKDF2 with 600,000 iterations (NIST SP 800-132)
 * - SHA-256 for key derivation
 * - Secure random generation for salts and IVs
 * 
 * SECURITY NOTES:
 * - Keys are derived from passwords using PBKDF2 with high iteration count
 * - Each encrypted value has unique salt and IV
 * - Auth tags provide integrity verification
 * - Constant-time comparison prevents timing attacks
 * 
 * @module ui/utils/WalletCrypto
 */

/**
 * Encrypted data structure compatible with localStorage JSON serialization
 */
export interface EncryptedData {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector */
  iv: string;
  /** Base64-encoded salt for key derivation */
  salt: string;
  /** Algorithm identifier */
  algorithm: 'AES-GCM';
  /** Key derivation algorithm */
  keyDerivation: 'PBKDF2';
  /** PBKDF2 iterations (600,000 per NIST) */
  iterations: number;
  /** Version for future compatibility */
  version: 1;
}

/**
 * Password strength requirements
 */
export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-100
  feedback: string[];
}

/**
 * Configuration constants
 */
const CRYPTO_CONFIG = {
  // AES-256-GCM parameters
  ALGORITHM: 'AES-GCM' as const,
  KEY_LENGTH: 256, // bits
  IV_LENGTH: 12, // bytes (96 bits, recommended for GCM)
  TAG_LENGTH: 128, // bits (16 bytes)
  
  // PBKDF2 parameters (NIST SP 800-132)
  KEY_DERIVATION: 'PBKDF2' as const,
  ITERATIONS: 600000, // NIST recommendation for password-based keys
  SALT_LENGTH: 32, // bytes (256 bits)
  HASH: 'SHA-256' as const,
  
  // Password requirements
  MIN_PASSWORD_LENGTH: 12,
  MAX_PASSWORD_LENGTH: 128,
  
  // Version
  VERSION: 1 as const
} as const;

/**
 * WalletCrypto - Production-grade encryption for browser storage
 */
export class WalletCrypto {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  /**
   * Check if Web Crypto API is available
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 
           typeof window.crypto !== 'undefined' && 
           typeof window.crypto.subtle !== 'undefined';
  }

  /**
   * Generate a random salt for key derivation
   */
  static generateSalt(): Uint8Array {
    const array = new Uint8Array(CRYPTO_CONFIG.SALT_LENGTH);
    window.crypto.getRandomValues(array);
    return array;
  }

  /**
   * Generate a random IV for encryption
   */
  static generateIV(): Uint8Array {
    const array = new Uint8Array(CRYPTO_CONFIG.IV_LENGTH);
    window.crypto.getRandomValues(array);
    return array;
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  static async deriveKey(
    password: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    // Import password as key material
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      this.encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive AES key using PBKDF2
    return window.crypto.subtle.deriveKey(
      {
        name: CRYPTO_CONFIG.KEY_DERIVATION,
        salt: salt as BufferSource,
        iterations: CRYPTO_CONFIG.ITERATIONS,
        hash: CRYPTO_CONFIG.HASH
      },
      passwordKey,
      {
        name: CRYPTO_CONFIG.ALGORITHM,
        length: CRYPTO_CONFIG.KEY_LENGTH
      },
      false, // Not extractable for security
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt plaintext with password
   */
  static async encrypt(
    plaintext: string,
    password: string
  ): Promise<EncryptedData> {
    if (!this.isSupported()) {
      throw new Error('Web Crypto API not supported in this environment');
    }

    // Generate unique salt and IV for this encryption
    const salt = this.generateSalt();
    const iv = this.generateIV();

    // Derive key from password
    const key = await this.deriveKey(password, salt);

    // Encrypt data
    const plaintextBytes = this.encoder.encode(plaintext);
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: CRYPTO_CONFIG.ALGORITHM,
        iv: iv as BufferSource,
        tagLength: CRYPTO_CONFIG.TAG_LENGTH
      },
      key,
      plaintextBytes
    );

    // Return structured encrypted data
    return {
      ciphertext: this.bufferToBase64(ciphertextBuffer),
      iv: this.bufferToBase64(iv),
      salt: this.bufferToBase64(salt),
      algorithm: CRYPTO_CONFIG.ALGORITHM,
      keyDerivation: CRYPTO_CONFIG.KEY_DERIVATION,
      iterations: CRYPTO_CONFIG.ITERATIONS,
      version: CRYPTO_CONFIG.VERSION
    };
  }

  /**
   * Decrypt ciphertext with password
   */
  static async decrypt(
    encryptedData: EncryptedData,
    password: string
  ): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Web Crypto API not supported in this environment');
    }

    // Validate version
    if (encryptedData.version !== CRYPTO_CONFIG.VERSION) {
      throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
    }

    // Validate algorithm
    if (encryptedData.algorithm !== CRYPTO_CONFIG.ALGORITHM) {
      throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`);
    }

    // Convert from base64
    const ciphertext = this.base64ToBuffer(encryptedData.ciphertext);
    const iv = this.base64ToBuffer(encryptedData.iv);
    const salt = this.base64ToBuffer(encryptedData.salt);

    // Derive key from password
    const key = await this.deriveKey(password, salt);

    // Decrypt data (will throw if auth tag verification fails)
    try {
      const plaintextBuffer = await window.crypto.subtle.decrypt(
        {
          name: CRYPTO_CONFIG.ALGORITHM,
          iv: iv as BufferSource,
          tagLength: CRYPTO_CONFIG.TAG_LENGTH
        },
        key,
        ciphertext as BufferSource
      );

      return this.decoder.decode(plaintextBuffer);
    } catch (error) {
      // Decryption failure usually means wrong password
      throw new Error('Decryption failed - incorrect password or corrupted data');
    }
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): PasswordStrength {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length < CRYPTO_CONFIG.MIN_PASSWORD_LENGTH) {
      feedback.push(`Password must be at least ${CRYPTO_CONFIG.MIN_PASSWORD_LENGTH} characters`);
      return { isValid: false, score: 0, feedback };
    }

    if (password.length > CRYPTO_CONFIG.MAX_PASSWORD_LENGTH) {
      feedback.push(`Password must not exceed ${CRYPTO_CONFIG.MAX_PASSWORD_LENGTH} characters`);
      return { isValid: false, score: 0, feedback };
    }

    // Length scoring (0-30 points)
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;

    // Character variety checks
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    // Variety scoring (0-40 points)
    if (hasLowercase) score += 10;
    if (hasUppercase) score += 10;
    if (hasNumbers) score += 10;
    if (hasSpecial) score += 10;

    // Complexity requirements
    const varietyCount = [hasLowercase, hasUppercase, hasNumbers, hasSpecial].filter(Boolean).length;
    
    if (varietyCount < 3) {
      feedback.push('Password should include at least 3 of: lowercase, uppercase, numbers, symbols');
    }

    // Common patterns check (0-30 points)
    const hasRepeatingChars = /(.)\1{2,}/.test(password);
    const hasSequentialChars = /(abc|bcd|cde|def|012|123|234|345)/i.test(password);
    const hasCommonWords = /(password|admin|user|login|welcome|qwerty|123456)/i.test(password);

    if (!hasRepeatingChars) score += 10;
    if (!hasSequentialChars) score += 10;
    if (!hasCommonWords) score += 10;

    if (hasRepeatingChars) {
      feedback.push('Avoid repeating characters');
    }
    if (hasSequentialChars) {
      feedback.push('Avoid sequential patterns');
    }
    if (hasCommonWords) {
      feedback.push('Avoid common words');
    }

    // Determine validity (requires 60+ score and 3+ character types)
    const isValid = score >= 60 && varietyCount >= 3;

    if (isValid && feedback.length === 0) {
      if (score >= 80) {
        feedback.push('Strong password');
      } else {
        feedback.push('Good password');
      }
    }

    return { isValid, score, feedback };
  }

  /**
   * Hash password for verification (not for encryption)
   * Used to verify password without storing it
   */
  static async hashPassword(password: string): Promise<string> {
    const passwordBytes = this.encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', passwordBytes as BufferSource);
    return this.bufferToBase64(hashBuffer);
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  private static bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to Uint8Array
   */
  private static base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Generate a secure random token (for session IDs, etc.)
   */
  static generateToken(length: number = 32): string {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return this.bufferToBase64(array);
  }
}

/**
 * Type guard to check if data is encrypted
 */
export function isEncryptedData(data: unknown): data is EncryptedData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  
  return (
    typeof obj.ciphertext === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.salt === 'string' &&
    obj.algorithm === 'AES-GCM' &&
    obj.keyDerivation === 'PBKDF2' &&
    typeof obj.iterations === 'number' &&
    obj.version === 1
  );
}

export default WalletCrypto;