/**
 * WalletIntegratedLLMService
 * 
 * Extends LLMHydrationService to use API keys from the secure wallet.
 * Automatically retrieves keys from the wallet based on provider.
 * 
 * @module services/llm/WalletIntegratedLLMService
 */

import { LLMHydrationService, LLMHydrationConfig } from './LLMHydrationService';
import { CompletionRequest, CompletionResponse, CompletionChunk, ProviderId } from './types';
import { ApiKeyWallet, getApiKeyWallet, ApiKeyProvider } from '../../security/ApiKeyWallet';

/**
 * Map LLM provider IDs to wallet provider IDs
 */
const PROVIDER_MAP: Record<ProviderId, ApiKeyProvider> = {
  openai: 'openai',
  anthropic: 'anthropic',
  ollama: 'ollama',
  mock: 'custom'
};

/**
 * Wallet integration configuration
 */
export interface WalletIntegrationConfig {
  wallet?: ApiKeyWallet;
  requireWallet?: boolean; // If true, fail if wallet is locked
  fallbackToEnv?: boolean; // If true, use env vars if wallet unavailable
}

/**
 * WalletIntegratedLLMService
 * 
 * LLM service that retrieves API keys from the secure wallet.
 */
export class WalletIntegratedLLMService extends LLMHydrationService {
  private wallet: ApiKeyWallet;
  private walletConfig: WalletIntegrationConfig;
  private resolvedKeys: Map<ProviderId, string | null> = new Map();
  
  constructor(
    config: Partial<LLMHydrationConfig> & WalletIntegrationConfig = {}
  ) {
    // Initialize with empty keys - we'll fetch from wallet
    super({
      ...config,
      providers: {
        openai: { apiKey: '' },
        anthropic: { apiKey: '' },
        ollama: {},
        ...config.providers
      }
    });
    
    this.wallet = config.wallet ?? getApiKeyWallet();
    this.walletConfig = {
      requireWallet: config.requireWallet ?? false,
      fallbackToEnv: config.fallbackToEnv ?? true
    };
    
    // Subscribe to wallet events
    this.setupWalletListeners();
  }
  
  /**
   * Set up wallet event listeners
   */
  private setupWalletListeners(): void {
    // Clear cached keys when wallet locks
    this.wallet.on('locked', () => {
      this.resolvedKeys.clear();
    });
    
    // Refresh keys when wallet unlocks
    this.wallet.on('unlocked', () => {
      this.resolvedKeys.clear();
    });
    
    // Clear specific key when rotated
    this.wallet.on('key:rotated', (event) => {
      const payload = event.payload as { provider: ApiKeyProvider };
      const providerId = this.getProviderIdFromWalletProvider(payload.provider);
      if (providerId) {
        this.resolvedKeys.delete(providerId);
      }
    });
  }
  
  /**
   * Get provider ID from wallet provider
   */
  private getProviderIdFromWalletProvider(
    walletProvider: ApiKeyProvider
  ): ProviderId | undefined {
    const entries = Object.entries(PROVIDER_MAP) as [ProviderId, ApiKeyProvider][];
    const found = entries.find(([_, wp]) => wp === walletProvider);
    return found?.[0];
  }
  
  /**
   * Resolve API key for a provider
   */
  private async resolveApiKey(provider: ProviderId): Promise<string | null> {
    // Check cache
    if (this.resolvedKeys.has(provider)) {
      return this.resolvedKeys.get(provider) ?? null;
    }
    
    // Try wallet first
    if (this.wallet.isUnlocked()) {
      const walletProvider = PROVIDER_MAP[provider];
      if (walletProvider) {
        const key = this.wallet.getKeyForProvider(walletProvider);
        if (key) {
          this.resolvedKeys.set(provider, key);
          return key;
        }
      }
    } else if (this.walletConfig.requireWallet) {
      throw new Error('Wallet is locked and requireWallet is true');
    }
    
    // Fall back to environment variables
    if (this.walletConfig.fallbackToEnv) {
      const envKey = this.getEnvKey(provider);
      if (envKey) {
        this.resolvedKeys.set(provider, envKey);
        return envKey;
      }
    }
    
    this.resolvedKeys.set(provider, null);
    return null;
  }
  
  /**
   * Get API key from environment
   */
  private getEnvKey(provider: ProviderId): string | null {
    const envMap: Record<ProviderId, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      ollama: 'OLLAMA_API_KEY',
      mock: ''
    };
    
    const envVar = envMap[provider];
    if (envVar && process.env[envVar]) {
      return process.env[envVar] ?? null;
    }
    
    return null;
  }
  
  /**
   * Override complete to inject wallet keys
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
        'Unlock the wallet and add a key, or set the environment variable.'
      );
    }
    
    // Update provider config with resolved key
    if (apiKey) {
      this.updateProviderKey(provider, apiKey);
    }
    
    return super.complete(request, preferredProvider);
  }
  
  /**
   * Override stream to inject wallet keys
   */
  async *stream(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    // Resolve API key for the default provider
    const provider = this.getDefaultProvider();
    const apiKey = await this.resolveApiKey(provider);
    
    if (!apiKey && provider !== 'ollama' && provider !== 'mock') {
      throw new Error(
        `No API key available for ${provider}. ` +
        'Unlock the wallet and add a key, or set the environment variable.'
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
  
  // ============================================================================
  // Wallet Management
  // ============================================================================
  
  /**
   * Get the wallet instance
   */
  getWallet(): ApiKeyWallet {
    return this.wallet;
  }
  
  /**
   * Check if wallet is unlocked
   */
  isWalletUnlocked(): boolean {
    return this.wallet.isUnlocked();
  }
  
  /**
   * Unlock the wallet
   */
  async unlockWallet(password: string): Promise<void> {
    await this.wallet.unlock(password);
    this.resolvedKeys.clear();
  }
  
  /**
   * Lock the wallet
   */
  lockWallet(): void {
    this.wallet.lock();
    this.resolvedKeys.clear();
  }
  
  /**
   * Add an API key to the wallet
   */
  async addApiKey(
    provider: ApiKeyProvider,
    apiKey: string,
    options?: {
      name?: string;
      isDefault?: boolean;
    }
  ): Promise<string> {
    if (!this.wallet.isUnlocked()) {
      throw new Error('Wallet is locked');
    }
    
    const keyId = await this.wallet.addKey(provider, apiKey, options);
    
    // Clear resolved cache for this provider
    const providerId = this.getProviderIdFromWalletProvider(provider);
    if (providerId) {
      this.resolvedKeys.delete(providerId);
    }
    
    return keyId;
  }
  
  /**
   * List available API keys
   */
  listApiKeys(provider?: ApiKeyProvider) {
    return this.wallet.listKeys(provider);
  }
  
  /**
   * Check if provider has API key available
   */
  async hasApiKey(provider: ProviderId): Promise<boolean> {
    const key = await this.resolveApiKey(provider);
    return key !== null;
  }
  
  /**
   * Get provider status
   */
  async getProviderStatus(): Promise<Array<{
    provider: ProviderId;
    hasKey: boolean;
    source: 'wallet' | 'env' | 'none';
  }>> {
    const providers: ProviderId[] = ['openai', 'anthropic', 'ollama'];
    const results: Array<{
      provider: ProviderId;
      hasKey: boolean;
      source: 'wallet' | 'env' | 'none';
    }> = [];
    
    for (const provider of providers) {
      const walletProvider = PROVIDER_MAP[provider];
      
      // Check wallet
      if (this.wallet.isUnlocked()) {
        const walletKey = this.wallet.getKeyForProvider(walletProvider);
        if (walletKey) {
          results.push({ provider, hasKey: true, source: 'wallet' });
          continue;
        }
      }
      
      // Check env
      const envKey = this.getEnvKey(provider);
      if (envKey) {
        results.push({ provider, hasKey: true, source: 'env' });
        continue;
      }
      
      // Ollama doesn't need a key
      if (provider === 'ollama') {
        results.push({ provider, hasKey: true, source: 'none' });
        continue;
      }
      
      results.push({ provider, hasKey: false, source: 'none' });
    }
    
    return results;
  }
}

/**
 * Create a wallet-integrated LLM service
 */
export function createWalletIntegratedLLMService(
  config?: Partial<LLMHydrationConfig> & WalletIntegrationConfig
): WalletIntegratedLLMService {
  return new WalletIntegratedLLMService(config);
}