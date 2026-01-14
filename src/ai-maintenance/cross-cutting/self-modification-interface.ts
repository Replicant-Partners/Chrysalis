/**
 * Self-Modification Interface
 *
 * Manages self-modification capabilities for adapters, enabling controlled
 * runtime modifications with approval workflows, validation, and automatic
 * rollback on failure. Provides event-driven architecture for monitoring
 * and responding to modification lifecycle events.
 *
 * @module self-modification-interface
 */

import { EventEmitter } from 'events';
import { AgentFramework } from '../../adapters/protocol-types';
import {
  ModificationLevel,
  ProposalType,
  ModificationRequest,
  ModificationChange,
  RollbackPlan
} from './types';

/**
 * Modification execution record.
 */
export interface ModificationExecution {
  requestId: string;
  protocol: AgentFramework;
  startTime: string;
  endTime: string;
  status: 'in-progress' | 'completed' | 'failed' | 'rolled-back';
  changesApplied: number;
  changesFailed: number;
  rollbackPerformed: boolean;
  error?: string;
}

/**
 * Modification request options.
 */
interface ModificationRequestOptions {
  approvalRequired: boolean;
  confidence: number;
}

/**
 * Self-modification configuration.
 */
interface SelfModificationConfig {
  enabled: boolean;
  maxConcurrentModifications: number;
  requireApproval: boolean;
  autoRollbackOnFailure: boolean;
  rollbackTimeoutMs: number;
  validationRequired: boolean;
  historySize: number;
}

/**
 * Manages self-modification capabilities for adapters.
 */
export class SelfModificationInterface {
  private modificationQueue: ModificationRequest[] = [];
  private executionHistory: ModificationExecution[] = [];
  private capabilities: Map<AgentFramework, ModificationLevel> = new Map();
  private emitter: EventEmitter = new EventEmitter();
  private config: SelfModificationConfig;

  constructor(config: Partial<SelfModificationConfig> = {}) {
    this.config = {
      enabled: true,
      maxConcurrentModifications: 1,
      requireApproval: true,
      autoRollbackOnFailure: true,
      rollbackTimeoutMs: 30000,
      validationRequired: true,
      historySize: 100,
      ...config
    };
  }

  /**
   * Register modification capability for an adapter.
   */
  registerCapability(protocol: AgentFramework, level: ModificationLevel): void {
    this.capabilities.set(protocol, level);
  }

  /**
   * Get modification capability level.
   */
  getCapabilityLevel(protocol: AgentFramework): ModificationLevel {
    return this.capabilities.get(protocol) ?? 'none';
  }

  /**
   * Request a modification.
   */
  requestModification(
    protocol: AgentFramework,
    type: ProposalType,
    description: string,
    changes: ModificationChange[],
    rollbackPlan: RollbackPlan,
    options: Partial<ModificationRequestOptions> = {}
  ): ModificationRequest {
    const level = this.getRequiredLevel(type);
    const currentLevel = this.getCapabilityLevel(protocol);

    if (!this.isLevelSufficient(currentLevel, level)) {
      throw new Error(
        `Insufficient modification capability: requires ${level}, has ${currentLevel}`
      );
    }

    const request: ModificationRequest = {
      id: `mod-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      protocol,
      level,
      type,
      description,
      changes,
      rollbackPlan,
      approvalRequired: options.approvalRequired ?? this.config.requireApproval,
      confidence: options.confidence ?? 1.0
    };

    this.modificationQueue.push(request);
    this.emitter.emit('modification-requested', request);

    if (!request.approvalRequired) {
      this.executeModification(request.id);
    }

    return request;
  }

  /**
   * Approve a pending modification.
   */
  approve(requestId: string, approver: string): boolean {
    const request = this.modificationQueue.find(r => r.id === requestId);
    if (!request) return false;

    this.emitter.emit('modification-approved', { request, approver });
    this.executeModification(requestId);
    return true;
  }

  /**
   * Reject a pending modification.
   */
  reject(requestId: string, reason: string): boolean {
    const index = this.modificationQueue.findIndex(r => r.id === requestId);
    if (index < 0) return false;

    const request = this.modificationQueue.splice(index, 1)[0];
    this.emitter.emit('modification-rejected', { request, reason });
    return true;
  }

  /**
   * Execute a modification.
   */
  async executeModification(requestId: string): Promise<ModificationExecution> {
    const index = this.modificationQueue.findIndex(r => r.id === requestId);
    if (index < 0) {
      throw new Error(`Modification request not found: ${requestId}`);
    }

    const request = this.modificationQueue.splice(index, 1)[0];
    const execution: ModificationExecution = {
      requestId,
      protocol: request.protocol,
      startTime: new Date().toISOString(),
      endTime: '',
      status: 'in-progress',
      changesApplied: 0,
      changesFailed: 0,
      rollbackPerformed: false
    };

    this.emitter.emit('modification-started', execution);

    try {
      // Validate changes if required
      if (this.config.validationRequired) {
        for (const change of request.changes) {
          if (change.validation && !change.validation()) {
            throw new Error(`Validation failed for change: ${change.target}`);
          }
        }
      }

      // Apply changes
      for (const change of request.changes) {
        try {
          await this.applyChange(change, request.protocol);
          execution.changesApplied++;
        } catch (error) {
          execution.changesFailed++;
          if (this.config.autoRollbackOnFailure) {
            await this.performRollback(request.rollbackPlan, execution);
            throw error;
          }
        }
      }

      execution.status = 'completed';
      execution.endTime = new Date().toISOString();

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date().toISOString();
      execution.error = error instanceof Error ? error.message : String(error);
    }

    this.recordExecution(execution);
    this.emitter.emit('modification-completed', execution);
    return execution;
  }

  /**
   * Apply a single change.
   */
  private async applyChange(
    change: ModificationChange,
    protocol: AgentFramework
  ): Promise<void> {
    // Emit change application event for external handling
    this.emitter.emit('apply-change', { change, protocol });

    // In a real implementation, this would modify the adapter
    // For now, we just log and emit events
    console.log(`Applying change to ${protocol}: ${change.operation} ${change.target}`);
  }

  /**
   * Perform rollback.
   */
  private async performRollback(
    plan: RollbackPlan,
    execution: ModificationExecution
  ): Promise<void> {
    execution.rollbackPerformed = true;
    this.emitter.emit('rollback-started', { execution, plan });

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Rollback timeout')), plan.timeoutMs);
    });

    const rollback = async () => {
      for (const step of plan.steps.sort((a, b) => a.order - b.order)) {
        await step.action();
        const verified = await step.verify();
        if (!verified) {
          throw new Error(`Rollback step ${step.order} verification failed`);
        }
      }
    };

    try {
      if (plan.automated) {
        await Promise.race([rollback(), timeout]);
      }
      this.emitter.emit('rollback-completed', execution);
    } catch (error) {
      this.emitter.emit('rollback-failed', { execution, error });
      throw error;
    }
  }

  /**
   * Get required modification level for a proposal type.
   */
  private getRequiredLevel(type: ProposalType): ModificationLevel {
    switch (type) {
      case 'type-update':
      case 'mapping-update':
        return 'configuration';
      case 'new-handler':
      case 'deprecation-wrapper':
      case 'security-patch':
        return 'behavior';
      case 'breaking-change-migration':
        return 'structural';
      default:
        return 'configuration';
    }
  }

  /**
   * Check if current level is sufficient.
   */
  private isLevelSufficient(
    current: ModificationLevel,
    required: ModificationLevel
  ): boolean {
    const levelOrder: ModificationLevel[] = [
      'none', 'configuration', 'behavior', 'structural', 'full'
    ];
    return levelOrder.indexOf(current) >= levelOrder.indexOf(required);
  }

  /**
   * Record execution in history.
   */
  private recordExecution(execution: ModificationExecution): void {
    this.executionHistory.push(execution);
    if (this.executionHistory.length > this.config.historySize) {
      this.executionHistory.shift();
    }
  }

  /**
   * Get pending modifications.
   */
  getPending(): ModificationRequest[] {
    return [...this.modificationQueue];
  }

  /**
   * Get execution history.
   */
  getHistory(protocol?: AgentFramework): ModificationExecution[] {
    if (protocol) {
      return this.executionHistory.filter(e => e.protocol === protocol);
    }
    return [...this.executionHistory];
  }

  /**
   * Subscribe to events.
   */
  on(event: string, handler: (data: unknown) => void): void {
    this.emitter.on(event, handler);
  }
}
