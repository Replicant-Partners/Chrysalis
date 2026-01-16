/**
 * KeyProvider Interface for LLM API Key Management
 * 
 * Abstracts API key retrieval to decouple LLM services from specific
 * key storage implementations (wallets, environment variables, vaults).
 * 
 * This interface follows the Dependency Inversion Principle, allowing
 * LLM services to depend on this abstraction rather than concrete
 * implementations like ApiKeyWallet.
 * 
 * @module services/llm/KeyProvider
 */

/**
 * Provider identifier for LLM services
 */
export type LLMProviderId = 'openai' | 'anthropic' | 'ollama';

/**
 * Key source indicates where an API key was retrieved from
 */
export type KeySource = 'wallet' | 'env' | 'vault' | 'config' | 'none';

/**
 * Result of a key lookup operation
 */
export interface KeyLookupResult {
  /** The API key value, or null if not found */
  key: string | null;
  /** Where the key was retrieved from */
  source: KeySource;
  /** Whether the key was found */
  found: boolean;
}

/**
 * Provider status information
 */
export interface ProviderKeyStatus {
  /** Provider identifier */
  provider: LLMProviderId;
  /** Whether a key is available */
  hasKey: boolean;
  /** Source of the key */
  source: KeySource;
}

/**
 * KeyProvider interface for retrieving API keys
 * 
 * Implementations can wrap various key storage mechanisms:
 * - ApiKeyWallet (encrypted local storage)
 * - Environment variables
 * - Secret management services (AWS Secrets Manager, HashiCorp Vault)
 * - Configuration files
 * 
 * @example
 * ```typescript
 * const keyProvider: KeyProvider = new WalletKeyProvider(wallet);
 * const result = await keyProvider.getKey('openai');
 * if (result.found) {
 *   // Use result.key
 * }
 * ```
 */
export interface KeyProvider {
  /**
   * Get API key for a provider
   * 
   * @param provider - LLM provider identifier
   * @returns Key lookup result with key value and source
   */
  getKey(provider: LLMProviderId): Promise<KeyLookupResult>;

  /**
   * Check if a key is available for a provider
   * 
   * @param provider - LLM provider identifier
   * @returns true if a key is available
   */
  hasKey(provider: LLMProviderId): Promise<boolean>;

  /**
   * Get status of all configured providers
   * 
   * @returns Array of provider status objects
   */
  getProviderStatus(): Promise<ProviderKeyStatus[]>;

  /**
   * Check if the key provider is ready (unlocked, connected, etc.)
   * 
   * @returns true if the provider can retrieve keys
   */
  isReady(): boolean;

  /**
   * Subscribe to key change events
   * 
   * @param callback - Function to call when keys change
   * @returns Unsubscribe function
   */
  onKeyChange?(callback: (provider: LLMProviderId) => void): () => void;
}

/**
 * Environment variable-based key provider
 * 
 * Simple implementation that reads keys from environment variables.
 * Useful for development, CI/CD, and containerized deployments.
 */
export class EnvKeyProvider implements KeyProvider {
  private readonly envVarMap: Record<LLMProviderId, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    ollama: 'OLLAMA_API_KEY',
  };

  /**
   * Create an environment key provider
   * 
   * @param customEnvVars - Optional custom environment variable mappings
   */
  constructor(customEnvVars?: Partial<Record<LLMProviderId, string>>) {
    if (customEnvVars) {
      this.envVarMap = { ...this.envVarMap, ...customEnvVars };
    }
  }

  async getKey(provider: LLMProviderId): Promise<KeyLookupResult> {
    const envVar = this.envVarMap[provider];

    if (!envVar) {
      return { key: null, source: 'none', found: false };
    }

    const key = process.env[envVar] ?? null;
    return {
      key,
      source: key ? 'env' : 'none',
      found: key !== null,
    };
  }

  async hasKey(provider: LLMProviderId): Promise<boolean> {
    const result = await this.getKey(provider);
    return result.found;
  }

  async getProviderStatus(): Promise<ProviderKeyStatus[]> {
    const providers: LLMProviderId[] = ['openai', 'anthropic', 'ollama'];
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

  isReady(): boolean {
    return true; // Environment variables are always accessible
  }
}

/**
 * Composite key provider that chains multiple providers
 * 
 * Tries providers in order until a key is found.
 * Useful for fallback scenarios (e.g., try wallet first, then env vars).
 */
export class CompositeKeyProvider implements KeyProvider {
  private readonly providers: KeyProvider[];
  private readonly keyChangeListeners: Set<(provider: LLMProviderId) => void> = new Set();

  /**
   * Create a composite key provider
   * 
   * @param providers - Array of providers to try in order
   */
  constructor(providers: KeyProvider[]) {
    this.providers = providers;

    // Subscribe to key changes from all providers
    for (const provider of providers) {
      if (provider.onKeyChange) {
        provider.onKeyChange((llmProvider) => {
          this.notifyKeyChange(llmProvider);
        });
      }
    }
  }

  async getKey(provider: LLMProviderId): Promise<KeyLookupResult> {
    for (const keyProvider of this.providers) {
      if (keyProvider.isReady()) {
        const result = await keyProvider.getKey(provider);
        if (result.found) {
          return result;
        }
      }
    }
    return { key: null, source: 'none', found: false };
  }

  async hasKey(provider: LLMProviderId): Promise<boolean> {
    const result = await this.getKey(provider);
    return result.found;
  }

  async getProviderStatus(): Promise<ProviderKeyStatus[]> {
    const providers: LLMProviderId[] = ['openai', 'anthropic', 'ollama'];
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

  isReady(): boolean {
    return this.providers.some(p => p.isReady());
  }

  onKeyChange(callback: (provider: LLMProviderId) => void): () => void {
    this.keyChangeListeners.add(callback);
    return () => this.keyChangeListeners.delete(callback);
  }

  private notifyKeyChange(provider: LLMProviderId): void {
    for (const listener of this.keyChangeListeners) {
      listener(provider);
    }
  }
}

/**
 * Create a default key provider based on environment
 * 
 * In production, this should be replaced with appropriate
 * key provider configuration.
 */
export function createDefaultKeyProvider(): KeyProvider {
  return new EnvKeyProvider();
}
