/**
 * SystemAgentChatService - Full Integration Layer
 *
 * Connects:
 * - SystemAgentLoader (persona configs)
 * - SCMRouter (Gate → Plan → Realize)
 * - LLM providers (OpenAI, Anthropic, Ollama)
 * - Memory system (Fireproof, Beads)
 * - VoyeurBus (observability)
 *
 * This is the main entry point for system agent interactions.
 *
 * @see ../../../plans/SYSTEM_AGENT_MIDDLEWARE_ARCHITECTURE.md
 */

import type {
  SystemAgentBinding,
  SystemAgentPersonaId,
  PersonaConfig,
  SCMPolicy,
} from './types';

import {
  SystemAgentLoader,
  getSystemAgentLoader,
  type SystemAgentLoaderConfig,
} from './SystemAgentLoader';

import {
  SCMRouter,
  createSCMRouter,
  createRoutingContext,
  type SCMRoutingContext,
  type SCMRoutingResult,
  type SCMRouterConfig,
} from './SCMRouting';

import {
  BehaviorLoader,
  createBehaviorLoader,
} from './BehaviorLoader';

import { createSystemContext, type SystemContext } from './TriggerEvaluator';
import type { SCMContext, SCMGateResult, SCMIntentType } from './SharedConversationMiddleware';

import type { LLMHydrationService } from '../../services/llm/LLMHydrationService';
import type { GatewayLLMClient } from '../../services/gateway/GatewayLLMClient';
import type { VoyeurBus, VoyeurEvent } from '../../observability/VoyeurEvents';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for SystemAgentChatService
 */
export interface SystemAgentChatServiceConfig {
  /** LLM service for completions */
  llmService?: LLMHydrationService;
  /** Gateway client for Go LLM service */
  gatewayClient?: GatewayLLMClient;
  /** VoyeurBus for observability events */
  voyeur?: VoyeurBus;
  /** SCM router config */
  scmConfig?: SCMRouterConfig;
  /** System agent loader config */
  loaderConfig?: SystemAgentLoaderConfig;
  /** Enable mock mode (for testing without LLM) */
  mockMode?: boolean;
}

/**
 * Chat message from user
 */
export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;
  targetAgentId?: SystemAgentPersonaId;
  threadId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response from a system agent
 */
export interface AgentResponse {
  agentId: SystemAgentPersonaId;
  content: string;
  intentType?: SCMIntentType;
  confidence: number;
  latencyMs: number;
  memoryReferences?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Result of routing a chat message
 */
export interface ChatRoutingResult {
  /** Which agents will respond */
  respondingAgents: SystemAgentPersonaId[];
  /** Responses from each agent */
  responses: AgentResponse[];
  /** SCM routing details */
  routingResult: SCMRoutingResult;
  /** Total processing time */
  totalLatencyMs: number;
}

// =============================================================================
// SystemAgentChatService Implementation
// =============================================================================

/**
 * Main service for system agent chat interactions.
 *
 * Usage:
 * ```typescript
 * const service = new SystemAgentChatService({
 *   llmService: myLLMService,
 *   voyeur: voyeurBus,
 * });
 *
 * await service.initialize();
 *
 * // Route a user message
 * const result = await service.routeMessage({
 *   id: 'msg-123',
 *   content: '@ada analyze this pattern',
 *   role: 'user',
 *   timestamp: Date.now(),
 * });
 *
 * // Check for proactive triggers
 * const proactiveResult = await service.checkProactiveTriggers();
 * ```
 */
export class SystemAgentChatService {
  private config: SystemAgentChatServiceConfig;
  private loader: SystemAgentLoader;
  private router: SCMRouter;
  private behaviorLoader: BehaviorLoader;
  private initialized: boolean = false;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();
  private enhancedBindings: Map<SystemAgentPersonaId, SystemAgentBinding> = new Map();

  constructor(config: SystemAgentChatServiceConfig = {}) {
    this.config = {
      mockMode: false,
      ...config,
    };

    this.loader = getSystemAgentLoader(config.loaderConfig);
    this.router = createSCMRouter({
      voyeur: config.voyeur,
      ...config.scmConfig,
    });
    this.behaviorLoader = createBehaviorLoader({
      voyeur: config.voyeur,
    });
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize the service - loads all agent configs and wires up LLM access
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load all system agent configs
    await this.loader.initialize();

    // Register agents with SCM router
    const bindings = this.loader.getBindingsArray();
    for (const binding of bindings) {
      // Wire up the evaluate function to use LLM service
      const enhancedBinding = this.enhanceBindingWithLLM(binding);
      this.enhancedBindings.set(binding.personaId, enhancedBinding);
      this.router.registerAgent(enhancedBinding);

      // Load behavior config
      this.behaviorLoader.loadFromPersonaConfig(binding.config);
    }

    this.initialized = true;
    this.emitEvent({
      kind: 'system_agent_chat.initialized',
      timestamp: new Date().toISOString(),
      details: {
        agentCount: bindings.length,
        agentIds: bindings.map(b => b.personaId),
        mockMode: this.config.mockMode,
      },
    });
  }

  /**
   * Enhance a binding with working LLM evaluate function
   */
  private enhanceBindingWithLLM(binding: SystemAgentBinding): SystemAgentBinding {
    const enhanced = { ...binding };

    enhanced.evaluate = async (
      prompt: string,
      options: { temperature: number; maxTokens: number; timeout: number }
    ) => {
      const startTime = Date.now();

      // Mock mode for testing
      if (this.config.mockMode) {
        return this.mockEvaluate(binding.personaId, prompt, options);
      }

      // Try gateway client first
      if (this.config.gatewayClient) {
        try {
          const response = await this.config.gatewayClient.chat(
            `system-agent-${binding.personaId}`,
            [
              { role: 'system', content: this.buildSystemPrompt(binding) },
              { role: 'user', content: prompt },
            ]
          );

          return this.parseEvaluationResponse(response.content, Date.now() - startTime);
        } catch (error) {
          console.warn(`Gateway failed for ${binding.personaId}, trying LLM service:`, error);
        }
      }

      // Try LLM service
      if (this.config.llmService) {
        try {
          const response = await this.config.llmService.complete({
            agentId: `system-agent-${binding.personaId}`,
            messages: [
              { role: 'system', content: this.buildSystemPrompt(binding) },
              { role: 'user', content: prompt },
            ],
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          });

          return this.parseEvaluationResponse(response.content, Date.now() - startTime);
        } catch (error) {
          console.error(`LLM service failed for ${binding.personaId}:`, error);
          throw error;
        }
      }

      throw new Error(`No LLM provider configured for agent ${binding.personaId}`);
    };

    return enhanced;
  }

  /**
   * Build system prompt for a persona
   */
  private buildSystemPrompt(binding: SystemAgentBinding): string {
    const config = binding.config;
    const dimensionsList = Object.entries(config.evaluationDimensions)
      .map(([key, val]) => `- ${key}: ${val.description} (weight: ${val.weight})`)
      .join('\n');

    return `You are ${config.name}, ${config.role}.
${config.description}

Your evaluation dimensions:
${dimensionsList}

Respond in JSON format with: scorecard, riskScore, confidence, recommendations, requiresHumanReview.`;
  }

  /**
   * Parse LLM response into evaluation result
   */
  private parseEvaluationResponse(
    content: string,
    latencyMs: number
  ): {
    scorecard: Record<string, number | string[]>;
    riskScore: number;
    confidence: number;
    recommendations: string[];
    requiresHumanReview: boolean;
  } {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          scorecard: parsed.scorecard || {},
          riskScore: parsed.riskScore ?? 0.5,
          confidence: parsed.confidence ?? 0.5,
          recommendations: parsed.recommendations || [],
          requiresHumanReview: parsed.requiresHumanReview ?? false,
        };
      }
    } catch (e) {
      console.warn('Failed to parse evaluation response as JSON');
    }

    // Fallback: create minimal response
    return {
      scorecard: { rawResponse: [content.slice(0, 500)] },
      riskScore: 0.5,
      confidence: 0.5,
      recommendations: [content.slice(0, 200)],
      requiresHumanReview: true,
    };
  }

  /**
   * Mock evaluate function for testing
   */
  private async mockEvaluate(
    personaId: SystemAgentPersonaId,
    prompt: string,
    _options: { temperature: number; maxTokens: number; timeout: number }
  ): Promise<{
    scorecard: Record<string, number | string[]>;
    riskScore: number;
    confidence: number;
    recommendations: string[];
    requiresHumanReview: boolean;
  }> {
    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    const mockResponses: Record<SystemAgentPersonaId, () => {
      scorecard: Record<string, number | string[]>;
      riskScore: number;
      confidence: number;
      recommendations: string[];
      requiresHumanReview: boolean;
    }> = {
      ada: () => ({
        scorecard: {
          structuralElegance: 7 + Math.random() * 2,
          composability: 6 + Math.random() * 3,
          patternNovelty: 5 + Math.random() * 4,
        },
        riskScore: 0.3 + Math.random() * 0.3,
        confidence: 0.7 + Math.random() * 0.2,
        recommendations: ['Consider extracting common patterns', 'Good structure overall'],
        requiresHumanReview: false,
      }),
      lea: () => ({
        scorecard: {
          practicalApplicability: 7 + Math.random() * 2,
          maintainability: 6 + Math.random() * 3,
          developerErgonomics: 6 + Math.random() * 3,
        },
        riskScore: 0.25 + Math.random() * 0.3,
        confidence: 0.75 + Math.random() * 0.2,
        recommendations: ['Add more inline documentation', 'Consider edge cases'],
        requiresHumanReview: false,
      }),
      phil: () => ({
        scorecard: {
          successProbability: 0.65 + Math.random() * 0.25,
          confidenceCalibration: 6 + Math.random() * 3,
          baseRateAlignment: 7 + Math.random() * 2,
        },
        riskScore: 0.35 + Math.random() * 0.3,
        confidence: 0.7 + Math.random() * 0.2,
        recommendations: ['Base rate suggests moderate success likelihood'],
        requiresHumanReview: false,
      }),
      david: () => ({
        scorecard: {
          overconfidenceRisk: 4 + Math.random() * 3,
          blindSpotDetection: ['Edge cases in error handling', 'Performance under load'],
          biasesIdentified: ['Optimism bias detected'],
          humilityScore: 6 + Math.random() * 3,
        },
        riskScore: 0.4 + Math.random() * 0.3,
        confidence: 0.65 + Math.random() * 0.2,
        recommendations: ['Review assumptions', 'Consider failure modes'],
        requiresHumanReview: true,
      }),
    };

    return mockResponses[personaId]();
  }

  // ===========================================================================
  // Chat Routing
  // ===========================================================================

  /**
   * Route a user message through the SCM pipeline
   */
  async routeMessage(
    message: ChatMessage,
    options?: {
      threadId?: string;
      systemContext?: Partial<SystemContext>;
    }
  ): Promise<ChatRoutingResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const threadId = options?.threadId ?? message.threadId ?? 'default';

    // Store message in conversation history
    this.addToHistory(threadId, message);

    // Build routing context
    const routingContext = this.buildRoutingContext(message, threadId, options?.systemContext);

    // Get all agent bindings
    const bindings = this.loader.getBindingsArray();

    // Route through SCM
    const routingResult = this.router.route(bindings, routingContext);

    // Generate responses from winning agents
    const responses: AgentResponse[] = [];

    for (const winner of routingResult.winners) {
      // Use enhanced binding (has LLM access) instead of raw loader binding
      const binding = this.enhancedBindings.get(winner.agentId as SystemAgentPersonaId);
      if (!binding) continue;

      const responseStartTime = Date.now();

      try {
        // Generate response using the agent
        const evaluation = await binding.evaluate(
          this.buildAgentPrompt(message, threadId),
          {
            temperature: binding.config.modelConfig.defaultTemperature,
            maxTokens: 2048,
            timeout: binding.config.modelConfig.latencyBudgetMs,
          }
        );

        responses.push({
          agentId: winner.agentId as SystemAgentPersonaId,
          content: this.formatAgentResponse(evaluation, winner.gateOutput.intentType),
          intentType: winner.gateOutput.intentType,
          confidence: winner.score,
          latencyMs: Date.now() - responseStartTime,
          metadata: {
            scorecard: evaluation.scorecard,
            riskScore: evaluation.riskScore,
          },
        });

        // Record the turn
        this.behaviorLoader.recordAgentTurn(winner.agentId);

        this.emitEvent({
          kind: 'system_agent_chat.response',
          timestamp: new Date().toISOString(),
          details: {
            agentId: winner.agentId,
            intentType: winner.gateOutput.intentType,
            confidence: winner.score,
            latencyMs: Date.now() - responseStartTime,
          },
        });
      } catch (error) {
        console.error(`Failed to get response from ${winner.agentId}:`, error);

        responses.push({
          agentId: winner.agentId as SystemAgentPersonaId,
          content: `I apologize, but I encountered an error processing your request.`,
          confidence: 0,
          latencyMs: Date.now() - responseStartTime,
          metadata: { error: String(error) },
        });
      }
    }

    // Store responses in history
    for (const response of responses) {
      this.addToHistory(threadId, {
        id: `${response.agentId}-${Date.now()}`,
        content: response.content,
        role: 'assistant',
        timestamp: Date.now(),
        targetAgentId: response.agentId,
        metadata: response.metadata,
      });
    }

    return {
      respondingAgents: routingResult.winners.map(w => w.agentId as SystemAgentPersonaId),
      responses,
      routingResult,
      totalLatencyMs: Date.now() - startTime,
    };
  }

  /**
   * Build routing context from message
   */
  private buildRoutingContext(
    message: ChatMessage,
    threadId: string,
    systemContext?: Partial<SystemContext>
  ): SCMRoutingContext {
    // Detect mentions
    const mentionMatch = message.content.match(/@(ada|lea|phil|david)/i);
    const addressedTo = mentionMatch ? mentionMatch[1].toLowerCase() as SystemAgentPersonaId : undefined;

    // Get thread history
    const history = this.conversationHistory.get(threadId) || [];

    // Detect repair signals
    const riskSignals = this.detectRiskSignals(message.content, history);

    return createRoutingContext({
      agentId: addressedTo ?? 'system',
      latestTurnId: message.id,
      addressedToMe: !!addressedTo,
      riskSignals,
      lastNTurns: history.slice(-5).map(m => ({
        speakerId: m.targetAgentId ?? (m.role === 'user' ? 'user' : 'assistant'),
        content: m.content,
        timestamp: m.timestamp,
      })),
      systemContext: systemContext ? createSystemContext(systemContext) : undefined,
    });
  }

  /**
   * Detect risk signals in message
   */
  private detectRiskSignals(
    content: string,
    history: ChatMessage[]
  ): Array<'confusion' | 'repeated_failure' | 'contradiction' | 'explicit_request'> {
    const signals: Array<'confusion' | 'repeated_failure' | 'contradiction' | 'explicit_request'> = [];

    const lower = content.toLowerCase();

    // Confusion indicators
    if (lower.includes("don't understand") || lower.includes('confused') || lower.includes('what do you mean')) {
      signals.push('confusion');
    }

    // Contradiction indicators
    if (lower.includes('not working') || lower.includes('why') || lower.includes("doesn't make sense")) {
      signals.push('contradiction');
    }

    // Check for repeated similar messages (failure)
    const recentUserMessages = history.filter(m => m.role === 'user').slice(-3);
    if (recentUserMessages.length >= 2) {
      const lastTwo = recentUserMessages.slice(-2);
      const similarity = this.calculateSimilarity(lastTwo[0].content, lastTwo[1].content);
      if (similarity > 0.7) {
        signals.push('repeated_failure');
      }
    }

    return signals;
  }

  /**
   * Simple string similarity calculation
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }

  /**
   * Build prompt for agent
   */
  private buildAgentPrompt(message: ChatMessage, threadId: string): string {
    const history = this.conversationHistory.get(threadId) || [];
    const recentHistory = history.slice(-5);

    let contextPart = '';
    if (recentHistory.length > 1) {
      contextPart = `\n\n## Recent Conversation\n${recentHistory
        .slice(0, -1)
        .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n')}`;
    }

    return `## User Message\n${message.content}${contextPart}`;
  }

  /**
   * Format evaluation result as chat response
   */
  private formatAgentResponse(
    evaluation: {
      scorecard: Record<string, number | string[]>;
      riskScore: number;
      confidence: number;
      recommendations: string[];
      requiresHumanReview: boolean;
    },
    intentType?: SCMIntentType
  ): string {
    // Format based on intent type
    if (intentType === 'clarify') {
      return `I'd like to clarify something: ${evaluation.recommendations[0] || 'Could you provide more details?'}`;
    }

    if (intentType === 'coach') {
      return `Here's a suggestion: ${evaluation.recommendations[0] || 'Let me help you think through this.'}\n\nConfidence: ${(evaluation.confidence * 100).toFixed(0)}%`;
    }

    // Default response format
    const parts: string[] = [];

    if (evaluation.recommendations.length > 0) {
      parts.push(evaluation.recommendations[0]);
    }

    if (evaluation.riskScore > 0.5) {
      parts.push(`\n\n⚠️ Note: Risk score is ${(evaluation.riskScore * 100).toFixed(0)}%`);
    }

    if (evaluation.requiresHumanReview) {
      parts.push('\n\n👤 This may benefit from human review.');
    }

    return parts.join('') || 'I\'ve analyzed your request. Let me know if you need more details.';
  }

  // ===========================================================================
  // Proactive Triggers
  // ===========================================================================

  /**
   * Check for proactive conversation triggers
   */
  async checkProactiveTriggers(
    threadId: string = 'default',
    systemContext?: Partial<SystemContext>
  ): Promise<Array<{
    agentId: SystemAgentPersonaId;
    opener: string;
    triggerId: string;
  }>> {
    if (!this.initialized) {
      await this.initialize();
    }

    const proactiveMessages: Array<{
      agentId: SystemAgentPersonaId;
      opener: string;
      triggerId: string;
    }> = [];

    const history = this.conversationHistory.get(threadId) || [];
    const lastUserMessage = history.filter(m => m.role === 'user').pop();

    const fullContext = createSystemContext({
      currentTimeMs: Date.now(),
      lastConversationTimeMs: lastUserMessage?.timestamp,
      userActive: true,
      recentEvents: [],
      currentMetrics: {},
      ...systemContext,
    });

    const scmContext: SCMContext = {
      agentId: 'system',
    };

    // Check each agent's behavior for triggers
    for (const personaId of ['ada', 'lea', 'phil', 'david'] as SystemAgentPersonaId[]) {
      try {
        const evaluation = await this.behaviorLoader.evaluateBehavior(
          personaId,
          fullContext,
          { ...scmContext, agentId: personaId }
        );

        if (evaluation.finalText && evaluation.gateResult.shouldSpeak) {
          proactiveMessages.push({
            agentId: personaId,
            opener: evaluation.finalText,
            triggerId: evaluation.triggeredResults[0]?.triggerId ?? 'unknown',
          });
        }
      } catch (error) {
        // Ignore evaluation errors for proactive triggers
      }
    }

    return proactiveMessages;
  }

  // ===========================================================================
  // Inter-Agent Communication
  // ===========================================================================

  /**
   * Send a message from one agent to another
   */
  async agentToAgentMessage(
    fromAgentId: SystemAgentPersonaId,
    toAgentId: SystemAgentPersonaId,
    message: string,
    context?: { threadId?: string }
  ): Promise<AgentResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const threadId = context?.threadId ?? `inter-agent-${fromAgentId}-${toAgentId}`;
    const startTime = Date.now();

    // Use enhanced binding (has LLM access) instead of raw loader binding
    const toBinding = this.enhancedBindings.get(toAgentId);
    if (!toBinding) {
      throw new Error(`Agent ${toAgentId} not found`);
    }

    const fromBinding = this.enhancedBindings.get(fromAgentId);
    const fromName = fromBinding?.config.name ?? fromAgentId;

    try {
      const evaluation = await toBinding.evaluate(
        `[Message from ${fromName}]\n${message}`,
        {
          temperature: toBinding.config.modelConfig.defaultTemperature,
          maxTokens: 2048,
          timeout: toBinding.config.modelConfig.latencyBudgetMs,
        }
      );

      const response: AgentResponse = {
        agentId: toAgentId,
        content: this.formatAgentResponse(evaluation),
        confidence: evaluation.confidence,
        latencyMs: Date.now() - startTime,
        metadata: {
          fromAgentId,
          scorecard: evaluation.scorecard,
        },
      };

      this.emitEvent({
        kind: 'system_agent_chat.inter_agent',
        timestamp: new Date().toISOString(),
        details: {
          fromAgentId,
          toAgentId,
          latencyMs: response.latencyMs,
        },
      });

      return response;
    } catch (error) {
      throw new Error(`Inter-agent communication failed: ${error}`);
    }
  }

  // ===========================================================================
  // Conversation History
  // ===========================================================================

  /**
   * Add message to conversation history
   */
  private addToHistory(threadId: string, message: ChatMessage): void {
    if (!this.conversationHistory.has(threadId)) {
      this.conversationHistory.set(threadId, []);
    }
    const history = this.conversationHistory.get(threadId)!;
    history.push(message);

    // Limit history size
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * Get conversation history for a thread
   */
  getHistory(threadId: string): ChatMessage[] {
    return [...(this.conversationHistory.get(threadId) || [])];
  }

  /**
   * Clear conversation history
   */
  clearHistory(threadId?: string): void {
    if (threadId) {
      this.conversationHistory.delete(threadId);
    } else {
      this.conversationHistory.clear();
    }
  }

  // ===========================================================================
  // Observability
  // ===========================================================================

  /**
   * Emit event to VoyeurBus
   */
  private emitEvent(event: VoyeurEvent): void {
    if (this.config.voyeur) {
      this.config.voyeur.emit(event).catch(() => {
        // Silently ignore emission errors
      });
    }
  }

  /**
   * Get metrics from the SCM router
   */
  getMetrics() {
    return this.router.getMetrics();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.router.resetMetrics();
  }

  // ===========================================================================
  // Accessors
  // ===========================================================================

  /**
   * Get the underlying loader
   */
  getLoader(): SystemAgentLoader {
    return this.loader;
  }

  /**
   * Get the underlying router
   */
  getRouter(): SCMRouter {
    return this.router;
  }

  /**
   * Get the underlying behavior loader
   */
  getBehaviorLoader(): BehaviorLoader {
    return this.behaviorLoader;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get all agent configurations
   */
  getAgentConfigs(): SystemAgentBinding[] {
    return Array.from(this.enhancedBindings.values());
  }

  /**
   * Get conversation history for a thread
   */
  getConversationHistory(threadId: string): ChatMessage[] {
    return this.conversationHistory.get(threadId) || [];
  }

  /**
   * Agent-to-agent communication (alias for agentToAgentMessage)
   */
  async agentToAgent(
    fromAgentId: SystemAgentPersonaId,
    toAgentId: SystemAgentPersonaId,
    message: string,
    threadId?: string
  ): Promise<AgentResponse | null> {
    return this.agentToAgentMessage(fromAgentId, toAgentId, message, { threadId });
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a SystemAgentChatService instance
 */
export function createSystemAgentChatService(
  config?: SystemAgentChatServiceConfig
): SystemAgentChatService {
  return new SystemAgentChatService(config);
}

/**
 * Create a chat service in mock mode for testing
 */
export function createMockChatService(): SystemAgentChatService {
  return new SystemAgentChatService({ mockMode: true });
}

export default SystemAgentChatService;
