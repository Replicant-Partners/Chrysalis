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
  config: Partial<Omit<TTSProviderConfig, 'provider'>> = {}
): Promise<ITTSProvider> {
  const fullConfig: TTSProviderConfig = { provider: type, ...config };
  let provider: BaseTTSProvider;
  
  switch (type) {
    case 'elevenlabs':
      provider = new ElevenLabsTTSProvider();
      break;
    case 'coqui':
      provider = new CoquiTTSProvider();
      break;
    case 'browser':
      provider = new BrowserTTSProvider();
      break;
    case 'openai':
      // Would need separate implementation
      throw new Error('OpenAI TTS provider not yet implemented');
    default:
      throw new Error(`Unknown TTS provider type: ${type}`);
  }
  
  await provider.initialize(fullConfig);
  return provider;
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
  config: Partial<Omit<TTSProviderConfig, 'provider'>> = {},
  fallbackChain: TTSProviderType[] = DEFAULT_TTS_FALLBACK_CHAIN
): Promise<ITTSProvider> {
  const errors: Array<{ type: TTSProviderType; error: Error }> = [];
  
  for (const type of fallbackChain) {
    try {
      // Skip browser provider if not available
      if (type === 'browser' && !isBrowserTTSAvailable()) {
        errors.push({ type, error: new Error('Browser TTS not available') });
        continue;
      }
      
      // Skip ElevenLabs if no API key
      if (type === 'elevenlabs' && !config.apiKey) {
        errors.push({ type, error: new Error('No API key for ElevenLabs') });
        continue;
      }
      
      // Check Coqui availability
      if (type === 'coqui') {
        const coquiEndpoint = config.endpoint || 'http://localhost:5002';
        const available = await isCoquiAvailable(coquiEndpoint);
        if (!available) {
          errors.push({ type, error: new Error('Coqui server not available') });
          continue;
        }
      }
      
      const provider = await createTTSProvider(type, config);
      console.log(`TTS provider initialized: ${type}`);
      return provider;
    } catch (error) {
      errors.push({
        type,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
  
  // All providers failed
  const errorDetails = errors
    .map(e => `${e.type}: ${e.error.message}`)
    .join('; ');
  throw new Error(`All TTS providers failed: ${errorDetails}`);
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