/**
 * Agent Communication Component
 * 
 * Manages communication style, voice configuration, and signature phrases.
 * 
 * Single Responsibility: Communication style and voice management
 */

/**
 * Voice configuration
 */
export interface VoiceConfig {
  model?: string;
  speaker?: string;
  characteristics?: string[];
  speed?: number;
  pitch?: number;
}

/**
 * Communication style data
 */
export interface AgentCommunicationData {
  /** Style guidelines by context */
  style: {
    all: string[];
    [context: string]: string[];
  };
  /** Signature phrases */
  signature_phrases?: string[];
  /** Voice configuration */
  voice?: VoiceConfig;
}

/**
 * Communication context
 */
export type CommunicationContext = 
  | 'all'
  | 'work'
  | 'conversational'
  | 'social'
  | 'introspective'
  | 'technical'
  | 'creative';

/**
 * Agent Communication Manager
 * 
 * Handles communication style, context-specific guidelines, and voice.
 */
export class AgentCommunication {
  private data: AgentCommunicationData;

  constructor(data?: Partial<AgentCommunicationData>) {
    this.data = {
      style: data?.style || { all: [] },
      signature_phrases: data?.signature_phrases,
      voice: data?.voice,
    };
  }

  /**
   * Add a style guideline
   */
  addStyleGuideline(guideline: string, context: CommunicationContext = 'all'): void {
    if (!this.data.style[context]) {
      this.data.style[context] = [];
    }
    if (!this.data.style[context].includes(guideline)) {
      this.data.style[context].push(guideline);
    }
  }

  /**
   * Remove a style guideline
   */
  removeStyleGuideline(guideline: string, context: CommunicationContext = 'all'): void {
    if (this.data.style[context]) {
      const index = this.data.style[context].indexOf(guideline);
      if (index !== -1) {
        this.data.style[context].splice(index, 1);
      }
    }
  }

  /**
   * Get style guidelines for a context
   */
  getStyleGuidelines(context: CommunicationContext = 'all'): string[] {
    const contextGuidelines = this.data.style[context] || [];
    const allGuidelines = this.data.style.all || [];
    
    // Combine context-specific with general guidelines
    return [...new Set([...allGuidelines, ...contextGuidelines])];
  }

  /**
   * Add a signature phrase
   */
  addSignaturePhrase(phrase: string): void {
    if (!this.data.signature_phrases) {
      this.data.signature_phrases = [];
    }
    if (!this.data.signature_phrases.includes(phrase)) {
      this.data.signature_phrases.push(phrase);
    }
  }

  /**
   * Get a random signature phrase
   */
  getRandomSignaturePhrase(): string | null {
    if (!this.data.signature_phrases || this.data.signature_phrases.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * this.data.signature_phrases.length);
    return this.data.signature_phrases[index];
  }

  /**
   * Set voice configuration
   */
  setVoice(voice: VoiceConfig): void {
    this.data.voice = voice;
  }

  /**
   * Get voice configuration with emotional modifiers
   */
  getVoiceWithEmotion(emotion?: { speed: number; pitch: number }): VoiceConfig | undefined {
    if (!this.data.voice) return undefined;

    if (!emotion) return this.data.voice;

    return {
      ...this.data.voice,
      speed: (this.data.voice.speed || 1.0) * emotion.speed,
      pitch: (this.data.voice.pitch || 1.0) * emotion.pitch,
    };
  }

  /**
   * Generate system prompt from communication style
   */
  generateSystemPromptSection(): string {
    const lines: string[] = [];

    const allGuidelines = this.getStyleGuidelines('all');
    if (allGuidelines.length > 0) {
      lines.push('Communication Guidelines:');
      allGuidelines.forEach(g => lines.push(`- ${g}`));
    }

    if (this.data.signature_phrases && this.data.signature_phrases.length > 0) {
      lines.push('');
      lines.push('Signature phrases you may use:');
      this.data.signature_phrases.slice(0, 3).forEach(p => lines.push(`- "${p}"`));
    }

    return lines.join('\n');
  }

  // Getters
  get style(): AgentCommunicationData['style'] { return this.data.style; }
  get signaturePhrases(): readonly string[] | undefined { return this.data.signature_phrases; }
  get voice(): VoiceConfig | undefined { return this.data.voice; }

  /**
   * Export communication data
   */
  toData(): AgentCommunicationData {
    return { ...this.data };
  }

  /**
   * Merge with another communication config
   */
  merge(other: AgentCommunication): void {
    // Merge style guidelines
    for (const [context, guidelines] of Object.entries(other.data.style)) {
      guidelines.forEach(g => this.addStyleGuideline(g, context as CommunicationContext));
    }

    // Merge signature phrases
    if (other.data.signature_phrases) {
      other.data.signature_phrases.forEach(p => this.addSignaturePhrase(p));
    }

    // Keep existing voice config (don't merge)
  }
}

/**
 * Validate communication data structure
 */
export function validateCommunication(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Communication must be an object'] };
  }

  const comm = data as Record<string, unknown>;

  if (!comm.style || typeof comm.style !== 'object') {
    errors.push('Communication must have style object');
  } else {
    const style = comm.style as Record<string, unknown>;
    if (!Array.isArray(style.all)) {
      errors.push('Communication style must have "all" array');
    }
  }

  return { valid: errors.length === 0, errors };
}
