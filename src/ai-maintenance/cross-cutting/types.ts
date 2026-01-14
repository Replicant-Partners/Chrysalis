/**
 * Cross-cutting AI Adaptation Types
 *
 * Type definitions for AI-led adaptation capabilities including pattern detection,
 * change propagation channels, and self-modification interfaces.
 *
 * @module ai-maintenance/cross-cutting/types
 * @version 1.0.0
 */

import { AgentFramework } from '../../adapters/protocol-types';
import { AdapterHealth } from '../../adapters/unified-adapter';

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Pattern type for detection.
 */
export type PatternType =
  | 'breaking-change'
  | 'deprecation'
  | 'enhancement'
  | 'security'
  | 'optimization'
  | 'schema-migration';

/**
 * Cross-cutting concern type for AI adaptation.
 */
export type AdaptationConcern =
  | 'pattern-detection'
  | 'change-propagation'
  | 'self-modification'
  | 'health-monitoring'
  | 'version-tracking'
  | 'capability-evolution'
  | 'error-recovery'
  | 'performance-optimization';

/**
 * Instrumentation point in the adapter lifecycle.
 */
export type InstrumentationPoint =
  | 'adapter-creation'
  | 'adapter-initialization'
  | 'pre-conversion'
  | 'post-conversion'
  | 'operation-invocation'
  | 'health-check'
  | 'error-handling'
  | 'adapter-shutdown'
  | 'registry-change'
  | 'capability-query';

/**
 * Change propagation channel type.
 *
 * Note: hierarchical and peer-to-peer channels were removed in v1.1.0
 * as they had no consumers and added latent complexity.
 */
export type PropagationChannel =
  | 'broadcast'      // All adapters receive
  | 'targeted'       // Specific adapters receive
  | 'event-driven';  // Event-based propagation

/**
 * Self-modification capability level.
 */
export type ModificationLevel =
  | 'none'           // No self-modification
  | 'configuration'  // Config changes only
  | 'behavior'       // Behavior modifications
  | 'structural'     // Structural changes
  | 'full';          // Complete self-modification

/**
 * Proposal type for modifications.
 */
export type ProposalType =
  | 'type-update'
  | 'mapping-update'
  | 'new-handler'
  | 'deprecation-wrapper'
  | 'security-patch'
  | 'breaking-change-migration';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Instrumentation configuration.
 */
export interface InstrumentationConfig {
  enabled: boolean;
  concerns: AdaptationConcern[];
  points: InstrumentationPoint[];
  samplingRate: number; // 0.0 - 1.0
  bufferSize: number;
  flushIntervalMs: number;
  asyncCollection: boolean;
}

/**
 * Collected instrumentation data.
 */
export interface InstrumentationData {
  id: string;
  timestamp: string;
  point: InstrumentationPoint;
  protocol: AgentFramework;
  concern: AdaptationConcern;
  data: Record<string, unknown>;
  duration?: number;
  success: boolean;
  error?: string;
}

/**
 * Change propagation message.
 */
export interface PropagationMessage {
  id: string;
  timestamp: string;
  channel: PropagationChannel;
  source: AgentFramework | 'system';
  targets: AgentFramework[] | 'all';
  changeType: string;
  payload: Record<string, unknown>;
  priority: number;
  ttl: number;
  requiresAck: boolean;
}

/**
 * Self-modification request.
 */
export interface ModificationRequest {
  id: string;
  timestamp: string;
  protocol: AgentFramework;
  level: ModificationLevel;
  type: ProposalType;
  description: string;
  changes: ModificationChange[];
  rollbackPlan: RollbackPlan;
  approvalRequired: boolean;
  confidence: number;
}

/**
 * Individual modification change.
 */
export interface ModificationChange {
  target: string;
  operation: 'add' | 'modify' | 'remove' | 'replace';
  before?: unknown;
  after?: unknown;
  validation?: () => boolean;
}

/**
 * Rollback plan for modifications.
 */
export interface RollbackPlan {
  steps: RollbackStep[];
  automated: boolean;
  timeoutMs: number;
  triggers: string[];
}

/**
 * Individual rollback step.
 */
export interface RollbackStep {
  order: number;
  description: string;
  action: () => Promise<void>;
  verify: () => Promise<boolean>;
}

/**
 * Component health with adaptation metrics.
 */
export interface AdaptiveHealth extends AdapterHealth {
  adaptationMetrics: {
    patternDetectionRate: number;
    modificationSuccessRate: number;
    propagationLatency: number;
    selfHealingEvents: number;
    evolutionScore: number;
  };
  pendingModifications: number;
  lastAdaptation?: string;
  adaptationStatus: 'idle' | 'adapting' | 'recovering' | 'evolving';
}

/**
 * Modification proposal for cross-cutting.
 */
export interface ModificationProposal {
  id: string;
  protocol: AgentFramework;
  type: ProposalType;
  description: string;
  confidence: number;
}
