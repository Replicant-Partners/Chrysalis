/**
 * WalletCrypto Tests
 * 
 * Unit tests for production-grade encryption utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletCrypto, EncryptedData } from '../WalletCrypto';
import { createMockCrypto } from '../../test/test-utils';

describe('WalletCrypto', () => {
  beforeEach(() => {
    // Reset crypto mock before each test
    const mockCrypto = createMockCrypto();
    vi.stubGlobal('crypto', mockCrypto);
  });

  describe('isAvailable', () => {
    it('should return true when Web Crypto API is available', () => {
      expect(WalletCrypto.isAvailable()).toBe(true);
    });

    it('should return false when Web Crypto API is missing', () => {
      vi.stubGlobal('crypto', undefined);
      expect(WalletCrypto.isAvailable()).toBe(false);
    });
  });

  describe('Password Validation', () => {
    it('should reject passwords shorter than minimum length', () => {
      const result = WalletCrypto.validatePassword('short');
      
      expect(result.isValid).toBe(false);
      expect(result.score).toBeLessThan(50);
      expect(result.feedback).toContain('Password must be at least 12 characters');
    });

    it('should reject passwords longer than maximum length', () => {
      const longPassword = 'a'.repeat(200);
      const result = WalletCrypto.validatePassword(longPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must not exceed 128 characters');
    });

    it('should accept strong passwords', () => {
      const result = WalletCrypto.validatePassword('MyStr0ng!P@ssw0rd123');
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(75);
    });

    it('should score passwords based on complexity', () => {
      const weak = WalletCrypto.validatePassword('aaaaaaaaaaaaaa');
      const medium = WalletCrypto.validatePassword('Password12345');
      const strong = WalletCrypto.validatePassword('P@ssw0rd!2024#Str0ng');

      expect(weak.score).toBeLessThan(medium.score);
      expect(medium.score).toBeLessThan(strong.score);
    });

    it('should provide feedback for password improvements', () => {
      const result = WalletCrypto.validatePassword('passwordpassword');
      
      expect(result.feedback.length).toBeGreaterThan(0);
      expect(result.feedback.some(f => f.includes('uppercase') || f.includes('number') || f.includes('special'))).toBe(true);
    });
  });

  describe('Encryption and Decryption', () => {
    it('should encrypt plaintext successfully', async () => {
      const plaintext = 'sk-my-secret-api-key-12345';
      const password = 'MySecurePassword123!';

      const mockEncrypted = new Uint8Array([1, 2, 3, 4]);
      const mockKey = {} as CryptoKey;
      
      vi.mocked(crypto.subtle.deriveKey).mockResolvedValue(mockKey);
      vi.mocked(crypto.subtle.encrypt).mockResolvedValue(mockEncrypted.buffer);

      const encrypted = await WalletCrypto.encrypt(plaintext, password);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.algorithm).toBe('AES-GCM');
      expect(encrypted.keyDerivation).toBe('PBKDF2');
      expect(encrypted.iterations).toBe(600000);
      expect(encrypted.version).toBe(1);
    });

    it('should decrypt ciphertext successfully', async () => {
      const plaintext = 'sk-my-secret-api-key-12345';
      const password = 'MySecurePassword123!';

      const mockDecrypted = new TextEncoder().encode(plaintext);
      const mockKey = {} as CryptoKey;
      
      vi.mocked(crypto.subtle.deriveKey).mockResolvedValue(mockKey);
      vi.mocked(crypto.subtle.decrypt).mockResolvedValue(mockDecrypted.buffer);

      const encrypted: EncryptedData = {
        ciphertext: btoa('encrypted'),
        iv: btoa('iv'),
        salt: btoa('salt'),
        algorithm: 'AES-GCM',
        keyDerivation: 'PBKDF2',
        iterations: 600000,
        version: 1
      };

      const decrypted = await WalletCrypto.decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error on decryption with wrong password', async () => {
      const password = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';

      vi.mocked(crypto.subtle.decrypt).mockRejectedValue(new Error('Decryption failed'));

      const encrypted: EncryptedData = {
        ciphertext: btoa('encrypted'),
        iv: btoa('iv'),
        salt: btoa('salt'),
        algorithm: 'AES-GCM',
        keyDerivation: 'PBKDF2',
        iterations: 600000,
        version: 1
      };

      await expect(
        WalletCrypto.decrypt(encrypted, wrongPassword)
      ).rejects.toThrow();
    });

    it('should use unique salts for each encryption', async () => {
      const plaintext = 'sk-test-key';
      const password = 'TestPassword123!';

      const mockKey = {} as CryptoKey;
      vi.mocked(crypto.subtle.deriveKey).mockResolvedValue(mockKey);
      vi.mocked(crypto.subtle.encrypt).mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);

      const encrypted1 = await WalletCrypto.encrypt(plaintext, password);
      const encrypted2 = await WalletCrypto.encrypt(plaintext, password);

      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });
  });

  describe('Data Serialization', () => {
    it('should serialize and deserialize encrypted data', () => {
      const encryptedData: EncryptedData = {
        ciphertext: btoa('test-cipher'),
        iv: btoa('test-iv'),
        salt: btoa('test-salt'),
        algorithm: 'AES-GCM',
        keyDerivation: 'PBKDF2',
        iterations: 600000,
        version: 1
      };

      const serialized = JSON.stringify(encryptedData);
      const deserialized = JSON.parse(serialized) as EncryptedData;

      expect(deserialized).toEqual(encryptedData);
      expect(deserialized.ciphertext).toBe(encryptedData.ciphertext);
      expect(deserialized.iv).toBe(encryptedData.iv);
      expect(deserialized.salt).toBe(encryptedData.salt);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty plaintext', async () => {
      const mockKey = {} as CryptoKey;
      vi.mocked(crypto.subtle.deriveKey).mockResolvedValue(mockKey);
      vi.mocked(crypto.subtle.encrypt).mockResolvedValue(new Uint8Array([]).buffer);

      const encrypted = await WalletCrypto.encrypt('', 'Password123!');
      
      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
    });

    it('should handle special characters in plaintext', async () => {
      const plaintext = 'key-with-特殊字符-and-émojis-🔐';
      const password = 'Password123!';

      const mockKey = {} as CryptoKey;
      const mockEncrypted = new TextEncoder().encode(plaintext);
      
      vi.mocked(crypto.subtle.deriveKey).mockResolvedValue(mockKey);
      vi.mocked(crypto.subtle.encrypt).mockResolvedValue(mockEncrypted.buffer);

      const encrypted = await WalletCrypto.encrypt(plaintext, password);
      
      expect(encrypted).toBeDefined();
    });

    it('should reject invalid encrypted data structure', async () => {
      const invalidData = {
        ciphertext: 'test',
        // Missing required fields
      } as any;

      await expect(
        WalletCrypto.decrypt(invalidData, 'Password123!')
      ).rejects.toThrow();
    });
  });
});