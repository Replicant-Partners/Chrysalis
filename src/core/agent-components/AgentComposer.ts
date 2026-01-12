/**
 * Agent Composer - Unified Agent from Components
 * 
 * Composes the decomposed agent components into a unified agent
 * while maintaining backward compatibility with UniformSemanticAgentV2.
 * 
 * This is the Facade pattern applied to the decomposed architecture.
 */

import { UniformSemanticAgentV2, SCHEMA_VERSION } from '../UniformSemanticAgentV2';
import { AgentIdentity, AgentIdentityData } from './AgentIdentity';
import { AgentPersonality, AgentPersonalityData } from './AgentPersonality';
import { AgentCommunication, AgentCommunicationData } from './AgentCommunication';
import { AgentCapabilities, AgentCapabilitiesData } from './AgentCapabilities';
import { AgentKnowledge, AgentKnowledgeData } from './AgentKnowledge';
import { AgentMemory, AgentMemoryData } from './AgentMemory';
import { AgentBeliefs, AgentBeliefsData } from './AgentBeliefs';
import { AgentInstances, AgentInstancesData } from './AgentInstances';
import { AgentSync } from './AgentSync';
import { AgentProtocols } from './AgentProtocols';
import { AgentExecution, AgentExecutionData } from './AgentExecution';
import { AgentMetadata, AgentMetadataData } from './AgentMetadata';

/**
 * Composed Agent - Unified interface to all components
 */
export class ComposedAgent {
  readonly identity: AgentIdentity;
  readonly personality: AgentPersonality;
  readonly communication: AgentCommunication;
  readonly capabilities: AgentCapabilities;
  readonly knowledge: AgentKnowledge;
  readonly memory: AgentMemory;
  readonly beliefs: AgentBeliefs;
  readonly instances: AgentInstances;
  readonly sync: AgentSync;
  readonly protocols: AgentProtocols;
  readonly execution: AgentExecution;
  readonly metadata: AgentMetadata;

  private constructor(components: {
    identity: AgentIdentity;
    personality: AgentPersonality;
    communication: AgentCommunication;
    capabilities: AgentCapabilities;
    knowledge: AgentKnowledge;
    memory: AgentMemory;
    beliefs: AgentBeliefs;
    instances: AgentInstances;
    sync: AgentSync;
    protocols: AgentProtocols;
    execution: AgentExecution;
    metadata: AgentMetadata;
  }) {
    this.identity = components.identity;
    this.personality = components.personality;
    this.communication = components.communication;
    this.capabilities = components.capabilities;
    this.knowledge = components.knowledge;
    this.memory = components.memory;
    this.beliefs = components.beliefs;
    this.instances = components.instances;
    this.sync = components.sync;
    this.protocols = components.protocols;
    this.execution = components.execution;
    this.metadata = components.metadata;
  }

  /**
   * Create a new composed agent
   */
  static create(options: {
    name: string;
    designation?: string;
    bio?: string | string[];
  }): ComposedAgent {
    return new ComposedAgent({
      identity: AgentIdentity.create(options),
      personality: new AgentPersonality(),
      communication: new AgentCommunication(),
      capabilities: new AgentCapabilities(),
      knowledge: new AgentKnowledge(),
      memory: new AgentMemory(),
      beliefs: new AgentBeliefs(),
      instances: new AgentInstances(),
      sync: new AgentSync(),
      protocols: new AgentProtocols(),
      execution: new AgentExecution(),
      metadata: new AgentMetadata(),
    });
  }

  /**
   * Create from UniformSemanticAgentV2 (backward compatibility)
   */
  static fromUSA(usa: UniformSemanticAgentV2): ComposedAgent {
    return new ComposedAgent({
      identity: AgentIdentity.fromData(usa.identity as AgentIdentityData),
      personality: new AgentPersonality(usa.personality),
      communication: new AgentCommunication(usa.communication),
      capabilities: new AgentCapabilities(usa.capabilities),
      knowledge: new AgentKnowledge(usa.knowledge),
      memory: new AgentMemory(usa.memory),
      beliefs: new AgentBeliefs(usa.beliefs),
      instances: new AgentInstances(usa.instances),
      sync: new AgentSync(usa.experience_sync),
      protocols: new AgentProtocols(usa.protocols),
      execution: new AgentExecution(usa.execution),
      metadata: new AgentMetadata(usa.metadata),
    });
  }

  /**
   * Convert to UniformSemanticAgentV2 (backward compatibility)
   */
  toUSA(): UniformSemanticAgentV2 {
    return {
      schema_version: SCHEMA_VERSION,
      identity: this.identity.toData(),
      personality: this.personality.toData(),
      communication: this.communication.toData(),
      capabilities: this.capabilities.toData(),
      knowledge: this.knowledge.toData(),
      memory: this.memory.toData(),
      beliefs: this.beliefs.toData(),
      instances: this.instances.toData(),
      experience_sync: this.sync.toData(),
      protocols: this.protocols.toData(),
      execution: this.execution.toData(),
      metadata: this.metadata.toData(),
    };
  }

  /**
   * Merge with another agent (for experience sync)
   */
  merge(other: ComposedAgent): void {
    // Personality evolves
    this.personality.merge(other.personality);
    
    // Capabilities expand
    this.capabilities.merge(other.capabilities);
    
    // Knowledge grows
    this.knowledge.merge(other.knowledge);
    
    // Memory accumulates
    this.memory.merge(other.memory);
    
    // Beliefs refine
    this.beliefs.merge(other.beliefs);
    
    // Communication style can merge
    this.communication.merge(other.communication);
    
    // Update metadata
    this.metadata.touch();
    this.metadata.recordSync();
  }

  /**
   * Get agent summary
   */
  getSummary(): {
    id: string;
    name: string;
    designation: string;
    traits: readonly string[];
    capabilities: number;
    skills: number;
    knowledge: number;
    beliefs: number;
    activeInstances: number;
    protocols: string[];
    evolutionRate: number;
  } {
    const capStats = this.capabilities;
    const knowStats = this.knowledge;
    const beliefStats = this.beliefs.getStatistics();
    const instanceStats = this.instances.getAggregateStatistics();
    const evolutionSummary = this.metadata.getEvolutionSummary();

    return {
      id: this.identity.id,
      name: this.identity.name,
      designation: this.identity.designation,
      traits: this.personality.traits,
      capabilities: capStats.primary.length + capStats.secondary.length,
      skills: capStats.skills.length,
      knowledge: knowStats.accumulatedKnowledge.length,
      beliefs: beliefStats.totalBeliefs,
      activeInstances: instanceStats.totalActive,
      protocols: this.protocols.getEnabledProtocols(),
      evolutionRate: evolutionSummary.evolutionRate,
    };
  }

  /**
   * Validate the composed agent
   */
  validate(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Verify identity integrity
    if (!this.identity.verify()) {
      errors.push('Identity fingerprint verification failed');
    }

    // Check protocols
    if (!this.protocols.hasEnabledProtocol()) {
      warnings.push('No protocols enabled - agent may not be functional');
    }

    // Check execution config
    if (!this.execution.isValid()) {
      errors.push('Invalid execution configuration');
    }

    // Check sync health
    if (this.sync.enabled && !this.sync.isHealthy()) {
      warnings.push('Sync is enabled but not properly configured');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Clone the agent (creates new identity)
   */
  clone(newName?: string): ComposedAgent {
    const cloned = ComposedAgent.create({
      name: newName || `${this.identity.name} (Clone)`,
      designation: this.identity.designation,
      bio: this.identity.bio,
    });

    // Copy personality
    this.personality.traits.forEach(t => cloned.personality.addTrait(t, 'clone'));
    this.personality.values.forEach(v => cloned.personality.addValue(v, 'clone'));
    this.personality.quirks.forEach(q => cloned.personality.addQuirk(q, 'clone'));

    // Copy capabilities
    cloned.capabilities.merge(this.capabilities);

    // Copy knowledge
    cloned.knowledge.merge(this.knowledge);

    // Copy beliefs
    cloned.beliefs.merge(this.beliefs);

    return cloned;
  }
}

/**
 * Agent Composer Builder - Fluent API for building composed agents
 */
export class AgentComposerBuilder {
  private name: string = 'Agent';
  private designation?: string;
  private bio?: string | string[];
  private traits: string[] = [];
  private values: string[] = [];
  private capabilities: string[] = [];
  private tools: NonNullable<AgentCapabilitiesData['tools']> = [];
  private enableMCP: boolean = false;
  private llmProvider: string = 'anthropic';
  private llmModel: string = 'claude-3-5-sonnet-20241022';

  withName(name: string): this {
    this.name = name;
    return this;
  }

  withDesignation(designation: string): this {
    this.designation = designation;
    return this;
  }

  withBio(bio: string | string[]): this {
    this.bio = bio;
    return this;
  }

  withTraits(...traits: string[]): this {
    this.traits.push(...traits);
    return this;
  }

  withValues(...values: string[]): this {
    this.values.push(...values);
    return this;
  }

  withCapabilities(...capabilities: string[]): this {
    this.capabilities.push(...capabilities);
    return this;
  }

  withTool(tool: NonNullable<AgentCapabilitiesData['tools']>[0]): this {
    this.tools.push(tool);
    return this;
  }

  withMCP(): this {
    this.enableMCP = true;
    return this;
  }

  withLLM(provider: string, model: string): this {
    this.llmProvider = provider;
    this.llmModel = model;
    return this;
  }

  build(): ComposedAgent {
    const agent = ComposedAgent.create({
      name: this.name,
      designation: this.designation,
      bio: this.bio,
    });

    // Add traits
    this.traits.forEach(t => agent.personality.addTrait(t, 'builder'));
    this.values.forEach(v => agent.personality.addValue(v, 'builder'));

    // Add capabilities
    this.capabilities.forEach(c => agent.capabilities.addPrimaryCapability(c));

    // Add tools
    this.tools.forEach(t => agent.capabilities.addTool(t));

    // Configure protocols
    if (this.enableMCP) {
      agent.protocols.enableMCP('client');
    }

    // Configure LLM
    agent.execution.setLLM(this.llmProvider, this.llmModel);

    return agent;
  }
}

/**
 * Create a new agent composer builder
 */
export function composeAgent(): AgentComposerBuilder {
  return new AgentComposerBuilder();
}
