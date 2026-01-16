/**
 * Base TTS Provider
 * 
 * Abstract base class for Text-to-Speech providers.
 * Implements common functionality for TTS operations.
 * 
 * @module voice/providers/tts/base
 */

import {
  ITTSProvider,
  TTSProviderType,
  TTSProviderConfig,
  TTSOptions,
  AudioBlob,
  AudioChunk,
  VoiceProfile,
} from '../../types';
import { createLogger } from '../../shared/logger';

/**
 * Audio playback state
 */
interface PlaybackState {
  audio: HTMLAudioElement | null;
  playing: boolean;
  paused: boolean;
  currentTime: number;
  duration: number;
}

/**
 * Abstract base class for TTS providers
 * 
 * Provides:
 * - Configuration management
 * - Audio playback utilities
 * - Voice caching
 * - Rate limiting
 */
export abstract class BaseTTSProvider implements ITTSProvider {
  abstract readonly name: string;
  abstract readonly type: TTSProviderType;
  
  protected config: TTSProviderConfig | null = null;
  protected initialized = false;
  protected log = createLogger('voice-tts');
  protected voiceCache: Map<string, VoiceProfile[]> = new Map();
  protected playbackState: PlaybackState = {
    audio: null,
    playing: false,
    paused: false,
    currentTime: 0,
    duration: 0,
  };
  
  // Rate limiting
  private lastRequestTime = 0;
  private minRequestInterval = 100; // ms between requests
  
  /**
   * Initialize the provider with configuration
   */
  async initialize(config: TTSProviderConfig): Promise<void> {
    if (this.initialized) {
      this.log.warn(`${this.name} already initialized`);
      return;
    }
    
    this.config = config;
    await this.doInitialize(config);
    this.initialized = true;
    this.log.info(`${this.name} initialized`);
  }
  
  /**
   * Check if provider is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get streaming audio (default implementation yields single chunk)
   */
  async *getStreamingAudio(text: string, options?: TTSOptions): AsyncGenerator<AudioChunk> {
    const audioBlob = await this.synthesize(text, options);
    const arrayBuffer = await audioBlob.blob.arrayBuffer();
    
    yield {
      data: arrayBuffer,
      index: 0,
      isFinal: true,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Provider-specific initialization
   */
  protected abstract doInitialize(config: TTSProviderConfig): Promise<void>;
  
  /**
   * Synthesize speech from text
   */
  abstract synthesize(text: string, options?: TTSOptions): Promise<AudioBlob>;
  
  /**
   * List available voices
   */
  abstract listVoices(): Promise<VoiceProfile[]>;
  
  /**
   * Check if voice cloning is supported
   */
  supportsVoiceCloning(): boolean {
    return false;
  }
  
  /**
   * Clone a voice from audio samples
   * Override in providers that support cloning
   */
  async cloneVoice(
    _name: string,
    _samples: AudioBlob[],
    _description?: string
  ): Promise<VoiceProfile> {
    throw new Error(`${this.name} does not support voice cloning`);
  }
  
  /**
   * Get cached voices or fetch fresh
   */
  protected async getCachedVoices(cacheKey: string = 'default'): Promise<VoiceProfile[]> {
    if (this.voiceCache.has(cacheKey)) {
      return this.voiceCache.get(cacheKey)!;
    }
    
    const voices = await this.listVoices();
    this.voiceCache.set(cacheKey, voices);
    return voices;
  }
  
  /**
   * Clear voice cache
   */
  clearVoiceCache(): void {
    this.voiceCache.clear();
  }
  
  /**
   * Rate-limited fetch
   */
  protected async rateLimitedFetch(
    url: string,
    options?: RequestInit
  ): Promise<Response> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < this.minRequestInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minRequestInterval - elapsed)
      );
    }
    
    this.lastRequestTime = Date.now();
    return fetch(url, options);
  }
  
  /**
   * Play synthesized audio
   */
  async playAudio(audioBlob: AudioBlob): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Audio playback requires browser environment');
    }
    
    // Stop any current playback
    this.stopPlayback();
    
    const url = URL.createObjectURL(audioBlob.blob);
    const audio = new Audio(url);
    
    this.playbackState.audio = audio;
    this.playbackState.playing = true;
    this.playbackState.paused = false;
    
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.playbackState.playing = false;
        resolve();
      };
      
      audio.onerror = (error) => {
        URL.revokeObjectURL(url);
        this.playbackState.playing = false;
        reject(new Error(`Audio playback failed: ${error}`));
      };
      
      audio.ontimeupdate = () => {
        this.playbackState.currentTime = audio.currentTime;
        this.playbackState.duration = audio.duration;
      };
      
      audio.play().catch(reject);
    });
  }
  
  /**
   * Pause current playback
   */
  pausePlayback(): void {
    if (this.playbackState.audio && this.playbackState.playing) {
      this.playbackState.audio.pause();
      this.playbackState.paused = true;
      this.playbackState.playing = false;
    }
  }
  
  /**
   * Resume paused playback
   */
  resumePlayback(): void {
    if (this.playbackState.audio && this.playbackState.paused) {
      this.playbackState.audio.play();
      this.playbackState.paused = false;
      this.playbackState.playing = true;
    }
  }
  
  /**
   * Stop playback completely
   */
  stopPlayback(): void {
    if (this.playbackState.audio) {
      this.playbackState.audio.pause();
      this.playbackState.audio.currentTime = 0;
      this.playbackState.audio = null;
      this.playbackState.playing = false;
      this.playbackState.paused = false;
    }
  }
  
  /**
   * Get playback state
   */
  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }
  
  /**
   * Convert text to SSML for enhanced control
   */
  protected textToSSML(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      emphasis?: 'strong' | 'moderate' | 'reduced';
      breaks?: Array<{ position: number; duration: string }>;
    }
  ): string {
    let ssml = `<speak>`;
    
    // Apply prosody if options provided
    if (options?.rate || options?.pitch) {
      const rate = options.rate ? `rate="${options.rate * 100}%"` : '';
      const pitch = options.pitch ? `pitch="${(options.pitch - 1) * 100}%"` : '';
      ssml += `<prosody ${rate} ${pitch}>`;
    }
    
    // Apply emphasis
    if (options?.emphasis) {
      ssml += `<emphasis level="${options.emphasis}">`;
    }
    
    // Insert breaks at specified positions
    if (options?.breaks && options.breaks.length > 0) {
      let lastPos = 0;
      for (const brk of options.breaks.sort((a, b) => a.position - b.position)) {
        ssml += text.slice(lastPos, brk.position);
        ssml += `<break time="${brk.duration}"/>`;
        lastPos = brk.position;
      }
      ssml += text.slice(lastPos);
    } else {
      ssml += text;
    }
    
    // Close tags
    if (options?.emphasis) {
      ssml += `</emphasis>`;
    }
    if (options?.rate || options?.pitch) {
      ssml += `</prosody>`;
    }
    
    ssml += `</speak>`;
    return ssml;
  }
  
  /**
   * Chunk text for synthesis (some providers have length limits)
   */
  protected chunkText(text: string, maxLength: number = 5000): string[] {
    if (text.length <= maxLength) {
      return [text];
    }
    
    const chunks: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }
      
      // Find a good break point (sentence end, period, comma, space)
      let breakPoint = remaining.lastIndexOf('. ', maxLength);
      if (breakPoint === -1) breakPoint = remaining.lastIndexOf('! ', maxLength);
      if (breakPoint === -1) breakPoint = remaining.lastIndexOf('? ', maxLength);
      if (breakPoint === -1) breakPoint = remaining.lastIndexOf(', ', maxLength);
      if (breakPoint === -1) breakPoint = remaining.lastIndexOf(' ', maxLength);
      if (breakPoint === -1) breakPoint = maxLength;
      
      chunks.push(remaining.slice(0, breakPoint + 1).trim());
      remaining = remaining.slice(breakPoint + 1).trim();
    }
    
    return chunks;
  }
  
  /**
   * Concatenate multiple audio blobs
   */
  protected async concatenateAudio(blobs: AudioBlob[]): Promise<AudioBlob> {
    if (blobs.length === 0) {
      throw new Error('No audio blobs to concatenate');
    }
    
    if (blobs.length === 1) {
      return blobs[0];
    }
    
    // Simple concatenation for now - in production would use AudioContext
    const combinedBlob = new Blob(
      blobs.map(b => b.blob),
      { type: blobs[0].mimeType }
    );
    
    const totalDuration = blobs.reduce((sum, b) => sum + b.duration, 0);
    
    return {
      blob: combinedBlob,
      mimeType: blobs[0].mimeType,
      duration: totalDuration,
      sampleRate: blobs[0].sampleRate,
      channels: blobs[0].channels,
    };
  }
  
  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopPlayback();
    this.voiceCache.clear();
    this.doDispose();
    this.initialized = false;
    this.config = null;
  }
  
  /**
   * Provider-specific cleanup
   */
  protected abstract doDispose(): void;
}
