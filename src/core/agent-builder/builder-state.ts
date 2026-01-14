/**
 * Builder state management - default values and state initialization.
 * @module core/agent-builder/builder-state
 */

import type {
  UniformSemanticAgentV2,
  ExperienceSyncConfig,
  Protocols,
} from '../UniformSemanticAgentV2';

export interface BuilderState {
  identity: Partial<UniformSemanticAgentV2['identity']>;
  personality: Partial<UniformSemanticAgentV2['personality']>;
  communication: Partial<UniformSemanticAgentV2['communication']>;
  capabilities: Partial<UniformSemanticAgentV2['capabilities']>;
  knowledge: Partial<UniformSemanticAgentV2['knowledge']>;
  memory: Partial<UniformSemanticAgentV2['memory']>;
  beliefs: Partial<UniformSemanticAgentV2['beliefs']>;
  instances: UniformSemanticAgentV2['instances'];
  experienceSync: Partial<ExperienceSyncConfig>;
  protocols: Partial<Protocols>;
  execution: Partial<UniformSemanticAgentV2['execution']>;
  deployment: Partial<UniformSemanticAgentV2['deployment']>;
  metadata: Partial<UniformSemanticAgentV2['metadata']>;
  training: Partial<UniformSemanticAgentV2['training']>;
}

export function createDefaultState(): BuilderState {
  return {
    identity: {},
    personality: {
      core_traits: [],
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
      tools: [],
      learned_skills: [],
    },
    knowledge: {
      facts: [],
      topics: [],
      expertise: [],
      accumulated_knowledge: [],
    },
    memory: {
      type: 'vector',
      provider: 'local',
      settings: {},
      collections: {
        episodic: [],
        semantic: [],
      },
    },
    beliefs: {
      who: [],
      what: [],
      why: [],
      how: [],
      where: [],
      when: [],
      huh: [],
    },
    instances: {
      active: [],
      terminated: [],
    },
    experienceSync: {
      enabled: false,
      default_protocol: 'streaming',
      merge_strategy: {
        conflict_resolution: 'latest_wins',
        memory_deduplication: true,
        skill_aggregation: 'max',
        knowledge_verification_threshold: 0.7,
      },
    },
    protocols: {},
    execution: {
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
    },
    deployment: {
      preferred_contexts: [],
    },
    metadata: {
      tags: [],
    },
    training: {},
  };
}

export function initializeFromTemplate(
  state: BuilderState,
  template: Partial<UniformSemanticAgentV2>
): void {
  if (template.identity) state.identity = { ...template.identity };
  if (template.personality) state.personality = { ...template.personality };
  if (template.communication) state.communication = { ...template.communication };
  if (template.capabilities) state.capabilities = { ...template.capabilities };
  if (template.knowledge) state.knowledge = { ...template.knowledge };
  if (template.memory) state.memory = { ...template.memory };
  if (template.beliefs) state.beliefs = { ...template.beliefs };
  if (template.instances) state.instances = { ...template.instances };
  if (template.experience_sync) state.experienceSync = { ...template.experience_sync };
  if (template.protocols) state.protocols = { ...template.protocols };
  if (template.execution) state.execution = { ...template.execution };
  if (template.deployment) state.deployment = { ...template.deployment };
  if (template.metadata) state.metadata = { ...template.metadata };
  if (template.training) state.training = { ...template.training };
}
