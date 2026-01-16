/**
 * Coqui TTS Provider
 * 
 * Open-source Text-to-Speech using Coqui TTS.
 * Supports local inference and voice cloning.
 * 
 * @module voice/providers/tts/coqui
 */

import {
  TTSProviderConfig,
  TTSOptions,
  AudioBlob,
  VoiceProfile,
} from '../../types';
import { BaseTTSProvider } from './base';
import { NotImplementedError } from '../../../mcp-server/chrysalis-tools';
import { createLogger } from '../../shared/logger';

/**
 * Coqui TTS model types
 */
type CoquiModel = 
  | 'tts_models/en/ljspeech/tacotron2-DDC'
  | 'tts_models/en/ljspeech/glow-tts'
  | 'tts_models/en/vctk/vits'
  | 'tts_models/en/jenny/jenny'
  | 'tts_models/multilingual/multi-dataset/xtts_v2'
  | string;

/**
 * Coqui server response
 */
interface CoquiResponse {
  audio: string;  // Base64 encoded audio
  sampling_rate: number;
  duration: number;
}

/**
 * Coqui TTS Provider
 * 
 * Features:
 * - Local inference (no API key needed)
 * - Voice cloning with XTTS
 * - Multi-language support
 * - Low latency for local deployment
 */
export class CoquiTTSProvider extends BaseTTSProvider {
  readonly name = 'Coqui TTS';
  readonly type = 'coqui' as const;
  private log = createLogger('voice-tts-coqui');
  
  private endpoint = 'http://localhost:5002';
  private model: CoquiModel = 'tts_models/multilingual/multi-dataset/xtts_v2';
  private speakerWav: string | null = null;
  private language = 'en';
  
  protected async doInitialize(config: TTSProviderConfig): Promise<void> {
    if (config.endpoint) {
      this.endpoint = config.endpoint;
    }
    
    if (config.model) {
      this.model = config.model;
    }
    
    if (config.voiceId) {
      this.speakerWav = config.voiceId;
    }
    
    // Test connection to Coqui server
    try {
      const response = await this.rateLimitedFetch(`${this.endpoint}/api/tts-models`);
      
      if (!response.ok) {
        this.log.warn('Coqui server health check failed, but continuing...', { status: response.status });
      }
    } catch {
      this.log.warn('Could not connect to Coqui TTS server. Make sure it is running.');
    }
  }
  
  /**
   * Synthesize speech from text
   */
  async synthesize(text: string, options?: TTSOptions): Promise<AudioBlob> {
    // Handle long text by chunking
    const chunks = this.chunkText(text, 1000); // Coqui works better with shorter chunks
    
    if (chunks.length === 1) {
      return this.synthesizeChunk(chunks[0], options);
    }
    
    // Synthesize each chunk and concatenate
    const audioBlobs: AudioBlob[] = [];
    for (const chunk of chunks) {
      const audio = await this.synthesizeChunk(chunk, options);
      audioBlobs.push(audio);
    }
    
    return this.concatenateAudio(audioBlobs);
  }
  
  /**
   * Synthesize a single chunk of text
   */
  private async synthesizeChunk(
    text: string,
    options?: TTSOptions
  ): Promise<AudioBlob> {
    // Build query parameters
    const params = new URLSearchParams({
      text,
      language: this.language,
    });
    
    // Add speaker if using XTTS for voice cloning
    if (options?.voiceProfile?.voiceId || this.speakerWav) {
      params.set('speaker_wav', options?.voiceProfile?.voiceId || this.speakerWav!);
    }
    
    // Add speed adjustment if specified
    if (options?.speed) {
      params.set('speed', options.speed.toString());
    }
    
    const response = await this.rateLimitedFetch(
      `${this.endpoint}/api/tts?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'audio/wav',
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Coqui TTS synthesis failed: ${response.status} - ${errorText}`);
    }
    
    // Check content type to determine response format
    const contentType = response.headers.get('content-type') || '';
    
    let blob: Blob;
    let mimeType: string;
    let duration: number;
    
    if (contentType.includes('application/json')) {
      // JSON response with base64 audio
      const data = await response.json() as CoquiResponse;
      const audioData = atob(data.audio);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      blob = new Blob([audioArray], { type: 'audio/wav' });
      mimeType = 'audio/wav';
      duration = data.duration; // Already in seconds
    } else {
      // Direct audio response
      const audioData = await response.arrayBuffer();
      blob = new Blob([audioData], { type: 'audio/wav' });
      mimeType = 'audio/wav';
      
      // Estimate duration from text (in seconds)
      const wordsPerMinute = options?.speed ? 150 * options.speed : 150;
      const wordCount = text.split(/\s+/).length;
      duration = (wordCount / wordsPerMinute) * 60;
    }
    
    return {
      blob,
      duration,
      sampleRate: 22050,
      channels: 1,
      mimeType,
    };
  }
  
  /**
   * Synthesize using XTTS for voice cloning
   */
  async synthesizeWithClone(
    text: string,
    speakerWav: string | Blob,
    options?: TTSOptions
  ): Promise<AudioBlob> {
    // Build form data for XTTS
    const formData = new FormData();
    formData.append('text', text);
    formData.append('language', this.language);
    
    if (typeof speakerWav === 'string') {
      formData.append('speaker_wav', speakerWav);
    } else {
      formData.append('speaker_wav', speakerWav, 'speaker.wav');
    }
    
    if (options?.speed) {
      formData.append('speed', options.speed.toString());
    }
    
    const response = await this.rateLimitedFetch(
      `${this.endpoint}/api/tts-to-audio/`,
      {
        method: 'POST',
        body: formData,
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`XTTS synthesis failed: ${response.status} - ${errorText}`);
    }
    
    const audioData = await response.arrayBuffer();
    const blob = new Blob([audioData], { type: 'audio/wav' });
    
    // Estimate duration (in seconds)
    const wordsPerMinute = options?.speed ? 150 * options.speed : 150;
    const wordCount = text.split(/\s+/).length;
    const duration = (wordCount / wordsPerMinute) * 60;
    
    return {
      blob,
      duration,
      sampleRate: 22050,
      channels: 1,
      mimeType: 'audio/wav',
    };
  }
  
  /**
   * List available voices/speakers
   */
  async listVoices(): Promise<VoiceProfile[]> {
    try {
      // Get available models
      const modelsResponse = await this.rateLimitedFetch(
        `${this.endpoint}/api/tts-models`
      );
      
      if (!modelsResponse.ok) {
        return this.getDefaultVoices();
      }
      
      const models = await modelsResponse.json() as string[];
      
      // Get speakers for current model
      const speakersResponse = await this.rateLimitedFetch(
        `${this.endpoint}/api/speakers`
      );
      
      let speakers: string[] = [];
      if (speakersResponse.ok) {
        speakers = await speakersResponse.json() as string[];
      }
      
      // Create voice profiles from speakers
      const voices: VoiceProfile[] = speakers.map(speaker => ({
        id: speaker,
        name: speaker,
        voiceId: speaker,
        isCloned: false,
        characteristics: ['coqui', 'neutral', 'en'],
        provider: 'coqui' as const,
      }));
      
      // If no speakers, return model-based profiles
      if (voices.length === 0) {
        return models.slice(0, 10).map(model => ({
          id: model,
          name: model.split('/').pop() || model,
          voiceId: model,
          isCloned: false,
          characteristics: ['coqui', 'model', model.includes('en') ? 'en' : 'multilingual'],
          provider: 'coqui' as const,
        }));
      }
      
      return voices;
    } catch {
      return this.getDefaultVoices();
    }
  }
  
  /**
   * Get default voices when server is unavailable
   */
  private getDefaultVoices(): VoiceProfile[] {
    return [
      {
        id: 'default',
        name: 'Default',
        voiceId: 'default',
        isCloned: false,
        characteristics: ['coqui', 'neutral', 'en'],
        provider: 'coqui',
      },
      {
        id: 'xtts_v2',
        name: 'XTTS v2 (Cloning)',
        voiceId: 'xtts_v2',
        isCloned: false,
        characteristics: ['coqui', 'cloning', 'multilingual'],
        provider: 'coqui',
      },
    ];
  }
  
  /**
   * Coqui XTTS supports voice cloning
   */
  supportsVoiceCloning(): boolean {
    return this.model.includes('xtts');
  }
  
  /**
   * Clone a voice from audio samples
   * For Coqui, this means saving the reference audio for XTTS
   */
  async cloneVoice(
    name: string,
    samples: AudioBlob[],
    description?: string
  ): Promise<VoiceProfile> {
    if (samples.length === 0) {
      throw new Error('At least one audio sample is required');
    }
    
    // For Coqui XTTS, we use the sample directly during synthesis
    // Store the first sample as the reference
    const sample = samples[0];
    
    // Convert to base64 for storage
    const arrayBuffer = await sample.blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );
    
    // Voice cloning requires disk persistence for the audio sample
    throw new NotImplementedError(
      'Voice cloning requires disk persistence implementation to save audio samples'
    );
  }
  
  /**
   * Get available languages
   */
  async getLanguages(): Promise<string[]> {
    try {
      const response = await this.rateLimitedFetch(
        `${this.endpoint}/api/languages`
      );
      
      if (response.ok) {
        return await response.json() as string[];
      }
    } catch {
      // Server unavailable
    }
    
    // Default languages for XTTS
    return ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh-cn', 'ja', 'hu', 'ko'];
  }
  
  /**
   * Set language for synthesis
   */
  setLanguage(language: string): void {
    this.language = language;
  }
  
  protected doDispose(): void {
    this.speakerWav = null;
  }
}

/**
 * Check if Coqui TTS server is available
 */
export async function isCoquiAvailable(endpoint = 'http://localhost:5002'): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/api/tts-models`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
