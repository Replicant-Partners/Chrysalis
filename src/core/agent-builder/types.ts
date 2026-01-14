/**
 * Type definitions for AgentBuilder configuration interfaces.
 * @module core/agent-builder/types
 */

import type { Episode, Concept, SyncProtocol } from '../UniformSemanticAgentV2';

export interface IdentityConfig {
  id?: string;
  name: string;
  designation?: string;
  bio?: string | string[];
  fingerprint?: string;
  version?: string;
}

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
