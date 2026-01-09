/**
 * Base STT Provider
 * 
 * Abstract base class for Speech-to-Text providers.
 * 
 * @module voice/providers/stt/base
 */

import {
  ISTTProvider,
  STTProviderType,
  STTProviderConfig,
  AudioBlob,
  TranscriptResult,
  PartialTranscript,
} from '../../types';

/**
 * Abstract base class for STT providers
 */
export abstract class BaseSTTProvider implements ISTTProvider {
  abstract readonly name: string;
  abstract readonly type: STTProviderType;
  
  protected config: STTProviderConfig | null = null;
  protected _isInitialized = false;
  protected mediaRecorder: MediaRecorder | null = null;
  protected audioChunks: Blob[] = [];
  protected mediaStream: MediaStream | null = null;
  
  async initialize(config: STTProviderConfig): Promise<void> {
    this.config = config;
    await this.doInitialize(config);
    this._isInitialized = true;
  }
  
  isInitialized(): boolean {
    return this._isInitialized;
  }
  
  /**
   * Provider-specific initialization
   */
  protected abstract doInitialize(config: STTProviderConfig): Promise<void>;
  
  /**
   * Start listening for audio input
   */
  async startListening(): Promise<void> {
    if (!this._isInitialized) {
      throw new Error(`${this.name} provider not initialized`);
    }
    
    // Get microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        sampleRate: this.config?.sampleRate || 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });
    
    // Create media recorder
    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: this.getSupportedMimeType(),
    });
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };
    
    this.mediaRecorder.start(100); // Collect data every 100ms
  }
  
  /**
   * Stop listening and return the recorded audio
   */
  async stopListening(): Promise<AudioBlob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Not currently listening'));
        return;
      }
      
      this.mediaRecorder.onstop = async () => {
        // Stop media stream
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
          this.mediaStream = null;
        }
        
        // Combine audio chunks
        const audioBlob = new Blob(this.audioChunks, { type: this.getSupportedMimeType() });
        
        // Calculate duration (approximate)
        const duration = this.audioChunks.length * 0.1; // 100ms per chunk
        
        resolve({
          blob: audioBlob,
          duration,
          sampleRate: this.config?.sampleRate || 16000,
          channels: 1,
          mimeType: this.getSupportedMimeType(),
        });
      };
      
      this.mediaRecorder.stop();
    });
  }
  
  /**
   * Transcribe audio
   */
  abstract transcribe(audio: AudioBlob): Promise<TranscriptResult>;
  
  /**
   * Get streaming transcript (if supported)
   */
  async *getStreamingTranscript(): AsyncGenerator<PartialTranscript> {
    // Default implementation yields nothing - override in providers that support streaming
    throw new Error(`${this.name} does not support streaming transcription`);
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.audioChunks = [];
    this._isInitialized = false;
    this.doDispose();
  }
  
  /**
   * Provider-specific cleanup
   */
  protected abstract doDispose(): void;
  
  /**
   * Get supported MIME type for recording
   */
  protected getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav',
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return 'audio/webm';
  }
  
  /**
   * Convert blob to base64
   */
  protected async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  /**
   * Convert blob to array buffer
   */
  protected async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return blob.arrayBuffer();
  }
}