/**
 * AgentBuilder - Fluent Builder Pattern for UniformSemanticAgentV2
 * 
 * Implements the Builder pattern (Gang of Four, 1994) to provide a fluent
 * interface for constructing complex agent objects step by step.
 * 
 * Benefits:
 * - Prevents invalid agent states through validation
 * - Improves developer experience with fluent API
 * - Separates construction from representation
 * - Enables different agent configurations from same construction process
 * 
 * @see Design Patterns: Elements of Reusable Object-Oriented Software
 *      Gamma, Helm, Johnson, Vlissides (1994), Chapter: Builder Pattern
 * @see docs/DESIGN_PATTERN_ANALYSIS.md - Section 1.1: Builder Pattern
 * 
 * @module core/AgentBuilder
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  UniformSemanticAgentV2,
  Episode,
  Concept,
  Belief,
  ToolDefinition,
  Skill,
  InstanceMetadata,
  ExperienceSyncConfig,
  Protocols,
  SyncProtocol,
  AgentImplementationType,
  OODAInterrogatives,
} from './UniformSemanticAgentV2';
import { SCHEMA_VERSION, validateUniformSemanticAgentV2 } from './UniformSemanticAgentV2';

/**
 * Identity configuration for agent builder.
 */
export interface IdentityConfig {
  id?: string;
  name: string;
  designation?: string;
  bio?: string | string[];
  fingerprint?: string;
  version?: string;
}

/**
 * Personality configuration for agent builder.
 */
export interface PersonalityConfig {
  core_traits?: string[];
  values?: string[];
  quirks?: string[];
  fears?: string[];
  aspirations?: string[];
  emotional_ranges?: Record<string, {
    triggers: string[];
    expressions: string[];
    voice?: { speed: number; pitch: number };
  }>;
}

/**
 * Communication style configuration.
 */
export interface CommunicationConfig {
  style?: {
    all: string[];
    [context: string]: string[];
  };
  signature_phrases?: string[];
  voice?: {
    model?: string;
    speaker?: string;
    characteristics?: string[];
    speed?: number;
    pitch?: number;
  };
}

/**
 * Memory configuration for agent builder.
 */
export interface MemoryConfig {
  type?: 'vector' | 'graph' | 'hybrid';
  provider?: string;
  settings?: Record<string, any>;
  collections?: {
    short_term?: {
      retention: string;
      max_size: number;
    };
    long_term?: {
      storage: 'vector' | 'graph';
      embedding_model: string;
    };
    episodic?: Episode[];
    semantic?: Concept[];
  };
}

/**
 * Execution configuration for agent builder.
 */
export interface ExecutionConfig {
  llm?: {
    provider: string;
    model: string;
    temperature?: number;
    max_tokens?: number;
    parameters?: Record<string, any>;
  };
  runtime?: {
    timeout?: number;
    max_iterations?: number;
    retry_policy?: {
      max_attempts: number;
      backoff: string;
      initial_delay: number;
    };
    error_handling?: string;
  };
}

/**
 * Experience sync configuration for agent builder.
 */
export interface SyncConfig {
  enabled?: boolean;
  default_protocol?: SyncProtocol;
  streaming?: {
    enabled: boolean;
    interval_ms: number;
    batch_size: number;
    priority_threshold: number;
  };
  lumped?: {
    enabled: boolean;
    batch_interval: string;
    max_batch_size: number;
    compression: boolean;
  };
  check_in?: {
    enabled: boolean;
    schedule: string;
    include_full_state: boolean;
  };
  merge_strategy?: {
    conflict_resolution: 'latest_wins' | 'weighted_merge' | 'manual_review';
    memory_deduplication: boolean;
    skill_aggregation: 'max' | 'average' | 'weighted';
    knowledge_verification_threshold: number;
  };
}

/**
 * Builder validation error.
 */
export class AgentBuilderError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'AgentBuilderError';
  }
}

/**
 * Fluent builder for UniformSemanticAgentV2.
 * 
 * Provides step-by-step construction with validation at each step
 * and final validation on build().
 * 
 * @example
 * ```typescript
 * const agent = new AgentBuilder()
 *   .withIdentity({ name: "Lovelace", designation: "Mathematician" })
 *   .withPersonality({ core_traits: ["analytical", "creative"] })
 *   .addCapability("code_generation")
 *   .addTool({ name: "python", protocol: "native", config: {} })
 *   .withMemory({ type: "vector", provider: "lance" })
 *   .enableSync("streaming", { interval_ms: 5000 })
 *   .build();
 * ```
 */
export class AgentBuilder {
  private identity: Partial<UniformSemanticAgentV2['identity']> = {};
  private personality: Partial<UniformSemanticAgentV2['personality']> = {
    core_traits: [],
    values: [],
    quirks: [],
  };
  private communication: Partial<UniformSemanticAgentV2['communication']> = {
    style: { all: [] },
  };
  private capabilities: Partial<UniformSemanticAgentV2['capabilities']> = {
    primary: [],
    secondary: [],
    domains: [],
    tools: [],
    learned_skills: [],
  };
  private knowledge: Partial<UniformSemanticAgentV2['knowledge']> = {
    facts: [],
    topics: [],
    expertise: [],
    accumulated_knowledge: [],
  };
  private memory: Partial<UniformSemanticAgentV2['memory']> = {
    type: 'vector',
    provider: 'local',
    settings: {},
    collections: {
      episodic: [],
      semantic: [],
    },
  };
  private beliefs: Partial<UniformSemanticAgentV2['beliefs']> = {
    who: [],
    what: [],
    why: [],
    how: [],
    where: [],
    when: [],
    huh: [],
  };
  private instances: UniformSemanticAgentV2['instances'] = {
    active: [],
    terminated: [],
  };
  private experienceSync: Partial<ExperienceSyncConfig> = {
    enabled: false,
    default_protocol: 'streaming',
    merge_strategy: {
      conflict_resolution: 'latest_wins',
      memory_deduplication: true,
      skill_aggregation: 'max',
      knowledge_verification_threshold: 0.7,
    },
  };
  private protocols: Partial<Protocols> = {};
  private execution: Partial<UniformSemanticAgentV2['execution']> = {
    llm: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      max_tokens: 4096,
    },
    runtime: {
      timeout: 300,
      max_iterations: 20,
      error_handling: 'graceful_degradation',
    },
  };
  private deployment: Partial<UniformSemanticAgentV2['deployment']> = {
    preferred_contexts: [],
  };
  private metadata: Partial<UniformSemanticAgentV2['metadata']> = {
    tags: [],
  };
  private training: Partial<UniformSemanticAgentV2['training']> = {};

  /**
   * Create a new AgentBuilder instance.
   * 
   * @param template - Optional template agent to start from
   */
  constructor(template?: Partial<UniformSemanticAgentV2>) {
    if (template) {
      this.fromTemplate(template);
    }
  }

  /**
   * Initialize builder from existing agent template.
   */
  private fromTemplate(template: Partial<UniformSemanticAgentV2>): this {
    if (template.identity) this.identity = { ...template.identity };
    if (template.personality) this.personality = { ...template.personality };
    if (template.communication) this.communication = { ...template.communication };
    if (template.capabilities) this.capabilities = { ...template.capabilities };
    if (template.knowledge) this.knowledge = { ...template.knowledge };
    if (template.memory) this.memory = { ...template.memory };
    if (template.beliefs) this.beliefs = { ...template.beliefs };
    if (template.instances) this.instances = { ...template.instances };
    if (template.experience_sync) this.experienceSync = { ...template.experience_sync };
    if (template.protocols) this.protocols = { ...template.protocols };
    if (template.execution) this.execution = { ...template.execution };
    if (template.deployment) this.deployment = { ...template.deployment };
    if (template.metadata) this.metadata = { ...template.metadata };
    if (template.training) this.training = { ...template.training };
    return this;
  }

  // =========================================================================
  // Identity Configuration
  // =========================================================================

  /**
   * Set agent identity.
   * 
   * @param config - Identity configuration
   * @returns this for chaining
   * 
   * @example
   * ```typescript
   * builder.withIdentity({
   *   name: "Ada",
   *   designation: "AI Research Assistant",
   *   bio: "Specialized in machine learning and data analysis"
   * });
   * ```
   */
  withIdentity(config: IdentityConfig): this {
    if (!config.name || config.name.trim().length === 0) {
      throw new AgentBuilderError('Agent name is required', 'identity.name');
    }

    this.identity = {
      id: config.id || uuidv4(),
      name: config.name,
      designation: config.designation || '',
      bio: config.bio || '',
      fingerprint: config.fingerprint || '',
      created: new Date().toISOString(),
      version: config.version || '1.0.0',
    };

    return this;
  }

  /**
   * Set agent name (shorthand).
   */
  withName(name: string): this {
    this.identity.name = name;
    if (!this.identity.id) {
      this.identity.id = uuidv4();
    }
    return this;
  }

  /**
   * Set agent designation/role.
   */
  withDesignation(designation: string): this {
    this.identity.designation = designation;
    return this;
  }

  /**
   * Set agent bio/description.
   */
  withBio(bio: string | string[]): this {
    this.identity.bio = bio;
    return this;
  }

  // =========================================================================
  // Personality Configuration
  // =========================================================================

  /**
   * Set agent personality.
   * 
   * @param config - Personality configuration
   * @returns this for chaining
   */
  withPersonality(config: PersonalityConfig): this {
    this.personality = {
      core_traits: config.core_traits || [],
      values: config.values || [],
      quirks: config.quirks || [],
      fears: config.fears,
      aspirations: config.aspirations,
      emotional_ranges: config.emotional_ranges,
    };
    return this;
  }

  /**
   * Add core personality traits.
   */
  addTraits(...traits: string[]): this {
    this.personality.core_traits = [
      ...(this.personality.core_traits || []),
      ...traits,
    ];
    return this;
  }

  /**
   * Add values.
   */
  addValues(...values: string[]): this {
    this.personality.values = [
      ...(this.personality.values || []),
      ...values,
    ];
    return this;
  }

  /**
   * Add quirks.
   */
  addQuirks(...quirks: string[]): this {
    this.personality.quirks = [
      ...(this.personality.quirks || []),
      ...quirks,
    ];
    return this;
  }

  // =========================================================================
  // Communication Configuration
  // =========================================================================

  /**
   * Set communication style.
   */
  withCommunication(config: CommunicationConfig): this {
    this.communication = {
      style: config.style || { all: [] },
      signature_phrases: config.signature_phrases,
      voice: config.voice,
    };
    return this;
  }

  /**
   * Add communication style rules.
   */
  addStyleRules(context: string, ...rules: string[]): this {
    if (!this.communication.style) {
      this.communication.style = { all: [] };
    }
    if (!this.communication.style[context]) {
      this.communication.style[context] = [];
    }
    this.communication.style[context].push(...rules);
    return this;
  }

  /**
   * Add signature phrases.
   */
  addSignaturePhrases(...phrases: string[]): this {
    this.communication.signature_phrases = [
      ...(this.communication.signature_phrases || []),
      ...phrases,
    ];
    return this;
  }

  // =========================================================================
  // Capabilities Configuration
  // =========================================================================

  /**
   * Add primary capability.
   */
  addCapability(capability: string, isPrimary: boolean = true): this {
    if (isPrimary) {
      this.capabilities.primary = [
        ...(this.capabilities.primary || []),
        capability,
      ];
    } else {
      this.capabilities.secondary = [
        ...(this.capabilities.secondary || []),
        capability,
      ];
    }
    return this;
  }

  /**
   * Add multiple capabilities.
   */
  addCapabilities(capabilities: string[], isPrimary: boolean = true): this {
    for (const cap of capabilities) {
      this.addCapability(cap, isPrimary);
    }
    return this;
  }

  /**
   * Add domain expertise.
   */
  addDomain(domain: string): this {
    this.capabilities.domains = [
      ...(this.capabilities.domains || []),
      domain,
    ];
    return this;
  }

  /**
   * Add tool definition.
   */
  addTool(tool: ToolDefinition): this {
    this.capabilities.tools = [
      ...(this.capabilities.tools || []),
      tool,
    ];
    return this;
  }

  /**
   * Add skill.
   */
  addSkill(skill: Skill): this {
    this.capabilities.learned_skills = [
      ...(this.capabilities.learned_skills || []),
      skill,
    ];
    return this;
  }

  // =========================================================================
  // Knowledge Configuration
  // =========================================================================

  /**
   * Add facts to knowledge base.
   */
  addFacts(...facts: string[]): this {
    this.knowledge.facts = [
      ...(this.knowledge.facts || []),
      ...facts,
    ];
    return this;
  }

  /**
   * Add topics of expertise.
   */
  addTopics(...topics: string[]): this {
    this.knowledge.topics = [
      ...(this.knowledge.topics || []),
      ...topics,
    ];
    return this;
  }

  /**
   * Add expertise areas.
   */
  addExpertise(...areas: string[]): this {
    this.knowledge.expertise = [
      ...(this.knowledge.expertise || []),
      ...areas,
    ];
    return this;
  }

  // =========================================================================
  // Memory Configuration
  // =========================================================================

  /**
   * Configure memory system.
   */
  withMemory(config: MemoryConfig): this {
    this.memory = {
      type: config.type || 'vector',
      provider: config.provider || 'local',
      settings: config.settings || {},
      collections: config.collections || {
        episodic: [],
        semantic: [],
      },
    };
    return this;
  }

  /**
   * Add episodic memory (episode).
   */
  addEpisode(episode: Episode): this {
    if (!this.memory.collections) {
      this.memory.collections = { episodic: [], semantic: [] };
    }
    if (!this.memory.collections.episodic) {
      this.memory.collections.episodic = [];
    }
    this.memory.collections.episodic.push(episode);
    return this;
  }

  /**
   * Add semantic memory (concept).
   */
  addConcept(concept: Concept): this {
    if (!this.memory.collections) {
      this.memory.collections = { episodic: [], semantic: [] };
    }
    if (!this.memory.collections.semantic) {
      this.memory.collections.semantic = [];
    }
    this.memory.collections.semantic.push(concept);
    return this;
  }

  // =========================================================================
  // Beliefs Configuration
  // =========================================================================

  /**
   * Add belief.
   */
  addBelief(category: keyof UniformSemanticAgentV2['beliefs'], belief: Belief): this {
    if (!this.beliefs[category]) {
      this.beliefs[category] = [];
    }
    this.beliefs[category]!.push(belief);
    return this;
  }

  /**
   * Add multiple beliefs to a category.
   */
  addBeliefs(category: keyof UniformSemanticAgentV2['beliefs'], beliefs: Belief[]): this {
    for (const belief of beliefs) {
      this.addBelief(category, belief);
    }
    return this;
  }

  // =========================================================================
  // Sync Configuration
  // =========================================================================

  /**
   * Enable experience synchronization.
   */
  enableSync(protocol: SyncProtocol = 'streaming', config?: Partial<SyncConfig>): this {
    this.experienceSync = {
      enabled: true,
      default_protocol: protocol,
      ...config,
      merge_strategy: {
        conflict_resolution: 'latest_wins',
        memory_deduplication: true,
        skill_aggregation: 'max',
        knowledge_verification_threshold: 0.7,
        ...config?.merge_strategy,
      },
    };
    return this;
  }

  /**
   * Disable experience synchronization.
   */
  disableSync(): this {
    this.experienceSync.enabled = false;
    return this;
  }

  /**
   * Configure streaming sync.
   */
  withStreamingSync(config: NonNullable<SyncConfig['streaming']>): this {
    this.experienceSync.streaming = config;
    return this;
  }

  /**
   * Configure lumped sync.
   */
  withLumpedSync(config: NonNullable<SyncConfig['lumped']>): this {
    this.experienceSync.lumped = config;
    return this;
  }

  /**
   * Configure check-in sync.
   */
  withCheckInSync(config: NonNullable<SyncConfig['check_in']>): this {
    this.experienceSync.check_in = config;
    return this;
  }

  // =========================================================================
  // Protocol Configuration
  // =========================================================================

  /**
   * Enable MCP protocol.
   */
  enableMCP(config: NonNullable<Protocols['mcp']>): this {
    this.protocols.mcp = config;
    return this;
  }

  /**
   * Enable A2A protocol.
   */
  enableA2A(config: NonNullable<Protocols['a2a']>): this {
    this.protocols.a2a = config;
    return this;
  }

  /**
   * Enable Agent Protocol.
   */
  enableAgentProtocol(config: NonNullable<Protocols['agent_protocol']>): this {
    this.protocols.agent_protocol = config;
    return this;
  }

  // =========================================================================
  // Execution Configuration
  // =========================================================================

  /**
   * Configure execution settings.
   */
  withExecution(config: ExecutionConfig): this {
    if (config.llm) {
      this.execution.llm = {
        provider: config.llm.provider,
        model: config.llm.model,
        temperature: config.llm.temperature ?? 0.7,
        max_tokens: config.llm.max_tokens ?? 4096,
        parameters: config.llm.parameters,
      };
    }
    if (config.runtime) {
      this.execution.runtime = {
        timeout: config.runtime.timeout ?? 300,
        max_iterations: config.runtime.max_iterations ?? 20,
        retry_policy: config.runtime.retry_policy,
        error_handling: config.runtime.error_handling ?? 'graceful_degradation',
      };
    }
    return this;
  }

  /**
   * Set LLM provider and model.
   */
  withLLM(provider: string, model: string, options?: { temperature?: number; max_tokens?: number }): this {
    this.execution.llm = {
      provider,
      model,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 4096,
    };
    return this;
  }

  // =========================================================================
  // Deployment Configuration
  // =========================================================================

  /**
   * Configure deployment settings.
   */
  withDeployment(config: Partial<UniformSemanticAgentV2['deployment']>): this {
    this.deployment = { ...this.deployment, ...config };
    return this;
  }

  /**
   * Add preferred deployment context.
   */
  addDeploymentContext(context: string): this {
    this.deployment.preferred_contexts = [
      ...(this.deployment.preferred_contexts || []),
      context,
    ];
    return this;
  }

  // =========================================================================
  // Metadata Configuration
  // =========================================================================

  /**
   * Set metadata.
   */
  withMetadata(config: Partial<UniformSemanticAgentV2['metadata']>): this {
    this.metadata = { ...this.metadata, ...config };
    return this;
  }

  /**
   * Add tags.
   */
  addTags(...tags: string[]): this {
    this.metadata.tags = [
      ...(this.metadata.tags || []),
      ...tags,
    ];
    return this;
  }

  /**
   * Set author.
   */
  withAuthor(author: string): this {
    this.metadata.author = author;
    return this;
  }

  // =========================================================================
  // Build
  // =========================================================================

  /**
   * Validate builder state before build.
   */
  private validate(): void {
    if (!this.identity.name) {
      throw new AgentBuilderError('Agent name is required. Call withIdentity() or withName() first.', 'identity.name');
    }

    if (!this.identity.id) {
      this.identity.id = uuidv4();
    }

    if (!this.identity.created) {
      this.identity.created = new Date().toISOString();
    }

    // Ensure at least one protocol is configured (warning only)
    const hasProtocol = 
      this.protocols.mcp?.enabled ||
      this.protocols.a2a?.enabled ||
      this.protocols.agent_protocol?.enabled;

    if (!hasProtocol) {
      console.warn('AgentBuilder: No protocols enabled. Agent may not be functional.');
    }
  }

  /**
   * Build the UniformSemanticAgentV2 instance.
   * 
   * Validates all configuration and returns the constructed agent.
   * 
   * @returns Constructed agent
   * @throws AgentBuilderError if validation fails
   * 
   * @example
   * ```typescript
   * const agent = builder
   *   .withIdentity({ name: "Ada" })
   *   .withPersonality({ core_traits: ["analytical"] })
   *   .build();
   * ```
   */
  build(): UniformSemanticAgentV2 {
    this.validate();

    const now = new Date().toISOString();

    const agent: UniformSemanticAgentV2 = {
      schema_version: SCHEMA_VERSION,
      
      identity: {
        id: this.identity.id!,
        name: this.identity.name!,
        designation: this.identity.designation || '',
        bio: this.identity.bio || '',
        fingerprint: this.identity.fingerprint || '',
        created: this.identity.created || now,
        version: this.identity.version || '1.0.0',
      },
      
      personality: {
        core_traits: this.personality.core_traits || [],
        values: this.personality.values || [],
        quirks: this.personality.quirks || [],
        fears: this.personality.fears,
        aspirations: this.personality.aspirations,
        emotional_ranges: this.personality.emotional_ranges,
      },
      
      communication: {
        style: this.communication.style || { all: [] },
        signature_phrases: this.communication.signature_phrases,
        voice: this.communication.voice,
      },
      
      capabilities: {
        primary: this.capabilities.primary || [],
        secondary: this.capabilities.secondary || [],
        domains: this.capabilities.domains || [],
        tools: this.capabilities.tools,
        learned_skills: this.capabilities.learned_skills,
      },
      
      knowledge: {
        facts: this.knowledge.facts || [],
        topics: this.knowledge.topics || [],
        expertise: this.knowledge.expertise || [],
        sources: this.knowledge.sources,
        lore: this.knowledge.lore,
        accumulated_knowledge: this.knowledge.accumulated_knowledge,
      },
      
      memory: {
        type: this.memory.type || 'vector',
        provider: this.memory.provider || 'local',
        settings: this.memory.settings || {},
        collections: this.memory.collections,
      },
      
      beliefs: {
        who: this.beliefs.who || [],
        what: this.beliefs.what || [],
        why: this.beliefs.why || [],
        how: this.beliefs.how || [],
        where: this.beliefs.where,
        when: this.beliefs.when,
        huh: this.beliefs.huh,
      },
      
      instances: this.instances,
      
      experience_sync: {
        enabled: this.experienceSync.enabled || false,
        default_protocol: this.experienceSync.default_protocol || 'streaming',
        streaming: this.experienceSync.streaming,
        lumped: this.experienceSync.lumped,
        check_in: this.experienceSync.check_in,
        merge_strategy: {
          conflict_resolution: this.experienceSync.merge_strategy?.conflict_resolution || 'latest_wins',
          memory_deduplication: this.experienceSync.merge_strategy?.memory_deduplication ?? true,
          skill_aggregation: this.experienceSync.merge_strategy?.skill_aggregation || 'max',
          knowledge_verification_threshold: this.experienceSync.merge_strategy?.knowledge_verification_threshold ?? 0.7,
        },
      },
      
      protocols: {
        mcp: this.protocols.mcp,
        a2a: this.protocols.a2a,
        agent_protocol: this.protocols.agent_protocol,
      },
      
      execution: {
        llm: {
          provider: this.execution.llm?.provider || 'anthropic',
          model: this.execution.llm?.model || 'claude-3-5-sonnet-20241022',
          temperature: this.execution.llm?.temperature ?? 0.7,
          max_tokens: this.execution.llm?.max_tokens ?? 4096,
          parameters: this.execution.llm?.parameters,
        },
        runtime: {
          timeout: this.execution.runtime?.timeout ?? 300,
          max_iterations: this.execution.runtime?.max_iterations ?? 20,
          retry_policy: this.execution.runtime?.retry_policy,
          error_handling: this.execution.runtime?.error_handling || 'graceful_degradation',
        },
      },
      
      deployment: this.deployment,
      
      metadata: {
        version: this.metadata.version || '1.0.0',
        schema_version: SCHEMA_VERSION,
        created: this.metadata.created || now,
        updated: now,
        author: this.metadata.author,
        tags: this.metadata.tags,
        source_framework: this.metadata.source_framework,
        evolution: this.metadata.evolution,
      },
      
      training: this.training,
    };

    // Validate the constructed agent
    const validation = validateUniformSemanticAgentV2(agent);
    if (!validation.valid) {
      throw new AgentBuilderError(
        `Agent validation failed: ${validation.errors.join(', ')}`,
        'validation'
      );
    }

    return agent;
  }

  /**
   * Build and return JSON representation.
   */
  buildJSON(): string {
    return JSON.stringify(this.build(), null, 2);
  }

  /**
   * Clone the builder for creating variations.
   */
  clone(): AgentBuilder {
    const cloned = new AgentBuilder();
    cloned.identity = { ...this.identity };
    cloned.personality = { ...this.personality };
    cloned.communication = { ...this.communication };
    cloned.capabilities = { ...this.capabilities };
    cloned.knowledge = { ...this.knowledge };
    cloned.memory = { ...this.memory };
    cloned.beliefs = { ...this.beliefs };
    cloned.instances = { ...this.instances };
    cloned.experienceSync = { ...this.experienceSync };
    cloned.protocols = { ...this.protocols };
    cloned.execution = { ...this.execution };
    cloned.deployment = { ...this.deployment };
    cloned.metadata = { ...this.metadata };
    cloned.training = { ...this.training };
    return cloned;
  }
}

/**
 * Create a new AgentBuilder instance.
 * 
 * Factory function for convenient builder creation.
 * 
 * @param template - Optional template agent
 * @returns New AgentBuilder instance
 * 
 * @example
 * ```typescript
 * const agent = createAgentBuilder()
 *   .withIdentity({ name: "Ada" })
 *   .build();
 * ```
 */
export function createAgentBuilder(template?: Partial<UniformSemanticAgentV2>): AgentBuilder {
  return new AgentBuilder(template);
}

/**
 * Quick agent creation with minimal configuration.
 * 
 * @param name - Agent name
 * @param options - Optional configuration
 * @returns Constructed agent
 * 
 * @example
 * ```typescript
 * const agent = quickAgent("Ada", {
 *   designation: "Research Assistant",
 *   traits: ["analytical", "curious"]
 * });
 * ```
 */
export function quickAgent(
  name: string,
  options?: {
    designation?: string;
    bio?: string;
    traits?: string[];
    capabilities?: string[];
    llm?: { provider: string; model: string };
  }
): UniformSemanticAgentV2 {
  const builder = new AgentBuilder()
    .withIdentity({
      name,
      designation: options?.designation,
      bio: options?.bio,
    });

  if (options?.traits) {
    builder.addTraits(...options.traits);
  }

  if (options?.capabilities) {
    builder.addCapabilities(options.capabilities);
  }

  if (options?.llm) {
    builder.withLLM(options.llm.provider, options.llm.model);
  }

  return builder.build();
}
