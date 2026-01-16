/**
 * Context Condenser System
 *
 * Provides context compression strategies to manage LLM token budgets.
 * Inspired by OpenHands V1 SDK condenser patterns.
 *
 * Key Strategies:
 * - WindowCondenser: Sliding window of recent messages
 * - SummarizingCondenser: LLM-based summarization
 * - ImportanceCondenser: Attention-based filtering
 * - PipelineCondenser: Chain multiple strategies
 *
 * @module experience/ContextCondenser
 * @see https://github.com/OpenHands/software-agent-sdk
 */

import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

/**
 * Message format for condenser input/output
 */
export interface CondenserMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: number;
  metadata?: {
    tokenCount?: number;
    importance?: number;
    isToolResult?: boolean;
    agentId?: string;
  };
}

/**
 * Result of condensation operation
 */
export interface CondensationResult {
  messages: CondenserMessage[];
  originalCount: number;
  condensedCount: number;
  estimatedTokensSaved: number;
  strategy: string;
  processingTimeMs: number;
}

/**
 * Configuration for condensers
 */
export interface CondenserConfig {
  maxTokens?: number;
  maxMessages?: number;
  preserveSystemMessages?: boolean;
  preserveRecentCount?: number;
  summaryMaxTokens?: number;
}

/**
 * LLM interface for summarization
 */
export interface LLMSummarizer {
  summarize(messages: CondenserMessage[], maxTokens: number): Promise<string>;
}

// =============================================================================
// Base Condenser Interface
// =============================================================================

/**
 * Base interface for all condensers
 */
export interface Condenser {
  readonly name: string;
  condense(messages: CondenserMessage[], config?: CondenserConfig): Promise<CondensationResult>;
}

// =============================================================================
// Window Condenser
// =============================================================================

/**
 * Sliding window condenser - keeps N most recent messages
 * Simple but effective for most use cases
 */
export class WindowCondenser implements Condenser {
  readonly name = 'window';
  private windowSize: number;
  private preserveSystem: boolean;

  constructor(windowSize: number = 50, preserveSystem: boolean = true) {
    this.windowSize = windowSize;
    this.preserveSystem = preserveSystem;
  }

  async condense(
    messages: CondenserMessage[],
    config?: CondenserConfig
  ): Promise<CondensationResult> {
    const startTime = Date.now();
    const maxMessages = config?.maxMessages ?? this.windowSize;
    const preserveSystem = config?.preserveSystemMessages ?? this.preserveSystem;

    // Separate system messages
    const systemMessages = preserveSystem
      ? messages.filter(m => m.role === 'system')
      : [];
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // Calculate how many non-system messages we can keep
    const allowedNonSystem = Math.max(0, maxMessages - systemMessages.length);

    // Keep most recent non-system messages
    const recentMessages = nonSystemMessages.slice(-allowedNonSystem);

    // Combine: system messages first, then recent
    const condensed = [...systemMessages, ...recentMessages];

    const estimatedTokensSaved = this.estimateTokens(messages) - this.estimateTokens(condensed);

    return {
      messages: condensed,
      originalCount: messages.length,
      condensedCount: condensed.length,
      estimatedTokensSaved,
      strategy: this.name,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private estimateTokens(messages: CondenserMessage[]): number {
    // Rough estimate: 4 chars per token
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }
}

// =============================================================================
// Importance Condenser
// =============================================================================

/**
 * Filters messages by importance score
 * Keeps messages above threshold or with explicit importance markers
 */
export class ImportanceCondenser implements Condenser {
  readonly name = 'importance';
  private threshold: number;

  constructor(threshold: number = 0.5) {
    this.threshold = threshold;
  }

  async condense(
    messages: CondenserMessage[],
    config?: CondenserConfig
  ): Promise<CondensationResult> {
    const startTime = Date.now();

    // Score each message
    const scored = messages.map(m => ({
      message: m,
      score: this.scoreMessage(m),
    }));

    // Keep messages above threshold, always keep system and tool results
    const condensed = scored
      .filter(
        s =>
          s.score >= this.threshold ||
          s.message.role === 'system' ||
          s.message.metadata?.isToolResult
      )
      .map(s => s.message);

    const estimatedTokensSaved = this.estimateTokens(messages) - this.estimateTokens(condensed);

    return {
      messages: condensed,
      originalCount: messages.length,
      condensedCount: condensed.length,
      estimatedTokensSaved,
      strategy: this.name,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private scoreMessage(message: CondenserMessage): number {
    // Use provided importance or calculate heuristically
    if (message.metadata?.importance !== undefined) {
      return message.metadata.importance;
    }

    let score = 0.5; // Base score

    // Boost for system messages
    if (message.role === 'system') score += 0.4;

    // Boost for tool results
    if (message.metadata?.isToolResult) score += 0.3;

    // Boost for longer content (likely more informative)
    if (message.content.length > 500) score += 0.1;

    // Boost for questions (likely need response)
    if (message.content.includes('?')) score += 0.1;

    // Boost for code blocks
    if (message.content.includes('```')) score += 0.15;

    // Boost for error indicators
    if (/error|exception|fail/i.test(message.content)) score += 0.2;

    return Math.min(1, score);
  }

  private estimateTokens(messages: CondenserMessage[]): number {
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }
}

// =============================================================================
// Summarizing Condenser
// =============================================================================

/**
 * Uses LLM to summarize older messages
 * Keeps recent messages intact, summarizes history
 */
export class SummarizingCondenser implements Condenser {
  readonly name = 'summarizing';
  private llm: LLMSummarizer;
  private recentCount: number;
  private summaryMaxTokens: number;

  constructor(llm: LLMSummarizer, recentCount: number = 10, summaryMaxTokens: number = 500) {
    this.llm = llm;
    this.recentCount = recentCount;
    this.summaryMaxTokens = summaryMaxTokens;
  }

  async condense(
    messages: CondenserMessage[],
    config?: CondenserConfig
  ): Promise<CondensationResult> {
    const startTime = Date.now();
    const recentCount = config?.preserveRecentCount ?? this.recentCount;
    const maxSummaryTokens = config?.summaryMaxTokens ?? this.summaryMaxTokens;

    // Separate system messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // If not enough messages, no need to summarize
    if (nonSystemMessages.length <= recentCount + 2) {
      return {
        messages,
        originalCount: messages.length,
        condensedCount: messages.length,
        estimatedTokensSaved: 0,
        strategy: this.name,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Split into history (to summarize) and recent (to keep)
    const historyMessages = nonSystemMessages.slice(0, -recentCount);
    const recentMessages = nonSystemMessages.slice(-recentCount);

    // Summarize history
    const summary = await this.llm.summarize(historyMessages, maxSummaryTokens);

    // Create summary message
    const summaryMessage: CondenserMessage = {
      role: 'assistant',
      content: `[Conversation Summary]\n${summary}`,
      timestamp: Date.now(),
      metadata: {
        importance: 0.8,
      },
    };

    // Combine: system + summary + recent
    const condensed = [...systemMessages, summaryMessage, ...recentMessages];

    const estimatedTokensSaved = this.estimateTokens(messages) - this.estimateTokens(condensed);

    return {
      messages: condensed,
      originalCount: messages.length,
      condensedCount: condensed.length,
      estimatedTokensSaved,
      strategy: this.name,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private estimateTokens(messages: CondenserMessage[]): number {
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }
}

// =============================================================================
// Amortized Forgetting Condenser
// =============================================================================

/**
 * Gradually reduces detail in older messages
 * More recent = more detail, older = less detail
 */
export class AmortizedForgettingCondenser implements Condenser {
  readonly name = 'amortized_forgetting';
  private decayFactor: number;

  constructor(decayFactor: number = 0.8) {
    this.decayFactor = decayFactor;
  }

  async condense(
    messages: CondenserMessage[],
    config?: CondenserConfig
  ): Promise<CondensationResult> {
    const startTime = Date.now();

    // Process messages from oldest to newest
    const condensed = messages.map((msg, index) => {
      // System messages preserved fully
      if (msg.role === 'system') return msg;

      // Calculate how much to keep based on position
      // Position 0 = oldest, gets most truncated
      const position = index / messages.length;
      const keepRatio = Math.pow(this.decayFactor, (1 - position) * 3);

      if (keepRatio >= 0.9) {
        // Keep full content
        return msg;
      }

      // Truncate content based on keep ratio
      const targetLength = Math.max(50, Math.floor(msg.content.length * keepRatio));
      const truncatedContent = this.truncateContent(msg.content, targetLength);

      return {
        ...msg,
        content: truncatedContent,
        metadata: {
          ...msg.metadata,
          truncated: true,
          originalLength: msg.content.length,
        },
      };
    });

    const estimatedTokensSaved = this.estimateTokens(messages) - this.estimateTokens(condensed);

    return {
      messages: condensed,
      originalCount: messages.length,
      condensedCount: condensed.length,
      estimatedTokensSaved,
      strategy: this.name,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    // Try to truncate at sentence boundary
    const truncated = content.slice(0, maxLength);
    const lastSentence = truncated.lastIndexOf('. ');
    if (lastSentence > maxLength * 0.6) {
      return truncated.slice(0, lastSentence + 1) + ' [...]';
    }

    return truncated + ' [...]';
  }

  private estimateTokens(messages: CondenserMessage[]): number {
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }
}

// =============================================================================
// Pipeline Condenser
// =============================================================================

/**
 * Chains multiple condensers together
 * Each condenser processes the output of the previous one
 */
export class PipelineCondenser implements Condenser {
  readonly name = 'pipeline';
  private condensers: Condenser[];
  private eventEmitter: EventEmitter;

  constructor(condensers: Condenser[]) {
    this.condensers = condensers;
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Add listener for stage completion events
   */
  onStageComplete(listener: (stage: string, result: CondensationResult) => void): void {
    this.eventEmitter.on('stageComplete', listener);
  }

  async condense(
    messages: CondenserMessage[],
    config?: CondenserConfig
  ): Promise<CondensationResult> {
    const startTime = Date.now();
    let currentMessages = messages;
    let totalTokensSaved = 0;
    const stageResults: string[] = [];

    for (const condenser of this.condensers) {
      const result = await condenser.condense(currentMessages, config);
      currentMessages = result.messages;
      totalTokensSaved += result.estimatedTokensSaved;
      stageResults.push(`${condenser.name}(${result.condensedCount})`);

      this.eventEmitter.emit('stageComplete', condenser.name, result);
    }

    return {
      messages: currentMessages,
      originalCount: messages.length,
      condensedCount: currentMessages.length,
      estimatedTokensSaved: totalTokensSaved,
      strategy: `pipeline[${stageResults.join(' → ')}]`,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// =============================================================================
// No-Op Condenser
// =============================================================================

/**
 * Passthrough condenser - does nothing
 * Useful for testing or when condensation should be disabled
 */
export class NoOpCondenser implements Condenser {
  readonly name = 'noop';

  async condense(messages: CondenserMessage[]): Promise<CondensationResult> {
    return {
      messages,
      originalCount: messages.length,
      condensedCount: messages.length,
      estimatedTokensSaved: 0,
      strategy: this.name,
      processingTimeMs: 0,
    };
  }
}

// =============================================================================
// Condenser Factory
// =============================================================================

export type CondenserType =
  | 'window'
  | 'importance'
  | 'summarizing'
  | 'amortized_forgetting'
  | 'pipeline'
  | 'noop';

export interface CondenserFactoryOptions {
  type: CondenserType;
  windowSize?: number;
  importanceThreshold?: number;
  llm?: LLMSummarizer;
  recentCount?: number;
  summaryMaxTokens?: number;
  decayFactor?: number;
  pipelineStages?: CondenserType[];
}

/**
 * Factory for creating condensers
 */
export function createCondenser(options: CondenserFactoryOptions): Condenser {
  switch (options.type) {
    case 'window':
      return new WindowCondenser(options.windowSize ?? 50);

    case 'importance':
      return new ImportanceCondenser(options.importanceThreshold ?? 0.5);

    case 'summarizing':
      if (!options.llm) {
        throw new Error('SummarizingCondenser requires an LLM');
      }
      return new SummarizingCondenser(
        options.llm,
        options.recentCount ?? 10,
        options.summaryMaxTokens ?? 500
      );

    case 'amortized_forgetting':
      return new AmortizedForgettingCondenser(options.decayFactor ?? 0.8);

    case 'pipeline':
      if (!options.pipelineStages || options.pipelineStages.length === 0) {
        throw new Error('PipelineCondenser requires pipelineStages');
      }
      const stages = options.pipelineStages.map(stage =>
        createCondenser({ ...options, type: stage })
      );
      return new PipelineCondenser(stages);

    case 'noop':
    default:
      return new NoOpCondenser();
  }
}

// =============================================================================
// Default Condenser Pipeline
// =============================================================================

/**
 * Creates a recommended default pipeline for multi-agent conversations
 */
export function createDefaultCondenser(llm?: LLMSummarizer): Condenser {
  const stages: Condenser[] = [
    // Stage 1: Filter by importance (remove low-value messages)
    new ImportanceCondenser(0.3),

    // Stage 2: Gradual forgetting (truncate old messages)
    new AmortizedForgettingCondenser(0.85),

    // Stage 3: Window limit (hard cap on message count)
    new WindowCondenser(100),
  ];

  // If LLM available, add summarization for very long conversations
  if (llm) {
    stages.push(new SummarizingCondenser(llm, 15, 800));
  }

  return new PipelineCondenser(stages);
}

// =============================================================================
// (Exports are inline with class definitions above)
// =============================================================================
