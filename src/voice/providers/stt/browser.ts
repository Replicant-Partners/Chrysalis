/**
 * Browser Web Speech API STT Provider
 * 
 * Speech-to-Text provider using the browser's native Web Speech API.
 * Works offline and requires no API keys, but quality may vary by browser.
 * 
 * @module voice/providers/stt/browser
 */

import {
  STTProviderConfig,
  AudioBlob,
  TranscriptResult,
  PartialTranscript,
  TranscriptSegment,
} from '../../types';
import { BaseSTTProvider } from './base';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

// Extend window to include SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
    onspeechstart: (() => void) | null;
    onspeechend: (() => void) | null;
  }
}

/**
 * Browser Web Speech API STT Provider
 * 
 * Features:
 * - Real-time streaming transcription
 * - No API key required
 * - Works offline (varies by browser)
 * - Interim results for responsive UI
 */
export class BrowserSTTProvider extends BaseSTTProvider {
  readonly name = 'Browser Web Speech';
  readonly type = 'browser' as const;
  
  private recognition: SpeechRecognition | null = null;
  private isStreaming = false;
  private streamingResults: PartialTranscript[] = [];
  private streamingResolvers: Array<(value: IteratorResult<PartialTranscript>) => void> = [];
  
  protected async doInitialize(config: STTProviderConfig): Promise<void> {
    // Check for browser support
    const SpeechRecognitionClass = typeof window !== 'undefined' 
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
    
    if (!SpeechRecognitionClass) {
      throw new Error('Web Speech API not supported in this browser');
    }
    
    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = config.language || 'en-US';
    
    // Set up event handlers
    this.recognition.onresult = this.handleResult.bind(this);
    this.recognition.onerror = this.handleError.bind(this);
    this.recognition.onend = this.handleEnd.bind(this);
  }
  
  /**
   * Handle speech recognition results
   */
  private handleResult(event: SpeechRecognitionEvent): void {
    const results = event.results;
    
    for (let i = event.resultIndex; i < results.length; i++) {
      const result = results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence || 0.8;
      
      const partialResult: PartialTranscript = {
        text: transcript,
        isFinal: result.isFinal,
        confidence,
        timestamp: Date.now(),
      };
      
      // Add to results queue
      this.streamingResults.push(partialResult);
      
      // Resolve any waiting generators
      const resolver = this.streamingResolvers.shift();
      if (resolver) {
        const nextResult = this.streamingResults.shift();
        if (nextResult) {
          resolver({ value: nextResult, done: false });
        }
      }
    }
  }
  
  /**
   * Handle speech recognition errors
   */
  private handleError(event: SpeechRecognitionErrorEvent): void {
    console.error('Speech recognition error:', event.error, event.message);
    
    // Map Web Speech API errors to user-friendly messages
    const errorMessages: Record<string, string> = {
      'no-speech': 'No speech detected. Please try again.',
      'audio-capture': 'Microphone not available. Check your permissions.',
      'not-allowed': 'Microphone permission denied.',
      'network': 'Network error occurred.',
      'service-not-allowed': 'Speech service not allowed.',
      'bad-grammar': 'Grammar error in recognition.',
      'language-not-supported': 'Language not supported.',
    };
    
    const message = errorMessages[event.error] || `Unknown error: ${event.error}`;
    
    // Add error to stream
    const errorResult: PartialTranscript = {
      text: '',
      isFinal: true,
      confidence: 0,
      timestamp: Date.now(),
    };
    
    this.streamingResults.push(errorResult);
    
    // Resolve waiting generator with error indication
    const resolver = this.streamingResolvers.shift();
    if (resolver) {
      resolver({ value: errorResult, done: true });
    }
    
    console.warn(`Browser STT error: ${message}`);
  }
  
  /**
   * Handle recognition end
   */
  private handleEnd(): void {
    this.isStreaming = false;
    
    // Signal end to all waiting resolvers
    for (const resolver of this.streamingResolvers) {
      resolver({ value: { text: '', isFinal: true, confidence: 0, timestamp: Date.now() }, done: true });
    }
    this.streamingResolvers = [];
  }
  
  /**
   * Transcribe audio blob
   * Note: Web Speech API works with microphone directly, not audio files.
   * This method starts live transcription.
   */
  async transcribe(audio: AudioBlob): Promise<TranscriptResult> {
    // Web Speech API doesn't support transcribing audio files directly
    // We need to use the streaming interface instead
    throw new Error(
      'Browser Web Speech API does not support transcribing audio files. ' +
      'Use getStreamingTranscript() for live microphone transcription.'
    );
  }
  
  /**
   * Get streaming transcript from microphone
   * Yields partial results as they become available
   */
  async *getStreamingTranscript(): AsyncGenerator<PartialTranscript> {
    if (!this.recognition) {
      throw new Error('Browser STT not initialized');
    }
    
    // Clear previous results
    this.streamingResults = [];
    this.streamingResolvers = [];
    this.isStreaming = true;
    
    // Start recognition
    try {
      this.recognition.start();
    } catch {
      // May already be started
    }
    
    // Yield results as they come in
    while (this.isStreaming || this.streamingResults.length > 0) {
      if (this.streamingResults.length > 0) {
        const result = this.streamingResults.shift()!;
        yield result;
        
        if (result.isFinal && !this.isStreaming) {
          break;
        }
      } else {
        // Wait for next result
        const result = await new Promise<IteratorResult<PartialTranscript>>((resolve) => {
          this.streamingResolvers.push(resolve);
        });
        
        if (result.done) break;
        yield result.value;
      }
    }
  }
  
  /**
   * Start live transcription
   */
  async startListening(): Promise<void> {
    if (!this.recognition) {
      throw new Error('Browser STT not initialized');
    }
    
    await super.startListening();
    this.isStreaming = true;
    this.recognition.start();
  }
  
  /**
   * Stop live transcription
   */
  async stopListening(): Promise<AudioBlob> {
    if (this.recognition) {
      this.recognition.stop();
    }
    this.isStreaming = false;
    
    return super.stopListening();
  }
  
  /**
   * Get accumulated transcript from streaming session
   */
  getAccumulatedTranscript(): TranscriptResult {
    // Combine all final results
    const finalResults = this.streamingResults.filter(r => r.isFinal);
    const text = finalResults.map(r => r.text).join(' ');
    const avgConfidence = finalResults.length > 0
      ? finalResults.reduce((sum, r) => sum + r.confidence, 0) / finalResults.length
      : 0;
    
    const segments: TranscriptSegment[] = finalResults.map((r, i) => ({
      text: r.text,
      start: i * 2, // Approximate timing
      end: (i + 1) * 2,
      confidence: r.confidence,
    }));
    
    return {
      text,
      confidence: avgConfidence,
      segments,
      language: this.config?.language || 'en',
      processingTimeMs: 0,
      provider: this.type,
    };
  }
  
  protected doDispose(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
        this.recognition.abort();
      } catch {
        // Ignore errors during cleanup
      }
      this.recognition = null;
    }
    this.streamingResults = [];
    this.streamingResolvers = [];
    this.isStreaming = false;
  }
}

/**
 * Check if browser Web Speech API is available
 */
export function isBrowserSTTAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}