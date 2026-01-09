/**
 * Whisper STT Provider
 * 
 * Speech-to-Text provider using OpenAI Whisper API.
 * Supports both OpenAI's hosted Whisper API and self-hosted endpoints.
 * 
 * @module voice/providers/stt/whisper
 */

import {
  STTProviderConfig,
  AudioBlob,
  TranscriptResult,
  PartialTranscript,
  TranscriptSegment,
} from '../../types';
import { BaseSTTProvider } from './base';

/**
 * Whisper API response format
 */
interface WhisperResponse {
  text: string;
  task?: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

/**
 * Whisper STT Provider using OpenAI's Whisper API
 */
export class WhisperAPIProvider extends BaseSTTProvider {
  readonly name = 'Whisper API';
  readonly type = 'whisper-api' as const;
  
  private apiKey: string | null = null;
  private endpoint: string = 'https://api.openai.com/v1/audio/transcriptions';
  private model: string = 'whisper-1';
  
  protected async doInitialize(config: STTProviderConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('Whisper API requires an API key');
    }
    
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint || this.endpoint;
    this.model = config.model || this.model;
  }
  
  async transcribe(audio: AudioBlob): Promise<TranscriptResult> {
    if (!this.apiKey) {
      throw new Error('Whisper API not initialized');
    }
    
    const startTime = Date.now();
    
    // Create form data with audio file
    const formData = new FormData();
    formData.append('file', audio.blob, 'audio.webm');
    formData.append('model', this.model);
    formData.append('response_format', 'verbose_json');
    
    if (this.config?.language) {
      formData.append('language', this.config.language);
    }
    
    // Add timestamp granularities for word-level timing
    formData.append('timestamp_granularities[]', 'word');
    formData.append('timestamp_granularities[]', 'segment');
    
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
      }
      
      const result: WhisperResponse = await response.json();
      const processingTimeMs = Date.now() - startTime;
      
      // Transform segments
      const segments: TranscriptSegment[] = (result.segments || []).map(seg => ({
        text: seg.text,
        start: seg.start,
        end: seg.end,
        confidence: 1 - seg.no_speech_prob,
        words: result.words?.filter(w => w.start >= seg.start && w.end <= seg.end).map(w => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: 0.9, // Whisper doesn't provide word-level confidence
        })),
      }));
      
      // Calculate average confidence from segments
      const avgConfidence = segments.length > 0
        ? segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length
        : 0.9;
      
      return {
        text: result.text,
        confidence: avgConfidence,
        segments,
        language: result.language || this.config?.language || 'en',
        processingTimeMs,
        provider: this.type,
      };
    } catch (error) {
      throw new Error(`Whisper transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async *getStreamingTranscript(): AsyncGenerator<PartialTranscript> {
    // Whisper API doesn't support streaming, so we yield nothing
    // This is implemented as a placeholder for potential future support
    throw new Error('Whisper API does not support streaming transcription. Use transcribe() instead.');
  }
  
  protected doDispose(): void {
    this.apiKey = null;
  }
}

/**
 * Local Whisper provider using whisper.cpp or similar
 * Connects to a local server running Whisper
 */
export class WhisperLocalProvider extends BaseSTTProvider {
  readonly name = 'Whisper Local';
  readonly type = 'whisper-local' as const;
  
  private endpoint: string = 'http://localhost:8080/inference';
  private model: string = 'base';
  
  protected async doInitialize(config: STTProviderConfig): Promise<void> {
    this.endpoint = config.endpoint || this.endpoint;
    this.model = config.model || this.model;
    
    // Test connection to local server
    try {
      const response = await fetch(this.endpoint.replace('/inference', '/health'), {
        method: 'GET',
      });
      
      if (!response.ok) {
        console.warn('Local Whisper server health check failed, but continuing...');
      }
    } catch {
      console.warn('Could not connect to local Whisper server. Make sure it is running.');
    }
  }
  
  async transcribe(audio: AudioBlob): Promise<TranscriptResult> {
    const startTime = Date.now();
    
    // Convert audio to WAV format for whisper.cpp compatibility
    const audioBuffer = await this.blobToArrayBuffer(audio.blob);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');
    formData.append('model', this.model);
    
    if (this.config?.language) {
      formData.append('language', this.config.language);
    }
    
    // Add elder-optimized settings if enabled
    if (this.config?.slowSpeechMode) {
      formData.append('beam_size', '10');  // More accurate for slower speech
      formData.append('patience', '2.0');  // Wait longer for speech
    }
    
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Local Whisper error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      const processingTimeMs = Date.now() - startTime;
      
      // Parse local whisper response format
      const text = result.text || result.transcription || '';
      const segments: TranscriptSegment[] = (result.segments || []).map((seg: { text: string; start: number; end: number }) => ({
        text: seg.text,
        start: seg.start,
        end: seg.end,
        confidence: 0.85, // Local whisper doesn't provide confidence
      }));
      
      return {
        text,
        confidence: 0.85,
        segments,
        language: result.language || this.config?.language || 'en',
        processingTimeMs,
        provider: this.type,
      };
    } catch (error) {
      throw new Error(`Local Whisper transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async *getStreamingTranscript(): AsyncGenerator<PartialTranscript> {
    throw new Error('Local Whisper does not support streaming transcription. Use transcribe() instead.');
  }
  
  protected doDispose(): void {
    // Nothing to clean up
  }
}