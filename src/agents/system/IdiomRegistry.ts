/**
 * Idiom Registry
 *
 * Pattern 13: AGENT BEHAVIOR CONFIG
 * Manages character-specific expressions and personality phrases.
 *
 * @see ../../../Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md
 * @see ../../../Borrowed_Ideas/AGENT_JOBS_AND_CONVERSATIONS.md
 *
 * Features:
 * - Context-based idiom selection
 * - Frequency throttling
 * - Seasonal filtering
 * - Weighted random selection
 */

import type { IdiomDefinition, IdiomPhrase } from './types';

// =============================================================================
// Types
// =============================================================================

export interface IdiomContext {
  currentMonth: number;       // 1-12
  activeEvents: string[];     // e.g., ['nfl_season', 'holidays']
  conversationContext: string[]; // e.g., ['exploration', 'check_in']
  agentId: string;
}

export interface IdiomSelection {
  idiomId: string;
  category: string;
  selectedPhrase: string;
  selectionReason: string;
}

export interface IdiomUsageStats {
  idiomId: string;
  lastUsedMs: number;
  usageCount: number;
}

// =============================================================================
// Frequency Intervals
// =============================================================================

const FREQUENCY_INTERVALS: Record<'high' | 'medium' | 'low', number> = {
  high: 60 * 1000,      // 1 minute minimum between uses
  medium: 5 * 60 * 1000, // 5 minutes minimum
  low: 15 * 60 * 1000,   // 15 minutes minimum
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an idiom's seasonal conditions are met
 */
function checkSeasonalConditions(
  idiom: IdiomDefinition,
  context: IdiomContext
): boolean {
  if (!idiom.seasonal) return true;

  const { months, events } = idiom.seasonal;

  // Check month restriction
  if (months && months.length > 0) {
    if (!months.includes(context.currentMonth)) {
      return false;
    }
  }

  // Check event restriction
  if (events && events.length > 0) {
    const hasMatchingEvent = events.some(e => context.activeEvents.includes(e));
    if (!hasMatchingEvent) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a phrase matches the conversation context
 */
function phraseMatchesContext(
  phrase: IdiomPhrase,
  context: IdiomContext
): boolean {
  if (!phrase.context || phrase.context.length === 0) {
    return true; // No context restriction
  }

  return phrase.context.some(c => context.conversationContext.includes(c));
}

/**
 * Weighted random selection
 */
function weightedRandomSelect<T extends { weight: number }>(items: T[]): T | null {
  if (items.length === 0) return null;

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return items[0];

  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }

  return items[items.length - 1];
}

// =============================================================================
// IdiomRegistry Implementation
// =============================================================================

export class IdiomRegistry {
  private idioms: Map<string, IdiomDefinition[]> = new Map(); // agentId -> idioms
  private usageStats: Map<string, IdiomUsageStats> = new Map(); // idiomId -> stats

  /**
   * Load idioms for an agent
   */
  loadIdioms(agentId: string, idioms: IdiomDefinition[]): void {
    this.idioms.set(agentId, idioms);
  }

  /**
   * Select an appropriate idiom based on context
   */
  selectIdiom(context: IdiomContext): IdiomSelection | null {
    const agentIdioms = this.idioms.get(context.agentId);
    if (!agentIdioms || agentIdioms.length === 0) {
      return null;
    }

    // Filter by triggers (must match conversation context)
    const triggeredIdioms = agentIdioms.filter(idiom =>
      idiom.triggers.some(t => context.conversationContext.includes(t))
    );

    if (triggeredIdioms.length === 0) {
      return null;
    }

    // Filter by seasonal conditions
    const seasonallyValid = triggeredIdioms.filter(idiom =>
      checkSeasonalConditions(idiom, context)
    );

    if (seasonallyValid.length === 0) {
      return null;
    }

    // Filter by frequency throttling
    const availableIdioms = seasonallyValid.filter(idiom =>
      this.checkFrequencyThrottle(idiom)
    );

    if (availableIdioms.length === 0) {
      return null;
    }

    // Select an idiom (weighted by frequency preference)
    const frequencyWeights = { high: 3, medium: 2, low: 1 };
    const weightedIdioms = availableIdioms.map(idiom => ({
      idiom,
      weight: frequencyWeights[idiom.frequency],
    }));

    const selectedEntry = weightedRandomSelect(weightedIdioms);
    if (!selectedEntry) return null;

    const selectedIdiom = selectedEntry.idiom;

    // Select a phrase from the idiom
    const phrase = this.selectPhrase(selectedIdiom, context);
    if (!phrase) return null;

    // Record usage
    this.recordUsage(selectedIdiom.idiom_id);

    return {
      idiomId: selectedIdiom.idiom_id,
      category: selectedIdiom.category,
      selectedPhrase: phrase.text,
      selectionReason: this.buildSelectionReason(selectedIdiom, phrase, context),
    };
  }

  /**
   * Select a phrase from an idiom
   */
  private selectPhrase(
    idiom: IdiomDefinition,
    context: IdiomContext
  ): IdiomPhrase | null {
    // Filter phrases by context
    const matchingPhrases = idiom.phrases.filter(p =>
      phraseMatchesContext(p, context)
    );

    if (matchingPhrases.length === 0) {
      // Fallback to any phrase
      return weightedRandomSelect(idiom.phrases);
    }

    return weightedRandomSelect(matchingPhrases);
  }

  /**
   * Check if an idiom can be used based on frequency throttling
   */
  private checkFrequencyThrottle(idiom: IdiomDefinition): boolean {
    const stats = this.usageStats.get(idiom.idiom_id);
    if (!stats) return true;

    const minInterval = FREQUENCY_INTERVALS[idiom.frequency];
    const elapsed = Date.now() - stats.lastUsedMs;

    return elapsed >= minInterval;
  }

  /**
   * Record that an idiom was used
   */
  private recordUsage(idiomId: string): void {
    const existing = this.usageStats.get(idiomId);
    this.usageStats.set(idiomId, {
      idiomId,
      lastUsedMs: Date.now(),
      usageCount: (existing?.usageCount ?? 0) + 1,
    });
  }

  /**
   * Build a reason string for the selection
   */
  private buildSelectionReason(
    idiom: IdiomDefinition,
    phrase: IdiomPhrase,
    context: IdiomContext
  ): string {
    const reasons: string[] = [
      `category=${idiom.category}`,
      `frequency=${idiom.frequency}`,
      `phrase_weight=${phrase.weight}`,
    ];

    if (idiom.seasonal) {
      if (idiom.seasonal.months?.includes(context.currentMonth)) {
        reasons.push('seasonal_month_match');
      }
      const matchingEvents = idiom.seasonal.events?.filter(e =>
        context.activeEvents.includes(e)
      );
      if (matchingEvents?.length) {
        reasons.push(`seasonal_events=${matchingEvents.join(',')}`);
      }
    }

    return reasons.join(', ');
  }

  /**
   * Inject an idiom into text if appropriate
   *
   * @param text - The base text to potentially modify
   * @param context - The idiom context
   * @param position - Where to inject ('prefix' | 'suffix' | 'replace_placeholder')
   */
  injectIdiom(
    text: string,
    context: IdiomContext,
    position: 'prefix' | 'suffix' | 'replace_placeholder' = 'suffix'
  ): { text: string; idiomApplied?: IdiomSelection } {
    const selection = this.selectIdiom(context);

    if (!selection) {
      return { text };
    }

    let result: string;
    switch (position) {
      case 'prefix':
        result = `${selection.selectedPhrase} ${text}`;
        break;
      case 'suffix':
        result = `${text} ${selection.selectedPhrase}`;
        break;
      case 'replace_placeholder':
        result = text.replace('{idiom}', selection.selectedPhrase);
        break;
      default:
        result = text;
    }

    return {
      text: result,
      idiomApplied: selection,
    };
  }

  /**
   * Get usage statistics for an idiom
   */
  getUsageStats(idiomId: string): IdiomUsageStats | undefined {
    return this.usageStats.get(idiomId);
  }

  /**
   * Get all idioms for an agent
   */
  getIdiomsForAgent(agentId: string): IdiomDefinition[] {
    return this.idioms.get(agentId) || [];
  }

  /**
   * Clear all state (for testing)
   */
  clear(): void {
    this.idioms.clear();
    this.usageStats.clear();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an IdiomRegistry instance
 */
export function createIdiomRegistry(): IdiomRegistry {
  return new IdiomRegistry();
}

/**
 * Create an IdiomContext from current state
 */
export function createIdiomContext(
  agentId: string,
  options: Partial<Omit<IdiomContext, 'agentId'>> = {}
): IdiomContext {
  return {
    agentId,
    currentMonth: options.currentMonth ?? new Date().getMonth() + 1,
    activeEvents: options.activeEvents ?? [],
    conversationContext: options.conversationContext ?? [],
  };
}
