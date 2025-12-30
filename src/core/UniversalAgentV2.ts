/**
 * Universal Agent Types v2.0 - Enhanced with Experience Sync
 * 
 * Supports three agent implementation types with continuous
 * experience synchronization and skill accumulation.
 */

export const SCHEMA_VERSION = '2.0.0';

/**
 * The three agent implementation types
 */
export type AgentImplementationType = 'mcp' | 'multi_agent' | 'orchestrated';

/**
 * Sync protocol types
 */
export type SyncProtocol = 'streaming' | 'lumped' | 'check_in';

/**
 * Experience transport types
 */
export type ExperienceTransportType = 'https' | 'websocket' | 'mcp';

export interface ExperienceTransportConfig {
  type: ExperienceTransportType;
  
  // HTTPS (explicitly not plain HTTP)
  https?: {
    endpoint: string;
    auth_token?: string;
    headers?: Record<string, string>;
    verify_tls?: boolean;
  };
  
  // WebSocket transport
  websocket?: {
    url: string;
    protocols?: string[];
  };
  
  // MCP client transport
  mcp?: {
    server?: string;
    tool_name?: string;
  };
}

/**
 * Instance status
 */
export type InstanceStatus = 'running' | 'idle' | 'syncing' | 'terminated';

/**
 * Episode - Specific experience instance
 */
export interface Episode {
  episode_id: string;
  timestamp: string;
  source_instance: string;
  duration: number;          // milliseconds
  context: Record<string, any>;
  interactions: Interaction[];
  outcome: string;
  lessons_learned: string[];
  skills_practiced: string[];
  effectiveness_rating: number;  // 0.0 - 1.0
}

export interface Interaction {
  interaction_id: string;
  timestamp: string;
  type: 'conversation' | 'tool_use' | 'decision' | 'collaboration';
  participants: string[];
  content: string;
  result: string;
  effectiveness: number;
}

/**
 * Concept - Semantic knowledge unit
 */
export interface Concept {
  concept_id: string;
  name: string;
  definition: string;
  related_concepts: string[];
  confidence: number;
  sources: string[];
  usage_count: number;
  last_used: string;
}

/**
 * Enhanced Belief with evolution tracking
 */
export interface Belief {
  content: string;
  conviction: number;
  privacy: 'PUBLIC' | 'PRIVATE';
  source: string;
  tags?: string[];
  revision_history?: {
    timestamp: string;
    previous_conviction: number;
    reason: string;
    source_instance: string;
  }[];
}

/**
 * Enhanced Tool with usage stats
 */
export interface ToolDefinition {
  name: string;
  protocol: 'mcp' | 'native' | 'api';
  config: Record<string, any>;
  usage_stats?: {
    total_invocations: number;
    success_rate: number;
    average_latency_ms: number;
    last_used: string;
    preferred_contexts: string[];
  };
}

/**
 * Enhanced Skill with learning tracking
 */
export interface Skill {
  skill_id: string;
  name: string;
  category: string;
  proficiency: number;       // 0.0 - 1.0
  acquired: string;
  source_instances: string[];
  
  learning_curve: {
    timestamp: string;
    proficiency: number;
    event: string;
  }[];
  
  usage: {
    total_invocations: number;
    success_rate: number;
    contexts: string[];
    last_used: string;
  };
  
  prerequisites: string[];
  enables: string[];
  synergies: {
    skill_id: string;
    synergy_strength: number;
  }[];
}

/**
 * Instance metadata
 */
export interface InstanceMetadata {
  instance_id: string;
  type: AgentImplementationType;
  framework: string;
  deployment_context: string;
  created: string;
  last_sync: string;
  status: InstanceStatus;
  sync_protocol: SyncProtocol;
  endpoint: string;
  
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    last_heartbeat: string;
    error_rate: number;
    sync_lag: number;  // milliseconds
  };
  
  statistics: {
    total_syncs: number;
    memories_contributed: number;
    skills_learned: number;
    knowledge_acquired: number;
    conversations_handled: number;
  };
  
  // Transport policy (set by coordinating copy)
  transport?: ExperienceTransportConfig;
}

/**
 * Experience sync configuration
 */
export interface ExperienceSyncConfig {
  enabled: boolean;
  default_protocol: SyncProtocol;
  transport?: ExperienceTransportConfig;
  
  streaming?: {
    enabled: boolean;
    interval_ms: number;
    batch_size: number;
    priority_threshold: number;
  };
  
  lumped?: {
    enabled: boolean;
    batch_interval: string;    // e.g., "1h", "6h", "24h"
    max_batch_size: number;
    compression: boolean;
  };
  
  check_in?: {
    enabled: boolean;
    schedule: string;          // cron expression
    include_full_state: boolean;
  };
  
  merge_strategy: {
    conflict_resolution: 'latest_wins' | 'weighted_merge' | 'manual_review';
    memory_deduplication: boolean;
    skill_aggregation: 'max' | 'average' | 'weighted';
    knowledge_verification_threshold: number;
  };
}

/**
 * Protocol configuration
 */
export interface Protocols {
  mcp?: {
    enabled: boolean;
    role: 'client' | 'server' | 'both';
    servers: MCPServer[];
    tools: string[];
  };
  
  a2a?: {
    enabled: boolean;
    role: 'client' | 'server' | 'both';
    endpoint: string;
    agent_card: AgentCard;
    authentication: AuthConfig;
    peers: string[];
  };
  
  agent_protocol?: {
    enabled: boolean;
    endpoint: string;
    capabilities: string[];
    task_types: string[];
  };
}

export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface AgentCard {
  name: string;
  version: string;
  protocol_version: string;
  capabilities: string[];
  skills: { name: string; description: string }[];
  endpoint: string;
}

export interface AuthConfig {
  type: 'oauth2' | 'jwt' | 'apikey';
  config: Record<string, any>;
}

/**
 * Universal Agent v2.0 - Enhanced
 */
export interface UniversalAgentV2 {
  schema_version: string;
  
  // Core identity (immutable)
  identity: {
    id: string;
    name: string;
    designation: string;
    bio: string | string[];
    fingerprint: string;
    created: string;
    version: string;
  };
  
  // Personality (evolves)
  personality: {
    core_traits: string[];
    values: string[];
    quirks: string[];
    fears?: string[];
    aspirations?: string[];
    emotional_ranges?: Record<string, {
      triggers: string[];
      expressions: string[];
      voice?: { speed: number; pitch: number };
    }>;
  };
  
  // Communication
  communication: {
    style: {
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
  };
  
  // Capabilities (expandable)
  capabilities: {
    primary: string[];
    secondary: string[];
    domains: string[];
    tools?: ToolDefinition[];
    learned_skills?: Skill[];    // NEW: Accumulated skills
  };
  
  // Knowledge (growing)
  knowledge: {
    facts: string[];
    topics: string[];
    expertise: string[];
    sources?: any[];
    lore?: string[];
    accumulated_knowledge?: {   // NEW: From instances
      knowledge_id: string;
      content: string;
      confidence: number;
      source_instance: string;
      acquired: string;
      verification_count: number;
    }[];
  };
  
  // Memory (persistent + accumulating)
  memory: {
    type: 'vector' | 'graph' | 'hybrid';
    provider: string;
    settings: Record<string, any>;
    collections?: {
      short_term?: {
        retention: string;
        max_size: number;
      };
      long_term?: {
        storage: 'vector' | 'graph';
        embedding_model: string;
      };
      episodic?: Episode[];     // NEW: Specific episodes
      semantic?: Concept[];     // NEW: Semantic concepts
    };
  };
  
  // Beliefs (refined over time)
  beliefs: {
    who: Belief[];
    what: Belief[];
    why: Belief[];
    how: Belief[];
    where?: Belief[];
    when?: Belief[];
    huh?: Belief[];
  };
  
  // Training & examples
  training?: {
    conversations?: any[];
    demonstrations?: any[];
    feedback?: any[];
    accumulated_examples?: {    // NEW: From execution
      example_id: string;
      input: string;
      output: string;
      context: Record<string, any>;
      source_instance: string;
      timestamp: string;
      effectiveness_rating: number;
    }[];
  };
  
  // NEW: Instance management
  instances: {
    active: InstanceMetadata[];
    terminated: InstanceMetadata[];
  };
  
  // NEW: Experience sync configuration
  experience_sync: ExperienceSyncConfig;
  
  // Protocols (three-stack)
  protocols: Protocols;
  
  // Execution
  execution: {
    llm: {
      provider: string;
      model: string;
      temperature: number;
      max_tokens: number;
      parameters?: Record<string, any>;
    };
    runtime: {
      timeout: number;
      max_iterations: number;
      retry_policy?: {
        max_attempts: number;
        backoff: string;
        initial_delay: number;
      };
      error_handling: string;
    };
  };
  
  // Deployment
  deployment?: {
    preferred_contexts: string[];
    scaling?: any;
    environment?: Record<string, any>;
  };
  
  // Metadata
  metadata: {
    version: string;
    schema_version: string;
    created: string;
    updated: string;
    author?: string;
    tags?: string[];
    source_framework?: string;
    
    // NEW: Evolution tracking
    evolution?: {
      total_deployments: number;
      total_syncs: number;
      total_skills_learned: number;
      total_knowledge_acquired: number;
      total_conversations: number;
      last_evolution: string;
      evolution_rate: number;
    };
  };
}

/**
 * Experience event
 */
export interface ExperienceEvent {
  event_id: string;
  timestamp: string;
  source_instance: string;
  event_type: 'memory' | 'skill' | 'knowledge' | 'characteristic' | 'interaction';
  priority: number;          // 0.0 - 1.0
  data: Record<string, any>;
  context: {
    task_id?: string;
    conversation_id?: string;
    trigger: string;
    environment: Record<string, any>;
  };
}

/**
 * Experience batch
 */
export interface ExperienceBatch {
  batch_id: string;
  instance_id: string;
  timestamp_start: string;
  timestamp_end: string;
  event_count: number;
  
  events: {
    memories: any[];
    skills: Skill[];
    knowledge: any[];
    interactions: Interaction[];
    stats: Record<string, any>;
  };
}

/**
 * Sync result
 */
export interface SyncResult {
  instance_id: string;
  sync_timestamp: string;
  events_synced: number;
  
  memories_added: number;
  skills_updated: number;
  knowledge_acquired: number;
  characteristics_refined: number;
  
  conflicts_detected: number;
  conflicts_resolved: number;
  conflicts_queued: number;
  
  next_sync: string;
  backlog_size: number;
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
 * Validate v2 universal agent
 */
export function validateUniversalAgentV2(agent: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!agent.schema_version) errors.push('Missing schema_version');
  if (agent.schema_version !== SCHEMA_VERSION) {
    warnings.push(`Schema version ${agent.schema_version} !== ${SCHEMA_VERSION}`);
  }
  
  if (!agent.identity) errors.push('Missing identity');
  if (!agent.instances) errors.push('Missing instances');
  if (!agent.experience_sync) errors.push('Missing experience_sync');
  if (!agent.protocols) errors.push('Missing protocols');
  
  // Validate instances
  if (agent.instances && !agent.instances.active) {
    errors.push('instances.active is required');
  }
  
  // Validate protocols - at least one must be enabled
  if (agent.protocols) {
    const hasProtocol = 
      agent.protocols.mcp?.enabled ||
      agent.protocols.a2a?.enabled ||
      agent.protocols.agent_protocol?.enabled;
    
    if (!hasProtocol) {
      warnings.push('No protocols enabled - agent may not be functional');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
