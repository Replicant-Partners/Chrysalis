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
  apiKey: string; // In real impl, encrypted
  isDefault: boolean;
  createdAt: number;
  lastUsed?: number;
  usageCount: number;
}

const STORAGE_KEY = 'chrysalis_wallet';

function loadFromStorage(): { keys: StoredKey[]; passwordHash?: string } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore storage errors
  }
  return { keys: [] };
}

function saveToStorage(data: { keys: StoredKey[]; passwordHash?: string }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

// Simple hash for demo (in real impl use proper crypto)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
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
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [passwordHash, setPasswordHash] = useState<string | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoLockTimeout, setAutoLockTimeoutState] = useState(30);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Load from storage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored.passwordHash) {
      setPasswordHash(stored.passwordHash);
      setKeys(stored.keys);
      setState('locked');
    } else if (stored.keys.length > 0) {
      // Legacy: keys without password
      setKeys(stored.keys);
      setState('unlocked');
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
    const hash = simpleHash(password);
    setPasswordHash(hash);
    setState('unlocked');
    saveToStorage({ keys, passwordHash: hash });
  }, [keys]);

  // Unlock wallet
  const unlockWallet = useCallback(async (password: string): Promise<boolean> => {
    updateActivity();
    if (!passwordHash) {
      // No password set, just unlock
      setState('unlocked');
      return true;
    }
    const hash = simpleHash(password);
    if (hash === passwordHash) {
      setState('unlocked');
      return true;
    }
    return false;
  }, [passwordHash, updateActivity]);

  // Lock wallet
  const lockWallet = useCallback(() => {
    setState('locked');
  }, []);

  // Add key
  const addKey = useCallback(async (
    provider: ApiKeyProvider,
    apiKey: string,
    options?: { name?: string; isDefault?: boolean }
  ): Promise<string> => {
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
    setKeys(finalKeys);
    saveToStorage({ keys: finalKeys, passwordHash });

    return id;
  }, [keys, passwordHash, updateActivity]);

  // Remove key
  const removeKey = useCallback((keyId: string): boolean => {
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
    saveToStorage({ keys: updatedKeys, passwordHash });
    return true;
  }, [keys, passwordHash, updateActivity]);

  // Set default key
  const setDefaultKey = useCallback((keyId: string) => {
    updateActivity();
    const key = keys.find(k => k.id === keyId);
    if (!key) return;

    const updatedKeys = keys.map(k => ({
      ...k,
      isDefault: k.id === keyId ? true : (k.provider === key.provider ? false : k.isDefault)
    }));

    setKeys(updatedKeys);
    saveToStorage({ keys: updatedKeys, passwordHash });
  }, [keys, passwordHash, updateActivity]);

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