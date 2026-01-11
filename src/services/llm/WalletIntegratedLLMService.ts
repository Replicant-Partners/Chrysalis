/**
 * WalletIntegratedLLMService
 *
 * Extends LLMHydrationService to use API keys from a KeyProvider.
 * Supports multiple key sources: wallets, environment variables, vaults.
 *
 * This refactored version uses dependency injection via the KeyProvider
 * interface instead of directly coupling to ApiKeyWallet, following the
 * Dependency Inversion Principle.
 *
 * @module services/llm/WalletIntegratedLLMService
 */

import { LLMHydrationService, LLMHydrationConfig } from './LLMHydrationService';
import { CompletionRequest, CompletionResponse, CompletionChunk, ProviderId } from './types';
import {
  KeyProvider,
  LLMProviderId,
  CompositeKeyProvider,
  EnvKeyProvider,
  createDefaultKeyProvider
} from './KeyProvider';
import { WalletKeyProvider, createWalletKeyProvider } from './WalletKeyProvider';
import { ApiKeyWallet, getApiKeyWallet, ApiKeyProvider as WalletApiKeyProvider } from '../../security/ApiKeyWallet';

/**
 * Configuration for key provider integration
 */
export interface KeyProviderIntegrationConfig {
  /** Custom key provider (takes precedence over wallet) */
  keyProvider?: KeyProvider;
  /** Wallet for key storage (creates WalletKeyProvider if no keyProvider) */
  wallet?: ApiKeyWallet;
  /** If true, fail if key provider is not ready */
  requireReady?: boolean;
  /** If true, use env vars as fallback if primary provider unavailable */
  fallbackToEnv?: boolean;
}

/**
 * @deprecated Use KeyProviderIntegrationConfig instead
 */
export interface WalletIntegrationConfig extends KeyProviderIntegrationConfig {
  /** @deprecated Use requireReady instead */
  requireWallet?: boolean;
}

/**
 * WalletIntegratedLLMService
 *
 * LLM service that retrieves API keys from a KeyProvider.
 *
 * @example
 * ```typescript
 * // Using default wallet
 * const service = new WalletIntegratedLLMService();
 *
 * // Using custom key provider
 * const keyProvider = new CompositeKeyProvider([
 *   new WalletKeyProvider(wallet),
 *   new EnvKeyProvider(),
 * ]);
 * const service = new WalletIntegratedLLMService({ keyProvider });
 *
 * // Using wallet directly (backward compatible)
 * const service = new WalletIntegratedLLMService({ wallet: myWallet });
 * ```
 */
export class WalletIntegratedLLMService extends LLMHydrationService {
  private readonly keyProvider: KeyProvider;
  private readonly requireReady: boolean;
  private keyCache: Map<ProviderId, string | null> = new Map();
  private unsubscribe?: () => void;
  
  /**
   * Underlying wallet provider if available (for wallet management operations)
   */
  private walletKeyProvider?: WalletKeyProvider;
  
  constructor(
    config: Partial<LLMHydrationConfig> & KeyProviderIntegrationConfig = {}
  ) {
    // Initialize with empty keys - we'll fetch from key provider
    super({
      ...config,
      providers: {
        openai: { apiKey: '' },
        anthropic: { apiKey: '' },
        ollama: {},
        ...config.providers
      }
    });
    
    // Set up key provider (dependency injection)
    this.keyProvider = this.createKeyProvider(config);
    this.requireReady = config.requireReady ?? config.requireWallet ?? false;
    
    // Subscribe to key change events
    this.setupKeyProviderListeners();
  }
  
  /**
   * Create the appropriate key provider based on configuration
   *
   * Priority:
   * 1. Explicit keyProvider (highest)
   * 2. Wallet + optional env fallback
   * 3. Default (env vars only)
   */
  private createKeyProvider(config: KeyProviderIntegrationConfig): KeyProvider {
    // If explicit key provider is provided, use it
    if (config.keyProvider) {
      return config.keyProvider;
    }
    
    // If wallet is provided, wrap it in WalletKeyProvider
    const wallet = config.wallet ?? getApiKeyWallet();
    this.walletKeyProvider = createWalletKeyProvider(wallet);
    
    // Create composite provider with fallback if enabled
    const fallbackToEnv = config.fallbackToEnv ?? true;
    if (fallbackToEnv) {
      return new CompositeKeyProvider([
        this.walletKeyProvider,
        new EnvKeyProvider(),
      ]);
    }
    
    return this.walletKeyProvider;
  }
  
  /**
   * Set up key provider event listeners for cache invalidation
   */
  private setupKeyProviderListeners(): void {
    if (this.keyProvider.onKeyChange) {
      this.unsubscribe = this.keyProvider.onKeyChange((provider: LLMProviderId) => {
        this.keyCache.delete(provider as ProviderId);
      });
    }
  }
  
  /**
   * Resolve API key for a provider using the key provider
   */
  private async resolveApiKey(provider: ProviderId): Promise<string | null> {
    // Check cache first
    if (this.keyCache.has(provider)) {
      return this.keyCache.get(provider) ?? null;
    }
    
    // Check if provider is ready
    if (!this.keyProvider.isReady() && this.requireReady) {
      throw new Error('Key provider is not ready and requireReady is true');
    }
    
    // Get key from provider
    const result = await this.keyProvider.getKey(provider as LLMProviderId);
    
    // Cache and return
    this.keyCache.set(provider, result.key);
    return result.key;
  }
  
  /**
   * Override complete to inject keys from key provider
   */
  async complete(
    request: CompletionRequest,
    preferredProvider?: ProviderId
  ): Promise<CompletionResponse> {
    // Resolve API key for the provider
    const provider = preferredProvider ?? this.getDefaultProvider();
    const apiKey = await this.resolveApiKey(provider);
    
    if (!apiKey && provider !== 'ollama' && provider !== 'mock') {
      throw new Error(
        `No API key available for ${provider}. ` +
        'Configure a key provider with the required key, or set the environment variable.'
      );
    }
    
    // Update provider config with resolved key
    if (apiKey) {
      this.updateProviderKey(provider, apiKey);
    }
    
    return super.complete(request, preferredProvider);
  }
  
  /**
   * Override stream to inject keys from key provider
   */
  async *stream(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    // Resolve API key for the default provider
    const provider = this.getDefaultProvider();
    const apiKey = await this.resolveApiKey(provider);
    
    if (!apiKey && provider !== 'ollama' && provider !== 'mock') {
      throw new Error(
        `No API key available for ${provider}. ` +
        'Configure a key provider with the required key, or set the environment variable.'
      );
    }
    
    // Update provider config with resolved key
    if (apiKey) {
      this.updateProviderKey(provider, apiKey);
    }
    
    yield* super.stream(request);
  }
  
  /**
   * Get default provider ID
   */
  private getDefaultProvider(): ProviderId {
    // Access protected member through type assertion
    return (this as any).defaultProvider ?? 'anthropic';
  }
  
  /**
   * Update provider API key
   */
  private updateProviderKey(provider: ProviderId, apiKey: string): void {
    // Access protected member through type assertion
    const config = (this as any).config;
    if (config?.providers?.[provider]) {
      config.providers[provider].apiKey = apiKey;
    }
  }
  
  /**
   * Clear the key cache
   */
  clearKeyCache(): void {
    this.keyCache.clear();
  }
  
  /**
   * Dispose of the service and cleanup listeners
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.keyCache.clear();
  }
  
  // ============================================================================
  // Key Provider Management
  // ============================================================================
  
  /**
   * Get the key provider instance
   */
  getKeyProvider(): KeyProvider {
    return this.keyProvider;
  }
  
  /**
   * Check if key provider is ready
   */
  isKeyProviderReady(): boolean {
    return this.keyProvider.isReady();
  }
  
  /**
   * Check if provider has API key available
   */
  async hasApiKey(provider: ProviderId): Promise<boolean> {
    return this.keyProvider.hasKey(provider as LLMProviderId);
  }
  
  /**
   * Get provider status from key provider
   */
  async getProviderStatus(): Promise<Array<{
    provider: ProviderId;
    hasKey: boolean;
    source: 'wallet' | 'env' | 'vault' | 'config' | 'none';
  }>> {
    const statuses = await this.keyProvider.getProviderStatus();
    return statuses
      .filter(s => s.provider !== 'mock')
      .map(s => ({
        provider: s.provider as ProviderId,
        hasKey: s.hasKey,
        source: s.source,
      }));
  }
  
  // ============================================================================
  // Wallet-Specific Operations (backward compatibility)
  // ============================================================================
  
  /**
   * Get the underlying wallet (if using WalletKeyProvider)
   *
   * @deprecated Use getKeyProvider() instead for generic key access
   */
  getWallet(): ApiKeyWallet | undefined {
    return this.walletKeyProvider?.getWallet();
  }
  
  /**
   * Check if wallet is unlocked (if using WalletKeyProvider)
   *
   * @deprecated Use isKeyProviderReady() instead
   */
  isWalletUnlocked(): boolean {
    return this.walletKeyProvider?.isReady() ?? false;
  }
  
  /**
   * Unlock the wallet (if using WalletKeyProvider)
   */
  async unlockWallet(password: string): Promise<void> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet available. Service is using a different key provider.');
    }
    await wallet.unlock(password);
    this.keyCache.clear();
  }
  
  /**
   * Lock the wallet (if using WalletKeyProvider)
   */
  lockWallet(): void {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet available. Service is using a different key provider.');
    }
    wallet.lock();
    this.keyCache.clear();
  }
  
  /**
   * Add an API key to the wallet (if using WalletKeyProvider)
   */
  async addApiKey(
    provider: WalletApiKeyProvider,
    apiKey: string,
    options?: {
      name?: string;
      isDefault?: boolean;
    }
  ): Promise<string> {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet available. Service is using a different key provider.');
    }
    if (!wallet.isUnlocked()) {
      throw new Error('Wallet is locked');
    }
    
    const keyId = await wallet.addKey(provider, apiKey, options);
    this.walletKeyProvider?.clearCache();
    return keyId;
  }
  
  /**
   * List available API keys (if using WalletKeyProvider)
   */
  listApiKeys(provider?: WalletApiKeyProvider) {
    const wallet = this.getWallet();
    if (!wallet) {
      throw new Error('No wallet available. Service is using a different key provider.');
    }
    return wallet.listKeys(provider);
  }
}

/**
 * Create a wallet-integrated LLM service with default configuration
 */
export function createWalletIntegratedLLMService(
  config?: Partial<LLMHydrationConfig> & KeyProviderIntegrationConfig
): WalletIntegratedLLMService {
  return new WalletIntegratedLLMService(config);
}

/**
 * Create an LLM service with a specific key provider
 */
export function createLLMServiceWithKeyProvider(
  keyProvider: KeyProvider,
  config?: Partial<LLMHydrationConfig>
): WalletIntegratedLLMService {
  return new WalletIntegratedLLMService({
    ...config,
    keyProvider,
  });
}