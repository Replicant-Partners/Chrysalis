/**
 * STT Provider Index
 * 
 * Exports all STT providers and factory function.
 * 
 * @module voice/providers/stt
 */

import {
  ISTTProvider,
  STTProviderType,
  STTProviderConfig,
} from '../../types';
import { BaseSTTProvider } from './base';
import { WhisperAPIProvider, WhisperLocalProvider } from './whisper';
import { BrowserSTTProvider, isBrowserSTTAvailable } from './browser';

// Re-export all providers
export { BaseSTTProvider } from './base';
export { WhisperAPIProvider, WhisperLocalProvider } from './whisper';
export { BrowserSTTProvider, isBrowserSTTAvailable } from './browser';

/**
 * Default fallback chain for STT providers
 * Ordered by quality/reliability
 */
export const DEFAULT_STT_FALLBACK_CHAIN: STTProviderType[] = [
  'whisper-api',
  'whisper-local',
  'deepgram',
  'browser',
];

/**
 * Create an STT provider instance
 * 
 * @param type - Provider type to create
 * @param config - Provider configuration
 * @returns Initialized STT provider
 */
export async function createSTTProvider(
  type: STTProviderType,
  config: Partial<Omit<STTProviderConfig, 'provider'>> = {}
): Promise<ISTTProvider> {
  let provider: BaseSTTProvider;
  
  switch (type) {
    case 'whisper-api':
      provider = new WhisperAPIProvider();
      break;
    case 'whisper-local':
      provider = new WhisperLocalProvider();
      break;
    case 'browser':
      provider = new BrowserSTTProvider();
      break;
    case 'deepgram':
    case 'openai':
      // These would need separate implementations
      throw new Error(`${type} provider not yet implemented`);
    default:
      throw new Error(`Unknown STT provider type: ${type}`);
  }
  
  await provider.initialize(config);
  return provider;
}

/**
 * Create an STT provider with automatic fallback
 * 
 * Tries providers in the fallback chain until one succeeds.
 * 
 * @param config - Provider configuration
 * @param fallbackChain - Order of providers to try
 * @returns Initialized STT provider
 */
export async function createSTTProviderWithFallback(
  config: Partial<Omit<STTProviderConfig, 'provider'>> = {},
  fallbackChain: STTProviderType[] = DEFAULT_STT_FALLBACK_CHAIN
): Promise<ISTTProvider> {
  const errors: Array<{ type: STTProviderType; error: Error }> = [];
  
  for (const type of fallbackChain) {
    try {
      // Skip browser provider if not available
      if (type === 'browser' && !isBrowserSTTAvailable()) {
        errors.push({ type, error: new Error('Browser STT not available') });
        continue;
      }
      
      // Skip whisper-api if no API key provided
      if (type === 'whisper-api' && !config.apiKey) {
        errors.push({ type, error: new Error('No API key for Whisper API') });
        continue;
      }
      
      const provider = await createSTTProvider(type, config);
      console.log(`STT provider initialized: ${type}`);
      return provider;
    } catch (error) {
      errors.push({ 
        type, 
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }
  
  // All providers failed
  const errorDetails = errors
    .map(e => `${e.type}: ${e.error.message}`)
    .join('; ');
  throw new Error(`All STT providers failed: ${errorDetails}`);
}

/**
 * Get available STT providers
 * 
 * @returns List of available provider types
 */
export function getAvailableSTTProviders(): STTProviderType[] {
  const available: STTProviderType[] = [];
  
  // Whisper API is always available if API key is provided
  available.push('whisper-api');
  
  // Whisper local depends on server availability (can't check synchronously)
  available.push('whisper-local');
  
  // Browser depends on Web Speech API support
  if (isBrowserSTTAvailable()) {
    available.push('browser');
  }
  
  return available;
}

/**
 * STT Provider Manager
 * 
 * Manages STT provider lifecycle with automatic fallback.
 */
export class STTProviderManager {
  private provider: ISTTProvider | null = null;
  private config: Partial<Omit<STTProviderConfig, 'provider'>>;
  private fallbackChain: STTProviderType[];
  
  constructor(
    config: Partial<Omit<STTProviderConfig, 'provider'>> = {},
    fallbackChain: STTProviderType[] = DEFAULT_STT_FALLBACK_CHAIN
  ) {
    this.config = config;
    this.fallbackChain = fallbackChain;
  }
  
  /**
   * Get or create the active provider
   */
  async getProvider(): Promise<ISTTProvider> {
    if (!this.provider) {
      this.provider = await createSTTProviderWithFallback(
        this.config,
        this.fallbackChain
      );
    }
    return this.provider;
  }
  
  /**
   * Get the current provider type
   */
  getCurrentType(): STTProviderType | null {
    return this.provider?.type || null;
  }
  
  /**
   * Switch to a specific provider type
   */
  async switchProvider(type: STTProviderType): Promise<void> {
    // Dispose current provider
    if (this.provider) {
      this.provider.dispose();
      this.provider = null;
    }
    
    // Create new provider
    this.provider = await createSTTProvider(type, this.config);
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<STTProviderConfig>): void {
    this.config = { ...this.config, ...config };
    
    // If provider exists and config changed significantly, reinitialize
    if (this.provider && config.language) {
      // Provider will need to be reinitialized on next use
      this.provider.dispose();
      this.provider = null;
    }
  }
  
  /**
   * Dispose all resources
   */
  dispose(): void {
    if (this.provider) {
      this.provider.dispose();
      this.provider = null;
    }
  }
}