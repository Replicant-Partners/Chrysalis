/**
 * Voice System Types
 * 
 * Type definitions for STT, TTS, voice profiles, and voice cloning.
 * Based on the voice integration specification from docs/architecture/voice-integration.md
 * 
 * @module voice/types
 */

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Available STT (Speech-to-Text) providers
 */
export type STTProviderType = 'whisper-local' | 'whisper-api' | 'deepgram' | 'openai' | 'browser';

/**
 * Available TTS (Text-to-Speech) providers
 */
export type TTSProviderType = 'coqui' | 'elevenlabs' | 'openai' | 'browser';

// =============================================================================
// Audio Types
// =============================================================================

/**
 * Audio blob with metadata
 */
export interface AudioBlob {
  blob: Blob;
  duration: number;
  sampleRate: number;
  channels: number;
  mimeType: string;
}

/**
 * Audio chunk for streaming
 */
export interface AudioChunk {
  data: ArrayBuffer;
  index: number;
  isFinal: boolean;
  timestamp: number;
}

// =============================================================================
// STT Types
// =============================================================================

/**
 * STT provider configuration
 */
export interface STTProviderConfig {
  provider: STTProviderType;
  apiKey?: string;
  model?: string;
  language?: string;
  sampleRate?: number;
  vadSensitivity?: number;
  // Elder-optimized settings
  slowSpeechMode?: boolean;
  accentTolerance?: 'standard' | 'enhanced';
  // API endpoint override
  endpoint?: string;
}

/**
 * Word timing information
 */
export interface WordTiming {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

/**
 * Transcript segment
 */
export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  confidence: number;
  words?: WordTiming[];
}

/**
 * Partial transcript for streaming
 */
export interface PartialTranscript {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
}

/**
 * Complete transcript result
 */
export interface TranscriptResult {
  text: string;
  confidence: number;
  segments: TranscriptSegment[];
  language: string;
  processingTimeMs: number;
  provider: STTProviderType;
}

/**
 * STT provider interface
 */
export interface ISTTProvider {
  readonly name: string;
  readonly type: STTProviderType;
  
  initialize(config: STTProviderConfig): Promise<void>;
  isInitialized(): boolean;
  
  startListening(): Promise<void>;
  stopListening(): Promise<AudioBlob>;
  
  transcribe(audio: AudioBlob): Promise<TranscriptResult>;
  getStreamingTranscript(): AsyncGenerator<PartialTranscript>;
  
  dispose(): void;
}

// =============================================================================
// TTS Types
// =============================================================================

/**
 * TTS provider configuration
 */
export interface TTSProviderConfig {
  provider: TTSProviderType;
  apiKey?: string;
  voiceId?: string;
  model?: string;
  // Voice characteristics
  speed?: number;        // 0.5 - 2.0, default 1.0
  pitch?: number;        // 0.5 - 2.0, default 1.0
  stability?: number;    // ElevenLabs-specific (0.0 - 1.0)
  similarity?: number;   // ElevenLabs-specific (0.0 - 1.0)
  // API endpoint override
  endpoint?: string;
}

/**
 * Voice profile for TTS
 */
export interface VoiceProfile {
  id: string;
  name: string;
  provider: TTSProviderType;
  voiceId: string;
  characteristics: string[];
  previewUrl?: string;
  isCloned: boolean;
  cloneSourceId?: string;
  // Default voice modifiers
  defaultSpeed?: number;
  defaultPitch?: number;
}

/**
 * Emotional state for voice modulation
 */
export interface EmotionalState {
  emotion: 'neutral' | 'joyful' | 'encouraging' | 'peaceful' | 'protective' | 'curious' | 'concerned';
  intensity: number;  // 0.0 - 1.0
  voiceModifiers: {
    speed: number;
    pitch: number;
  };
}

/**
 * TTS synthesis options
 */
export interface TTSOptions {
  voiceProfile?: VoiceProfile;
  emotionalState?: EmotionalState;
  speed?: number;
  pitch?: number;
  format?: 'mp3' | 'wav' | 'ogg' | 'pcm';
}

/**
 * TTS provider interface
 */
export interface ITTSProvider {
  readonly name: string;
  readonly type: TTSProviderType;
  
  initialize(config: TTSProviderConfig): Promise<void>;
  isInitialized(): boolean;
  
  synthesize(text: string, options?: TTSOptions): Promise<AudioBlob>;
  getStreamingAudio(text: string, options?: TTSOptions): AsyncGenerator<AudioChunk>;
  
  listVoices(): Promise<VoiceProfile[]>;
  
  dispose(): void;
}

// =============================================================================
// Voice State Types
// =============================================================================

/**
 * Voice mode for chatbox
 */
export type VoiceMode = 'text' | 'voice' | 'hybrid';

/**
 * Voice activity state
 */
export interface VoiceState {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  currentTranscript: string;
  confidence: number;
  error?: string;
}

/**
 * Voice configuration for chatbox
 */
export interface VoiceConfig {
  mode: VoiceMode;
  sttProvider: STTProviderType;
  ttsProvider: TTSProviderType;
  voiceProfile?: VoiceProfile;
  pushToTalk: boolean;
  vadEnabled: boolean;
  autoTranscribe: boolean;
  autoSpeak: boolean;
  // Elder-optimized settings
  elderMode?: boolean;
  visualFeedbackEnabled?: boolean;
}

/**
 * Default voice configuration
 */
export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  mode: 'text',
  sttProvider: 'browser',
  ttsProvider: 'browser',
  pushToTalk: true,
  vadEnabled: false,
  autoTranscribe: true,
  autoSpeak: false,
  elderMode: false,
  visualFeedbackEnabled: true,
};

// =============================================================================
// Voice Cloning Types
// =============================================================================

/**
 * Quality assessment for voice samples
 */
export interface QualityAssessment {
  overallScore: number;      // 0.0 - 1.0
  signalToNoise: number;
  clarity: number;
  consistency: number;
  duration: number;
  issues: QualityIssue[];
}

/**
 * Quality issue types
 */
export interface QualityIssue {
  type: 'noise' | 'clipping' | 'silence' | 'distortion' | 'echo' | 'too_short' | 'too_long';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp?: number;
}

/**
 * Consent record for voice cloning
 */
export interface ConsentRecord {
  granted: boolean;
  grantedAt: Date;
  scope: 'this-device' | 'cloud-processing' | 'full';
  expiresAt?: Date;
  revocable: boolean;
}

/**
 * Voice sample for cloning
 */
export interface VoiceSample {
  id: string;
  userId: string;
  audioBlob: Blob;
  duration: number;
  sampleRate: number;
  quality: QualityAssessment;
  transcript?: string;
  collectedAt: Date;
  source: 'passive' | 'explicit';
  consent: ConsentRecord;
}

/**
 * Clone readiness status
 */
export interface CloneReadiness {
  ready: boolean;
  totalDuration: number;
  requiredDuration: number;  // Minimum 30 seconds recommended
  qualityScore: number;
  sampleCount: number;
  recommendations: string[];
}

/**
 * Voice clone options
 */
export interface CloneOptions {
  provider: 'elevenlabs' | 'coqui' | 'custom';
  targetQuality: 'draft' | 'standard' | 'premium';
  characteristics?: string[];
}

/**
 * Voice clone result
 */
export interface VoiceClone {
  id: string;
  userId: string;
  name: string;
  provider: string;
  providerCloneId: string;
  createdAt: Date;
  updatedAt: Date;
  sampleIds: string[];
  quality: number;
  status: 'processing' | 'ready' | 'failed';
  voiceProfile: VoiceProfile;
}

// =============================================================================
// Memory Integration Types
// =============================================================================

/**
 * Voice interaction for memory storage
 */
export interface VoiceInteraction {
  id: string;
  timestamp: number;
  audioRef?: string;          // Reference to stored audio
  transcript: string;
  confidence: number;
  speaker: 'user' | 'agent';
  voiceProfile?: string;
  emotionalState?: EmotionalState;
  duration: number;
  metadata?: {
    sttProvider: STTProviderType;
    ttsProvider?: TTSProviderType;
    processingTimeMs: number;
  };
}

/**
 * Voice metrics for analytics
 */
export interface VoiceMetrics {
  speechRate: number;         // Words per minute
  pitchVariance: number;
  emotionalTone: string;
  clarity: number;
  averageConfidence: number;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Voice event types
 */
export type VoiceEventType = 
  | 'listening_started'
  | 'listening_stopped'
  | 'transcript_partial'
  | 'transcript_final'
  | 'synthesis_started'
  | 'synthesis_completed'
  | 'error'
  | 'voice_detected'
  | 'silence_detected';

/**
 * Voice event
 */
export interface VoiceEvent {
  type: VoiceEventType;
  timestamp: number;
  data?: {
    transcript?: string;
    confidence?: number;
    audioBlob?: AudioBlob;
    error?: string;
    provider?: STTProviderType | TTSProviderType;
  };
}

/**
 * Voice event handler
 */
export type VoiceEventHandler = (event: VoiceEvent) => void;