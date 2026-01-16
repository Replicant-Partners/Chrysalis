/**
 * Stuck Detector System
 *
 * Detects when agents are stuck in loops or making no progress.
 * Inspired by OpenHands V1 SDK stuck detection patterns.
 *
 * Detection Patterns:
 * 1. Action Repetition - Same action repeated N times
 * 2. Error Loop - Same error repeated N times
 * 3. Monologue - Agent talking without user input
 * 4. Alternating Pattern - A-B-A-B oscillation
 * 5. Context Overflow - Hitting token limits repeatedly
 *
 * @module experience/StuckDetector
 * @see https://github.com/OpenHands/software-agent-sdk
 */

import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

/**
 * Types of stuck patterns detected
 */
export type StuckLoopType =
  | 'action_repetition'
  | 'error_loop'
  | 'monologue'
  | 'alternating'
  | 'context_overflow'
  | 'progress_stall'
  | null;

/**
 * Severity levels for stuck detection
 */
export type StuckSeverity = 'warning' | 'critical' | 'terminal';

/**
 * Individual action/observation record
 */
export interface ActionRecord {
  type: 'action' | 'observation' | 'error' | 'user_input';
  content: string;
  timestamp: number;
  agentId?: string;
  tokenCount?: number;
  hash?: string; // For deduplication
}

/**
 * Analysis result from stuck detection
 */
export interface StuckAnalysis {
  isStuck: boolean;
  loopType: StuckLoopType;
  severity: StuckSeverity;
  repeatCount: number;
  startIndex: number;
  suggestion: string;
  patternDescription: string;
  affectedAgentIds: string[];
}

/**
 * Configuration for stuck detector
 */
export interface StuckDetectorConfig {
  /** How many repeated actions before detecting stuck (default: 3) */
  repeatThreshold: number;
  /** How many actions to track in history (default: 20) */
  historySize: number;
  /** How many agent turns without user input = monologue (default: 10) */
  monologueThreshold: number;
  /** How many context overflow errors = stuck (default: 2) */
  contextOverflowThreshold: number;
  /** Enable hash-based comparison for better matching (default: true) */
  useHashComparison: boolean;
  /** Similarity threshold for fuzzy matching (0-1, default: 0.85) */
  similarityThreshold: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

export const DEFAULT_STUCK_CONFIG: StuckDetectorConfig = {
  repeatThreshold: 3,
  historySize: 20,
  monologueThreshold: 10,
  contextOverflowThreshold: 2,
  useHashComparison: true,
  similarityThreshold: 0.85,
};

// =============================================================================
// Stuck Detector
// =============================================================================

/**
 * Detects when agents are stuck in loops
 */
export class StuckDetector extends EventEmitter {
  private history: ActionRecord[] = [];
  private config: StuckDetectorConfig;
  private lastUserInputIndex: number = -1;
  private contextOverflowCount: number = 0;

  constructor(config: Partial<StuckDetectorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_STUCK_CONFIG, ...config };
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Record a new action/observation
   */
  record(record: Omit<ActionRecord, 'timestamp' | 'hash'>): void {
    const fullRecord: ActionRecord = {
      ...record,
      timestamp: Date.now(),
      hash: this.hashContent(record.content),
    };

    this.history.push(fullRecord);

    // Track user input position
    if (record.type === 'user_input') {
      this.lastUserInputIndex = this.history.length - 1;
    }

    // Track context overflow errors
    if (
      record.type === 'error' &&
      /context.*(length|limit|overflow|exceeded)/i.test(record.content)
    ) {
      this.contextOverflowCount++;
    }

    // Trim history to configured size
    while (this.history.length > this.config.historySize) {
      this.history.shift();
      if (this.lastUserInputIndex >= 0) this.lastUserInputIndex--;
    }
  }

  /**
   * Analyze current history for stuck patterns
   */
  analyze(): StuckAnalysis {
    // Check patterns in order of severity

    // Pattern 5: Context Overflow (terminal)
    const contextOverflow = this.detectContextOverflow();
    if (contextOverflow.isStuck) return contextOverflow;

    // Pattern 2: Error Loop (critical)
    const errorLoop = this.detectErrorLoop();
    if (errorLoop.isStuck) return errorLoop;

    // Pattern 1: Action Repetition (critical)
    const actionRepetition = this.detectActionRepetition();
    if (actionRepetition.isStuck) return actionRepetition;

    // Pattern 4: Alternating Pattern (warning)
    const alternating = this.detectAlternatingPattern();
    if (alternating.isStuck) return alternating;

    // Pattern 3: Monologue (warning)
    const monologue = this.detectMonologue();
    if (monologue.isStuck) return monologue;

    // Pattern 6: Progress Stall (warning)
    const stall = this.detectProgressStall();
    if (stall.isStuck) return stall;

    // Not stuck
    return {
      isStuck: false,
      loopType: null,
      severity: 'warning',
      repeatCount: 0,
      startIndex: -1,
      suggestion: '',
      patternDescription: 'No stuck pattern detected',
      affectedAgentIds: [],
    };
  }

  /**
   * Quick check if currently stuck
   */
  isStuck(): boolean {
    return this.analyze().isStuck;
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.history = [];
    this.lastUserInputIndex = -1;
    this.contextOverflowCount = 0;
  }

  /**
   * Get current history (for debugging)
   */
  getHistory(): readonly ActionRecord[] {
    return this.history;
  }

  // ===========================================================================
  // Detection Patterns
  // ===========================================================================

  /**
   * Pattern 1: Same action repeated N times
   */
  private detectActionRepetition(): StuckAnalysis {
    if (this.history.length < this.config.repeatThreshold) {
      return this.notStuck();
    }

    const recentActions = this.history
      .filter(r => r.type === 'action')
      .slice(-this.config.repeatThreshold);

    if (recentActions.length < this.config.repeatThreshold) {
      return this.notStuck();
    }

    const firstHash = recentActions[0].hash;
    const allSame = recentActions.every(r =>
      this.config.useHashComparison
        ? r.hash === firstHash
        : this.isSimilar(r.content, recentActions[0].content)
    );

    if (allSame) {
      const affectedAgents = Array.from(new Set(recentActions.map(r => r.agentId).filter(Boolean))) as string[];
      return {
        isStuck: true,
        loopType: 'action_repetition',
        severity: 'critical',
        repeatCount: this.config.repeatThreshold,
        startIndex: this.history.length - this.config.repeatThreshold,
        suggestion: 'Try a different approach or rephrase the request',
        patternDescription: `Same action repeated ${this.config.repeatThreshold} times`,
        affectedAgentIds: affectedAgents,
      };
    }

    return this.notStuck();
  }

  /**
   * Pattern 2: Same error repeated N times
   */
  private detectErrorLoop(): StuckAnalysis {
    const recentErrors = this.history
      .filter(r => r.type === 'error')
      .slice(-this.config.repeatThreshold);

    if (recentErrors.length < this.config.repeatThreshold) {
      return this.notStuck();
    }

    const firstHash = recentErrors[0].hash;
    const allSame = recentErrors.every(r =>
      this.config.useHashComparison
        ? r.hash === firstHash
        : this.isSimilar(r.content, recentErrors[0].content)
    );

    if (allSame) {
      const affectedAgents = Array.from(new Set(recentErrors.map(r => r.agentId).filter(Boolean))) as string[];
      return {
        isStuck: true,
        loopType: 'error_loop',
        severity: 'critical',
        repeatCount: recentErrors.length,
        startIndex: this.history.indexOf(recentErrors[0]),
        suggestion: 'Recurring error - consider debugging or switching approach',
        patternDescription: `Same error repeated ${recentErrors.length} times: "${this.summarize(recentErrors[0].content)}"`,
        affectedAgentIds: affectedAgents,
      };
    }

    return this.notStuck();
  }

  /**
   * Pattern 3: Agent monologue without user input
   */
  private detectMonologue(): StuckAnalysis {
    const actionsSinceUser =
      this.lastUserInputIndex >= 0
        ? this.history.length - 1 - this.lastUserInputIndex
        : this.history.length;

    const agentActions = this.history
      .slice(this.lastUserInputIndex + 1)
      .filter(r => r.type === 'action' || r.type === 'observation');

    if (agentActions.length >= this.config.monologueThreshold) {
      const affectedAgents = Array.from(new Set(agentActions.map(r => r.agentId).filter(Boolean))) as string[];
      return {
        isStuck: true,
        loopType: 'monologue',
        severity: 'warning',
        repeatCount: agentActions.length,
        startIndex: this.lastUserInputIndex + 1,
        suggestion: 'Agent has been working alone for a while - consider checking progress',
        patternDescription: `${agentActions.length} agent actions without user input`,
        affectedAgentIds: affectedAgents,
      };
    }

    return this.notStuck();
  }

  /**
   * Pattern 4: A-B-A-B alternating pattern
   */
  private detectAlternatingPattern(): StuckAnalysis {
    if (this.history.length < 6) return this.notStuck();

    const recent = this.history.slice(-6);
    const hashes = recent.map(r => r.hash);

    // Check for A-B-A-B-A-B pattern
    if (
      hashes[0] === hashes[2] &&
      hashes[2] === hashes[4] &&
      hashes[1] === hashes[3] &&
      hashes[3] === hashes[5] &&
      hashes[0] !== hashes[1]
    ) {
      const affectedAgents = Array.from(new Set(recent.map(r => r.agentId).filter(Boolean))) as string[];
      return {
        isStuck: true,
        loopType: 'alternating',
        severity: 'warning',
        repeatCount: 3,
        startIndex: this.history.length - 6,
        suggestion: 'Agent alternating between two states - try breaking the cycle',
        patternDescription: 'A-B-A-B alternating pattern detected',
        affectedAgentIds: affectedAgents,
      };
    }

    return this.notStuck();
  }

  /**
   * Pattern 5: Context overflow errors
   */
  private detectContextOverflow(): StuckAnalysis {
    if (this.contextOverflowCount >= this.config.contextOverflowThreshold) {
      return {
        isStuck: true,
        loopType: 'context_overflow',
        severity: 'terminal',
        repeatCount: this.contextOverflowCount,
        startIndex: -1,
        suggestion: 'Context window exceeded - apply context condensation or start fresh',
        patternDescription: `Context overflow errors: ${this.contextOverflowCount}`,
        affectedAgentIds: [],
      };
    }

    return this.notStuck();
  }

  /**
   * Pattern 6: No meaningful progress
   */
  private detectProgressStall(): StuckAnalysis {
    if (this.history.length < 10) return this.notStuck();

    const recent = this.history.slice(-10);

    // Check if all recent actions are very short (< 50 chars) = no real work
    const shortActions = recent.filter(
      r => r.type === 'action' && r.content.length < 50
    );

    if (shortActions.length >= 8) {
      const affectedAgents = Array.from(new Set(recent.map(r => r.agentId).filter(Boolean))) as string[];
      return {
        isStuck: true,
        loopType: 'progress_stall',
        severity: 'warning',
        repeatCount: shortActions.length,
        startIndex: this.history.length - 10,
        suggestion: 'Agent making minimal progress - may need guidance or different task',
        patternDescription: 'Minimal progress detected - mostly short actions',
        affectedAgentIds: affectedAgents,
      };
    }

    return this.notStuck();
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  private notStuck(): StuckAnalysis {
    return {
      isStuck: false,
      loopType: null,
      severity: 'warning',
      repeatCount: 0,
      startIndex: -1,
      suggestion: '',
      patternDescription: '',
      affectedAgentIds: [],
    };
  }

  /**
   * Simple hash function for content comparison
   */
  private hashContent(content: string): string {
    // Normalize: lowercase, remove extra whitespace, remove timestamps/ids
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\b\d{10,}\b/g, '') // Remove timestamps
      .replace(/\b[a-f0-9-]{36}\b/g, '') // Remove UUIDs
      .trim();

    // Simple hash
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Check if two strings are similar (for fuzzy matching)
   */
  private isSimilar(a: string, b: string): boolean {
    if (a === b) return true;

    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return true;

    // Use Jaccard similarity on word sets
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set(Array.from(wordsA).filter(x => wordsB.has(x)));
    const union = new Set(Array.from(wordsA).concat(Array.from(wordsB)));

    const similarity = intersection.size / union.size;
    return similarity >= this.config.similarityThreshold;
  }

  /**
   * Summarize content for display
   */
  private summarize(content: string, maxLen: number = 50): string {
    if (content.length <= maxLen) return content;
    return content.slice(0, maxLen - 3) + '...';
  }
}

// =============================================================================
// Integration with OODA Recorder
// =============================================================================

/**
 * Adapter to integrate StuckDetector with OODARecorder
 */
export class OODAStuckAdapter {
  private detector: StuckDetector;

  constructor(detector: StuckDetector) {
    this.detector = detector;
  }

  /**
   * Record an OODA cycle observation
   */
  recordOODAObserve(observation: string, agentId?: string): void {
    this.detector.record({
      type: 'observation',
      content: observation,
      agentId,
    });
  }

  /**
   * Record an OODA cycle action
   */
  recordOODAAction(action: string, agentId?: string): void {
    this.detector.record({
      type: 'action',
      content: action,
      agentId,
    });
  }

  /**
   * Record an error during OODA cycle
   */
  recordOODAError(error: string, agentId?: string): void {
    this.detector.record({
      type: 'error',
      content: error,
      agentId,
    });
  }

  /**
   * Record user input (breaks monologue detection)
   */
  recordUserInput(input: string): void {
    this.detector.record({
      type: 'user_input',
      content: input,
    });
  }
}

// =============================================================================
// (Exports are inline with class definitions above)
// =============================================================================
