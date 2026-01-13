/**
 * System Agents Types
 *
 * Type definitions for the System Agents Layer (Horizontal 2).
 * These types bridge the JSON persona configurations to the runtime TypeScript system.
 *
 * @module agents/system/types
 */

import type { AgentBinding, ChatPanePosition } from '../../components/ChrysalisWorkspace/types';

// =============================================================================
// Persona Types
// =============================================================================

/**
 * System agent persona identifiers
 */
export type SystemAgentPersonaId = 'ada' | 'lea' | 'phil' | 'david';

/**
 * Model tier for complexity-based routing
 */
export type ModelTier = 'local_slm' | 'cloud_llm' | 'hybrid';

/**
 * Interaction state for agent engagement
 */
export type InteractionState = 'responsive' | 'proactive' | 'disengaged';

/**
 * Evaluation dimension with weight
 */
export interface EvaluationDimension {
  weight: number;
  description: string;
}

/**
 * Model configuration from persona config
 */
export interface ModelConfig {
  modelTier: ModelTier;
  localModel: {
    provider: string;
    model: string;
    useCases: string[];
  };
  cloudModel: {
    provider: string;
    model: string;
    useCases: string[];
  };
  contextWindow: number;
  defaultTemperature: number;
  latencyBudgetMs: number;
}

/**
 * Memory configuration for persona
 */
export interface PersonaMemoryConfig {
  access: 'read' | 'write' | 'read_write';
  namespace: string;
  scopes: {
    episodic: {
      description: string;
      retentionDays: number;
      promotionThreshold: number;
    };
    semantic: {
      description: string;
      retentionDays: number;
      promotionThreshold: number;
    };
    procedural: {
      description: string;
      retentionDays: number;
      promotionThreshold: number;
    };
  };
  integration: {
    beadsService: {
      maxItems: number;
      ttlSeconds: number;
      promotionEnabled: boolean;
    };
    fireproofService: {
      dbName: string;
      promotionEnabled: boolean;
      localVectorCache: boolean;
    };
    zepHooks: {
      enabled: boolean;
      syncInterval: number;
    };
  };
}

/**
 * Escalation rules for human oversight
 */
export interface EscalationRules {
  riskThresholds: {
    autoApply: { max: number };
    supervised: { min: number; max: number };
    humanApproval: { min: number };
  };
  criticalBypassThreshold: number;
  conflictResolution: 'defer_to_coordinator' | 'majority_vote' | 'escalate_to_human';
}

/**
 * Collaborator relationship definition
 */
export interface CollaboratorRelationship {
  relationship: 'complementary' | 'receives_from' | 'advisory' | 'oversight';
  handoff: string;
}

/**
 * Raw persona configuration from JSON
 */
export interface PersonaConfig {
  id: SystemAgentPersonaId;
  name: string;
  fullName: string;
  role: string;
  description: string;
  personaSource: string;
  evaluationDimensions: Record<string, EvaluationDimension>;
  outputSchema: Record<string, unknown>;
  modelConfig: ModelConfig;
  defaultTools: string[];
  memoryConfig: PersonaMemoryConfig;
  telemetryConfig: {
    level: string;
    metrics: string[];
    sampling: number;
  };
  interactionStates: Record<InteractionState, {
    description: string;
    timeout?: number | null;
    triggers?: string[];
    dndEnabled?: boolean;
    dndExpiryHours?: number;
  }>;
  escalationRules: EscalationRules;
  dependencies: SystemAgentPersonaId[];
  collaborators: Record<string, CollaboratorRelationship>;
  inputFromDependencies?: Record<string, {
    fields: string[];
    minConfidence: number;
    fallbackBehavior: string;
  }>;
  promptSetId: string;
  version: string;
  lastUpdated: string;
}

// =============================================================================
// System Agent Binding (extends AgentBinding)
// =============================================================================

/**
 * Options for persona evaluation calls
 */
export interface EvaluationOptions {
  temperature: number;
  maxTokens: number;
  timeout: number;
}

/**
 * Result from a single persona evaluation
 */
export interface EvaluationResult {
  scorecard: Record<string, number | string[]>;
  riskScore: number;
  confidence: number;
  recommendations: string[];
  requiresHumanReview: boolean;
}

/**
 * Extended agent binding with system agent specifics.
 * This is a class (not interface) because it has methods.
 */
export interface SystemAgentBindingConfig {
  /** Persona identifier */
  personaId: SystemAgentPersonaId;

  /** Full persona configuration */
  config: PersonaConfig;

  /** Default prompt template ID */
  defaultPrompt: string;

  /** Available prompt template IDs */
  availablePrompts: string[];

  /** Memory namespace for this persona */
  memoryNamespace: string;

  /** Fireproof database name */
  fireproofDbName: string;

  /** Model tier for complexity routing */
  modelTier: ModelTier;

  /** Current interaction state */
  interactionState: InteractionState;

  /** Dependencies (must run before this agent) */
  dependencies: SystemAgentPersonaId[];

  /** Icon emoji */
  icon: string;
}

/**
 * System Agent Binding - runtime instance of a persona
 * Extends AgentBinding interface and adds evaluation capability
 */
export interface SystemAgentBinding extends AgentBinding {
  /** Persona identifier */
  personaId: SystemAgentPersonaId;

  /** Full persona configuration */
  config: PersonaConfig;

  /** Default prompt template ID */
  defaultPrompt: string;

  /** Available prompt template IDs */
  availablePrompts: string[];

  /** Memory namespace for this persona */
  memoryNamespace: string;

  /** Fireproof database name */
  fireproofDbName: string;

  /** Model tier for complexity routing */
  modelTier: ModelTier;

  /** Current interaction state */
  interactionState: InteractionState;

  /** Dependencies (must run before this agent) */
  dependencies: SystemAgentPersonaId[];

  /** Icon emoji */
  icon: string;

  /**
   * Execute evaluation with this persona
   * @param prompt - The evaluation prompt
   * @param options - Evaluation options (temperature, maxTokens, timeout)
   * @returns Evaluation result with scorecard, risk, recommendations
   */
  evaluate(prompt: string, options: EvaluationOptions): Promise<EvaluationResult>;
}

// =============================================================================
// Routing Types
// =============================================================================

/**
 * Chat pane configuration from routing_config.json
 */
export interface ChatPaneConfig {
  personaId: SystemAgentPersonaId | 'coordinator';
  displayName: string;
  description: string;
  icon: string;
  defaultPrompt: string;
  availablePrompts?: string[];
  pipelineMode?: boolean;
  pipelineStages?: SystemAgentPersonaId[];
  quickActions: Array<{
    label: string;
    promptId?: string;
    pipelineMode?: string;
    variant: string;
    stages?: SystemAgentPersonaId[];
  }>;
  inputHints: {
    placeholder: string;
    supportedTypes: string[];
    languageDetection?: boolean;
  };
  outputDisplay: Record<string, boolean>;
}

/**
 * Parsed mention from user input
 */
export interface ParsedMention {
  personaId: SystemAgentPersonaId | 'evaluate';
  startIndex: number;
  endIndex: number;
  originalText: string;
}

/**
 * Message routing result
 */
export interface RoutingResult {
  /** Target persona(s) for the message */
  targets: SystemAgentPersonaId[];

  /** Whether to run full evaluation pipeline */
  runPipeline: boolean;

  /** Content with mentions stripped */
  cleanContent: string;

  /** All parsed mentions */
  mentions: ParsedMention[];
}

// =============================================================================
// Evaluation Types
// =============================================================================

/**
 * Conflict types detected during multi-agent evaluation
 */
export type ConflictType =
  | 'risk_disagreement'      // Ada says low risk, Lea says high
  | 'confidence_mismatch'    // Phil says overconfident, others don't
  | 'unanimous_warning'      // David flags unanimous agreement as suspicious
  | 'threshold_boundary';    // Output is near escalation boundary

/**
 * Resolution strategies for conflicts
 */
export type ResolutionStrategy =
  | 'defer_to_coordinator'   // Use weighted aggregation
  | 'escalate_to_human'      // Require human decision
  | 'conservative_bound'     // Take worst-case estimate
  | 'delphi_round';          // Run another evaluation round

/**
 * Output from a single persona evaluation in the pipeline
 */
export interface PersonaOutput {
  personaId: SystemAgentPersonaId;
  scorecard: Record<string, number | string[]>;
  riskScore: number;
  confidence: number;
  recommendations: string[];
  requiresHumanReview: boolean;
  timestamp: Date;
  latencyMs: number;
}

/**
 * Single persona evaluation result (legacy format)
 */
export interface PersonaEvaluationResult {
  personaId: SystemAgentPersonaId;
  scorecard: Record<string, number>;
  riskScore: number;
  recommendations: string[];
  requiresHumanReview: boolean;
  confidence: number;
  latencyMs: number;
  modelUsed: string;
}

/**
 * Metacognitive metadata from David's analysis
 */
export interface MetacognitiveMetadata {
  overconfidenceRisk: number;
  blindSpots: string[];
  biasesIdentified: string[];
  humilityScore: number;
}

/**
 * Aggregated evaluation from all personas
 *
 * Theoretical foundation:
 * - Delphi Method: Iterative expert consensus with feedback
 * - Tetlock Superforecasting: Brier scores, calibration tracking
 * - Social Choice Theory: Weighted aggregation with conflict resolution
 *
 * @see Tetlock, P.E. & Gardner, D. (2015). Superforecasting
 */
export interface AggregatedEvaluation {
  /** Individual persona results (legacy format) */
  personaResults?: PersonaEvaluationResult[];

  /** Individual persona outputs (new format with full details) */
  personaOutputs?: Record<string, PersonaOutput>;

  /** Weighted aggregate risk score (0-1) */
  aggregatedRiskScore: number;

  /** Legacy alias for aggregatedRiskScore */
  aggregateScore?: number;

  /** Legacy alias for aggregatedRiskScore */
  overallRisk?: number;

  /** Weighted aggregate confidence (0-1) */
  aggregatedConfidence: number;

  /** Combined recommendations from all personas */
  recommendations: string[];

  /** Whether human review is required */
  requiresHumanReview: boolean;

  /** Detected conflicts between persona evaluations */
  conflicts?: ConflictType[];

  /** Legacy conflict format */
  conflictsLegacy?: Array<{
    personas: [SystemAgentPersonaId, SystemAgentPersonaId];
    dimension: string;
    scoreDiff: number;
  }>;

  /** Resolution strategy applied to conflicts */
  resolution?: ResolutionStrategy;

  /** Escalation level based on risk thresholds */
  escalationLevel?: 'autoApply' | 'supervised' | 'humanApproval';

  /** Metacognitive analysis from David */
  metacognitive?: MetacognitiveMetadata;

  /** Final verdict */
  verdict?: 'approve' | 'review' | 'reject';

  /** Unique evaluation ID */
  evaluationId: string;

  /** Total pipeline latency in ms */
  totalLatencyMs: number;

  /** Aggregation metadata (legacy format) */
  metadata?: {
    evaluatedAt: string;
    totalLatencyMs: number;
    pipelineStages: SystemAgentPersonaId[];
  };
}

// =============================================================================
// WebSocket Message Types
// =============================================================================

/**
 * Client → Server message
 */
export interface AgentWSClientMessage {
  type: 'chat' | 'evaluate' | 'status' | 'subscribe';
  messageId: string;
  content?: string;
  targetPersona?: SystemAgentPersonaId | 'evaluate';
  artifactType?: string;
  sessionId?: string;
}

/**
 * Server → Client message
 */
export interface AgentWSServerMessage {
  type: 'response' | 'evaluation' | 'status' | 'error' | 'typing';
  messageId: string;
  personaId?: SystemAgentPersonaId;
  content?: string;
  evaluation?: AggregatedEvaluation;
  personaResult?: PersonaEvaluationResult;
  status?: InteractionState;
  error?: string;
}

// =============================================================================
// Exports
// =============================================================================

export const PERSONA_IDS: SystemAgentPersonaId[] = ['ada', 'lea', 'phil', 'david'];

export const PERSONA_ICONS: Record<SystemAgentPersonaId | 'evaluate', string> = {
  ada: '🏗️',
  lea: '👩‍💻',
  phil: '📊',
  david: '🛡️',
  evaluate: '🔄',
};

export const PERSONA_DISPLAY_NAMES: Record<SystemAgentPersonaId, string> = {
  ada: 'Ada - Algorithmic Architect',
  lea: 'Lea - Implementation Reviewer',
  phil: 'Phil - Forecast Analyst',
  david: 'David - Metacognitive Guardian',
};

/**
 * Evaluation pipeline order (dependencies respected)
 */
export const EVALUATION_PIPELINE_ORDER: SystemAgentPersonaId[] = [
  'ada',   // Stage 1: Structural analysis
  'lea',   // Stage 2: Implementation review (depends on ada)
  'phil',  // Stage 3: Forecast analysis (depends on lea)
  'david', // Stage 4: Metacognitive audit (depends on all)
];

/**
 * Aggregation weights from routing_config.json
 */
export const AGGREGATION_WEIGHTS: Record<SystemAgentPersonaId, number> = {
  ada: 0.25,
  lea: 0.30,
  phil: 0.20,
  david: 0.25,
};
