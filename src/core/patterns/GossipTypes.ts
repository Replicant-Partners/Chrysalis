/**
 * Typed Gossip Protocol Payloads
 * 
 * Replaces the untyped `data: any` in GossipMessage with strongly-typed
 * discriminated unions for each message type.
 * 
 * @see IMPLEMENTATION_PLAN.md Phase 0.4
 * @see COMPREHENSIVE_CODE_REVIEW.md CRIT-LOG-001
 */

/**
 * Experience payload - Agent learning from episodes
 */
export interface ExperiencePayload {
  experiences: ExperienceItem[];
}

export interface ExperienceItem {
  episode_id: string;
  timestamp: string;
  source_instance: string;
  content: string;
  duration_ms: number;
  effectiveness: number;  // 0.0 - 1.0
  skills_practiced: string[];
  lessons_learned: string[];
  ooda_stage?: 'observe' | 'orient' | 'decide' | 'act';
}

/**
 * State payload - Agent status synchronization
 */
export interface StatePayload {
  nodeId: string;
  version: number;
  status: 'running' | 'idle' | 'syncing' | 'terminated';
  skills: Record<string, SkillState>;
  lastUpdate: string;
  health: HealthStatus;
}

export interface SkillState {
  proficiency: number;  // 0.0 - 1.0
  usage_count: number;
  last_used: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  error_rate: number;
  sync_lag_ms: number;
}

/**
 * Knowledge payload - Factual information sharing
 */
export interface KnowledgePayload {
  concepts: KnowledgeItem[];
}

export interface KnowledgeItem {
  concept_id: string;
  name: string;
  definition: string;
  confidence: number;  // 0.0 - 1.0
  sources: string[];
  related_concepts: string[];
  verification_count: number;
  last_verified: string;
}

/**
 * Memories payload - Episodic/semantic memory sharing
 */
export interface MemoriesPayload {
  memories: MemoryItem[];
}

export interface MemoryItem {
  id: string;
  content: string;
  type: 'episodic' | 'semantic' | 'working' | 'core';
  timestamp: string;
  source: 'user' | 'agent' | 'sync' | 'inference';
  embedding?: number[];  // Optional for efficiency
  metadata: Record<string, string>;
  privacy: 'PUBLIC' | 'PRIVATE';
}

/**
 * Discriminated union for all gossip payloads
 */
export type GossipPayload = 
  | { type: 'experiences'; data: ExperiencePayload }
  | { type: 'state'; data: StatePayload }
  | { type: 'knowledge'; data: KnowledgePayload }
  | { type: 'memories'; data: MemoriesPayload };

/**
 * Typed gossip message (replaces original GossipMessage)
 */
export interface TypedGossipMessage {
  id: string;
  nodeId: string;
  timestamp: number;
  payload: GossipPayload;
  signature: string;
  logicalClock: number;
}

/**
 * Type guards for payload discrimination
 */
export function isExperiencePayload(payload: GossipPayload): payload is { type: 'experiences'; data: ExperiencePayload } {
  return payload.type === 'experiences';
}

export function isStatePayload(payload: GossipPayload): payload is { type: 'state'; data: StatePayload } {
  return payload.type === 'state';
}

export function isKnowledgePayload(payload: GossipPayload): payload is { type: 'knowledge'; data: KnowledgePayload } {
  return payload.type === 'knowledge';
}

export function isMemoriesPayload(payload: GossipPayload): payload is { type: 'memories'; data: MemoriesPayload } {
  return payload.type === 'memories';
}

/**
 * Validation functions for runtime type checking
 */
export function validateExperienceItem(item: unknown): item is ExperienceItem {
  if (typeof item !== 'object' || item === null) return false;
  const e = item as Record<string, unknown>;
  return (
    typeof e.episode_id === 'string' &&
    typeof e.timestamp === 'string' &&
    typeof e.source_instance === 'string' &&
    typeof e.content === 'string' &&
    typeof e.duration_ms === 'number' &&
    typeof e.effectiveness === 'number' &&
    e.effectiveness >= 0 && e.effectiveness <= 1 &&
    Array.isArray(e.skills_practiced) &&
    Array.isArray(e.lessons_learned)
  );
}

export function validateKnowledgeItem(item: unknown): item is KnowledgeItem {
  if (typeof item !== 'object' || item === null) return false;
  const k = item as Record<string, unknown>;
  return (
    typeof k.concept_id === 'string' &&
    typeof k.name === 'string' &&
    typeof k.definition === 'string' &&
    typeof k.confidence === 'number' &&
    k.confidence >= 0 && k.confidence <= 1 &&
    Array.isArray(k.sources) &&
    Array.isArray(k.related_concepts) &&
    typeof k.verification_count === 'number'
  );
}

export function validateMemoryItem(item: unknown): item is MemoryItem {
  if (typeof item !== 'object' || item === null) return false;
  const m = item as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.content === 'string' &&
    ['episodic', 'semantic', 'working', 'core'].includes(m.type as string) &&
    typeof m.timestamp === 'string' &&
    ['user', 'agent', 'sync', 'inference'].includes(m.source as string) &&
    typeof m.metadata === 'object' &&
    ['PUBLIC', 'PRIVATE'].includes(m.privacy as string)
  );
}

/**
 * Validate entire gossip payload
 */
export function validateGossipPayload(payload: unknown): payload is GossipPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  
  if (typeof p.type !== 'string' || typeof p.data !== 'object') return false;
  
  switch (p.type) {
    case 'experiences': {
      const data = p.data as Record<string, unknown>;
      return Array.isArray(data.experiences) && 
             data.experiences.every(validateExperienceItem);
    }
    case 'knowledge': {
      const data = p.data as Record<string, unknown>;
      return Array.isArray(data.concepts) && 
             data.concepts.every(validateKnowledgeItem);
    }
    case 'memories': {
      const data = p.data as Record<string, unknown>;
      return Array.isArray(data.memories) && 
             data.memories.every(validateMemoryItem);
    }
    case 'state': {
      const data = p.data as Record<string, unknown>;
      return (
        typeof data.nodeId === 'string' &&
        typeof data.version === 'number' &&
        ['running', 'idle', 'syncing', 'terminated'].includes(data.status as string)
      );
    }
    default:
      return false;
  }
}
