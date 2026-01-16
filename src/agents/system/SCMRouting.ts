/**
 * SCM-aware routing for system agents
 *
 * Pattern 12: SHARED CONVERSATION MIDDLEWARE
 * Integrates Gate, Arbiter, and Behavior components for intelligent routing.
 *
 * @see ../../../Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md
 */

import type { SystemAgentBinding, SCMPolicy, CoordinationTag } from './types';
import {
  SharedConversationMiddleware,
  createSCM,
  type SCMContext,
  type SCMGateResult,
  type SCMIntentType,
} from './SharedConversationMiddleware';
import {
  AgentArbiter,
  createArbiter,
  type ArbiterCandidate,
  type ArbiterResult,
  type CandidateRanking,
  type ArbiterMetrics,
} from './AgentArbiter';
import {
  BehaviorLoader,
  type BehaviorEvaluation,
} from './BehaviorLoader';
import {
  TriggerEvaluator,
  createSystemContext,
  type SystemContext,
} from './TriggerEvaluator';
import type { VoyeurBus } from '../../observability/VoyeurEvents';

// =============================================================================
// Types
// =============================================================================

export interface SCMRoutingContext extends SCMContext {
  maxWinners?: number;
  systemContext?: Partial<SystemContext>;
}

export interface SCMRoutingResult {
  winners: CandidateRanking[];
  losers: CandidateRanking[];
  pileOnPrevented: boolean;
  arbitrationReason: string;
  gateResults: Record<string, SCMGateResult>;
  proactiveOpeners: Record<string, string>;
  metrics: ArbiterMetrics;
}

export interface SCMRouterConfig {
  maxAgentsPerTurn?: number;
  diversityWeight?: number;
  enableBehavior?: boolean;
  voyeur?: VoyeurBus;
}

// =============================================================================
// SCMRouter Class
// =============================================================================

/**
 * Routes messages to system agents using SCM policies
 */
export class SCMRouter {
  private scmInstances: Map<string, SharedConversationMiddleware> = new Map();
  private arbiter: AgentArbiter;
  private behaviorLoader: BehaviorLoader;
  private config: Required<SCMRouterConfig>;

  constructor(config: SCMRouterConfig = {}) {
    this.config = {
      maxAgentsPerTurn: config.maxAgentsPerTurn ?? 2,
      diversityWeight: config.diversityWeight ?? 0.15,
      enableBehavior: config.enableBehavior ?? true,
      voyeur: config.voyeur as VoyeurBus,
    };

    this.arbiter = createArbiter({
      maxAgentsPerTurn: this.config.maxAgentsPerTurn,
      diversityWeight: this.config.diversityWeight,
      strategy: 'priority_then_diversity',
    });

    this.behaviorLoader = new BehaviorLoader({
      voyeur: this.config.voyeur,
      enableTriggers: this.config.enableBehavior,
      enableOpeners: this.config.enableBehavior,
      enableIdioms: this.config.enableBehavior,
    });
  }

  /**
   * Register a system agent with its SCM policy
   */
  registerAgent(agent: SystemAgentBinding): void {
    // Create SCM instance with agent's policy
    const policy = agent.config.scm_policy as Partial<SCMPolicy> | undefined;
    const scm = createSCM(policy);
    this.scmInstances.set(agent.personaId, scm);

    // Load behavior config if present
    if (agent.config.behavior && this.config.enableBehavior) {
      this.behaviorLoader.loadFromPersonaConfig(agent.config);
    }
  }

  /**
   * Route a message through SCM pipeline
   *
   * Flow:
   * 1. Evaluate gate for each agent
   * 2. Apply arbitration to select winners
   * 3. Check for proactive triggers
   * 4. Return routing decision
   */
  route(
    agents: SystemAgentBinding[],
    context: SCMRoutingContext
  ): SCMRoutingResult {
    const gateResults: Record<string, SCMGateResult> = {};
    const proactiveOpeners: Record<string, string> = {};
    const candidates: ArbiterCandidate[] = [];

    // 1. Evaluate gate for each agent
    for (const agent of agents) {
      const scm = this.scmInstances.get(agent.personaId);
      if (!scm) {
        // Agent not registered, create temporary SCM
        const tempScm = createSCM(agent.config.scm_policy as Partial<SCMPolicy>);
        this.scmInstances.set(agent.personaId, tempScm);
      }

      const agentScm = this.scmInstances.get(agent.personaId)!;

      // Build context with agent-specific data
      const agentContext: SCMContext = {
        agentId: agent.personaId,
        latestTurnId: context.latestTurnId,
        participantIds: context.participantIds,
        threadState: context.threadState,
        riskSignals: context.riskSignals,
        addressedToMe: context.addressedToMe,
        lastSpokeAtMs: agentScm.getLastSpokeAt(agent.personaId),
        messagesInLast10Min: agentScm.getMessagesInWindow(agent.personaId),
      };

      const gate = agentScm.shouldSpeak(agentContext);
      gateResults[agent.personaId] = gate;

      // Get complement tags from coordination policy
      const coordination = agent.config.scm_policy?.coordination as { complement_tags?: string[] } | undefined;
      const complementTags = coordination?.complement_tags as CoordinationTag[] | undefined;

      candidates.push({
        agentId: agent.personaId,
        gate,
        complementTags,
      });
    }

    // 2. Apply arbitration
    const arbiterResult = this.arbiter.selectWinners(candidates);

    // 3. Check for proactive triggers (if behavior enabled)
    if (this.config.enableBehavior && context.systemContext) {
      for (const agent of agents) {
        const behaviorConfig = this.behaviorLoader.getBehaviorConfig(agent.personaId);
        if (behaviorConfig && behaviorConfig.conversation_triggers.length > 0) {
          // Check if any triggers fire
          const systemCtx = createSystemContext({
            ...context.systemContext,
            userActive: true,
          });

          const scmCtx: SCMContext = {
            ...context,
            agentId: agent.personaId,
          };

          this.behaviorLoader.evaluateBehavior(agent.personaId, systemCtx, scmCtx)
            .then(evaluation => {
              if (evaluation.finalText) {
                proactiveOpeners[agent.personaId] = evaluation.finalText;
              }
            })
            .catch(() => {
              // Ignore behavior evaluation errors
            });
        }
      }
    }

    // 4. Record turns for winners
    for (const winner of arbiterResult.winners) {
      const scm = this.scmInstances.get(winner.agentId);
      if (scm) {
        scm.recordTurn(winner.agentId);
      }
      this.arbiter.recordTurn(winner.agentId);
    }

    return {
      ...arbiterResult,
      gateResults,
      proactiveOpeners,
      metrics: this.arbiter.getMetrics(),
    };
  }

  /**
   * Get arbiter metrics
   */
  getMetrics(): ArbiterMetrics {
    return this.arbiter.getMetrics();
  }

  /**
   * Reset arbiter metrics
   */
  resetMetrics(): void {
    this.arbiter.resetMetrics();
  }

  /**
   * Get behavior loader for direct access
   */
  getBehaviorLoader(): BehaviorLoader {
    return this.behaviorLoader;
  }
}

// =============================================================================
// Legacy Function (Backwards Compatibility)
// =============================================================================

const DEFAULT_CONTEXT: SCMRoutingContext = {
  agentId: 'system',
  maxWinners: 1,
};

/**
 * Route with SCM (legacy function for backwards compatibility)
 */
export function routeWithSCM(
  agents: SystemAgentBinding[],
  context?: SCMRoutingContext
): SCMRoutingResult {
  const router = new SCMRouter();

  // Register all agents
  for (const agent of agents) {
    router.registerAgent(agent);
  }

  const mergedContext = { ...DEFAULT_CONTEXT, ...context };
  return router.route(agents, mergedContext);
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an SCMRouter instance
 */
export function createSCMRouter(config?: SCMRouterConfig): SCMRouter {
  return new SCMRouter(config);
}

/**
 * Create routing context from chat state
 */
export function createRoutingContext(
  options: Partial<SCMRoutingContext> = {}
): SCMRoutingContext {
  return {
    agentId: options.agentId ?? 'system',
    ...options,
  };
}
