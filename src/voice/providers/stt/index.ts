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
import { createLogger } from '../../shared/logger';

const log = createLogger('voice-stt');

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
  _config: Partial<Omit<STTProviderConfig, 'provider'>> = {}
): Promise<ISTTProvider> {
  throw new Error('STT providers are deferred (voice features paused)');
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
  _config: Partial<Omit<STTProviderConfig, 'provider'>> = {},
  _fallbackChain: STTProviderType[] = DEFAULT_STT_FALLBACK_CHAIN
): Promise<ISTTProvider> {
  throw new Error('STT providers are deferred (voice features paused)');
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
