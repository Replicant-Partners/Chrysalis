/**
 * Security Module
 * 
 * Provides cryptographic utilities, secure storage, and canvas encryption.
 * 
 * @module security
 */

// Cryptographic utilities
export {
  EncryptedData,
  generateKey,
  generateSalt,
  generateIV,
  generateToken,
  deriveKeyFromPassword,
  hash,
  encrypt,
  decrypt,
  decryptToString,
  encryptWithPassword,
  decryptWithPassword,
  decryptWithPasswordToString,
  secureWipe,
  secureCompare
} from './crypto';

// API Key Wallet
export {
  ApiKeyWallet,
  ApiKeyProvider,
  ApiKeyEntry,
  WalletSettings,
  WalletState,
  WalletEventType,
  WalletEventHandler,
  getApiKeyWallet,
  createApiKeyWallet
} from './ApiKeyWallet';

// Secure Canvas Manager
export {
  SecureCanvasManager,
  createSecureCanvasManager
} from './SecureCanvasManager';