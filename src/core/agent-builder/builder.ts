/**
 * AgentBuilder - Core builder class with build and validation logic.
 * @module core/agent-builder/builder
 */

import { v4 as uuidv4 } from 'uuid';
import type { UniformSemanticAgentV2 } from '../UniformSemanticAgentV2';
import { SCHEMA_VERSION, validateUniformSemanticAgentV2 } from '../UniformSemanticAgentV2';
import { AgentBuilderError } from './errors';
import { BuilderState, createDefaultState, initializeFromTemplate } from './builder-state';
import type {
  IdentityConfig,
  PersonalityConfig,
  CommunicationConfig,
  MemoryConfig,
  ExecutionConfig,
  SyncConfig,
} from './types';
import type { ToolDefinition, Skill, Belief, Protocols, SyncProtocol, Episode, Concept } from '../UniformSemanticAgentV2';

export class AgentBuilder {
  public state: BuilderState;

  constructor(template?: Partial<UniformSemanticAgentV2>) {
    this.state = createDefaultState();
    if (template) {
      initializeFromTemplate(this.state, template);
    }
  }

  // Identity methods
  withIdentity(config: IdentityConfig): this {
    if (!config.name || config.name.trim().length === 0) {
      throw new AgentBuilderError('Agent name is required', 'identity.name');
    }
    this.state.identity = {
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

  withName(name: string): this {
    this.state.identity.name = name;
    if (!this.state.identity.id) {
      this.state.identity.id = uuidv4();
    }
    return this;
  }

  withDesignation(designation: string): this {
    this.state.identity.designation = designation;
    return this;
  }

  withBio(bio: string | string[]): this {
    this.state.identity.bio = bio;
    return this;
  }

  // Personality methods
  withPersonality(config: PersonalityConfig): this {
    this.state.personality = {
      core_traits: config.core_traits || [],
      values: config.values || [],
      quirks: config.quirks || [],
      fears: config.fears,
      aspirations: config.aspirations,
      emotional_ranges: config.emotional_ranges,
    };
    return this;
  }

  addTraits(...traits: string[]): this {
    this.state.personality.core_traits = [
      ...(this.state.personality.core_traits || []),
      ...traits,
    ];
    return this;
  }

  addValues(...values: string[]): this {
    this.state.personality.values = [
      ...(this.state.personality.values || []),
      ...values,
    ];
    return this;
  }

  addQuirks(...quirks: string[]): this {
    this.state.personality.quirks = [
      ...(this.state.personality.quirks || []),
      ...quirks,
    ];
    return this;
  }

  // Communication methods
  withCommunication(config: CommunicationConfig): this {
    this.state.communication = {
      style: config.style || { all: [] },
      signature_phrases: config.signature_phrases,
      voice: config.voice,
    };
    return this;
  }

  addStyleRules(context: string, ...rules: string[]): this {
    if (!this.state.communication.style) {
      this.state.communication.style = { all: [] };
    }
    if (!this.state.communication.style[context]) {
      this.state.communication.style[context] = [];
    }
    this.state.communication.style[context].push(...rules);
    return this;
  }

  addSignaturePhrases(...phrases: string[]): this {
    this.state.communication.signature_phrases = [
      ...(this.state.communication.signature_phrases || []),
      ...phrases,
    ];
    return this;
  }

  // Capabilities methods
  addCapability(capability: string, isPrimary: boolean = true): this {
    if (isPrimary) {
      this.state.capabilities.primary = [
        ...(this.state.capabilities.primary || []),
        capability,
      ];
    } else {
      this.state.capabilities.secondary = [
        ...(this.state.capabilities.secondary || []),
        capability,
      ];
    }
    return this;
  }

  addCapabilities(capabilities: string[], isPrimary: boolean = true): this {
    for (const cap of capabilities) {
      this.addCapability(cap, isPrimary);
    }
    return this;
  }

  addDomain(domain: string): this {
    this.state.capabilities.domains = [
      ...(this.state.capabilities.domains || []),
      domain,
    ];
    return this;
  }

  addTool(tool: ToolDefinition): this {
    this.state.capabilities.tools = [
      ...(this.state.capabilities.tools || []),
      tool,
    ];
    return this;
  }

  addSkill(skill: Skill): this {
    this.state.capabilities.learned_skills = [
      ...(this.state.capabilities.learned_skills || []),
      skill,
    ];
    return this;
  }

  // Knowledge methods
  addFacts(...facts: string[]): this {
    this.state.knowledge.facts = [
      ...(this.state.knowledge.facts || []),
      ...facts,
    ];
    return this;
  }

  addTopics(...topics: string[]): this {
    this.state.knowledge.topics = [
      ...(this.state.knowledge.topics || []),
      ...topics,
    ];
    return this;
  }

  addExpertise(...areas: string[]): this {
    this.state.knowledge.expertise = [
      ...(this.state.knowledge.expertise || []),
      ...areas,
    ];
    return this;
  }

  // Memory methods
  withMemory(config: MemoryConfig): this {
    this.state.memory = {
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

  addEpisode(episode: Episode): this {
    if (!this.state.memory.collections) {
      this.state.memory.collections = { episodic: [], semantic: [] };
    }
    if (!this.state.memory.collections.episodic) {
      this.state.memory.collections.episodic = [];
    }
    this.state.memory.collections.episodic.push(episode);
    return this;
  }

  addConcept(concept: Concept): this {
    if (!this.state.memory.collections) {
      this.state.memory.collections = { episodic: [], semantic: [] };
    }
    if (!this.state.memory.collections.semantic) {
      this.state.memory.collections.semantic = [];
    }
    this.state.memory.collections.semantic.push(concept);
    return this;
  }

  // Beliefs methods
  addBelief(category: keyof UniformSemanticAgentV2['beliefs'], belief: Belief): this {
    if (!this.state.beliefs[category]) {
      this.state.beliefs[category] = [];
    }
    this.state.beliefs[category]!.push(belief);
    return this;
  }

  addBeliefs(category: keyof UniformSemanticAgentV2['beliefs'], beliefs: Belief[]): this {
    for (const belief of beliefs) {
      this.addBelief(category, belief);
    }
    return this;
  }

  // Sync methods
  enableSync(protocol: SyncProtocol = 'streaming', config?: Partial<SyncConfig>): this {
    this.state.experienceSync = {
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

  disableSync(): this {
    this.state.experienceSync.enabled = false;
    return this;
  }

  withStreamingSync(config: NonNullable<SyncConfig['streaming']>): this {
    this.state.experienceSync.streaming = config;
    return this;
  }

  withLumpedSync(config: NonNullable<SyncConfig['lumped']>): this {
    this.state.experienceSync.lumped = config;
    return this;
  }

  withCheckInSync(config: NonNullable<SyncConfig['check_in']>): this {
    this.state.experienceSync.check_in = config;
    return this;
  }

  // Protocol methods
  enableMCP(config: NonNullable<Protocols['mcp']>): this {
    this.state.protocols.mcp = config;
    return this;
  }

  enableA2A(config: NonNullable<Protocols['a2a']>): this {
    this.state.protocols.a2a = config;
    return this;
  }

  enableAgentProtocol(config: NonNullable<Protocols['agent_protocol']>): this {
    this.state.protocols.agent_protocol = config;
    return this;
  }

  // Execution methods
  withExecution(config: ExecutionConfig): this {
    if (config.llm) {
      this.state.execution.llm = {
        provider: config.llm.provider,
        model: config.llm.model,
        temperature: config.llm.temperature ?? 0.7,
        max_tokens: config.llm.max_tokens ?? 4096,
        parameters: config.llm.parameters,
      };
    }
    if (config.runtime) {
      this.state.execution.runtime = {
        timeout: config.runtime.timeout ?? 300,
        max_iterations: config.runtime.max_iterations ?? 20,
        retry_policy: config.runtime.retry_policy,
        error_handling: config.runtime.error_handling ?? 'graceful_degradation',
      };
    }
    return this;
  }

  withLLM(provider: string, model: string, options?: { temperature?: number; max_tokens?: number }): this {
    this.state.execution.llm = {
      provider,
      model,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 4096,
    };
    return this;
  }

  // Deployment methods
  withDeployment(config: Partial<UniformSemanticAgentV2['deployment']>): this {
    this.state.deployment = { ...this.state.deployment, ...config };
    return this;
  }

  addDeploymentContext(context: string): this {
    if (!this.state.deployment) {
      this.state.deployment = { preferred_contexts: [] };
    }
    this.state.deployment.preferred_contexts = [
      ...(this.state.deployment.preferred_contexts ?? []),
      context,
    ];
    return this;
  }

  // Metadata methods
  withMetadata(config: Partial<UniformSemanticAgentV2['metadata']>): this {
    this.state.metadata = { ...this.state.metadata, ...config };
    return this;
  }

  addTags(...tags: string[]): this {
    this.state.metadata.tags = [
      ...(this.state.metadata.tags || []),
      ...tags,
    ];
    return this;
  }

  withAuthor(author: string): this {
    this.state.metadata.author = author;
    return this;
  }

  // Validation
  private validate(): void {
    if (!this.state.identity.name) {
      throw new AgentBuilderError(
        'Agent name is required. Call withIdentity() or withName() first.',
        'identity.name'
      );
    }

    if (!this.state.identity.id) {
      this.state.identity.id = uuidv4();
    }

    if (!this.state.identity.created) {
      this.state.identity.created = new Date().toISOString();
    }

    const hasProtocol =
      this.state.protocols.mcp?.enabled ||
      this.state.protocols.a2a?.enabled ||
      this.state.protocols.agent_protocol?.enabled;

    if (!hasProtocol) {
      console.warn('AgentBuilder: No protocols enabled. Agent may not be functional.');
    }
  }

  build(): UniformSemanticAgentV2 {
    this.validate();

    const now = new Date().toISOString();

    const agent: UniformSemanticAgentV2 = {
      schema_version: SCHEMA_VERSION,

      identity: {
        id: this.state.identity.id!,
        name: this.state.identity.name!,
        designation: this.state.identity.designation || '',
        bio: this.state.identity.bio || '',
        fingerprint: this.state.identity.fingerprint || '',
        created: this.state.identity.created || now,
        version: this.state.identity.version || '1.0.0',
      },

      personality: {
        core_traits: this.state.personality.core_traits || [],
        values: this.state.personality.values || [],
        quirks: this.state.personality.quirks || [],
        fears: this.state.personality.fears,
        aspirations: this.state.personality.aspirations,
        emotional_ranges: this.state.personality.emotional_ranges,
      },

      communication: {
        style: this.state.communication.style || { all: [] },
        signature_phrases: this.state.communication.signature_phrases,
        voice: this.state.communication.voice,
      },

      capabilities: {
        primary: this.state.capabilities.primary || [],
        secondary: this.state.capabilities.secondary || [],
        domains: this.state.capabilities.domains || [],
        tools: this.state.capabilities.tools,
        learned_skills: this.state.capabilities.learned_skills,
      },

      knowledge: {
        facts: this.state.knowledge.facts || [],
        topics: this.state.knowledge.topics || [],
        expertise: this.state.knowledge.expertise || [],
        sources: this.state.knowledge.sources,
        lore: this.state.knowledge.lore,
        accumulated_knowledge: this.state.knowledge.accumulated_knowledge,
      },

      memory: {
        type: this.state.memory.type || 'vector',
        provider: this.state.memory.provider || 'local',
        settings: this.state.memory.settings || {},
        collections: this.state.memory.collections,
      },

      beliefs: {
        who: this.state.beliefs.who || [],
        what: this.state.beliefs.what || [],
        why: this.state.beliefs.why || [],
        how: this.state.beliefs.how || [],
        where: this.state.beliefs.where,
        when: this.state.beliefs.when,
        huh: this.state.beliefs.huh,
      },

      instances: this.state.instances,

      experience_sync: {
        enabled: this.state.experienceSync.enabled || false,
        default_protocol: this.state.experienceSync.default_protocol || 'streaming',
        streaming: this.state.experienceSync.streaming,
        lumped: this.state.experienceSync.lumped,
        check_in: this.state.experienceSync.check_in,
        merge_strategy: {
          conflict_resolution:
            this.state.experienceSync.merge_strategy?.conflict_resolution || 'latest_wins',
          memory_deduplication:
            this.state.experienceSync.merge_strategy?.memory_deduplication ?? true,
          skill_aggregation:
            this.state.experienceSync.merge_strategy?.skill_aggregation || 'max',
          knowledge_verification_threshold:
            this.state.experienceSync.merge_strategy?.knowledge_verification_threshold ?? 0.7,
        },
      },

      protocols: {
        mcp: this.state.protocols.mcp,
        a2a: this.state.protocols.a2a,
        agent_protocol: this.state.protocols.agent_protocol,
      },

      execution: {
        llm: {
          provider: this.state.execution.llm?.provider || 'anthropic',
          model: this.state.execution.llm?.model || 'claude-3-5-sonnet-20241022',
          temperature: this.state.execution.llm?.temperature ?? 0.7,
          max_tokens: this.state.execution.llm?.max_tokens ?? 4096,
          parameters: this.state.execution.llm?.parameters,
        },
        runtime: {
          timeout: this.state.execution.runtime?.timeout ?? 300,
          max_iterations: this.state.execution.runtime?.max_iterations ?? 20,
          retry_policy: this.state.execution.runtime?.retry_policy,
          error_handling:
            this.state.execution.runtime?.error_handling || 'graceful_degradation',
        },
      },

      deployment: {
        preferred_contexts: this.state.deployment?.preferred_contexts ?? [],
        scaling: this.state.deployment?.scaling,
        environment: this.state.deployment?.environment,
      },

      metadata: {
        version: this.state.metadata.version || '1.0.0',
        schema_version: SCHEMA_VERSION,
        created: this.state.metadata.created || now,
        updated: now,
        author: this.state.metadata.author,
        tags: this.state.metadata.tags,
        source_framework: this.state.metadata.source_framework,
        evolution: this.state.metadata.evolution,
      },

      training: this.state.training,
    };

    const validation = validateUniformSemanticAgentV2(agent);
    if (!validation.valid) {
      throw new AgentBuilderError(
        `Agent validation failed: ${validation.errors.join(', ')}`,
        'validation'
      );
    }

    return agent;
  }

  buildJSON(): string {
    return JSON.stringify(this.build(), null, 2);
  }

  clone(): AgentBuilder {
    const cloned = new AgentBuilder();
    cloned.state = {
      identity: { ...this.state.identity },
      personality: { ...this.state.personality },
      communication: { ...this.state.communication },
      capabilities: { ...this.state.capabilities },
      knowledge: { ...this.state.knowledge },
      memory: { ...this.state.memory },
      beliefs: { ...this.state.beliefs },
      instances: { ...this.state.instances },
      experienceSync: { ...this.state.experienceSync },
      protocols: { ...this.state.protocols },
      execution: { ...this.state.execution },
      deployment: { ...this.state.deployment },
      metadata: { ...this.state.metadata },
      training: { ...this.state.training },
    };
    return cloned;
  }
}
