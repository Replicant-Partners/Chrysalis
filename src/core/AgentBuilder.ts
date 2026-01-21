/**
 * AgentBuilder - Fluent Builder Pattern for SemanticAgent
 *
 * Implements the Builder pattern (Gang of Four, 1994) to provide a fluent
 * interface for constructing complex agent objects step by step.
 *
 * @module core/AgentBuilder
 */

import { SemanticAgent } from './SemanticAgent';

// =============================================================================
// Configuration Types
// =============================================================================

export interface IdentityConfig {
  id?: string;
  name: string;
  designation: string;
  bio?: string | string[];
  fingerprint?: string;
  version?: string;
}

export interface PersonalityConfig {
  coreTraits?: string[];
  values?: string[];
  quirks?: string[];
  fears?: string[];
  aspirations?: string[];
}

export interface CommunicationConfig {
  style?: Record<string, string[]>;
  signaturePhrases?: string[];
  voice?: {
    tone?: string;
    formality?: string;
    humor?: string;
  };
}

export interface CapabilityConfig {
  primary?: string[];
  secondary?: string[];
  domains?: string[];
  tools?: string[];
}

export interface KnowledgeConfig {
  facts?: string[];
  topics?: string[];
  expertise?: string[];
  sources?: string[];
}

export interface MemoryConfig {
  type?: 'ephemeral' | 'persistent' | 'hybrid';
  provider?: string;
  settings?: Record<string, unknown>;
}

export interface BeliefConfig {
  who?: string[];
  what?: string[];
  why?: string[];
  how?: string[];
}

export interface ExecutionConfig {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxIterations?: number;
}

export interface SyncConfig {
  enabled?: boolean;
  protocol?: 'streaming' | 'lumped' | 'check_in';
  conflictResolution?: 'latest_wins' | 'merge' | 'manual';
}

export interface BuilderState {
  identity: Partial<IdentityConfig>;
  personality: Partial<PersonalityConfig>;
  communication: Partial<CommunicationConfig>;
  capabilities: Partial<CapabilityConfig>;
  knowledge: Partial<KnowledgeConfig>;
  memory: Partial<MemoryConfig>;
  beliefs: Partial<BeliefConfig>;
  execution: Partial<ExecutionConfig>;
  sync: Partial<SyncConfig>;
}

// =============================================================================
// Error Types
// =============================================================================

export class AgentBuilderError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AgentBuilderError';
  }
}

// =============================================================================
// AgentBuilder Implementation
// =============================================================================

/**
 * Fluent builder for constructing SemanticAgent instances
 */
export class AgentBuilder {
  private state: BuilderState;

  constructor() {
    this.state = {
      identity: {},
      personality: {},
      communication: {},
      capabilities: {},
      knowledge: {},
      memory: {},
      beliefs: {},
      execution: {},
      sync: {},
    };
  }

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  /**
   * Set agent identity
   */
  withIdentity(config: IdentityConfig): this {
    this.state.identity = { ...this.state.identity, ...config };
    return this;
  }

  /**
   * Set agent name
   */
  withName(name: string): this {
    this.state.identity.name = name;
    return this;
  }

  /**
   * Set agent designation/role
   */
  withDesignation(designation: string): this {
    this.state.identity.designation = designation;
    return this;
  }

  /**
   * Set agent bio
   */
  withBio(bio: string | string[]): this {
    this.state.identity.bio = bio;
    return this;
  }

  // ---------------------------------------------------------------------------
  // Personality
  // ---------------------------------------------------------------------------

  /**
   * Set personality configuration
   */
  withPersonality(config: PersonalityConfig): this {
    this.state.personality = { ...this.state.personality, ...config };
    return this;
  }

  /**
   * Add core traits
   */
  withTraits(...traits: string[]): this {
    this.state.personality.coreTraits = [
      ...(this.state.personality.coreTraits || []),
      ...traits,
    ];
    return this;
  }

  /**
   * Add values
   */
  withValues(...values: string[]): this {
    this.state.personality.values = [
      ...(this.state.personality.values || []),
      ...values,
    ];
    return this;
  }

  // ---------------------------------------------------------------------------
  // Communication
  // ---------------------------------------------------------------------------

  /**
   * Set communication configuration
   */
  withCommunication(config: CommunicationConfig): this {
    this.state.communication = { ...this.state.communication, ...config };
    return this;
  }

  /**
   * Set communication style for a context
   */
  withStyle(context: string, ...styles: string[]): this {
    this.state.communication.style = {
      ...(this.state.communication.style || {}),
      [context]: styles,
    };
    return this;
  }

  // ---------------------------------------------------------------------------
  // Capabilities
  // ---------------------------------------------------------------------------

  /**
   * Set capabilities configuration
   */
  withCapabilities(config: CapabilityConfig): this {
    this.state.capabilities = { ...this.state.capabilities, ...config };
    return this;
  }

  /**
   * Add primary capabilities
   */
  withPrimaryCapabilities(...capabilities: string[]): this {
    this.state.capabilities.primary = [
      ...(this.state.capabilities.primary || []),
      ...capabilities,
    ];
    return this;
  }

  /**
   * Add domains
   */
  withDomains(...domains: string[]): this {
    this.state.capabilities.domains = [
      ...(this.state.capabilities.domains || []),
      ...domains,
    ];
    return this;
  }

  /**
   * Add tools
   */
  withTools(...tools: string[]): this {
    this.state.capabilities.tools = [
      ...(this.state.capabilities.tools || []),
      ...tools,
    ];
    return this;
  }

  // ---------------------------------------------------------------------------
  // Knowledge
  // ---------------------------------------------------------------------------

  /**
   * Set knowledge configuration
   */
  withKnowledge(config: KnowledgeConfig): this {
    this.state.knowledge = { ...this.state.knowledge, ...config };
    return this;
  }

  /**
   * Add facts
   */
  withFacts(...facts: string[]): this {
    this.state.knowledge.facts = [
      ...(this.state.knowledge.facts || []),
      ...facts,
    ];
    return this;
  }

  /**
   * Add expertise areas
   */
  withExpertise(...expertise: string[]): this {
    this.state.knowledge.expertise = [
      ...(this.state.knowledge.expertise || []),
      ...expertise,
    ];
    return this;
  }

  // ---------------------------------------------------------------------------
  // Memory
  // ---------------------------------------------------------------------------

  /**
   * Set memory configuration
   */
  withMemory(config: MemoryConfig): this {
    this.state.memory = { ...this.state.memory, ...config };
    return this;
  }

  /**
   * Use ephemeral memory (no persistence)
   */
  withEphemeralMemory(): this {
    this.state.memory.type = 'ephemeral';
    return this;
  }

  /**
   * Use persistent memory
   */
  withPersistentMemory(provider?: string): this {
    this.state.memory.type = 'persistent';
    if (provider) {
      this.state.memory.provider = provider;
    }
    return this;
  }

  /**
   * Use hybrid memory
   */
  withHybridMemory(): this {
    this.state.memory.type = 'hybrid';
    return this;
  }

  // ---------------------------------------------------------------------------
  // Beliefs
  // ---------------------------------------------------------------------------

  /**
   * Set beliefs configuration
   */
  withBeliefs(config: BeliefConfig): this {
    this.state.beliefs = { ...this.state.beliefs, ...config };
    return this;
  }

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  /**
   * Set execution configuration
   */
  withExecution(config: ExecutionConfig): this {
    this.state.execution = { ...this.state.execution, ...config };
    return this;
  }

  /**
   * Set LLM model
   */
  withModel(provider: string, model: string): this {
    this.state.execution.provider = provider;
    this.state.execution.model = model;
    return this;
  }

  /**
   * Set temperature
   */
  withTemperature(temperature: number): this {
    this.state.execution.temperature = temperature;
    return this;
  }

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------

  /**
   * Set sync configuration
   */
  withSync(config: SyncConfig): this {
    this.state.sync = { ...this.state.sync, ...config };
    return this;
  }

  /**
   * Enable experience sync
   */
  withExperienceSync(protocol?: 'streaming' | 'lumped' | 'check_in'): this {
    this.state.sync.enabled = true;
    if (protocol) {
      this.state.sync.protocol = protocol;
    }
    return this;
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  /**
   * Validate builder state
   */
  private validate(): void {
    if (!this.state.identity.name) {
      throw new AgentBuilderError('Agent name is required', 'identity.name', 'MISSING_NAME');
    }
    if (!this.state.identity.designation) {
      throw new AgentBuilderError('Agent designation is required', 'identity.designation', 'MISSING_DESIGNATION');
    }
  }

  /**
   * Build the SemanticAgent
   */
  build(): SemanticAgent {
    this.validate();

    const now = new Date().toISOString();
    const id = this.state.identity.id || crypto.randomUUID();

    return {
      id,
      name: this.state.identity.name!,
      version: this.state.identity.version || '1.0.0',
      schemaVersion: '2.0.0',
      identity: {
        id,
        name: this.state.identity.name!,
        designation: this.state.identity.designation!,
        bio: this.state.identity.bio,
        fingerprint: this.state.identity.fingerprint,
        created: now,
        version: this.state.identity.version || '1.0.0',
      },
      personality: {
        coreTraits: this.state.personality.coreTraits || [],
        values: this.state.personality.values || [],
        quirks: this.state.personality.quirks || [],
        fears: this.state.personality.fears,
        aspirations: this.state.personality.aspirations,
      },
      communication: {
        style: this.state.communication.style || { all: [] },
        signaturePhrases: this.state.communication.signaturePhrases,
        voice: this.state.communication.voice,
      },
      capabilities: {
        primary: this.state.capabilities.primary || [],
        secondary: this.state.capabilities.secondary || [],
        domains: this.state.capabilities.domains || [],
        tools: this.state.capabilities.tools,
      },
      knowledge: {
        facts: this.state.knowledge.facts || [],
        topics: this.state.knowledge.topics || [],
        expertise: this.state.knowledge.expertise || [],
        sources: this.state.knowledge.sources,
      },
      memory: {
        type: this.state.memory.type || 'hybrid',
        provider: this.state.memory.provider || 'default',
        settings: this.state.memory.settings || {},
      },
      beliefs: {
        who: this.state.beliefs.who || [],
        what: this.state.beliefs.what || [],
        why: this.state.beliefs.why || [],
        how: this.state.beliefs.how || [],
      },
      execution: {
        llm: {
          provider: this.state.execution.provider || 'anthropic',
          model: this.state.execution.model || 'claude-sonnet-4-20250514',
          temperature: this.state.execution.temperature ?? 0.7,
          maxTokens: this.state.execution.maxTokens ?? 4096,
        },
        runtime: {
          timeout: this.state.execution.timeout ?? 300000,
          maxIterations: this.state.execution.maxIterations ?? 25,
          errorHandling: 'graceful',
        },
      },
      experienceSync: {
        enabled: this.state.sync.enabled ?? false,
        defaultProtocol: this.state.sync.protocol || 'streaming',
        mergeStrategy: {
          conflictResolution: this.state.sync.conflictResolution || 'latest_wins',
          memoryDeduplication: true,
          skillAggregation: 'max',
          knowledgeVerificationThreshold: 0.7,
        },
      },
      instances: {
        active: [],
        terminated: [],
      },
      protocols: {},
      metadata: {
        version: this.state.identity.version || '1.0.0',
        schemaVersion: '2.0.0',
        created: now,
        updated: now,
      },
    } as SemanticAgent;
  }

  /**
   * Get current builder state (for debugging)
   */
  getState(): BuilderState {
    return { ...this.state };
  }

  /**
   * Reset builder state
   */
  reset(): this {
    this.state = {
      identity: {},
      personality: {},
      communication: {},
      capabilities: {},
      knowledge: {},
      memory: {},
      beliefs: {},
      execution: {},
      sync: {},
    };
    return this;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new AgentBuilder instance
 */
export function createAgentBuilder(): AgentBuilder {
  return new AgentBuilder();
}

/**
 * Quick agent creation with minimal configuration
 */
export function quickAgent(name: string, designation: string): SemanticAgent {
  return new AgentBuilder()
    .withName(name)
    .withDesignation(designation)
    .build();
}
