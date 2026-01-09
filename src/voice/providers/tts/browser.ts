/**
 * Browser Web Speech API TTS Provider
 * 
 * Text-to-Speech using the browser's native Speech Synthesis API.
 * Works offline and requires no API keys.
 * 
 * @module voice/providers/tts/browser
 */

import {
  TTSProviderConfig,
  TTSOptions,
  AudioBlob,
  VoiceProfile,
} from '../../types';
import { BaseTTSProvider } from './base';

/**
 * Browser TTS Provider
 * 
 * Features:
 * - No API key required
 * - Works offline
 * - Uses system voices
 * - Real-time playback
 */
export class BrowserTTSProvider extends BaseTTSProvider {
  readonly name = 'Browser Speech Synthesis';
  readonly type = 'browser' as const;
  
  private synth: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private voicesLoaded = false;
  
  protected async doInitialize(config: TTSProviderConfig): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Browser TTS requires a browser environment');
    }
    
    this.synth = window.speechSynthesis;
    
    if (!this.synth) {
      throw new Error('Speech Synthesis not supported in this browser');
    }
    
    // Wait for voices to load
    await this.waitForVoices();
    
    // Set default voice if specified
    if (config.voiceId) {
      const voices = this.synth.getVoices();
      this.selectedVoice = voices.find(v => v.voiceURI === config.voiceId) || null;
    }
  }
  
  /**
   * Wait for voices to be loaded
   */
  private waitForVoices(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve();
        return;
      }
      
      const voices = this.synth.getVoices();
      if (voices.length > 0) {
        this.voicesLoaded = true;
        resolve();
        return;
      }
      
      // Some browsers load voices asynchronously
      const handleVoicesChanged = () => {
        this.voicesLoaded = true;
        this.synth?.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve();
      };
      
      this.synth.addEventListener('voiceschanged', handleVoicesChanged);
      
      // Timeout in case event never fires
      setTimeout(() => {
        this.voicesLoaded = true;
        resolve();
      }, 1000);
    });
  }
  
  /**
   * Synthesize speech from text
   * Note: Browser TTS plays directly, returns empty blob
   */
  async synthesize(text: string, options?: TTSOptions): Promise<AudioBlob> {
    if (!this.synth) {
      throw new Error('Browser TTS not initialized');
    }
    
    // Cancel any ongoing speech
    this.synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice
    if (options?.voiceId) {
      const voices = this.synth.getVoices();
      const voice = voices.find(v => v.voiceURI === options.voiceId);
      if (voice) utterance.voice = voice;
    } else if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    
    // Set rate (0.1 to 10)
    if (options?.speed) {
      utterance.rate = Math.max(0.1, Math.min(10, options.speed));
    }
    
    // Set pitch (0 to 2)
    if (options?.pitch) {
      utterance.pitch = Math.max(0, Math.min(2, options.pitch));
    }
    
    // Calculate estimated duration
    const wordsPerMinute = (options?.speed || 1) * 150;
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = (wordCount / wordsPerMinute) * 60 * 1000;
    
    // Return a promise that resolves when speech ends
    return new Promise((resolve, reject) => {
      utterance.onend = () => {
        // Browser TTS doesn't provide audio data
        // Return an empty blob with duration info
        resolve({
          blob: new Blob([], { type: 'audio/wav' }),
          mimeType: 'audio/wav',
          durationMs: estimatedDuration,
        });
      };
      
      utterance.onerror = (event) => {
        reject(new Error(`Browser TTS error: ${event.error}`));
      };
      
      this.synth!.speak(utterance);
    });
  }
  
  /**
   * Speak text directly (preferred method for browser TTS)
   */
  async speak(text: string, options?: TTSOptions): Promise<void> {
    if (!this.synth) {
      throw new Error('Browser TTS not initialized');
    }
    
    // Cancel any ongoing speech
    this.synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice
    if (options?.voiceId) {
      const voices = this.synth.getVoices();
      const voice = voices.find(v => v.voiceURI === options.voiceId);
      if (voice) utterance.voice = voice;
    } else if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    
    // Set rate and pitch
    if (options?.speed) {
      utterance.rate = Math.max(0.1, Math.min(10, options.speed));
    }
    if (options?.pitch) {
      utterance.pitch = Math.max(0, Math.min(2, options.pitch));
    }
    
    return new Promise((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(`TTS error: ${event.error}`));
      this.synth!.speak(utterance);
    });
  }
  
  /**
   * List available voices
   */
  async listVoices(): Promise<VoiceProfile[]> {
    if (!this.synth) {
      throw new Error('Browser TTS not initialized');
    }
    
    await this.waitForVoices();
    
    const voices = this.synth.getVoices();
    
    return voices.map(voice => ({
      id: voice.voiceURI,
      name: voice.name,
      gender: this.inferGender(voice.name),
      language: voice.lang,
      characteristics: [
        voice.localService ? 'local' : 'remote',
        voice.default ? 'default' : '',
      ].filter(Boolean),
      provider: 'browser',
    }));
  }
  
  /**
   * Infer gender from voice name
   */
  private inferGender(name: string): 'male' | 'female' | 'neutral' {
    const lowerName = name.toLowerCase();
    
    // Common female voice indicators
    const femaleIndicators = ['female', 'samantha', 'karen', 'victoria', 'alex', 'fiona', 'moira', 'tessa', 'veena', 'zira', 'hazel'];
    if (femaleIndicators.some(ind => lowerName.includes(ind))) {
      return 'female';
    }
    
    // Common male voice indicators
    const maleIndicators = ['male', 'daniel', 'david', 'fred', 'oliver', 'george', 'tom', 'james', 'mark'];
    if (maleIndicators.some(ind => lowerName.includes(ind))) {
      return 'male';
    }
    
    return 'neutral';
  }
  
  /**
   * Get voices by language
   */
  async getVoicesByLanguage(lang: string): Promise<VoiceProfile[]> {
    const allVoices = await this.listVoices();
    return allVoices.filter(voice => 
      voice.language.toLowerCase().startsWith(lang.toLowerCase())
    );
  }
  
  /**
   * Set the default voice
   */
  setVoice(voiceId: string): void {
    if (!this.synth) return;
    
    const voices = this.synth.getVoices();
    this.selectedVoice = voices.find(v => v.voiceURI === voiceId) || null;
  }
  
  /**
   * Pause current speech
   */
  pause(): void {
    this.synth?.pause();
  }
  
  /**
   * Resume paused speech
   */
  resume(): void {
    this.synth?.resume();
  }
  
  /**
   * Cancel current speech
   */
  cancel(): void {
    this.synth?.cancel();
  }
  
  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synth?.speaking || false;
  }
  
  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.synth?.paused || false;
  }
  
  protected doDispose(): void {
    this.synth?.cancel();
    this.synth = null;
    this.selectedVoice = null;
  }
}

/**
 * Check if browser TTS is available
 */
export function isBrowserTTSAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}