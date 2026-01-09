/**
 * ElevenLabs TTS Provider
 * 
 * High-quality Text-to-Speech using ElevenLabs API.
 * Supports voice cloning and emotional expression.
 * 
 * @module voice/providers/tts/elevenlabs
 */

import {
  TTSProviderConfig,
  TTSOptions,
  AudioBlob,
  VoiceProfile,
} from '../../types';
import { BaseTTSProvider } from './base';

/**
 * ElevenLabs voice model types
 */
type ElevenLabsModel = 
  | 'eleven_monolingual_v1'
  | 'eleven_multilingual_v1'
  | 'eleven_multilingual_v2'
  | 'eleven_turbo_v2'
  | 'eleven_turbo_v2_5';

/**
 * ElevenLabs voice settings
 */
interface ElevenLabsVoiceSettings {
  stability: number;          // 0-1, lower = more variable
  similarity_boost: number;   // 0-1, higher = more similar to original
  style?: number;             // 0-1, style exaggeration
  use_speaker_boost?: boolean;
}

/**
 * ElevenLabs API voice response
 */
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
  available_for_tiers?: string[];
  settings?: ElevenLabsVoiceSettings;
}

/**
 * ElevenLabs TTS Provider
 * 
 * Features:
 * - High-quality neural TTS
 * - Voice cloning support
 * - Emotional expression
 * - Multiple language support
 */
export class ElevenLabsTTSProvider extends BaseTTSProvider {
  readonly name = 'ElevenLabs';
  readonly type = 'elevenlabs' as const;
  
  private apiKey: string | null = null;
  private endpoint = 'https://api.elevenlabs.io/v1';
  private model: ElevenLabsModel = 'eleven_multilingual_v2';
  private defaultVoiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam
  
  protected async doInitialize(config: TTSProviderConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('ElevenLabs requires an API key');
    }
    
    this.apiKey = config.apiKey;
    
    if (config.model) {
      this.model = config.model as ElevenLabsModel;
    }
    
    if (config.voiceId) {
      this.defaultVoiceId = config.voiceId;
    }
    
    // Verify API key
    try {
      const response = await this.rateLimitedFetch(
        `${this.endpoint}/user`,
        {
          headers: {
            'xi-api-key': this.apiKey,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Invalid API key: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`ElevenLabs API verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Synthesize speech from text
   */
  async synthesize(text: string, options?: TTSOptions): Promise<AudioBlob> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs not initialized');
    }
    
    const voiceId = options?.voiceId || this.defaultVoiceId;
    
    // Handle long text by chunking
    const chunks = this.chunkText(text, 5000);
    
    if (chunks.length === 1) {
      return this.synthesizeChunk(chunks[0], voiceId, options);
    }
    
    // Synthesize each chunk and concatenate
    const audioBlobs: AudioBlob[] = [];
    for (const chunk of chunks) {
      const audio = await this.synthesizeChunk(chunk, voiceId, options);
      audioBlobs.push(audio);
    }
    
    return this.concatenateAudio(audioBlobs);
  }
  
  /**
   * Synthesize a single chunk of text
   */
  private async synthesizeChunk(
    text: string,
    voiceId: string,
    options?: TTSOptions
  ): Promise<AudioBlob> {
    // Build voice settings
    const voiceSettings: ElevenLabsVoiceSettings = {
      stability: options?.emotionalRange ? (1 - options.emotionalRange) * 0.5 + 0.25 : 0.5,
      similarity_boost: 0.75,
      style: options?.emotionalRange || 0.5,
      use_speaker_boost: true,
    };
    
    // Build request body
    const body = {
      text,
      model_id: this.model,
      voice_settings: voiceSettings,
    };
    
    const response = await this.rateLimitedFetch(
      `${this.endpoint}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey!,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify(body),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs synthesis failed: ${response.status} - ${errorText}`);
    }
    
    const audioData = await response.arrayBuffer();
    const blob = new Blob([audioData], { type: 'audio/mpeg' });
    
    // Estimate duration based on text length and speech rate
    const wordsPerMinute = options?.speed ? 150 * options.speed : 150;
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = (wordCount / wordsPerMinute) * 60 * 1000;
    
    return {
      blob,
      mimeType: 'audio/mpeg',
      durationMs: estimatedDuration,
    };
  }
  
  /**
   * List available voices
   */
  async listVoices(): Promise<VoiceProfile[]> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs not initialized');
    }
    
    const response = await this.rateLimitedFetch(
      `${this.endpoint}/voices`,
      {
        headers: {
          'xi-api-key': this.apiKey,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to list voices: ${response.status}`);
    }
    
    const data = await response.json();
    const voices: ElevenLabsVoice[] = data.voices || [];
    
    return voices.map(voice => this.mapElevenLabsVoice(voice));
  }
  
  /**
   * Map ElevenLabs voice to VoiceProfile
   */
  private mapElevenLabsVoice(voice: ElevenLabsVoice): VoiceProfile {
    // Extract characteristics from labels
    const labels = voice.labels || {};
    const characteristics: string[] = [];
    
    if (labels.accent) characteristics.push(labels.accent);
    if (labels.age) characteristics.push(labels.age);
    if (labels.gender) characteristics.push(labels.gender);
    if (labels.use_case) characteristics.push(labels.use_case);
    
    // Determine gender from labels
    let gender: 'male' | 'female' | 'neutral' = 'neutral';
    if (labels.gender?.toLowerCase().includes('male')) {
      gender = labels.gender.toLowerCase().includes('female') ? 'female' : 'male';
    }
    
    return {
      id: voice.voice_id,
      name: voice.name,
      gender,
      language: labels.language || 'en',
      characteristics,
      previewUrl: voice.preview_url,
      provider: 'elevenlabs',
    };
  }
  
  /**
   * ElevenLabs supports voice cloning
   */
  supportsVoiceCloning(): boolean {
    return true;
  }
  
  /**
   * Clone a voice from audio samples
   */
  async cloneVoice(
    name: string,
    samples: AudioBlob[],
    description?: string
  ): Promise<VoiceProfile> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs not initialized');
    }
    
    if (samples.length === 0) {
      throw new Error('At least one audio sample is required');
    }
    
    // Create form data with samples
    const formData = new FormData();
    formData.append('name', name);
    
    if (description) {
      formData.append('description', description);
    }
    
    // Add each sample
    samples.forEach((sample, i) => {
      formData.append('files', sample.blob, `sample_${i}.mp3`);
    });
    
    const response = await this.rateLimitedFetch(
      `${this.endpoint}/voices/add`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
        },
        body: formData,
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voice cloning failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    return {
      id: result.voice_id,
      name,
      gender: 'neutral',
      language: 'en',
      characteristics: ['cloned'],
      provider: 'elevenlabs',
    };
  }
  
  /**
   * Delete a cloned voice
   */
  async deleteVoice(voiceId: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs not initialized');
    }
    
    const response = await this.rateLimitedFetch(
      `${this.endpoint}/voices/${voiceId}`,
      {
        method: 'DELETE',
        headers: {
          'xi-api-key': this.apiKey,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to delete voice: ${response.status}`);
    }
    
    // Clear cache to refresh voice list
    this.clearVoiceCache();
  }
  
  /**
   * Get user subscription info
   */
  async getSubscriptionInfo(): Promise<{
    tier: string;
    characterLimit: number;
    characterCount: number;
    canCloneVoices: boolean;
  }> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs not initialized');
    }
    
    const response = await this.rateLimitedFetch(
      `${this.endpoint}/user/subscription`,
      {
        headers: {
          'xi-api-key': this.apiKey,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get subscription info: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      tier: data.tier || 'free',
      characterLimit: data.character_limit || 0,
      characterCount: data.character_count || 0,
      canCloneVoices: data.can_use_instant_voice_cloning || false,
    };
  }
  
  protected doDispose(): void {
    this.apiKey = null;
  }
}