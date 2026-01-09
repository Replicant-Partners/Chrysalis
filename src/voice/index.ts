/**
 * Chrysalis Voice System
 * 
 * Provider-agnostic voice interface supporting:
 * - Speech-to-Text (STT) with Whisper, Deepgram, and browser fallback
 * - Text-to-Speech (TTS) with ElevenLabs, Coqui, and browser fallback
 * - Voice cloning through XTTS and ElevenLabs
 * - Elder-optimized settings (slow speech, accent tolerance)
 * 
 * @module voice
 */

// Types
export * from './types';

// Providers
export * from './providers';