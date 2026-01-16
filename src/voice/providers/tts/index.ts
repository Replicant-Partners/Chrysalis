/**
 * TTS Provider Index
 * 
 * Exports all TTS providers and factory functions.
 * 
 * @module voice/providers/tts
 */

import {
  ITTSProvider,
  TTSProviderType,
  TTSProviderConfig,
} from '../../types';
import { BaseTTSProvider } from './base';
import { ElevenLabsTTSProvider } from './elevenlabs';
import { CoquiTTSProvider, isCoquiAvailable } from './coqui';
import { BrowserTTSProvider, isBrowserTTSAvailable } from './browser';
import { NotImplementedError } from '../../../mcp-server/chrysalis-tools';
import { createLogger } from '../../shared/logger';

const log = createLogger('voice-tts');

// Re-export all providers
export { BaseTTSProvider } from './base';
export { ElevenLabsTTSProvider } from './elevenlabs';
export { CoquiTTSProvider, isCoquiAvailable } from './coqui';
export { BrowserTTSProvider, isBrowserTTSAvailable } from './browser';

/**
 * Default fallback chain for TTS providers
 * Ordered by quality/reliability
 */
export const DEFAULT_TTS_FALLBACK_CHAIN: TTSProviderType[] = [
  'elevenlabs',
  'coqui',
  'openai',
  'browser',
];

/**
 * Create a TTS provider instance
 * 
 * @param type - Provider type to create
 * @param config - Provider configuration
 * @returns Initialized TTS provider
 */
export async function createTTSProvider(
  type: TTSProviderType,
  _config: Partial<Omit<TTSProviderConfig, 'provider'>> = {}
): Promise<ITTSProvider> {
  throw new Error('TTS providers are deferred (voice features paused)');
}

/**
 * Create a TTS provider with automatic fallback
 * 
 * Tries providers in the fallback chain until one succeeds.
 * 
 * @param config - Provider configuration
 * @param fallbackChain - Order of providers to try
 * @returns Initialized TTS provider
 */
export async function createTTSProviderWithFallback(
  _config: Partial<Omit<TTSProviderConfig, 'provider'>> = {},
  _fallbackChain: TTSProviderType[] = DEFAULT_TTS_FALLBACK_CHAIN
): Promise<ITTSProvider> {
  throw new Error('TTS providers are deferred (voice features paused)');
}

/**
 * Get available TTS providers
 * 
 * @returns List of available provider types
 */
export async function getAvailableTTSProviders(): Promise<TTSProviderType[]> {
  const available: TTSProviderType[] = [];
  
  // ElevenLabs is always available if API key is provided
  available.push('elevenlabs');
  
  // Check Coqui availability
  if (await isCoquiAvailable()) {
    available.push('coqui');
  }
  
  // Browser depends on Speech Synthesis API support
  if (isBrowserTTSAvailable()) {
    available.push('browser');
  }
  
  return available;
}

/**
 * TTS Provider Manager
 * 
 * Manages TTS provider lifecycle with automatic fallback.
 */
export class TTSProviderManager {
  private provider: ITTSProvider | null = null;
  private config: Partial<Omit<TTSProviderConfig, 'provider'>>;
  private fallbackChain: TTSProviderType[];
  
  constructor(
    config: Partial<Omit<TTSProviderConfig, 'provider'>> = {},
    fallbackChain: TTSProviderType[] = DEFAULT_TTS_FALLBACK_CHAIN
  ) {
    this.config = config;
    this.fallbackChain = fallbackChain;
  }
  
  /**
   * Get or create the active provider
   */
  async getProvider(): Promise<ITTSProvider> {
    if (!this.provider) {
      this.provider = await createTTSProviderWithFallback(
        this.config,
        this.fallbackChain
      );
    }
    return this.provider;
  }
  
  /**
   * Get the current provider type
   */
  getCurrentType(): TTSProviderType | null {
    return this.provider?.type || null;
  }
  
  /**
   * Switch to a specific provider type
   */
  async switchProvider(type: TTSProviderType): Promise<void> {
    // Dispose current provider
    if (this.provider) {
      this.provider.dispose();
      this.provider = null;
    }
    
    // Create new provider
    this.provider = await createTTSProvider(type, this.config);
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<TTSProviderConfig>): void {
    this.config = { ...this.config, ...config };
    
    // If provider exists and config changed significantly, reinitialize
    if (this.provider && (config.apiKey || config.voiceId)) {
      this.provider.dispose();
      this.provider = null;
    }
  }
  
  /**
   * Synthesize speech using current provider
   */
  async synthesize(
    text: string,
    options?: { speed?: number; pitch?: number }
  ): Promise<import('../../types').AudioBlob> {
    const provider = await this.getProvider();
    return provider.synthesize(text, options);
  }
  
  /**
   * List available voices from current provider
   */
  async listVoices(): Promise<import('../../types').VoiceProfile[]> {
    const provider = await this.getProvider();
    return provider.listVoices();
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
