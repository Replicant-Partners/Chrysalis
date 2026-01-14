/**
 * WalletContext Tests
 *
 * Tests for the wallet state management context
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { WalletProvider, useWallet } from '../WalletContext';
import { WalletCrypto } from '../../utils/WalletCrypto';

// Mock WalletCrypto
vi.mock('../../utils/WalletCrypto', () => ({
  WalletCrypto: {
    isAvailable: vi.fn(() => true),
    encrypt: vi.fn(async (plaintext) => ({
      ciphertext: btoa(plaintext),
      iv: btoa('iv'),
      salt: btoa('salt'),
      algorithm: 'AES-GCM' as const,
      keyDerivation: 'PBKDF2' as const,
      iterations: 600000,
      version: 1 as const
    })),
    decrypt: vi.fn(async (encrypted, _password) => {
      // Simulate successful decryption
      return atob(encrypted.ciphertext);
    }),
    validatePassword: vi.fn((password) => ({
      isValid: password.length >= 12,
      score: password.length >= 12 ? 80 : 20,
      feedback: password.length >= 12 ? [] : ['Password must be at least 12 characters']
    }))
  }
}));

describe('WalletContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should start in uninitialized state', () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      expect(result.current.state).toBe('uninitialized');
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isUnlocked).toBe(false);
    });

    it('should detect existing wallet in localStorage', () => {
      localStorage.setItem('chrysalis_wallet_initialized', 'true');

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      expect(result.current.state).toBe('locked');
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isUnlocked).toBe(false);
    });

    it('should initialize wallet with password', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      await act(async () => {
        await result.current.initializeWallet('MySecurePassword123!');
      });

      expect(result.current.state).toBe('unlocked');
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isUnlocked).toBe(true);
    });

    it('should reject weak passwords', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      await expect(
        result.current.initializeWallet('weak')
      ).rejects.toThrow();
    });
  });

  describe('Lock/Unlock', () => {
    beforeEach(() => {
      localStorage.setItem('chrysalis_wallet_initialized', 'true');
      localStorage.setItem('chrysalis_wallet_keys', JSON.stringify([]));
    });

    it('should unlock wallet with correct password', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      expect(result.current.state).toBe('locked');

      const unlocked = await act(async () => {
        return await result.current.unlockWallet('CorrectPassword123!');
      });

      expect(unlocked).toBe(true);
      expect(result.current.state).toBe('unlocked');
      expect(result.current.isUnlocked).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      vi.mocked(WalletCrypto.decrypt).mockRejectedValueOnce(new Error('Decryption failed'));

      const unlocked = await act(async () => {
        return await result.current.unlockWallet('WrongPassword123!');
      });

      expect(unlocked).toBe(false);
      expect(result.current.state).toBe('locked');
    });

    it('should lock wallet', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      // First unlock
      await act(async () => {
        await result.current.unlockWallet('Password123!');
      });

      expect(result.current.isUnlocked).toBe(true);

      // Then lock
      act(() => {
        result.current.lockWallet();
      });

      expect(result.current.state).toBe('locked');
      expect(result.current.isUnlocked).toBe(false);
    });
  });

  describe('Key Management', () => {
    beforeEach(async () => {
      localStorage.setItem('chrysalis_wallet_initialized', 'true');
    });

    it('should add API key', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      await act(async () => {
        await result.current.unlockWallet('Password123!');
      });

      const keyId = await act(async () => {
        return await result.current.addKey('openai', 'sk-test-key-12345', {
          name: 'Test Key',
          isDefault: true
        });
      });

      expect(keyId).toBeDefined();
      expect(result.current.keys.length).toBe(1);
      expect(result.current.keys[0].provider).toBe('openai');
      expect(result.current.keys[0].isDefault).toBe(true);
    });

    it('should remove API key', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      await act(async () => {
        await result.current.unlockWallet('Password123!');
      });

      const keyId = await act(async () => {
        return await result.current.addKey('openai', 'sk-test-key');
      });

      const removed = act(() => {
        return result.current.removeKey(keyId);
      });

      expect(removed).toBe(true);
      expect(result.current.keys.length).toBe(0);
    });

    it('should get key for provider', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      await act(async () => {
        await result.current.unlockWallet('Password123!');
        await result.current.addKey('openai', 'sk-openai-key');
      });

      const key = result.current.getKeyForProvider('openai');
      expect(key).toBe('sk-openai-key');
    });

    it('should return null for missing provider', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      await act(async () => {
        await result.current.unlockWallet('Password123!');
      });

      const key = result.current.getKeyForProvider('anthropic');
      expect(key).toBeNull();
    });

    it('should set default key', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      await act(async () => {
        await result.current.unlockWallet('Password123!');
      });

      const keyId1 = await act(async () => {
        return await result.current.addKey('openai', 'sk-key-1', { isDefault: true });
      });

      const keyId2 = await act(async () => {
        return await result.current.addKey('openai', 'sk-key-2');
      });

      act(() => {
        result.current.setDefaultKey(keyId2);
      });

      const key1 = result.current.keys.find(k => k.id === keyId1);
      const key2 = result.current.keys.find(k => k.id === keyId2);

      expect(key1?.isDefault).toBe(false);
      expect(key2?.isDefault).toBe(true);
    });
  });

  describe('Provider Status', () => {
    it('should check if provider has key', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      await act(async () => {
        await result.current.unlockWallet('Password123!');
        await result.current.addKey('openai', 'sk-test-key');
      });

      expect(result.current.hasKeyForProvider('openai')).toBe(true);
      expect(result.current.hasKeyForProvider('anthropic')).toBe(false);
    });

    it('should provide provider status list', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      await act(async () => {
        await result.current.unlockWallet('Password123!');
        await result.current.addKey('openai', 'sk-test-key');
      });

      const openaiStatus = result.current.providerStatus.find(
        s => s.provider === 'openai'
      );

      expect(openaiStatus?.hasKey).toBe(true);
      expect(openaiStatus?.source).toBe('wallet');
    });
  });

  describe('Modal State', () => {
    it('should control modal open/close', () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      expect(result.current.isModalOpen).toBe(false);

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isModalOpen).toBe(true);

      act(() => {
        result.current.closeModal();
      });

      expect(result.current.isModalOpen).toBe(false);
    });
  });

  describe('Auto-lock', () => {
    it('should configure auto-lock timeout', () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      expect(result.current.autoLockTimeout).toBe(15); // Default 15 minutes

      act(() => {
        result.current.setAutoLockTimeout(30);
      });

      expect(result.current.autoLockTimeout).toBe(30);
    });
  });

  describe('Password Validation', () => {
    it('should validate password strength', () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider
      });

      const weak = result.current.validatePassword('weak');
      expect(weak.isValid).toBe(false);

      const strong = result.current.validatePassword('StrongPassword123!');
      expect(strong.isValid).toBe(true);
      expect(strong.score).toBeGreaterThanOrEqual(75);
    });
  });
});