/**
 * Shared Conversational Middleware (SCM)
 *
 * Pattern 12: SHARED CONVERSATION MIDDLEWARE
 * Three-routine pipeline (Gate → Plan → Realize) with multi-agent arbitration.
 *
 * @see ../../../Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md
 * @see ../../../Borrowed_Ideas/Shared-Conversational-Middleware-Research.md
 *
 * Theoretical foundations:
 * - Sacks, Schegloff, & Jefferson (1974) - Turn-taking organization
 * - Grice (1975) - Cooperative principle and relevance
 * - Brown & Levinson (1987) - Politeness strategies
 */

import type {
  SCMPolicy,
  InitiativeTrigger,
  RepairSignal,
  CoordinationTag,
  DEFAULT_SCM_POLICY,
} from './types';

// =============================================================================
// Intent Types
// =============================================================================

export type SCMIntentType =
  | 'ask'
  | 'answer'
  | 'clarify'
  | 'reflect'
  | 'coach'
  | 'brainstorm'
  | 'handoff'
  | 'summarize';

// =============================================================================
// Gate Types
// =============================================================================

export interface SCMGateResult {
  shouldSpeak: boolean;
  confidence: number;
  intentType?: SCMIntentType;
  priority?: number;
  targetTurnId?: string;
  reasons: string[];
}

export interface SCMContext {
  agentId: string;
  latestTurnId?: string;
  participantIds?: string[];
  threadState?: 'planning' | 'action' | 'ops';
  riskSignals?: RepairSignal[];
  addressedToMe?: boolean;

  // Turn tracking
  lastSpokeAtMs?: number;
  messagesInLast10Min?: number;

  // Thread context
  lastNTurns?: Array<{
    speakerId: string;
    content: string;
    timestamp: number;
  }>;
}

// =============================================================================
// Plan Types
// =============================================================================

export interface SCMPlanResult {
  intentType: SCMIntentType;
  moves: string[];
  successCriterion: string;
  handoffTarget?: string;
}

// =============================================================================
// Realize Types
// =============================================================================

export interface SCMStyleResult {
  text: string;
  tone: string;
  truncated: boolean;
  idiomApplied?: string;
}

// =============================================================================
// Move Sequences (Intent → Moves mapping)
// =============================================================================

const INTENT_MOVE_SEQUENCES: Record<SCMIntentType, {
  moves: string[];
  successCriterion: string;
}> = {
  ask: {
    moves: ['formulate_question', 'await_response'],
    successCriterion: 'user_provides_answer',
  },
  answer: {
    moves: ['provide_answer', 'check_understanding'],
    successCriterion: 'user_acknowledges',
  },
  clarify: {
    moves: ['reflect_understanding', 'ask_clarification'],
    successCriterion: 'user_clarifies',
  },
  reflect: {
    moves: ['summarize_stated', 'validate_interpretation'],
    successCriterion: 'user_confirms',
  },
  coach: {
    moves: ['ask_permission', 'offer_options', 'await_selection'],
    successCriterion: 'user_selects_next_step',
  },
  brainstorm: {
    moves: ['generate_ideas', 'present_options', 'await_feedback'],
    successCriterion: 'user_reacts_to_ideas',
  },
  handoff: {
    moves: ['summarize_context', 'introduce_handoff', 'transfer'],
    successCriterion: 'handoff_accepted',
  },
  summarize: {
    moves: ['extract_key_points', 'present_summary', 'confirm'],
    successCriterion: 'user_acknowledges_summary',
  },
};

// =============================================================================
// Autonomy Language Templates
// =============================================================================

const AUTONOMY_PREFIXES: Record<'high' | 'medium' | 'low', string[]> = {
  high: [
    'You might consider...',
    'One option could be...',
    'Some people find it helpful to...',
    'Would you like to explore...',
  ],
  medium: [
    'I suggest...',
    'It would be good to...',
    'Consider...',
    'Try...',
  ],
  low: [
    'You should...',
    'Do this:',
    'The best approach is...',
    'I recommend...',
  ],
};

// =============================================================================
// SharedConversationMiddleware Implementation
// =============================================================================

export class SharedConversationMiddleware {
  private policy: SCMPolicy;
  private turnHistory: Map<string, number[]> = new Map(); // agentId -> timestamps

  constructor(policy?: Partial<SCMPolicy>) {
    // Import default at runtime to avoid circular dependency
    const { DEFAULT_SCM_POLICY } = require('./types');
    this.policy = { ...DEFAULT_SCM_POLICY, ...policy };
  }

  /**
   * Routine A: Gate - "Should I speak?"
   *
   * Evaluates whether the agent should respond based on:
   * - Cooldown status
   * - Turn budget (max messages per 10 min)
   * - Initiative mode and triggers
   * - Repair signals (boost priority)
   * - Coordination rules (yield_to)
   */
  shouldSpeak(context: SCMContext): SCMGateResult {
    const reasons: string[] = [];
    const now = Date.now();
    let priority = this.policy.coordination.priority;
    let confidence = 0.5;
    let intentType: SCMIntentType = 'answer';

    // 1. Check cooldown
    if (context.lastSpokeAtMs) {
      const elapsed = now - context.lastSpokeAtMs;
      if (elapsed < this.policy.initiative.cooldown_ms) {
        reasons.push(`cooldown_active: ${Math.round((this.policy.initiative.cooldown_ms - elapsed) / 1000)}s remaining`);
        return { shouldSpeak: false, confidence: 0.1, reasons };
      }
    }

    // 2. Check turn budget
    const messagesInWindow = context.messagesInLast10Min ?? 0;
    if (messagesInWindow >= this.policy.initiative.max_msgs_per_10min) {
      reasons.push(`turn_budget_exhausted: ${messagesInWindow}/${this.policy.initiative.max_msgs_per_10min}`);
      return { shouldSpeak: false, confidence: 0.15, reasons };
    }

    // 3. Check initiative mode
    const mode = this.policy.initiative.mode;
    const triggers = this.policy.initiative.triggers ?? ['direct_mention'];

    if (mode === 'only_when_asked') {
      if (!context.addressedToMe) {
        reasons.push('initiative_only_when_asked: not addressed');
        return { shouldSpeak: false, confidence: 0.2, reasons };
      }
      reasons.push('addressed_to_me');
      confidence = 0.8;
    }

    // 4. Check initiative triggers
    const triggersMatched: string[] = [];

    if (context.addressedToMe && triggers.includes('direct_mention')) {
      triggersMatched.push('direct_mention');
      priority += 0.2;
    }

    if (context.riskSignals?.includes('confusion') && triggers.includes('confusion')) {
      triggersMatched.push('confusion_detected');
      priority += 0.15;
      intentType = 'clarify';
    }

    if (context.riskSignals?.includes('repeated_failure') && triggers.includes('stuck')) {
      triggersMatched.push('stuck_detected');
      priority += 0.2;
      intentType = 'coach';
    }

    // 5. Repair signals boost priority
    if (context.riskSignals && context.riskSignals.length > 0 && this.policy.repair.enabled) {
      const repairMatch = context.riskSignals.some(s =>
        this.policy.repair.signals.includes(s)
      );
      if (repairMatch) {
        reasons.push('repair_signal_detected');
        priority += 0.25;
        confidence += 0.2;

        // Map repair strategy to intent
        switch (this.policy.repair.strategy) {
          case 'clarify':
            intentType = 'clarify';
            break;
          case 'reflect_then_clarify':
            intentType = 'reflect';
            break;
          case 'summarize_then_ask':
            intentType = 'summarize';
            break;
        }
      }
    }

    // 6. Proactive mode allows speaking without trigger
    if (mode === 'proactive' && triggersMatched.length === 0) {
      reasons.push('proactive_mode_allowed');
      confidence = 0.6;
    } else if (mode === 'can_interject' && triggersMatched.length === 0 && !context.addressedToMe) {
      // can_interject requires at least one trigger
      reasons.push('can_interject_no_trigger');
      return { shouldSpeak: false, confidence: 0.3, reasons };
    }

    // 7. Add trigger matches to reasons
    if (triggersMatched.length > 0) {
      reasons.push(`triggers_matched: ${triggersMatched.join(', ')}`);
      confidence = Math.min(0.95, confidence + triggersMatched.length * 0.1);
    }

    // 8. Cap priority at 1.0
    priority = Math.min(1.0, priority);

    // Final decision
    const shouldSpeak = confidence >= 0.4;

    return {
      shouldSpeak,
      confidence,
      intentType,
      priority,
      targetTurnId: context.latestTurnId,
      reasons,
    };
  }

  /**
   * Routine B: Plan - "What is my move?"
   *
   * Maps intent type to a sequence of conversational moves
   * with success criteria for evaluation.
   */
  planIntent(intentType: SCMIntentType, context?: SCMContext): SCMPlanResult {
    const sequence = INTENT_MOVE_SEQUENCES[intentType];

    // Adapt moves based on coaching policy
    let moves = [...sequence.moves];

    if (intentType === 'coach' && this.policy.coaching.ask_permission_before_advice) {
      // Ensure ask_permission is first
      if (!moves.includes('ask_permission')) {
        moves.unshift('ask_permission');
      }
    }

    // For creativity intents, add technique selection
    if (intentType === 'brainstorm') {
      const { mode, techniques } = this.policy.creativity;
      if (mode === 'divergent' || mode === 'oscillate') {
        moves.unshift('select_technique');
      }
      if (this.policy.creativity.anti_takeover) {
        moves.push('await_user_selection');
      }
    }

    return {
      intentType,
      moves,
      successCriterion: sequence.successCriterion,
    };
  }

  /**
   * Routine C: Realize - "How do I say it?"
   *
   * Applies style transformations:
   * - Autonomy language level
   * - Brevity (max_lines)
   * - Tone
   * - Politeness strategies
   */
  realizeStyle(
    text: string,
    tone: string = 'neutral',
    options?: {
      applyAutonomyPrefix?: boolean;
      maxLines?: number;
    }
  ): SCMStyleResult {
    let result = text;
    let truncated = false;
    const maxLines = options?.maxLines ?? this.policy.turn_taking.max_lines;

    // 1. Apply autonomy language prefix for coaching
    if (options?.applyAutonomyPrefix) {
      const prefixes = AUTONOMY_PREFIXES[this.policy.coaching.autonomy_language];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      result = `${prefix} ${result}`;
    }

    // 2. Enforce brevity (max_lines)
    const lines = result.split('\n');
    if (lines.length > maxLines) {
      result = lines.slice(0, maxLines).join('\n');
      truncated = true;
    }

    // 3. Enforce max questions per reply
    const questionCount = (result.match(/\?/g) || []).length;
    if (questionCount > this.policy.turn_taking.max_questions_per_reply) {
      // Keep only the first N questions
      let questionsKept = 0;
      result = result.replace(/[^.!?]*\?/g, (match) => {
        if (questionsKept < this.policy.turn_taking.max_questions_per_reply) {
          questionsKept++;
          return match;
        }
        return match.replace('?', '.');
      });
    }

    return {
      text: result,
      tone,
      truncated,
    };
  }

  /**
   * Record that this agent spoke at the current time
   * Used for turn budget tracking
   */
  recordTurn(agentId: string): void {
    const now = Date.now();
    const history = this.turnHistory.get(agentId) || [];

    // Keep only timestamps from last 10 minutes
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const recentHistory = history.filter(t => t > tenMinutesAgo);
    recentHistory.push(now);

    this.turnHistory.set(agentId, recentHistory);
  }

  /**
   * Get the number of messages an agent has sent in the last 10 minutes
   */
  getMessagesInWindow(agentId: string): number {
    const now = Date.now();
    const history = this.turnHistory.get(agentId) || [];
    const tenMinutesAgo = now - 10 * 60 * 1000;
    return history.filter(t => t > tenMinutesAgo).length;
  }

  /**
   * Get the time of the last message from an agent
   */
  getLastSpokeAt(agentId: string): number | undefined {
    const history = this.turnHistory.get(agentId);
    if (!history || history.length === 0) return undefined;
    return history[history.length - 1];
  }

  /**
   * Update the policy at runtime
   */
  updatePolicy(policy: Partial<SCMPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  /**
   * Get the current policy
   */
  getPolicy(): SCMPolicy {
    return { ...this.policy };
  }

  /**
   * Get creativity technique for brainstorming
   */
  selectCreativityTechnique(): string {
    const { techniques } = this.policy.creativity;
    if (techniques.length === 0) return 'analogies';
    return techniques[Math.floor(Math.random() * techniques.length)];
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a SharedConversationMiddleware instance with custom policy
 */
export function createSCM(policy?: Partial<SCMPolicy>): SharedConversationMiddleware {
  return new SharedConversationMiddleware(policy);
}

/**
 * Create SCM context from chat state
 */
export function createSCMContext(
  agentId: string,
  options: Partial<SCMContext> = {}
): SCMContext {
  return {
    agentId,
    ...options,
  };
}
