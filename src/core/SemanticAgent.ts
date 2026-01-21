/**
 * SemanticAgent - Canonical Agent Type
 *
 * This is the primary agent type for the Chrysalis system, representing
 * agents operating in semantic/meaning space with experience sync capabilities.
 *
 * Mirrors the Rust implementation at src/rust/chrysalis-core/src/agent.rs
 *
 * @version 2.0.0
 */

// =============================================================================
// Component Types
// =============================================================================

export interface AgentIdentity {
  id: string;
  name: string;
  designation: string;
  bio?: string | string[];
  fingerprint?: string;
  created: string;
  version: string;
}

export interface AgentPersonality {
  coreTraits: string[];
  values: string[];
  quirks: string[];
  fears?: string[];
  aspirations?: string[];
  emotionalRanges?: Record<string, [number, number]>;
}

export interface AgentCommunication {
  style: Record<string, string[]>;
  signaturePhrases?: string[];
  voice?: {
    tone?: string;
    formality?: string;
    humor?: string;
  };
}

export interface AgentCapabilities {
  primary: string[];
  secondary: string[];
  domains: string[];
  tools?: string[];
  learnedSkills?: LearnedSkill[];
}

export interface LearnedSkill {
  name: string;
  proficiency: number;
  learnedAt: string;
  source?: string;
}

export interface AgentKnowledge {
  facts: string[];
  topics: string[];
  expertise: string[];
  sources?: string[];
  lore?: Record<string, unknown>;
  accumulatedKnowledge?: AccumulatedKnowledge[];
}

export interface AccumulatedKnowledge {
  topic: string;
  content: string;
  confidence: number;
  learnedAt: string;
}

export interface AgentMemory {
  type: 'ephemeral' | 'persistent' | 'hybrid';
  provider: string;
  settings: Record<string, unknown>;
  collections?: string[];
}

export interface AgentBeliefs {
  who: string[];
  what: string[];
  why: string[];
  how: string[];
  where?: string[];
  when?: string[];
  huh?: string[];
}

export interface AgentTraining {
  examples?: TrainingExample[];
  finetuning?: FineTuningConfig;
}

export interface TrainingExample {
  input: string;
  output: string;
  context?: string;
}

export interface FineTuningConfig {
  baseModel: string;
  adapter?: string;
  epochs?: number;
}

export interface AgentInstances {
  active: AgentInstance[];
  terminated: AgentInstance[];
}

export interface AgentInstance {
  instanceId: string;
  startedAt: string;
  lastActive: string;
  state: 'running' | 'paused' | 'terminated';
  metadata?: Record<string, unknown>;
}

export interface ExperienceSyncConfig {
  enabled: boolean;
  defaultProtocol: 'streaming' | 'lumped' | 'check_in';
  transport?: {
    type: string;
    endpoint?: string;
  };
  streaming?: {
    batchSize: number;
    flushIntervalMs: number;
  };
  lumped?: {
    intervalMs: number;
  };
  checkIn?: {
    intervalMs: number;
  };
  mergeStrategy: MergeStrategy;
}

export interface MergeStrategy {
  conflictResolution: 'latest_wins' | 'merge' | 'manual';
  memoryDeduplication: boolean;
  skillAggregation: 'max' | 'average' | 'sum';
  knowledgeVerificationThreshold: number;
}

export interface AgentProtocols {
  mcp?: McpConfig;
  a2a?: A2aConfig;
  agentProtocol?: AgentProtocolConfig;
}

export interface McpConfig {
  enabled: boolean;
  serverEndpoint?: string;
  tools?: string[];
  resources?: string[];
}

export interface A2aConfig {
  enabled: boolean;
  agentCard?: Record<string, unknown>;
}

export interface AgentProtocolConfig {
  enabled: boolean;
  taskEndpoint?: string;
}

export interface AgentExecution {
  llm: LlmConfig;
  runtime: RuntimeConfig;
}

export interface LlmConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  parameters?: Record<string, unknown>;
}

export interface RuntimeConfig {
  timeout: number;
  maxIterations: number;
  retryPolicy?: RetryPolicy;
  errorHandling: 'strict' | 'graceful';
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
}

export interface AgentDeployment {
  environment: 'development' | 'staging' | 'production';
  scaling?: ScalingConfig;
  healthCheck?: HealthCheckConfig;
}

export interface ScalingConfig {
  minInstances: number;
  maxInstances: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
}

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
}

export interface AgentMetadata {
  version: string;
  schemaVersion: string;
  created: string;
  updated: string;
  author?: string;
  tags?: string[];
  sourceFramework?: string;
  evolution?: EvolutionHistory[];
}

export interface EvolutionHistory {
  version: string;
  timestamp: string;
  changes: string[];
}

// =============================================================================
// Main SemanticAgent Interface
// =============================================================================

/**
 * SemanticAgent - The canonical agent representation in Chrysalis
 *
 * Agents operate agentically in semantic/meaning space with support for:
 * - Multiple implementation types (MCP, Multi-Agent, Orchestrated)
 * - Experience synchronization across instances
 * - Instance tracking and lifecycle management
 * - Multi-protocol support (MCP, A2A, Agent Protocol)
 */
export interface SemanticAgent {
  /** Unique agent identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Agent version */
  version: string;

  /** Schema version for serialization */
  schemaVersion: string;

  /** Agent identity information */
  identity: AgentIdentity;

  /** Personality traits and characteristics */
  personality: AgentPersonality;

  /** Communication style and voice */
  communication: AgentCommunication;

  /** Agent capabilities and skills */
  capabilities: AgentCapabilities;

  /** Knowledge base */
  knowledge: AgentKnowledge;

  /** Memory configuration */
  memory: AgentMemory;

  /** Agent beliefs (who/what/why/how) */
  beliefs: AgentBeliefs;

  /** Training configuration (optional) */
  training?: AgentTraining;

  /** Instance tracking */
  instances: AgentInstances;

  /** Experience sync configuration */
  experienceSync: ExperienceSyncConfig;

  /** Protocol configurations */
  protocols: AgentProtocols;

  /** Execution configuration */
  execution: AgentExecution;

  /** Deployment configuration (optional) */
  deployment?: AgentDeployment;

  /** Metadata */
  metadata: AgentMetadata;
}

// =============================================================================
// Validation
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Validate a SemanticAgent
 */
export function validateAgent(agent: Partial<SemanticAgent>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!agent.id) {
    errors.push({ field: 'id', message: 'Agent ID is required', code: 'MISSING_ID' });
  }
  if (!agent.name) {
    errors.push({ field: 'name', message: 'Agent name is required', code: 'MISSING_NAME' });
  }
  if (!agent.identity?.designation) {
    errors.push({ field: 'identity.designation', message: 'Agent designation is required', code: 'MISSING_DESIGNATION' });
  }

  // Warnings for optional but recommended
  if (!agent.personality?.coreTraits?.length) {
    warnings.push('Agent has no core traits defined');
  }
  if (!agent.capabilities?.primary?.length) {
    warnings.push('Agent has no primary capabilities defined');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a minimal SemanticAgent with required fields only
 */
export function createMinimalAgent(
  id: string,
  name: string,
  designation: string
): SemanticAgent {
  const now = new Date().toISOString();

  return {
    id,
    name,
    version: '1.0.0',
    schemaVersion: '2.0.0',
    identity: {
      id,
      name,
      designation,
      created: now,
      version: '1.0.0',
    },
    personality: {
      coreTraits: [],
      values: [],
      quirks: [],
    },
    communication: {
      style: { all: [] },
    },
    capabilities: {
      primary: [],
      secondary: [],
      domains: [],
    },
    knowledge: {
      facts: [],
      topics: [],
      expertise: [],
    },
    memory: {
      type: 'hybrid',
      provider: 'default',
      settings: {},
    },
    beliefs: {
      who: [],
      what: [],
      why: [],
      how: [],
    },
    instances: {
      active: [],
      terminated: [],
    },
    experienceSync: {
      enabled: false,
      defaultProtocol: 'streaming',
      mergeStrategy: {
        conflictResolution: 'latest_wins',
        memoryDeduplication: true,
        skillAggregation: 'max',
        knowledgeVerificationThreshold: 0.7,
      },
    },
    protocols: {},
    execution: {
      llm: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        temperature: 0.7,
        maxTokens: 4096,
      },
      runtime: {
        timeout: 300000,
        maxIterations: 25,
        errorHandling: 'graceful',
      },
    },
    metadata: {
      version: '1.0.0',
      schemaVersion: '2.0.0',
      created: now,
      updated: now,
    },
  };
}

/**
 * Parse agent from JSON string
 */
export function parseAgent(json: string): SemanticAgent {
  return JSON.parse(json) as SemanticAgent;
}

/**
 * Serialize agent to JSON string
 */
export function serializeAgent(agent: SemanticAgent, pretty = false): string {
  return pretty ? JSON.stringify(agent, null, 2) : JSON.stringify(agent);
}

// Default export
export default SemanticAgent;
