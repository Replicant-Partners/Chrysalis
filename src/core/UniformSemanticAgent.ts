/**
 * Uniform Semantic Agent Types - Canonical Agent Representation
 * 
 * The Uniform Semantic Agent is the reference entity that exists
 * independently of any specific agentic AI framework.
 */

export const SCHEMA_VERSION = '1.0.0';

/**
 * Core belief structure
 */
export interface Belief {
  content: string;
  conviction: number;  // 0-1
  privacy: 'PUBLIC' | 'PRIVATE';
  source: string;
  tags?: string[];
}

/**
 * Emotional state definition
 */
export interface EmotionalState {
  triggers: string[];
  expressions: string[];
  voice?: {
    speed: number;
    pitch: number;
  };
}

/**
 * Knowledge source reference
 */
export interface KnowledgeSource {
  type: 'file' | 'directory' | 'url' | 'embedding';
  path?: string;
  directory?: string;
  url?: string;
  shared?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Action definition
 */
export interface ActionDef {
  name: string;
  description: string;
  parameters?: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    default?: any;
  }>;
  examples?: Array<{
    input: Record<string, any>;
    output: any;
    explanation?: string;
  }>;
}

/**
 * Conversation training data
 */
export interface Conversation {
  messages: Message[];
  context?: string;
}

export interface Message {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp?: string;
}

/**
 * Voice configuration
 */
export interface VoiceConfig {
  model?: string;
  speaker?: string;
  characteristics?: string[];
  speed?: number;
  pitch?: number;
}

/**
 * Uniform Semantic Agent - The canonical agent representation
 */
export interface UniformSemanticAgent {
  // Schema version
  schema_version: string;
  
  // Identity (immutable core)
  identity: {
    id: string;              // Unique UUID
    name: string;
    designation: string;     // Role/title
    bio: string | string[];
    username?: string;
    fingerprint: string;     // Cryptographic identity hash
  };
  
  // Personality
  personality: {
    core_traits: string[];
    values: string[];
    quirks: string[];
    fears?: string[];
    aspirations?: string[];
    emotional_ranges?: Record<string, EmotionalState>;
  };
  
  // Communication
  communication: {
    style: {
      all: string[];
      [context: string]: string[];
    };
    signature_phrases?: string[];
    voice?: VoiceConfig;
  };
  
  // Capabilities
  capabilities: {
    primary: string[];
    secondary: string[];
    domains: string[];
    tools?: string[];
    actions?: ActionDef[];
  };
  
  // Knowledge
  knowledge: {
    facts: string[];
    topics: string[];
    expertise: string[];
    sources?: KnowledgeSource[];
    lore?: string[];
  };
  
  // Memory configuration
  memory: {
    type: 'vector' | 'graph' | 'hybrid';
    provider: string;
    settings: Record<string, any>;
  };
  
  // Beliefs
  beliefs: {
    who: Belief[];
    what: Belief[];
    why: Belief[];
    how: Belief[];
    where?: Belief[];
    when?: Belief[];
    huh?: Belief[];
  };
  
  // Training data
  training?: {
    conversations?: Conversation[];
    demonstrations?: Array<{
      input: string;
      output: string;
      context?: string;
    }>;
    feedback?: Array<{
      action: string;
      rating: number;
      comment?: string;
    }>;
  };
  
  // Metadata
  metadata: {
    version: string;
    created: string;
    updated: string;
    author?: string;
    tags?: string[];
    source_framework?: string;
    [key: string]: any;
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a Uniform Semantic Agent
 * @param agent
 */
export function validateUniformSemanticAgent(agent: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!agent.schema_version) {errors.push('Missing schema_version');}
  if (!agent.identity) {errors.push('Missing identity');}
  if (!agent.identity?.name) {errors.push('Missing identity.name');}
  if (!agent.identity?.designation) {errors.push('Missing identity.designation');}
  if (!agent.personality) {errors.push('Missing personality');}
  if (!agent.capabilities) {errors.push('Missing capabilities');}
  if (!agent.knowledge) {errors.push('Missing knowledge');}
  if (!agent.memory) {errors.push('Missing memory');}
  if (!agent.beliefs) {errors.push('Missing beliefs');}
  if (!agent.metadata) {errors.push('Missing metadata');}
  
  // Validate types
  if (agent.personality?.core_traits && !Array.isArray(agent.personality.core_traits)) {
    errors.push('personality.core_traits must be an array');
  }
  
  if (agent.capabilities?.primary && !Array.isArray(agent.capabilities.primary)) {
    errors.push('capabilities.primary must be an array');
  }
  
  // Warnings for recommended fields
  if (!agent.identity?.fingerprint) {
    warnings.push('Missing identity.fingerprint - should be generated');
  }
  
  if (!agent.training) {
    warnings.push('Missing training data - agent may have limited examples');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create a default Uniform Semantic Agent
 * @param name
 * @param designation
 * @param overrides
 */
export function createUniformSemanticAgent(
  name: string,
  designation: string,
  overrides?: Partial<UniformSemanticAgent>
): UniformSemanticAgent {
  const now = new Date().toISOString();
  
  return {
    schema_version: SCHEMA_VERSION,
    identity: {
      id: crypto.randomUUID(),
      name,
      designation,
      bio: '',
      fingerprint: '',
      ...overrides?.identity
    },
    personality: {
      core_traits: [],
      values: [],
      quirks: [],
      ...overrides?.personality
    },
    communication: {
      style: {
        all: []
      },
      ...overrides?.communication
    },
    capabilities: {
      primary: [],
      secondary: [],
      domains: [],
      ...overrides?.capabilities
    },
    knowledge: {
      facts: [],
      topics: [],
      expertise: [],
      ...overrides?.knowledge
    },
    memory: {
      type: 'hybrid',
      provider: 'lance',  // LanceDB (qdrant deprecated)
      settings: {},
      ...overrides?.memory
    },
    beliefs: {
      who: [],
      what: [],
      why: [],
      how: [],
      ...overrides?.beliefs
    },
    metadata: {
      version: '1.0.0',
      created: now,
      updated: now,
      ...overrides?.metadata
    }
  };
}
