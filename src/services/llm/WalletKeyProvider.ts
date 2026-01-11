/**
 * WalletKeyProvider - KeyProvider implementation backed by ApiKeyWallet
 * 
 * Wraps the ApiKeyWallet to implement the KeyProvider interface,
 * enabling dependency injection and loose coupling between LLM
 * services and the wallet implementation.
 * 
 * @module services/llm/WalletKeyProvider
 */

import { 
  KeyProvider, 
  LLMProviderId, 
  KeyLookupResult, 
  ProviderKeyStatus,
  KeySource 
} from './KeyProvider';
import { ApiKeyWallet, ApiKeyProvider } from '../../security/ApiKeyWallet';

/**
 * Map LLM provider IDs to wallet provider IDs
 */
const PROVIDER_MAP: Record<LLMProviderId, ApiKeyProvider> = {
  openai: 'openai',
  anthropic: 'anthropic',
  ollama: 'ollama',
  mock: 'custom',
};

/**
 * Reverse map wallet providers to LLM provider IDs
 */
const REVERSE_PROVIDER_MAP = new Map<ApiKeyProvider, LLMProviderId>(
  Object.entries(PROVIDER_MAP).map(([llm, wallet]) => [wallet, llm as LLMProviderId])
);

/**
 * WalletKeyProvider wraps ApiKeyWallet for KeyProvider interface
 * 
 * Features:
 * - Automatic key caching with wallet event-based invalidation
 * - Event forwarding for key rotation/changes
 * - Graceful handling of locked wallet states
 * 
 * @example
 * ```typescript
 * const wallet = getApiKeyWallet();
 * const keyProvider = new WalletKeyProvider(wallet);
 * 
 * const result = await keyProvider.getKey('openai');
 * if (result.found) {
 *   // Use result.key
 * }
 * ```
 */
export class WalletKeyProvider implements KeyProvider {
  private readonly wallet: ApiKeyWallet;
  private keyCache: Map<LLMProviderId, string | null> = new Map();
  private readonly keyChangeListeners: Set<(provider: LLMProviderId) => void> = new Set();

  /**
   * Create a wallet key provider
   * 
   * @param wallet - ApiKeyWallet instance to wrap
   */
  constructor(wallet: ApiKeyWallet) {
    this.wallet = wallet;
    this.setupWalletListeners();
  }

  /**
   * Set up wallet event listeners for cache invalidation
   */
  private setupWalletListeners(): void {
    // Clear cache when wallet locks
    this.wallet.on('locked', () => {
      this.keyCache.clear();
    });

    // Clear cache when wallet unlocks
    this.wallet.on('unlocked', () => {
      this.keyCache.clear();
    });

    // Clear specific key when rotated
    this.wallet.on('key:rotated', (event) => {
      const payload = event.payload as { provider: ApiKeyProvider };
      const llmProvider = this.walletToLLMProvider(payload.provider);
      if (llmProvider) {
        this.keyCache.delete(llmProvider);
        this.notifyKeyChange(llmProvider);
      }
    });

    // Clear specific key when added
    this.wallet.on('key:added', (event) => {
      const payload = event.payload as { provider: ApiKeyProvider };
      const llmProvider = this.walletToLLMProvider(payload.provider);
      if (llmProvider) {
        this.keyCache.delete(llmProvider);
        this.notifyKeyChange(llmProvider);
      }
    });

    // Clear specific key when removed
    this.wallet.on('key:removed', (event) => {
      const payload = event.payload as { provider: ApiKeyProvider };
      const llmProvider = this.walletToLLMProvider(payload.provider);
      if (llmProvider) {
        this.keyCache.delete(llmProvider);
        this.notifyKeyChange(llmProvider);
      }
    });
  }

  /**
   * Convert wallet provider ID to LLM provider ID
   */
  private walletToLLMProvider(walletProvider: ApiKeyProvider): LLMProviderId | undefined {
    return REVERSE_PROVIDER_MAP.get(walletProvider);
  }

  /**
   * Convert LLM provider ID to wallet provider ID
   */
  private llmToWalletProvider(llmProvider: LLMProviderId): ApiKeyProvider {
    return PROVIDER_MAP[llmProvider];
  }

  /**
   * Notify listeners of key changes
   */
  private notifyKeyChange(provider: LLMProviderId): void {
    for (const listener of this.keyChangeListeners) {
      listener(provider);
    }
  }

  /**
   * Get API key for a provider from the wallet
   */
  async getKey(provider: LLMProviderId): Promise<KeyLookupResult> {
    // Check cache first
    if (this.keyCache.has(provider)) {
      const cachedKey = this.keyCache.get(provider);
      return {
        key: cachedKey ?? null,
        source: cachedKey ? 'wallet' : 'none',
        found: cachedKey !== null,
      };
    }

    // Check if wallet is unlocked
    if (!this.wallet.isUnlocked()) {
      return {
        key: null,
        source: 'none',
        found: false,
      };
    }

    // Get key from wallet
    const walletProvider = this.llmToWalletProvider(provider);
    const key = this.wallet.getKeyForProvider(walletProvider);
    
    // Cache the result
    this.keyCache.set(provider, key ?? null);

    return {
      key: key ?? null,
      source: key ? 'wallet' : 'none',
      found: key !== null,
    };
  }

  /**
   * Check if a key is available for a provider
   */
  async hasKey(provider: LLMProviderId): Promise<boolean> {
    const result = await this.getKey(provider);
    return result.found;
  }

  /**
   * Get status of all configured providers
   */
  async getProviderStatus(): Promise<ProviderKeyStatus[]> {
    const providers: LLMProviderId[] = ['openai', 'anthropic', 'ollama', 'mock'];
    const results: ProviderKeyStatus[] = [];

    for (const provider of providers) {
      const result = await this.getKey(provider);
      results.push({
        provider,
        hasKey: result.found,
        source: result.source,
      });
    }

    return results;
  }

  /**
   * Check if the wallet is ready (unlocked)
   */
  isReady(): boolean {
    return this.wallet.isUnlocked();
  }

  /**
   * Subscribe to key change events
   */
  onKeyChange(callback: (provider: LLMProviderId) => void): () => void {
    this.keyChangeListeners.add(callback);
    return () => this.keyChangeListeners.delete(callback);
  }

  /**
   * Get the underlying wallet (for wallet management operations)
   * 
   * Note: This exposes the wallet for operations like unlock/lock.
   * Direct key access should use getKey() instead.
   */
  getWallet(): ApiKeyWallet {
    return this.wallet;
  }

  /**
   * Clear the key cache
   */
  clearCache(): void {
    this.keyCache.clear();
  }
}

/**
 * Create a wallet key provider from an existing wallet
 */
export function createWalletKeyProvider(wallet: ApiKeyWallet): WalletKeyProvider {
  return new WalletKeyProvider(wallet);
}
