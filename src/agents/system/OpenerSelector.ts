/**
 * Opener Selector
 *
 * Pattern 13: AGENT BEHAVIOR CONFIG
 * Selects appropriate conversation openers based on triggers and context.
 *
 * @see ../../../Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md
 * @see ../../../Borrowed_Ideas/AGENT_JOBS_AND_CONVERSATIONS.md
 *
 * Features:
 * - Weighted random selection
 * - Condition filtering (time_of_day, user_mood)
 * - Follow-up prompt handling
 * - Tone extraction
 */

import type { OpenerDefinition, OpenerVariation } from './types';

// =============================================================================
// Types
// =============================================================================

export interface SelectionContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  userMood?: 'happy' | 'neutral' | 'tired';
  recentTopics?: string[];
  customConditions?: Record<string, unknown>;
}

export interface OpenerSelection {
  openerId: string;
  triggerId: string;
  selectedText: string;
  followUpPrompt?: string;
  tone: string;
  selectionReason: string;
  variationIndex: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determine time of day from current hour
 */
export function getTimeOfDay(hour?: number): 'morning' | 'afternoon' | 'evening' {
  const h = hour ?? new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

/**
 * Weighted random selection from variations
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

/**
 * Check if a variation matches the current context
 */
function variationMatchesContext(
  variation: OpenerVariation,
  context: SelectionContext
): boolean {
  if (!variation.conditions) return true;

  const { conditions } = variation;

  // Check time_of_day
  if (conditions.time_of_day && conditions.time_of_day !== context.timeOfDay) {
    return false;
  }

  // Check user_mood
  if (conditions.user_mood && conditions.user_mood !== context.userMood) {
    return false;
  }

  // Check custom conditions
  if (context.customConditions) {
    for (const [key, value] of Object.entries(conditions)) {
      if (key === 'time_of_day' || key === 'user_mood') continue;
      if (context.customConditions[key] !== value) {
        return false;
      }
    }
  }

  return true;
}

// =============================================================================
// OpenerSelector Implementation
// =============================================================================

export class OpenerSelector {
  private openers: Map<string, OpenerDefinition[]> = new Map(); // triggerId -> openers

  /**
   * Load openers from configuration
   */
  loadOpeners(openers: OpenerDefinition[]): void {
    this.openers.clear();

    for (const opener of openers) {
      const existing = this.openers.get(opener.trigger_id) || [];
      existing.push(opener);
      this.openers.set(opener.trigger_id, existing);
    }
  }

  /**
   * Select an opener for a triggered event
   */
  selectOpener(
    triggerId: string,
    context: SelectionContext
  ): OpenerSelection | null {
    const openerList = this.openers.get(triggerId);

    if (!openerList || openerList.length === 0) {
      return null;
    }

    // Try each opener in order
    for (const opener of openerList) {
      const selection = this.selectFromOpener(opener, context);
      if (selection) return selection;
    }

    // Fallback: select from first opener without conditions
    const fallbackOpener = openerList[0];
    if (fallbackOpener.variations.length > 0) {
      return {
        openerId: fallbackOpener.opener_id,
        triggerId: fallbackOpener.trigger_id,
        selectedText: fallbackOpener.variations[0].text,
        followUpPrompt: fallbackOpener.follow_up_prompt,
        tone: fallbackOpener.tone,
        selectionReason: 'fallback_first_variation',
        variationIndex: 0,
      };
    }

    return null;
  }

  /**
   * Select a variation from a specific opener
   */
  private selectFromOpener(
    opener: OpenerDefinition,
    context: SelectionContext
  ): OpenerSelection | null {
    // Filter variations by context
    const matchingVariations = opener.variations.filter(v =>
      variationMatchesContext(v, context)
    );

    if (matchingVariations.length === 0) {
      return null;
    }

    // Weighted selection
    const selected = weightedRandomSelect(matchingVariations);
    if (!selected) return null;

    const variationIndex = opener.variations.indexOf(selected);

    return {
      openerId: opener.opener_id,
      triggerId: opener.trigger_id,
      selectedText: selected.text,
      followUpPrompt: opener.follow_up_prompt,
      tone: opener.tone,
      selectionReason: this.buildSelectionReason(selected, context),
      variationIndex,
    };
  }

  /**
   * Build a reason string for the selection
   */
  private buildSelectionReason(
    variation: OpenerVariation,
    context: SelectionContext
  ): string {
    const reasons: string[] = [`weight=${variation.weight}`];

    if (variation.conditions) {
      if (variation.conditions.time_of_day) {
        reasons.push(`time_of_day=${context.timeOfDay}`);
      }
      if (variation.conditions.user_mood && context.userMood) {
        reasons.push(`user_mood=${context.userMood}`);
      }
    }

    return reasons.join(', ');
  }

  /**
   * Get all openers for a trigger
   */
  getOpenersForTrigger(triggerId: string): OpenerDefinition[] {
    return this.openers.get(triggerId) || [];
  }

  /**
   * Get all loaded trigger IDs
   */
  getLoadedTriggerIds(): string[] {
    return Array.from(this.openers.keys());
  }

  /**
   * Clear all loaded openers (for testing)
   */
  clearOpeners(): void {
    this.openers.clear();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an OpenerSelector instance
 */
export function createOpenerSelector(openers?: OpenerDefinition[]): OpenerSelector {
  const selector = new OpenerSelector();
  if (openers) {
    selector.loadOpeners(openers);
  }
  return selector;
}

/**
 * Create a SelectionContext from current state
 */
export function createSelectionContext(
  options: Partial<SelectionContext> = {}
): SelectionContext {
  return {
    timeOfDay: options.timeOfDay ?? getTimeOfDay(),
    userMood: options.userMood,
    recentTopics: options.recentTopics ?? [],
    customConditions: options.customConditions,
  };
}
