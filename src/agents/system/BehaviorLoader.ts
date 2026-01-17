/**
 * Behavior Loader
 *
 * Pattern 13: AGENT BEHAVIOR CONFIG
 * Integrates TriggerEvaluator, OpenerSelector, and IdiomRegistry
 * to provide a unified behavior management interface.
 *
 * @see ../../../Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md
 * @see ../../../plans/SYSTEM_AGENT_MIDDLEWARE_TASK_PLAN.md
 *
 * Responsibilities:
 * - Load behavior configs from PersonaConfig
 * - Initialize sub-components
 * - Provide unified API for behavior evaluation
 */

import type { PersonaConfig, BehaviorConfig, SCMPolicy, DEFAULT_SCM_POLICY } from './types';
import { TriggerEvaluator, createSystemContext, type SystemContext, type TriggerResult } from './TriggerEvaluator';
import { OpenerSelector, createSelectionContext, type SelectionContext, type OpenerSelection } from './OpenerSelector';
import { IdiomRegistry, createIdiomContext, type IdiomContext, type IdiomSelection } from './IdiomRegistry';
import { SharedConversationMiddleware, type SCMContext, type SCMGateResult } from './SharedConversationMiddleware';
import { logger } from '../../observability';

// =============================================================================
// Types
// =============================================================================

export interface BehaviorEvaluation {
  agentId: string;
  triggeredResults: TriggerResult[];
  selectedOpener: OpenerSelection | null;
  gateResult: SCMGateResult;
  idiomInjected?: IdiomSelection;
  finalText?: string;
}

export interface BehaviorLoaderConfig {
  enableTriggers?: boolean;
  enableOpeners?: boolean;
  enableIdioms?: boolean;
}

// =============================================================================
// BehaviorLoader Implementation
// =============================================================================

export class BehaviorLoader {
  private triggers: Map<string, TriggerEvaluator> = new Map(); // agentId -> evaluator
  private openers: Map<string, OpenerSelector> = new Map();
  private idiomRegistry: IdiomRegistry;
  private scmInstances: Map<string, SharedConversationMiddleware> = new Map();
  private configs: Map<string, BehaviorConfig> = new Map();
  private scmPolicies: Map<string, SCMPolicy> = new Map();
  private config: BehaviorLoaderConfig;
  private log = logger('BehaviorLoader');

  constructor(config: BehaviorLoaderConfig = {}) {
    this.config = {
      enableTriggers: true,
      enableOpeners: true,
      enableIdioms: true,
      ...config,
    };
    this.idiomRegistry = new IdiomRegistry();
  }

  /**
   * Load behavior configuration from a PersonaConfig
   */
  loadFromPersonaConfig(persona: PersonaConfig): void {
    const agentId = persona.id;

    // Load behavior section
    if (persona.behavior) {
      const behavior: BehaviorConfig = {
        jobs: Array.isArray(persona.behavior.jobs) ? persona.behavior.jobs : [],
        conversation_triggers: Array.isArray(persona.behavior.conversation_triggers) 
          ? persona.behavior.conversation_triggers 
          : [],
        openers: Array.isArray(persona.behavior.openers) ? persona.behavior.openers : [],
        idioms: Array.isArray(persona.behavior.idioms) ? persona.behavior.idioms : [],
      };
      this.configs.set(agentId, behavior);

      // Initialize TriggerEvaluator
      if (this.config.enableTriggers && behavior.conversation_triggers.length > 0) {
        this.triggers.set(agentId, new TriggerEvaluator());
      }

      // Initialize OpenerSelector
      if (this.config.enableOpeners && behavior.openers.length > 0) {
        const selector = new OpenerSelector();
        selector.loadOpeners(behavior.openers);
        this.openers.set(agentId, selector);
      }

      // Initialize IdiomRegistry
      if (this.config.enableIdioms && behavior.idioms.length > 0) {
        this.idiomRegistry.loadIdioms(agentId, behavior.idioms);
      }
    }

    // Load SCM policy
    if (persona.scm_policy) {
      const { DEFAULT_SCM_POLICY } = require('./types');
      const policy: SCMPolicy = {
        ...DEFAULT_SCM_POLICY,
        ...persona.scm_policy,
      } as SCMPolicy;
      this.scmPolicies.set(agentId, policy);
      this.scmInstances.set(agentId, new SharedConversationMiddleware(policy));
    }

    this.emitEvent({
      kind: 'behavior.loaded',
      timestamp: new Date().toISOString(),
      details: {
        agentId,
        triggersLoaded: this.triggers.has(agentId),
        openersLoaded: this.openers.has(agentId),
        idiomsLoaded: this.idiomRegistry.getIdiomsForAgent(agentId).length > 0,
        scmPolicyLoaded: this.scmPolicies.has(agentId),
      },
    });
  }

  /**
   * Evaluate if an agent should speak proactively
   *
   * Full evaluation flow:
   * 1. Evaluate conversation triggers
   * 2. If triggered, select opener
   * 3. Run SCM gate
   * 4. Optionally inject idiom
   */
  async evaluateBehavior(
    agentId: string,
    systemContext: SystemContext,
    scmContext: SCMContext
  ): Promise<BehaviorEvaluation> {
    const result: BehaviorEvaluation = {
      agentId,
      triggeredResults: [],
      selectedOpener: null,
      gateResult: { shouldSpeak: false, confidence: 0, reasons: ['no_evaluation'] },
    };

    // 1. Evaluate triggers
    const behavior = this.configs.get(agentId);
    const triggerEvaluator = this.triggers.get(agentId);

    if (behavior && triggerEvaluator) {
      result.triggeredResults = triggerEvaluator.evaluateTriggers(
        agentId,
        behavior.conversation_triggers,
        systemContext
      );

      // Find the highest priority triggered trigger
      const topTriggered = result.triggeredResults.find(t => t.shouldTrigger);

      if (topTriggered) {
        this.emitEvent({
          kind: 'behavior.trigger.activated',
          timestamp: new Date().toISOString(),
          details: {
            agentId,
            triggerId: topTriggered.triggerId,
            triggerName: topTriggered.triggerName,
            confidence: topTriggered.confidence,
          },
        });

        // Record activation for cooldown
        const trigger = behavior.conversation_triggers.find(
          t => t.trigger_id === topTriggered.triggerId
        );
        if (trigger) {
          triggerEvaluator.recordActivation(
            agentId,
            trigger.trigger_id,
            trigger.cooldown_seconds
          );
        }

        // 2. Select opener for triggered trigger
        const openerSelector = this.openers.get(agentId);
        if (openerSelector) {
          const selectionContext = createSelectionContext({
            userMood: this.inferUserMood(systemContext),
          });
          result.selectedOpener = openerSelector.selectOpener(
            topTriggered.triggerId,
            selectionContext
          );

          if (result.selectedOpener) {
            this.emitEvent({
              kind: 'behavior.opener.selected',
              timestamp: new Date().toISOString(),
              details: {
                agentId,
                openerId: result.selectedOpener.openerId,
                tone: result.selectedOpener.tone,
              },
            });
          }
        }
      }
    }

    // 3. Run SCM gate
    const scm = this.scmInstances.get(agentId);
    if (scm) {
      result.gateResult = scm.shouldSpeak({
        ...scmContext,
        agentId,
        messagesInLast10Min: scm.getMessagesInWindow(agentId),
        lastSpokeAtMs: scm.getLastSpokeAt(agentId),
      });
    }

    // 4. Inject idiom if opener selected
    if (result.selectedOpener && result.gateResult.shouldSpeak) {
      const idiomContext = createIdiomContext(agentId, {
        conversationContext: ['proactive', result.selectedOpener.tone],
      });

      const injection = this.idiomRegistry.injectIdiom(
        result.selectedOpener.selectedText,
        idiomContext,
        'suffix'
      );

      result.finalText = injection.text;
      result.idiomInjected = injection.idiomApplied;

      if (injection.idiomApplied) {
        this.emitEvent({
          kind: 'behavior.idiom.injected',
          timestamp: new Date().toISOString(),
          details: {
            agentId,
            idiomId: injection.idiomApplied.idiomId,
            category: injection.idiomApplied.category,
          },
        });
      }
    }

    return result;
  }

  /**
   * Record that an agent spoke (for turn tracking)
   */
  recordAgentTurn(agentId: string): void {
    const scm = this.scmInstances.get(agentId);
    if (scm) {
      scm.recordTurn(agentId);
    }
  }

  /**
   * Get SCM instance for an agent
   */
  getSCM(agentId: string): SharedConversationMiddleware | undefined {
    return this.scmInstances.get(agentId);
  }

  /**
   * Get behavior config for an agent
   */
  getBehaviorConfig(agentId: string): BehaviorConfig | undefined {
    return this.configs.get(agentId);
  }

  /**
   * Get SCM policy for an agent
   */
  getSCMPolicy(agentId: string): SCMPolicy | undefined {
    return this.scmPolicies.get(agentId);
  }

  /**
   * Get loaded agent IDs
   */
  getLoadedAgentIds(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Infer user mood from system context (simplified)
   */
  private inferUserMood(context: SystemContext): 'happy' | 'neutral' | 'tired' {
    if (context.userState === 'confused' || context.userState === 'stuck') {
      return 'tired';
    }
    if (context.userState === 'engaged') {
      return 'happy';
    }
    return 'neutral';
  }

  /**
   * Log observability event
   */
  private emitEvent(event: { kind: string; timestamp: string; [key: string]: unknown }): void {
    this.log.debug('event', { event });
  }

  /**
   * Clear all loaded state (for testing)
   */
  clear(): void {
    this.triggers.clear();
    this.openers.clear();
    this.idiomRegistry.clear();
    this.scmInstances.clear();
    this.configs.clear();
    this.scmPolicies.clear();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a BehaviorLoader instance
 */
export function createBehaviorLoader(config?: BehaviorLoaderConfig): BehaviorLoader {
  return new BehaviorLoader(config);
}

/**
 * Load behaviors for multiple agents
 */
export function loadBehaviorsFromConfigs(
  personas: PersonaConfig[],
  config?: BehaviorLoaderConfig
): BehaviorLoader {
  const loader = createBehaviorLoader(config);
  for (const persona of personas) {
    loader.loadFromPersonaConfig(persona);
  }
  return loader;
}