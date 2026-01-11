/**
 * WalletContext
 * 
 * Provides global wallet state and actions to all React components.
 * Makes API keys accessible to both chat panes and canvas widgets.
 * 
 * @module ui/contexts/WalletContext
 */

import { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useEffect,
  useMemo,
  ReactNode
} from 'react';
import { WalletCrypto, EncryptedData, PasswordStrength } from '../utils/WalletCrypto';

// ============================================================================
// Types
// ============================================================================

export type ApiKeyProvider = 
  | 'openai' 
  | 'anthropic' 
  | 'google' 
  | 'ollama' 
  | 'azure' 
  | 'huggingface'
  | 'cohere'
  | 'mistral'
  | 'groq'
  | 'custom';

export interface ApiKeyInfo {
  id: string;
  provider: ApiKeyProvider;
  name?: string;
  keyPrefix: string; // Only first few chars for display
  isDefault: boolean;
  createdAt: number;
  lastUsed?: number;
  usageCount: number;
}

export interface ProviderStatus {
  provider: ApiKeyProvider;
  hasKey: boolean;
  isConfigured: boolean;
  source: 'wallet' | 'env' | 'none';
}

export type WalletState = 'uninitialized' | 'locked' | 'unlocked';

export interface WalletContextValue {
  // State
  state: WalletState;
  isUnlocked: boolean;
  isInitialized: boolean;
  keys: ApiKeyInfo[];
  providerStatus: ProviderStatus[];
  
  // Modal state
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  
  // Initialization
  initializeWallet: (password: string) => Promise<void>;
  
  // Lock/Unlock
  unlockWallet: (password: string) => Promise<boolean>;
  lockWallet: () => void;
  
  // Key management
  addKey: (provider: ApiKeyProvider, apiKey: string, options?: {
    name?: string;
    isDefault?: boolean;
  }) => Promise<string>;
  removeKey: (keyId: string) => boolean;
  setDefaultKey: (keyId: string) => void;
  
  // Provider queries
  getKeyForProvider: (provider: ApiKeyProvider) => string | null;
  hasKeyForProvider: (provider: ApiKeyProvider) => boolean;
  
  // Password validation
  validatePassword: (password: string) => PasswordStrength;
  
  // Settings
  autoLockTimeout: number;
  setAutoLockTimeout: (minutes: number) => void;
}

// ============================================================================
// Context
// ============================================================================

const WalletContext = createContext<WalletContextValue | null>(null);

// ============================================================================
// Mock Implementation (Browser-Safe)
// In production, this would bridge to the backend ApiKeyWallet
// ============================================================================

interface StoredKey {
  id: string;
  provider: ApiKeyProvider;
  name?: string;
  apiKey: string; // Plaintext - only exists in memory when unlocked
  isDefault: boolean;
  createdAt: number;
  lastUsed?: number;
  usageCount: number;
}

interface EncryptedStoredKey {
  id: string;
  provider: ApiKeyProvider;
  name?: string;
  encryptedApiKey: EncryptedData; // Encrypted with wallet password
  isDefault: boolean;
  createdAt: number;
  lastUsed?: number;
  usageCount: number;
}

interface WalletStorage {
  keys: EncryptedStoredKey[];
  passwordHash: string;
  version: number;
  createdAt: number;
  lastModified: number;
}

interface LegacyStorage {
  keys: StoredKey[];
  passwordHash?: string;
}

const STORAGE_KEY = 'chrysalis_wallet';
const STORAGE_VERSION = 2; // v2 = encrypted, v1/undefined = legacy plaintext

function loadFromStorage(): WalletStorage | LegacyStorage | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load wallet from storage:', error);
  }
  return null;
}

function saveToStorage(data: WalletStorage) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save wallet to storage:', error);
    throw new Error('Failed to save wallet - storage may be full or disabled');
  }
}

function isLegacyStorage(storage: unknown): storage is LegacyStorage {
  if (!storage || typeof storage !== 'object') return false;
  const obj = storage as Record<string, unknown>;
  return (
    'version' in obj === false &&
    Array.isArray(obj.keys) &&
    obj.keys.every(k => typeof k === 'object' && 'apiKey' in k && typeof k.apiKey === 'string')
  );
}

function isEncryptedStorage(storage: unknown): storage is WalletStorage {
  if (!storage || typeof storage !== 'object') return false;
  const obj = storage as Record<string, unknown>;
  return (
    typeof obj.version === 'number' &&
    obj.version === STORAGE_VERSION &&
    Array.isArray(obj.keys) &&
    obj.keys.every(k => typeof k === 'object' && 'encryptedApiKey' in k)
  );
}

function getKeyPrefix(key: string): string {
  if (key.length <= 8) return key.slice(0, 4) + '...';
  return key.slice(0, 8) + '...';
}

// ============================================================================
// Provider Component
// ============================================================================

export interface WalletProviderProps {
  children: ReactNode;
  /** Called when wallet is ready with API keys */
  onReady?: (getKey: (provider: ApiKeyProvider) => string | null) => void;
}

export function WalletProvider({ children, onReady }: WalletProviderProps) {
  // State
  const [state, setState] = useState<WalletState>('uninitialized');
  const [keys, setKeys] = useState<StoredKey[]>([]); // Plaintext keys in memory (only when unlocked)
  const [passwordHash, setPasswordHash] = useState<string | undefined>();
  const [currentPassword, setCurrentPassword] = useState<string | undefined>(); // Cached password while unlocked
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoLockTimeout, setAutoLockTimeoutState] = useState(30);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [needsMigration, setNeedsMigration] = useState(false);

  // Check Web Crypto API support
  useEffect(() => {
    if (!WalletCrypto.isSupported()) {
      console.error('Web Crypto API not supported - wallet encryption unavailable');
    }
  }, []);

  // Load from storage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    
    if (!stored) {
      // No wallet exists
      setState('uninitialized');
      return;
    }

    if (isEncryptedStorage(stored)) {
      // Modern encrypted storage
      setPasswordHash(stored.passwordHash);
      setState('locked');
    } else if (isLegacyStorage(stored)) {
      // Legacy plaintext storage - needs migration
      console.warn('Legacy plaintext wallet detected - migration required on next unlock');
      setNeedsMigration(true);
      
      if (stored.passwordHash) {
        // Had password but keys not encrypted (shouldn't happen, but handle it)
        setPasswordHash(stored.passwordHash);
        setState('locked');
      } else {
        // No password - treat as uninitialized and require password setup
        setState('uninitialized');
      }
    }
  }, []);

  // Auto-lock timer
  useEffect(() => {
    if (state !== 'unlocked' || autoLockTimeout <= 0) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastActivity) / 1000 / 60;
      if (elapsed >= autoLockTimeout) {
        setState('locked');
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [state, autoLockTimeout, lastActivity]);

  // Update activity on interaction
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  // Notify when ready
  useEffect(() => {
    if (state === 'unlocked' && onReady) {
      onReady((provider) => {
        const key = keys.find(k => k.provider === provider && k.isDefault);
        if (key) return key.apiKey;
        const anyKey = keys.find(k => k.provider === provider);
        return anyKey?.apiKey ?? null;
      });
    }
  }, [state, keys, onReady]);

  // Initialize wallet with password
  const initializeWallet = useCallback(async (password: string) => {
    try {
      // Hash password for verification
      const hash = await WalletCrypto.hashPassword(password);
      setPasswordHash(hash);
      setCurrentPassword(password); // Cache password while unlocked
      setState('unlocked');
      
      // Save encrypted wallet (initially empty)
      const walletStorage: WalletStorage = {
        keys: [],
        passwordHash: hash,
        version: STORAGE_VERSION,
        createdAt: Date.now(),
        lastModified: Date.now()
      };
      saveToStorage(walletStorage);
      
      setNeedsMigration(false);
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      throw new Error('Failed to initialize wallet');
    }
  }, []);

  // Unlock wallet and decrypt keys
  const unlockWallet = useCallback(async (password: string): Promise<boolean> => {
    try {
      updateActivity();
      
      if (!passwordHash) {
        // No password set - shouldn't happen
        return false;
      }

      // Verify password
      const hash = await WalletCrypto.hashPassword(password);
      if (!WalletCrypto.secureCompare(hash, passwordHash)) {
        return false;
      }

      // Load and decrypt keys
      const stored = loadFromStorage();
      
      if (!stored) {
        setState('unlocked');
        return true;
      }

      // Handle migration from legacy storage
      if (needsMigration && isLegacyStorage(stored)) {
        console.log('Migrating legacy plaintext wallet to encrypted storage');
        
        // Encrypt all legacy keys
        const encryptedKeys: EncryptedStoredKey[] = [];
        for (const legacyKey of stored.keys) {
          const encryptedApiKey = await WalletCrypto.encrypt(legacyKey.apiKey, password);
          encryptedKeys.push({
            id: legacyKey.id,
            provider: legacyKey.provider,
            name: legacyKey.name,
            encryptedApiKey,
            isDefault: legacyKey.isDefault,
            createdAt: legacyKey.createdAt,
            lastUsed: legacyKey.lastUsed,
            usageCount: legacyKey.usageCount
          });
        }

        // Save encrypted wallet
        const walletStorage: WalletStorage = {
          keys: encryptedKeys,
          passwordHash: hash,
          version: STORAGE_VERSION,
          createdAt: Date.now(),
          lastModified: Date.now()
        };
        saveToStorage(walletStorage);
        
        // Load plaintext keys into memory
        setKeys(stored.keys);
        setNeedsMigration(false);
        
        console.log('Migration complete - wallet is now encrypted');
      } else if (isEncryptedStorage(stored)) {
        // Decrypt keys into memory
        const decryptedKeys: StoredKey[] = [];
        
        for (const encryptedKey of stored.keys) {
          try {
            const apiKey = await WalletCrypto.decrypt(encryptedKey.encryptedApiKey, password);
            decryptedKeys.push({
              id: encryptedKey.id,
              provider: encryptedKey.provider,
              name: encryptedKey.name,
              apiKey,
              isDefault: encryptedKey.isDefault,
              createdAt: encryptedKey.createdAt,
              lastUsed: encryptedKey.lastUsed,
              usageCount: encryptedKey.usageCount
            });
          } catch (error) {
            console.error(`Failed to decrypt key ${encryptedKey.id}:`, error);
            // Skip corrupted keys
          }
        }
        
        setKeys(decryptedKeys);
      }

      setState('unlocked');
      setCurrentPassword(password); // Cache password for encryption operations
      return true;
    } catch (error) {
      console.error('Failed to unlock wallet:', error);
      return false;
    }
  }, [passwordHash, updateActivity, needsMigration]);

  // Lock wallet and clear plaintext keys from memory
  const lockWallet = useCallback(() => {
    // Clear sensitive data from memory
    setKeys([]);
    setCurrentPassword(undefined); // Clear cached password
    setState('locked');
  }, []);

  // Add key (encrypt before storage)
  const addKey = useCallback(async (
    provider: ApiKeyProvider,
    apiKey: string,
    options?: { name?: string; isDefault?: boolean }
  ): Promise<string> => {
    if (state !== 'unlocked' || !currentPassword) {
      throw new Error('Wallet must be unlocked to add keys');
    }

    updateActivity();
    const id = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newKey: StoredKey = {
      id,
      provider,
      name: options?.name,
      apiKey,
      isDefault: options?.isDefault ?? false,
      createdAt: Date.now(),
      usageCount: 0
    };

    // If setting as default, unset other defaults for this provider
    let updatedKeys = keys;
    if (options?.isDefault) {
      updatedKeys = keys.map(k => 
        k.provider === provider ? { ...k, isDefault: false } : k
      );
    }

    // If this is the first key for provider, make it default
    const hasExisting = updatedKeys.some(k => k.provider === provider);
    if (!hasExisting) {
      newKey.isDefault = true;
    }

    const finalKeys = [...updatedKeys, newKey];

    // Encrypt and save to storage
    try {
      // Load current storage
      const stored = loadFromStorage();
      let walletStorage: WalletStorage;
      
      if (isEncryptedStorage(stored)) {
        walletStorage = stored;
      } else {
        // Initialize new encrypted storage
        walletStorage = {
          keys: [],
          passwordHash: passwordHash!,
          version: STORAGE_VERSION,
          createdAt: Date.now(),
          lastModified: Date.now()
        };
      }

      // Encrypt the new key
      const encryptedApiKey = await WalletCrypto.encrypt(apiKey, currentPassword);
      const encryptedKey: EncryptedStoredKey = {
        id: newKey.id,
        provider: newKey.provider,
        name: newKey.name,
        encryptedApiKey,
        isDefault: newKey.isDefault,
        createdAt: newKey.createdAt,
        usageCount: newKey.usageCount
      };

      // Update encrypted keys in storage
      if (options?.isDefault) {
        walletStorage.keys = walletStorage.keys.map(k => 
          k.provider === provider ? { ...k, isDefault: false } : k
        );
      }
      
      walletStorage.keys.push(encryptedKey);
      walletStorage.lastModified = Date.now();
      saveToStorage(walletStorage);

      // Update plaintext keys in memory
      setKeys(finalKeys);

      return id;
    } catch (error) {
      console.error('Failed to save encrypted key:', error);
      throw new Error('Failed to encrypt and save key');
    }
  }, [state, keys, currentPassword, passwordHash, updateActivity]);

  // Remove key (update encrypted storage)
  const removeKey = useCallback((keyId: string): boolean => {
    if (state !== 'unlocked') {
      return false;
    }

    updateActivity();
    const keyToRemove = keys.find(k => k.id === keyId);
    if (!keyToRemove) return false;

    let updatedKeys = keys.filter(k => k.id !== keyId);
    
    // If we removed the default, make another key default
    if (keyToRemove.isDefault) {
      const nextKey = updatedKeys.find(k => k.provider === keyToRemove.provider);
      if (nextKey) {
        updatedKeys = updatedKeys.map(k => 
          k.id === nextKey.id ? { ...k, isDefault: true } : k
        );
      }
    }

    setKeys(updatedKeys);
    
    // Update storage (remove from encrypted keys)
    try {
      const stored = loadFromStorage();
      if (isEncryptedStorage(stored)) {
        stored.keys = stored.keys.filter(k => k.id !== keyId);
        stored.lastModified = Date.now();
        saveToStorage(stored);
      }
    } catch (error) {
      console.error('Failed to update storage after key removal:', error);
    }
    
    return true;
  }, [state, keys, updateActivity]);

  // Set default key (update encrypted storage)
  const setDefaultKey = useCallback((keyId: string) => {
    if (state !== 'unlocked') {
      return;
    }

    updateActivity();
    const key = keys.find(k => k.id === keyId);
    if (!key) return;

    const updatedKeys = keys.map(k => ({
      ...k,
      isDefault: k.id === keyId ? true : (k.provider === key.provider ? false : k.isDefault)
    }));

    setKeys(updatedKeys);
    
    // Update storage
    try {
      const stored = loadFromStorage();
      if (isEncryptedStorage(stored)) {
        stored.keys = stored.keys.map(k => ({
          ...k,
          isDefault: k.id === keyId ? true : (k.provider === key.provider ? false : k.isDefault)
        }));
        stored.lastModified = Date.now();
        saveToStorage(stored);
      }
    } catch (error) {
      console.error('Failed to update storage after setting default:', error);
    }
  }, [state, keys, updateActivity]);

  // Get key for provider
  const getKeyForProvider = useCallback((provider: ApiKeyProvider): string | null => {
    if (state !== 'unlocked') return null;
    updateActivity();
    
    const defaultKey = keys.find(k => k.provider === provider && k.isDefault);
    if (defaultKey) return defaultKey.apiKey;
    
    const anyKey = keys.find(k => k.provider === provider);
    return anyKey?.apiKey ?? null;
  }, [state, keys, updateActivity]);

  // Check if provider has key
  const hasKeyForProvider = useCallback((provider: ApiKeyProvider): boolean => {
    return keys.some(k => k.provider === provider);
  }, [keys]);

  // Computed values
  const keyInfos: ApiKeyInfo[] = useMemo(() => 
    keys.map(k => ({
      id: k.id,
      provider: k.provider,
      name: k.name,
      keyPrefix: getKeyPrefix(k.apiKey),
      isDefault: k.isDefault,
      createdAt: k.createdAt,
      lastUsed: k.lastUsed,
      usageCount: k.usageCount
    })),
    [keys]
  );

  const providerStatus: ProviderStatus[] = useMemo(() => {
    const providers: ApiKeyProvider[] = [
      'openai', 'anthropic', 'google', 'ollama', 
      'azure', 'huggingface', 'cohere', 'mistral', 'groq'
    ];
    
    return providers.map(provider => ({
      provider,
      hasKey: keys.some(k => k.provider === provider),
      isConfigured: keys.some(k => k.provider === provider),
      source: keys.some(k => k.provider === provider) ? 'wallet' as const : 'none' as const
    }));
  }, [keys]);

  // Password validation
  const validatePassword = useCallback((password: string): PasswordStrength => {
    return WalletCrypto.validatePasswordStrength(password);
  }, []);

  // Context value
  const value: WalletContextValue = useMemo(() => ({
    state,
    isUnlocked: state === 'unlocked',
    isInitialized: state !== 'uninitialized',
    keys: keyInfos,
    providerStatus,
    
    isModalOpen,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
    
    initializeWallet,
    unlockWallet,
    lockWallet,
    
    addKey,
    removeKey,
    setDefaultKey,
    
    getKeyForProvider,
    hasKeyForProvider,
    
    validatePassword,
    
    autoLockTimeout,
    setAutoLockTimeout: setAutoLockTimeoutState
  }), [
    state,
    keyInfos,
    providerStatus,
    isModalOpen,
    initializeWallet,
    unlockWallet,
    lockWallet,
    addKey,
    removeKey,
    setDefaultKey,
    getKeyForProvider,
    hasKeyForProvider,
    validatePassword,
    autoLockTimeout
  ]);

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

export default WalletContext;