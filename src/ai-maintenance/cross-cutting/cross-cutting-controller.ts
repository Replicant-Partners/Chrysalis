/**
 * @file cross-cutting-controller.ts
 * @description Central controller integrating all cross-cutting AI adaptation concerns.
 *
 * This module provides the CrossCuttingController class which orchestrates
 * pattern detection, change propagation, and self-modification capabilities
 * across all instrumented adapters. It serves as the integration point for
 * AI-driven maintenance and adaptation features.
 */

import { EventEmitter } from 'events';

import { AgentFramework } from '../../adapters/protocol-types';
import { NotImplementedError } from '../../mcp-server/chrysalis-tools';
import { UnifiedAdapter } from '../../adapters/unified-adapter';

import {
  PropagationMessage,
  AdaptiveHealth,
  ProposalType,
  ModificationChange,
  RollbackPlan
} from './types';
import {
  PatternDetectionInstrumentor,
  PatternDetection
} from './pattern-detection-instrumentor';
import { ChangePropagationSystem } from './change-propagation-system';
import {
  SelfModificationInterface,
  ModificationExecution
} from './self-modification-interface';

/**
 * Cross-cutting controller configuration.
 */
interface CrossCuttingConfig {
  enabled: boolean;
  autoInstrument: boolean;
  autoPropagate: boolean;
  autoModify: boolean;
  healthCheckIntervalMs: number;
}

/**
 * Central controller integrating all cross-cutting AI adaptation concerns.
 */
export class CrossCuttingController {
  private patternDetector: PatternDetectionInstrumentor;
  private propagationSystem: ChangePropagationSystem;
  private selfModification: SelfModificationInterface;
  private instrumentedAdapters: Map<AgentFramework, UnifiedAdapter> = new Map();
  private emitter: EventEmitter = new EventEmitter();
  private config: CrossCuttingConfig;

  constructor(config: Partial<CrossCuttingConfig> = {}) {
    this.config = {
      enabled: true,
      autoInstrument: true,
      autoPropagate: true,
      autoModify: false, // Require approval by default
      healthCheckIntervalMs: 30000,
      ...config
    };

    this.patternDetector = new PatternDetectionInstrumentor();
    this.propagationSystem = new ChangePropagationSystem();
    this.selfModification = new SelfModificationInterface({
      requireApproval: !this.config.autoModify
    });

    this.setupIntegration();
  }

  /**
   * Setup integration between components.
   */
  private setupIntegration(): void {
    // Connect pattern detection to propagation
    this.patternDetector.onPatternDetected((detection) => {
      if (this.config.autoPropagate) {
        this.propagationSystem.propagatePatternDetection(detection);
      }
      this.emitter.emit('pattern-detected', detection);
    });

    // Connect auto-reactions to self-modification
    this.patternDetector.onAutoReaction(async (detection) => {
      if (this.config.autoModify) {
        await this.triggerAutoModification(detection);
      }
      this.emitter.emit('auto-reaction', detection);
    });

    // Connect propagation events
    this.propagationSystem.on('message-sent', (msg) => {
      this.emitter.emit('propagation', msg);
    });

    // Connect modification events
    this.selfModification.on('modification-completed', (execution) => {
      this.propagationSystem.propagate('modification-completed', {
        execution
      });
      this.emitter.emit('modification', execution);
    });
  }

  /**
   * Instrument an adapter with AI adaptation capabilities.
   */
  instrument(adapter: UnifiedAdapter): void {
    const protocol = adapter.protocol;

    // Install pattern detection sensors
    this.patternDetector.installSensors(adapter);

    // Subscribe to change propagation
    this.propagationSystem.subscribe(protocol, async (message) => {
      await this.handlePropagatedChange(adapter, message);
    });

    // Register self-modification capability
    this.selfModification.registerCapability(protocol, 'behavior');

    // Store instrumented adapter reference
    this.instrumentedAdapters.set(protocol, adapter);

    this.emitter.emit('adapter-instrumented', { protocol });
  }

  /**
   * Handle propagated change for an adapter.
   */
  private async handlePropagatedChange(
    adapter: UnifiedAdapter,
    message: PropagationMessage
  ): Promise<void> {
    switch (message.changeType) {
      case 'adaptation':
        // Another adapter adapted, check if we need to respond
        this.emitter.emit('adaptation-propagated', {
          adapter: adapter.protocol,
          message
        });
        break;

      case 'health-change':
        // Health status changed elsewhere
        if (message.payload.newStatus === 'error') {
          // Check if this affects us
          const health = await adapter.getHealth();
          if (health.protocolHealth.recommendation === 'evaluate') {
            this.propagationSystem.propagateHealthChange(
              adapter.protocol,
              health.status,
              'degraded'
            );
          }
        }
        break;

      case 'pattern-detected':
        // Pattern detected elsewhere, check for related patterns
        this.emitter.emit('related-pattern', {
          adapter: adapter.protocol,
          originalDetection: message.payload
        });
        break;
    }
  }

  /**
   * Trigger automatic modification based on detected pattern.
   */
  private async triggerAutoModification(
    detection: PatternDetection
  ): Promise<void> {
    // Map pattern to modification
    const modification = this.createModificationFromPattern(detection);
    if (modification) {
      this.selfModification.requestModification(
        detection.protocol,
        modification.type,
        modification.description,
        modification.changes,
        modification.rollbackPlan,
        { approvalRequired: !this.config.autoModify, confidence: detection.confidence }
      );
    }
  }

  /**
   * Create modification from pattern detection.
   */
  private createModificationFromPattern(
    detection: PatternDetection
  ): {
    type: ProposalType;
    description: string;
    changes: ModificationChange[];
    rollbackPlan: RollbackPlan;
  } | null {
    switch (detection.patternType) {
      case 'deprecation':
        return {
          type: 'deprecation-wrapper',
          description: `Auto-wrap deprecated features: ${detection.description}`,
          changes: [{
            target: `adapters/${detection.protocol}/deprecated`,
            operation: 'add',
            after: { reason: detection.description }
          }],
          rollbackPlan: {
            steps: [{
              order: 1,
              description: 'Remove deprecation wrapper',
              action: async () => { /* rollback logic */ },
              verify: async () => true
            }],
            automated: true,
            timeoutMs: 10000,
            triggers: ['failure', 'timeout']
          }
        };

      case 'breaking-change':
        return {
          type: 'breaking-change-migration',
          description: `Handle breaking change: ${detection.description}`,
          changes: [{
            target: `adapters/${detection.protocol}/migration`,
            operation: 'add',
            after: { migration: detection.evidence }
          }],
          rollbackPlan: {
            steps: [{
              order: 1,
              description: 'Revert migration',
              action: async () => { /* rollback logic */ },
              verify: async () => true
            }],
            automated: true,
            timeoutMs: 30000,
            triggers: ['failure']
          }
        };

      default:
        return null;
    }
  }

  /**
   * Get adaptive health for all instrumented adapters.
   */
  async getAdaptiveHealth(): Promise<Map<AgentFramework, AdaptiveHealth>> {
    throw new NotImplementedError(
      'getAdaptiveHealth: propagationLatency tracking not implemented. ' +
      'Real implementation requires latency measurement infrastructure.'
    );
  }

  /**
   * Calculate pattern detection rate.
   */
  private calculateDetectionRate(detections: PatternDetection[]): number {
    const recentDetections = detections.filter(
      d => Date.now() - new Date(d.timestamp).getTime() < 3600000
    );
    return recentDetections.length;
  }

  /**
   * Calculate modification success rate.
   */
  private calculateModificationRate(executions: ModificationExecution[]): number {
    if (executions.length === 0) return 1.0;
    const successful = executions.filter(e => e.status === 'completed').length;
    return successful / executions.length;
  }

  /**
   * Calculate evolution score.
   */
  private calculateEvolutionScore(
    detections: PatternDetection[],
    executions: ModificationExecution[]
  ): number {
    const detectionScore = Math.min(detections.length / 10, 1);
    const modificationScore = executions.filter(e => e.status === 'completed').length / 10;
    return (detectionScore + modificationScore) / 2;
  }

  /**
   * Get current adaptation status for a protocol.
   */
  private getAdaptationStatus(
    protocol: AgentFramework
  ): 'idle' | 'adapting' | 'recovering' | 'evolving' {
    const pending = this.selfModification.getPending()
      .filter(m => m.protocol === protocol);
    if (pending.length > 0) return 'adapting';

    const recent = this.selfModification.getHistory(protocol)
      .filter(e => Date.now() - new Date(e.endTime).getTime() < 60000);
    if (recent.some(e => e.rollbackPerformed)) return 'recovering';
    if (recent.length > 0) return 'evolving';

    return 'idle';
  }

  /**
   * Subscribe to controller events.
   */
  on(event: string, handler: (data: unknown) => void): void {
    this.emitter.on(event, handler);
  }

  /**
   * Get components.
   */
  getComponents(): {
    patternDetector: PatternDetectionInstrumentor;
    propagationSystem: ChangePropagationSystem;
    selfModification: SelfModificationInterface;
  } {
    return {
      patternDetector: this.patternDetector,
      propagationSystem: this.propagationSystem,
      selfModification: this.selfModification
    };
  }

  /**
   * Stop the controller.
   */
  stop(): void {
    this.propagationSystem.stopProcessing();
  }
}

/**
 * Global cross-cutting controller instance.
 */
export const crossCuttingController = new CrossCuttingController();

/**
 * Global pattern detection instrumentor instance.
 */
export const patternDetectionInstrumentor = new PatternDetectionInstrumentor();

/**
 * Global change propagation system instance.
 */
export const changePropagationSystem = new ChangePropagationSystem();

/**
 * Global self-modification interface instance.
 */
export const selfModificationInterface = new SelfModificationInterface();

export default {
  CrossCuttingController,
  crossCuttingController,
  patternDetectionInstrumentor,
  changePropagationSystem,
  selfModificationInterface
};
