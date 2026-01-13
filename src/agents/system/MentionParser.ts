/**
 * MentionParser
 *
 * Parses @mentions from user messages to route them to the appropriate
 * system agent persona or evaluation pipeline.
 *
 * Supported mentions:
 * - @ada - Route to Ada (Algorithmic Architect)
 * - @lea - Route to Lea (Implementation Reviewer)
 * - @phil - Route to Phil (Forecast Analyst)
 * - @david - Route to David (Metacognitive Guardian)
 * - @evaluate - Run full evaluation pipeline
 *
 * @module agents/system/MentionParser
 */

import {
  SystemAgentPersonaId,
  ParsedMention,
  RoutingResult,
  PERSONA_IDS,
  EVALUATION_PIPELINE_ORDER,
} from './types';

// =============================================================================
// Constants
// =============================================================================

/**
 * Regex pattern for matching @mentions
 * Matches: @ada, @lea, @phil, @david, @evaluate
 * Case insensitive, must be at word boundary
 */
const MENTION_PATTERN = /@(ada|lea|phil|david|evaluate)\b/gi;

/**
 * Valid mention targets
 */
const VALID_MENTIONS = new Set(['ada', 'lea', 'phil', 'david', 'evaluate']);

// =============================================================================
// MentionParser Class
// =============================================================================

export interface MentionParserConfig {
  /** Whether to allow multiple mentions in a single message */
  allowMultipleMentions?: boolean;

  /** Whether to default to @evaluate when no mention is present */
  defaultToEvaluate?: boolean;

  /** Whether to strip mentions from the content */
  stripMentions?: boolean;

  /** Custom mention prefix (default: @) */
  mentionPrefix?: string;
}

const DEFAULT_CONFIG: Required<MentionParserConfig> = {
  allowMultipleMentions: true,
  defaultToEvaluate: false,
  stripMentions: true,
  mentionPrefix: '@',
};

/**
 * Parser for @-mention routing in chat messages
 */
export class MentionParser {
  private config: Required<MentionParserConfig>;

  constructor(config?: MentionParserConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Main Parsing Methods
  // ===========================================================================

  /**
   * Parse a message and extract routing information
   */
  parse(content: string): RoutingResult {
    const mentions = this.extractMentions(content);
    const cleanContent = this.config.stripMentions
      ? this.stripMentionsFromContent(content, mentions)
      : content;

    // Determine targets
    let targets: SystemAgentPersonaId[] = [];
    let runPipeline = false;

    if (mentions.length === 0) {
      // No mentions - use default behavior
      if (this.config.defaultToEvaluate) {
        runPipeline = true;
        targets = [...EVALUATION_PIPELINE_ORDER];
      }
    } else {
      // Process mentions
      for (const mention of mentions) {
        if (mention.personaId === 'evaluate') {
          runPipeline = true;
          targets = [...EVALUATION_PIPELINE_ORDER];
          break; // @evaluate overrides other mentions
        } else if (PERSONA_IDS.includes(mention.personaId as SystemAgentPersonaId)) {
          if (!targets.includes(mention.personaId as SystemAgentPersonaId)) {
            targets.push(mention.personaId as SystemAgentPersonaId);
          }
        }
      }

      // If not allowing multiple mentions, take only the first
      if (!this.config.allowMultipleMentions && targets.length > 1) {
        targets = [targets[0]];
      }
    }

    return {
      targets,
      runPipeline,
      cleanContent: cleanContent.trim(),
      mentions,
    };
  }

  /**
   * Extract all mentions from content
   */
  extractMentions(content: string): ParsedMention[] {
    const mentions: ParsedMention[] = [];
    const regex = new RegExp(MENTION_PATTERN);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const personaId = match[1].toLowerCase();

      if (VALID_MENTIONS.has(personaId)) {
        mentions.push({
          personaId: personaId as SystemAgentPersonaId | 'evaluate',
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          originalText: match[0],
        });
      }
    }

    return mentions;
  }

  /**
   * Check if content contains any valid mentions
   */
  hasMentions(content: string): boolean {
    return MENTION_PATTERN.test(content);
  }

  /**
   * Check if content mentions a specific persona
   */
  mentionsPersona(content: string, personaId: SystemAgentPersonaId | 'evaluate'): boolean {
    const mentions = this.extractMentions(content);
    return mentions.some(m => m.personaId === personaId);
  }

  /**
   * Get the first mention in the content
   */
  getFirstMention(content: string): ParsedMention | null {
    const mentions = this.extractMentions(content);
    return mentions.length > 0 ? mentions[0] : null;
  }

  // ===========================================================================
  // Content Manipulation
  // ===========================================================================

  /**
   * Strip mentions from content, preserving structure
   */
  stripMentionsFromContent(content: string, mentions?: ParsedMention[]): string {
    if (!mentions) {
      mentions = this.extractMentions(content);
    }

    if (mentions.length === 0) {
      return content;
    }

    // Sort mentions by start index (descending) to process from end
    const sortedMentions = [...mentions].sort((a, b) => b.startIndex - a.startIndex);

    let result = content;
    for (const mention of sortedMentions) {
      // Remove the mention and any trailing space
      const beforeMention = result.slice(0, mention.startIndex);
      let afterMention = result.slice(mention.endIndex);

      // Remove leading space after mention if present
      if (afterMention.startsWith(' ')) {
        afterMention = afterMention.slice(1);
      }

      result = beforeMention + afterMention;
    }

    // Clean up multiple spaces
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * Add a mention to the beginning of content
   */
  prependMention(content: string, personaId: SystemAgentPersonaId | 'evaluate'): string {
    const mention = `${this.config.mentionPrefix}${personaId}`;
    return `${mention} ${content}`;
  }

  /**
   * Replace all mentions with a specific persona
   */
  replaceMentions(content: string, newPersonaId: SystemAgentPersonaId | 'evaluate'): string {
    const newMention = `${this.config.mentionPrefix}${newPersonaId}`;
    return content.replace(MENTION_PATTERN, newMention);
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  /**
   * Validate that a string is a valid persona mention
   */
  isValidMention(mention: string): boolean {
    const normalized = mention.toLowerCase().replace(/^@/, '');
    return VALID_MENTIONS.has(normalized);
  }

  /**
   * Get all valid mention strings
   */
  getValidMentions(): string[] {
    return Array.from(VALID_MENTIONS).map(m => `${this.config.mentionPrefix}${m}`);
  }

  // ===========================================================================
  // Routing Helpers
  // ===========================================================================

  /**
   * Determine if the routing result requires pipeline execution
   */
  requiresPipeline(result: RoutingResult): boolean {
    return result.runPipeline;
  }

  /**
   * Get the primary target from a routing result
   */
  getPrimaryTarget(result: RoutingResult): SystemAgentPersonaId | null {
    return result.targets.length > 0 ? result.targets[0] : null;
  }

  /**
   * Order targets by pipeline order (dependencies)
   */
  orderByPipeline(targets: SystemAgentPersonaId[]): SystemAgentPersonaId[] {
    return EVALUATION_PIPELINE_ORDER.filter(p => targets.includes(p));
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let parserInstance: MentionParser | null = null;

/**
 * Get or create the singleton parser instance
 */
export function getMentionParser(config?: MentionParserConfig): MentionParser {
  if (!parserInstance) {
    parserInstance = new MentionParser(config);
  }
  return parserInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetMentionParser(): void {
  parserInstance = null;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Parse a message and return routing result
 */
export function parseMessage(content: string, config?: MentionParserConfig): RoutingResult {
  const parser = getMentionParser(config);
  return parser.parse(content);
}

/**
 * Quick check if content has mentions
 */
export function hasMentions(content: string): boolean {
  return MENTION_PATTERN.test(content);
}

/**
 * Extract persona ID from a mention string
 */
export function extractPersonaFromMention(mention: string): SystemAgentPersonaId | 'evaluate' | null {
  const match = mention.toLowerCase().match(/^@?(ada|lea|phil|david|evaluate)$/);
  return match ? (match[1] as SystemAgentPersonaId | 'evaluate') : null;
}

export default MentionParser;
