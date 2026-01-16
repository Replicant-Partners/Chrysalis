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
  behavior?: {
    jobs?: Array<Record<string, unknown>>;
    conversation_triggers?: Array<Record<string, unknown>>;
    openers?: Array<Record<string, unknown>>;
    idioms?: Array<Record<string, unknown>>;
  };
  scm_policy?: {
    initiative?: Record<string, unknown>;
    turn_taking?: Record<string, unknown>;
    coaching?: Record<string, unknown>;
    creativity?: Record<string, unknown>;
    coordination?: Record<string, unknown>;
    repair?: Record<string, unknown>;
  };
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

// =============================================================================
// SCM Policy Types (Shared Conversational Middleware)
// =============================================================================

/**
 * Initiative triggers for proactive agent behavior
 */
export type InitiativeTrigger =
  | 'direct_mention'
  | 'question_to_me'
  | 'confusion'
  | 'stuck'
  | 'low_morale'
  | 'risk'
  | 'idea_request';

/**
 * Initiative policy controls when an agent speaks proactively
 */
export interface InitiativePolicy {
  mode: 'only_when_asked' | 'can_interject' | 'proactive';
  triggers: InitiativeTrigger[];
  cooldown_ms: number;
  max_msgs_per_10min: number;
}

/**
 * Turn-taking policy controls conversation flow
 */
export interface TurnTakingPolicy {
  interrupt_ok: boolean;
  max_questions_per_reply: number;
  max_lines: number;
  allow_repetition_for_empathy: boolean;
}

/**
 * Repair signals for detecting misunderstanding
 */
export type RepairSignal =
  | 'confusion'
  | 'contradiction'
  | 'repeated_failure'
  | 'explicit_request';

/**
 * Repair policy controls how agents handle misunderstanding
 */
export interface RepairPolicy {
  enabled: boolean;
  signals: RepairSignal[];
  strategy: 'clarify' | 'reflect_then_clarify' | 'summarize_then_ask';
}

/**
 * Coaching style options
 */
export type CoachingStyle = 'socratic' | 'directive' | 'motivational_interviewing' | 'mixed';

/**
 * Coaching policy controls how agents provide guidance
 */
export interface CoachingPolicy {
  style: CoachingStyle;
  ask_permission_before_advice: boolean;
  autonomy_language: 'high' | 'medium' | 'low';
  boundaries: string[];
}

/**
 * Creativity techniques available
 */
export type CreativityTechnique =
  | 'SCAMPER'
  | 'SixHats'
  | 'analogies'
  | 'constraints'
  | 'random_word'
  | 'bad_ideas_first'
  | 'perspective_rotation'
  | 'morphological_analysis';

/**
 * Creativity policy controls divergent/convergent thinking
 */
export interface CreativityPolicy {
  mode: 'divergent' | 'convergent' | 'oscillate';
  techniques: CreativityTechnique[];
  n_ideas_default: number;
  anti_takeover: boolean;
  risk_tolerance: 'safe' | 'medium' | 'wild';
}

/**
 * Coordination tags for multi-agent diversity
 */
export type CoordinationTag =
  | 'planning'
  | 'ops'
  | 'creative'
  | 'coach'
  | 'critic'
  | 'builder';

/**
 * Coordination policy controls multi-agent arbitration
 */
export interface CoordinationPolicy {
  priority: number;
  complement_tags: CoordinationTag[];
  yield_to: string[];
  speak_probability?: number;
}

/**
 * Complete SCM Policy combining all sub-policies
 *
 * @see Pattern 12: SHARED CONVERSATION MIDDLEWARE
 */
export interface SCMPolicy {
  initiative: InitiativePolicy;
  turn_taking: TurnTakingPolicy;
  repair: RepairPolicy;
  coaching: CoachingPolicy;
  creativity: CreativityPolicy;
  coordination: CoordinationPolicy;
}

/**
 * Default SCM policy for agents without explicit configuration
 */
export const DEFAULT_SCM_POLICY: SCMPolicy = {
  initiative: {
    mode: 'can_interject',
    triggers: ['direct_mention', 'confusion'],
    cooldown_ms: 5000,
    max_msgs_per_10min: 10,
  },
  turn_taking: {
    interrupt_ok: false,
    max_questions_per_reply: 1,
    max_lines: 10,
    allow_repetition_for_empathy: true,
  },
  repair: {
    enabled: true,
    signals: ['confusion', 'explicit_request'],
    strategy: 'clarify',
  },
  coaching: {
    style: 'socratic',
    ask_permission_before_advice: true,
    autonomy_language: 'high',
    boundaries: ['no_diagnosis', 'no_shame'],
  },
  creativity: {
    mode: 'oscillate',
    techniques: ['analogies', 'constraints'],
    n_ideas_default: 3,
    anti_takeover: true,
    risk_tolerance: 'safe',
  },
  coordination: {
    priority: 0.5,
    complement_tags: [],
    yield_to: [],
  },
};

// =============================================================================
// Behavior Configuration Types
// =============================================================================

/**
 * Job schedule configuration
 */
export interface JobSchedule {
  type: 'cron' | 'interval' | 'event';
  value: string;
  timezone?: string;
  start_delay_seconds?: number;
  filters?: Record<string, unknown>;
}

/**
 * Job definition for agent behavior
 */
export interface JobDefinition {
  job_id: string;
  name: string;
  description?: string;
  schedule: JobSchedule;
  enabled: boolean;
  priority: 'high' | 'medium' | 'low';
  timeout_seconds: number;
  retry?: {
    max_attempts: number;
    backoff_seconds: number;
  };
  data_sources?: string[];
  outputs?: string[];
  rights_required?: string[];
}

/**
 * Trigger condition types
 */
export type TriggerConditionType = 'time_since_last' | 'event' | 'metric' | 'user_state';

/**
 * Conversation trigger definition
 */
export interface ConversationTrigger {
  trigger_id: string;
  name: string;
  condition: {
    type: TriggerConditionType;
    parameters: Record<string, unknown>;
  };
  cooldown_seconds: number;
  enabled: boolean;
  priority: 'high' | 'medium' | 'low';
  context_required?: string[];
}

/**
 * Opener variation with conditions
 */
export interface OpenerVariation {
  text: string;
  weight: number;
  conditions?: {
    time_of_day?: 'morning' | 'afternoon' | 'evening';
    user_mood?: 'happy' | 'neutral' | 'tired';
    [key: string]: unknown;
  };
}

/**
 * Opener definition linked to triggers
 */
export interface OpenerDefinition {
  opener_id: string;
  trigger_id: string;
  variations: OpenerVariation[];
  follow_up_prompt?: string;
  tone: string;
}

/**
 * Idiom phrase with context
 */
export interface IdiomPhrase {
  text: string;
  weight: number;
  context: string[];
}

/**
 * Idiom definition for character personality
 */
export interface IdiomDefinition {
  idiom_id: string;
  category: 'catchphrase' | 'metaphor' | 'reference' | 'complaint' | 'exclamation';
  phrases: IdiomPhrase[];
  frequency: 'high' | 'medium' | 'low';
  seasonal?: {
    months?: number[];
    events?: string[];
  };
  triggers: string[];
}

/**
 * Complete behavior configuration
 *
 * @see Pattern 13: AGENT BEHAVIOR CONFIG
 */
export interface BehaviorConfig {
  jobs: JobDefinition[];
  conversation_triggers: ConversationTrigger[];
  openers: OpenerDefinition[];
  idioms: IdiomDefinition[];
}