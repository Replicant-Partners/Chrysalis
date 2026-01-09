/**
 * Voice Providers Index
 * 
 * Re-exports all STT and TTS providers and utilities.
 * 
 * @module voice/providers
 */

// STT Providers
export {
  BaseSTTProvider,
  WhisperAPIProvider,
  WhisperLocalProvider,
  BrowserSTTProvider,
  isBrowserSTTAvailable,
  createSTTProvider,
  createSTTProviderWithFallback,
  getAvailableSTTProviders,
  STTProviderManager,
  DEFAULT_STT_FALLBACK_CHAIN,
} from './stt';

// TTS Providers
export {
  BaseTTSProvider,
  ElevenLabsTTSProvider,
  CoquiTTSProvider,
  isCoquiAvailable,
  BrowserTTSProvider,
  isBrowserTTSAvailable,
  createTTSProvider,
  createTTSProviderWithFallback,
  getAvailableTTSProviders,
  TTSProviderManager,
  DEFAULT_TTS_FALLBACK_CHAIN,
} from './tts';