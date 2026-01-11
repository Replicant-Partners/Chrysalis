/**
 * Agent Personality Component
 * 
 * Manages the evolving personality traits of an agent.
 * Personality can change over time through experience and learning.
 * 
 * Single Responsibility: Personality trait management and evolution
 */

/**
 * Emotional range configuration
 */
export interface EmotionalRange {
  triggers: string[];
  expressions: string[];
  voice?: {
    speed: number;
    pitch: number;
  };
}

/**
 * Personality data structure
 */
export interface AgentPersonalityData {
  /** Core personality traits */
  core_traits: string[];
  /** Values and principles */
  values: string[];
  /** Quirks and idiosyncrasies */
  quirks: string[];
  /** Fears and concerns */
  fears?: string[];
  /** Goals and aspirations */
  aspirations?: string[];
  /** Emotional response patterns */
  emotional_ranges?: Record<string, EmotionalRange>;
}

/**
 * Personality evolution event
 */
export interface PersonalityEvolution {
  timestamp: string;
  type: 'trait_added' | 'trait_removed' | 'value_changed' | 'quirk_added';
  field: string;
  value: string;
  source: string;
  reason?: string;
}

/**
 * Agent Personality Manager
 * 
 * Handles personality traits, values, and their evolution over time.
 */
export class AgentPersonality {
  private data: AgentPersonalityData;
  private evolutionHistory: PersonalityEvolution[] = [];

  constructor(data?: Partial<AgentPersonalityData>) {
    this.data = {
      core_traits: data?.core_traits || [],
      values: data?.values || [],
      quirks: data?.quirks || [],
      fears: data?.fears,
      aspirations: data?.aspirations,
      emotional_ranges: data?.emotional_ranges,
    };
  }

  /**
   * Add a core trait
   */
  addTrait(trait: string, source: string = 'system'): void {
    if (!this.data.core_traits.includes(trait)) {
      this.data.core_traits.push(trait);
      this.recordEvolution('trait_added', 'core_traits', trait, source);
    }
  }

  /**
   * Remove a core trait
   */
  removeTrait(trait: string, source: string = 'system'): void {
    const index = this.data.core_traits.indexOf(trait);
    if (index !== -1) {
      this.data.core_traits.splice(index, 1);
      this.recordEvolution('trait_removed', 'core_traits', trait, source);
    }
  }

  /**
   * Add a value
   */
  addValue(value: string, source: string = 'system'): void {
    if (!this.data.values.includes(value)) {
      this.data.values.push(value);
      this.recordEvolution('value_changed', 'values', value, source);
    }
  }

  /**
   * Add a quirk
   */
  addQuirk(quirk: string, source: string = 'system'): void {
    if (!this.data.quirks.includes(quirk)) {
      this.data.quirks.push(quirk);
      this.recordEvolution('quirk_added', 'quirks', quirk, source);
    }
  }

  /**
   * Set emotional range for an emotion
   */
  setEmotionalRange(emotion: string, range: EmotionalRange): void {
    if (!this.data.emotional_ranges) {
      this.data.emotional_ranges = {};
    }
    this.data.emotional_ranges[emotion] = range;
  }

  /**
   * Get emotional response for a trigger
   */
  getEmotionalResponse(trigger: string): { emotion: string; range: EmotionalRange } | null {
    if (!this.data.emotional_ranges) return null;

    for (const [emotion, range] of Object.entries(this.data.emotional_ranges)) {
      if (range.triggers.some(t => trigger.toLowerCase().includes(t.toLowerCase()))) {
        return { emotion, range };
      }
    }
    return null;
  }

  /**
   * Check if agent has a specific trait
   */
  hasTrait(trait: string): boolean {
    return this.data.core_traits.some(t => 
      t.toLowerCase() === trait.toLowerCase()
    );
  }

  /**
   * Get trait compatibility score with another personality
   */
  getCompatibility(other: AgentPersonality): number {
    const sharedTraits = this.data.core_traits.filter(t => 
      other.data.core_traits.includes(t)
    );
    const sharedValues = this.data.values.filter(v => 
      other.data.values.includes(v)
    );

    const totalUnique = new Set([
      ...this.data.core_traits,
      ...other.data.core_traits,
      ...this.data.values,
      ...other.data.values,
    ]).size;

    if (totalUnique === 0) return 0.5;

    return (sharedTraits.length + sharedValues.length) / totalUnique;
  }

  /**
   * Record personality evolution
   */
  private recordEvolution(
    type: PersonalityEvolution['type'],
    field: string,
    value: string,
    source: string
  ): void {
    this.evolutionHistory.push({
      timestamp: new Date().toISOString(),
      type,
      field,
      value,
      source,
    });
  }

  // Getters
  get traits(): readonly string[] { return this.data.core_traits; }
  get values(): readonly string[] { return this.data.values; }
  get quirks(): readonly string[] { return this.data.quirks; }
  get fears(): readonly string[] | undefined { return this.data.fears; }
  get aspirations(): readonly string[] | undefined { return this.data.aspirations; }
  get emotionalRanges(): Record<string, EmotionalRange> | undefined { 
    return this.data.emotional_ranges; 
  }
  get history(): readonly PersonalityEvolution[] { return this.evolutionHistory; }

  /**
   * Export personality data
   */
  toData(): AgentPersonalityData {
    return { ...this.data };
  }

  /**
   * Merge with another personality (for experience sync)
   */
  merge(other: AgentPersonality, strategy: 'union' | 'intersection' = 'union'): void {
    if (strategy === 'union') {
      // Add all unique traits from other
      other.data.core_traits.forEach(t => this.addTrait(t, 'merge'));
      other.data.values.forEach(v => this.addValue(v, 'merge'));
      other.data.quirks.forEach(q => this.addQuirk(q, 'merge'));
    } else {
      // Keep only shared traits
      this.data.core_traits = this.data.core_traits.filter(t => 
        other.data.core_traits.includes(t)
      );
      this.data.values = this.data.values.filter(v => 
        other.data.values.includes(v)
      );
    }
  }
}

/**
 * Validate personality data structure
 */
export function validatePersonality(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Personality must be an object'] };
  }

  const personality = data as Record<string, unknown>;

  if (!Array.isArray(personality.core_traits)) {
    errors.push('Personality must have core_traits array');
  }

  if (!Array.isArray(personality.values)) {
    errors.push('Personality must have values array');
  }

  return { valid: errors.length === 0, errors };
}
