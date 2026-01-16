/**
 * Trigger Evaluator
 *
 * Pattern 13: AGENT BEHAVIOR CONFIG
 * Evaluates conversation triggers to determine when agents should proactively initiate.
 *
 * @see ../../../Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md
 * @see ../../../Borrowed_Ideas/AGENT_JOBS_AND_CONVERSATIONS.md
 *
 * Supported condition types:
 * - time_since_last: Trigger after period of inactivity
 * - event: Trigger on specific events
 * - metric: Trigger on metric thresholds
 * - user_state: Trigger on detected user states
 */

import type { ConversationTrigger, TriggerConditionType } from './types';

// =============================================================================
// Types
// =============================================================================

export interface SystemContext {
  currentTimeMs: number;
  lastConversationTimeMs?: number;
  lastAgentConversationTimeMs?: Record<string, number>;
  userActive: boolean;
  recentEvents: Array<{
    name: string;
    timestamp: number;
    data?: Record<string, unknown>;
  }>;
  currentMetrics: Record<string, number>;
  userState?: 'idle' | 'confused' | 'stuck' | 'engaged';
}

export interface TriggerResult {
  triggerId: string;
  triggerName: string;
  shouldTrigger: boolean;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  matchedCondition?: string;
  contextAvailable: Record<string, unknown>;
}

export interface CooldownState {
  triggerId: string;
  lastActivatedMs: number;
  cooldownSeconds: number;
}

// =============================================================================
// Condition Evaluators
// =============================================================================

type ConditionEvaluator = (
  params: Record<string, unknown>,
  context: SystemContext
) => { matches: boolean; confidence: number; reason: string };

const CONDITION_EVALUATORS: Record<TriggerConditionType, ConditionEvaluator> = {
  /**
   * Time-since-last condition
   * Triggers when no conversation has occurred for threshold_seconds
   */
  time_since_last: (params, context) => {
    const thresholdSeconds = (params.threshold_seconds as number) ?? 3600;
    const agentId = params.agent_id as string | undefined;
    const requireUserActive = (params.user_active as boolean) ?? false;

    // Check user activity requirement
    if (requireUserActive && !context.userActive) {
      return {
        matches: false,
        confidence: 0,
        reason: 'user_not_active',
      };
    }

    // Determine last conversation time
    let lastConversation: number | undefined;
    if (agentId && agentId !== 'any') {
      lastConversation = context.lastAgentConversationTimeMs?.[agentId];
    } else {
      lastConversation = context.lastConversationTimeMs;
    }

    if (!lastConversation) {
      // No previous conversation - could be first interaction
      return {
        matches: true,
        confidence: 0.5,
        reason: 'no_previous_conversation',
      };
    }

    const elapsedSeconds = (context.currentTimeMs - lastConversation) / 1000;
    const matches = elapsedSeconds >= thresholdSeconds;

    // Confidence increases as time exceeds threshold
    const overage = elapsedSeconds / thresholdSeconds;
    const confidence = matches ? Math.min(0.95, 0.5 + overage * 0.2) : overage * 0.4;

    return {
      matches,
      confidence,
      reason: `elapsed_${Math.round(elapsedSeconds)}s_threshold_${thresholdSeconds}s`,
    };
  },

  /**
   * Event condition
   * Triggers when a count of specific events occurs within a time window
   */
  event: (params, context) => {
    const eventName = params.event_name as string;
    const countThreshold = (params.count_threshold as number) ?? 1;
    const timeWindowSeconds = (params.time_window_seconds as number) ?? 300;

    if (!eventName) {
      return {
        matches: false,
        confidence: 0,
        reason: 'no_event_name_specified',
      };
    }

    const cutoffMs = context.currentTimeMs - timeWindowSeconds * 1000;
    const matchingEvents = context.recentEvents.filter(
      e => e.name === eventName && e.timestamp >= cutoffMs
    );

    const matches = matchingEvents.length >= countThreshold;
    const confidence = matches
      ? Math.min(0.95, 0.6 + (matchingEvents.length / countThreshold) * 0.2)
      : matchingEvents.length / countThreshold * 0.5;

    return {
      matches,
      confidence,
      reason: `${matchingEvents.length}_events_threshold_${countThreshold}`,
    };
  },

  /**
   * Metric condition
   * Triggers when a metric crosses a threshold for a duration
   */
  metric: (params, context) => {
    const metricName = params.metric_name as string;
    const operator = (params.operator as string) ?? 'gte';
    const threshold = params.threshold as number;
    // duration_seconds for sustained condition (not implemented in simple version)

    if (!metricName || threshold === undefined) {
      return {
        matches: false,
        confidence: 0,
        reason: 'missing_metric_params',
      };
    }

    const currentValue = context.currentMetrics[metricName];
    if (currentValue === undefined) {
      return {
        matches: false,
        confidence: 0,
        reason: `metric_${metricName}_not_found`,
      };
    }

    let matches = false;
    switch (operator) {
      case 'gte':
        matches = currentValue >= threshold;
        break;
      case 'lte':
        matches = currentValue <= threshold;
        break;
      case 'eq':
        matches = currentValue === threshold;
        break;
      case 'ne':
        matches = currentValue !== threshold;
        break;
      case 'gt':
        matches = currentValue > threshold;
        break;
      case 'lt':
        matches = currentValue < threshold;
        break;
    }

    const deviation = Math.abs(currentValue - threshold) / Math.max(threshold, 0.001);
    const confidence = matches ? Math.min(0.95, 0.6 + deviation * 0.3) : 0.3;

    return {
      matches,
      confidence,
      reason: `${metricName}=${currentValue}_${operator}_${threshold}`,
    };
  },

  /**
   * User state condition
   * Triggers when the user is in a specific state for a duration
   */
  user_state: (params, context) => {
    const state = params.state as string;
    // duration_seconds for sustained state (not implemented in simple version)

    if (!state) {
      return {
        matches: false,
        confidence: 0,
        reason: 'no_state_specified',
      };
    }

    const matches = context.userState === state;
    const confidence = matches ? 0.8 : 0.2;

    return {
      matches,
      confidence,
      reason: `user_state_${context.userState ?? 'unknown'}_expected_${state}`,
    };
  },
};

// =============================================================================
// TriggerEvaluator Implementation
// =============================================================================

export class TriggerEvaluator {
  private cooldowns: Map<string, CooldownState> = new Map();

  /**
   * Evaluate all triggers for an agent
   */
  evaluateTriggers(
    agentId: string,
    triggers: ConversationTrigger[],
    context: SystemContext
  ): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const trigger of triggers) {
      // Skip disabled triggers
      if (!trigger.enabled) {
        continue;
      }

      // Check cooldown
      if (!this.checkCooldown(agentId, trigger.trigger_id)) {
        results.push({
          triggerId: trigger.trigger_id,
          triggerName: trigger.name,
          shouldTrigger: false,
          confidence: 0,
          priority: trigger.priority,
          matchedCondition: 'cooldown_active',
          contextAvailable: {},
        });
        continue;
      }

      // Evaluate condition
      const evaluator = CONDITION_EVALUATORS[trigger.condition.type];
      if (!evaluator) {
        results.push({
          triggerId: trigger.trigger_id,
          triggerName: trigger.name,
          shouldTrigger: false,
          confidence: 0,
          priority: trigger.priority,
          matchedCondition: `unknown_condition_type_${trigger.condition.type}`,
          contextAvailable: {},
        });
        continue;
      }

      const evaluation = evaluator(trigger.condition.parameters, context);

      results.push({
        triggerId: trigger.trigger_id,
        triggerName: trigger.name,
        shouldTrigger: evaluation.matches,
        confidence: evaluation.confidence,
        priority: trigger.priority,
        matchedCondition: evaluation.reason,
        contextAvailable: this.gatherContext(trigger.context_required ?? [], context),
      });
    }

    // Sort by priority (high > medium > low) then by confidence
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    results.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    return results;
  }

  /**
   * Check if cooldown has expired for a trigger
   */
  checkCooldown(agentId: string, triggerId: string): boolean {
    const key = `${agentId}:${triggerId}`;
    const state = this.cooldowns.get(key);

    if (!state) return true;

    const now = Date.now();
    const cooldownExpired = now - state.lastActivatedMs >= state.cooldownSeconds * 1000;

    return cooldownExpired;
  }

  /**
   * Record that a trigger was activated
   */
  recordActivation(agentId: string, triggerId: string, cooldownSeconds: number): void {
    const key = `${agentId}:${triggerId}`;
    this.cooldowns.set(key, {
      triggerId,
      lastActivatedMs: Date.now(),
      cooldownSeconds,
    });
  }

  /**
   * Get remaining cooldown in seconds
   */
  getCooldownRemaining(agentId: string, triggerId: string): number {
    const key = `${agentId}:${triggerId}`;
    const state = this.cooldowns.get(key);

    if (!state) return 0;

    const elapsed = (Date.now() - state.lastActivatedMs) / 1000;
    const remaining = state.cooldownSeconds - elapsed;

    return Math.max(0, remaining);
  }

  /**
   * Gather required context for a trigger
   */
  private gatherContext(
    required: string[],
    context: SystemContext
  ): Record<string, unknown> {
    const gathered: Record<string, unknown> = {};

    for (const key of required) {
      switch (key) {
        case 'user_activity':
          gathered.user_activity = context.userActive;
          break;
        case 'recent_events':
          gathered.recent_events = context.recentEvents.slice(-10);
          break;
        case 'current_metrics':
          gathered.current_metrics = context.currentMetrics;
          break;
        case 'user_state':
          gathered.user_state = context.userState;
          break;
        default:
          // Check if it's a specific metric
          if (context.currentMetrics[key] !== undefined) {
            gathered[key] = context.currentMetrics[key];
          }
      }
    }

    return gathered;
  }

  /**
   * Clear all cooldown state (for testing)
   */
  clearCooldowns(): void {
    this.cooldowns.clear();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a TriggerEvaluator instance
 */
export function createTriggerEvaluator(): TriggerEvaluator {
  return new TriggerEvaluator();
}

/**
 * Create a SystemContext from current state
 */
export function createSystemContext(options: Partial<SystemContext> = {}): SystemContext {
  return {
    currentTimeMs: Date.now(),
    userActive: true,
    recentEvents: [],
    currentMetrics: {},
    ...options,
  };
}
