/**
 * Cross-cutting AI Adaptation Integration
 * 
 * Instruments the Chrysalis adapter ecosystem with AI-led adaptation capabilities,
 * connecting pattern detection sensors, change propagation channels, and
 * self-modification interfaces across all components.
 * 
 * @module ai-maintenance/cross-cutting-integration
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { AgentFramework } from '../adapters/protocol-types';
import { UnifiedAdapter, AdapterHealth, AdapterStatus } from '../adapters/unified-adapter';
import { UniversalMessage } from '../adapters/protocol-messages';
import { ProtocolCapability } from '../adapters/protocol-capabilities';
import {
  AdaptationHook,
  AdaptationHookType,
  HookContext,
  HookResult,
  hookExecutor,
  patternSensorManager,
  extensibilityManager,
  versionNegotiator,
  createPreConversionHook,
  createPostConversionHook,
  createErrorRecoveryHook
} from '../adapters/adaptation-hooks';
import {
  EvolutionaryPattern,
  PatternType,
  evolutionaryPatternRegistry,
  PatternTrigger,
  PatternMatchResult
} from './evolutionary-patterns';
import {
  AdaptationPipeline,
  AdaptationPipelineConfig,
  PipelineStatus
} from './adaptation-pipeline';
import {
  SemanticDiffAnalyzer,
  SemanticDiff,
  ChangeImpact
} from './semantic-diff-analyzer';
import {
  ModificationProposal,
  ProposalType
} from './adapter-modification-generator';

// ============================================================================
// Types and Interfaces
// ============================================================================

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
 */
export type PropagationChannel =
  | 'broadcast'      // All adapters receive
  | 'targeted'       // Specific adapters receive
  | 'hierarchical'   // Parent-child propagation
  | 'peer-to-peer'   // Direct adapter communication
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

// ============================================================================
// Pattern Detection Instrumentation
// ============================================================================

/**
 * Instruments adapters with pattern detection sensors.
 */
export class PatternDetectionInstrumentor {
  private sensors: Map<AgentFramework, PatternSensor[]> = new Map();
  private detectionHistory: PatternDetection[] = [];
  private config: PatternDetectionConfig;
  private emitter: EventEmitter = new EventEmitter();

  constructor(config: Partial<PatternDetectionConfig> = {}) {
    this.config = {
      enabled: true,
      historySize: 1000,
      detectionThreshold: 0.7,
      patternTypes: ['breaking-change', 'deprecation', 'enhancement', 'security', 'optimization'],
      autoReact: true,
      reactionDelay: 5000,
      ...config
    };
  }

  /**
   * Install sensors on an adapter.
   */
  installSensors(adapter: UnifiedAdapter): void {
    const protocol = adapter.protocol;
    const sensors: PatternSensor[] = [];

    // API Surface Sensor - detects capability changes
    sensors.push({
      id: `${protocol}-api-surface`,
      type: 'api-surface',
      protocol,
      enabled: true,
      detect: async (context: SensorContext) => {
        const capabilities = adapter.getCapabilities();
        const versionInfo = adapter.getVersionInfo();
        return this.analyzeApiSurface(capabilities, versionInfo, context);
      }
    });

    // Behavior Sensor - detects operational anomalies
    sensors.push({
      id: `${protocol}-behavior`,
      type: 'behavior',
      protocol,
      enabled: true,
      detect: async (context: SensorContext) => {
        const health = await adapter.getHealth();
        return this.analyzeBehavior(health, context);
      }
    });

    // Version Sensor - detects version drift
    sensors.push({
      id: `${protocol}-version`,
      type: 'version',
      protocol,
      enabled: true,
      detect: async (context: SensorContext) => {
        const versionInfo = adapter.getVersionInfo();
        return this.analyzeVersionDrift(versionInfo, context);
      }
    });

    // Error Pattern Sensor - detects recurring error patterns
    sensors.push({
      id: `${protocol}-error-pattern`,
      type: 'error-pattern',
      protocol,
      enabled: true,
      detect: async (context: SensorContext) => {
        const health = await adapter.getHealth();
        return this.analyzeErrorPatterns(health, context);
      }
    });

    // Register sensors
    this.sensors.set(protocol, sensors);

    // Register with global pattern sensor manager
    for (const sensor of sensors) {
      patternSensorManager.registerSensor(protocol, {
        sensorType: sensor.type,
        detect: sensor.detect
      });
    }

    // Install adaptation hooks
    this.installDetectionHooks(protocol);
  }

  /**
   * Install hooks for real-time pattern detection.
   */
  private installDetectionHooks(protocol: AgentFramework): void {
    // Pre-conversion hook for input pattern detection
    hookExecutor.registerHook(createPreConversionHook(
      `${protocol}-pre-conversion-sensor`,
      async (ctx) => {
        await this.runSensorCheck(protocol, 'pre-conversion', ctx);
        return { success: true, data: ctx.data };
      },
      { protocols: [protocol] }
    ));

    // Post-conversion hook for output pattern detection
    hookExecutor.registerHook(createPostConversionHook(
      `${protocol}-post-conversion-sensor`,
      async (ctx) => {
        await this.runSensorCheck(protocol, 'post-conversion', ctx);
        return { success: true, data: ctx.data };
      },
      { protocols: [protocol] }
    ));

    // Error hook for failure pattern detection
    hookExecutor.registerHook(createErrorRecoveryHook(
      `${protocol}-error-sensor`,
      async (ctx) => {
        const detection = await this.detectErrorPattern(protocol, ctx);
        if (detection && this.config.autoReact) {
          await this.triggerAutoReaction(detection);
        }
        return { success: true, recovered: false };
      },
      { protocols: [protocol] }
    ));
  }

  /**
   * Run sensor check at instrumentation point.
   */
  private async runSensorCheck(
    protocol: AgentFramework,
    point: InstrumentationPoint,
    context: HookContext
  ): Promise<void> {
    const sensors = this.sensors.get(protocol) || [];
    const sensorContext: SensorContext = {
      point,
      timestamp: new Date().toISOString(),
      data: context.data,
      metadata: context.metadata
    };

    for (const sensor of sensors) {
      if (!sensor.enabled) continue;

      try {
        const detection = await sensor.detect(sensorContext);
        if (detection && detection.confidence >= this.config.detectionThreshold) {
          this.recordDetection(detection);
          this.emitter.emit('pattern-detected', detection);
        }
      } catch (error) {
        console.error(`Sensor ${sensor.id} failed:`, error);
      }
    }
  }

  /**
   * Analyze API surface for changes.
   */
  private analyzeApiSurface(
    capabilities: ProtocolCapability,
    versionInfo: unknown,
    context: SensorContext
  ): PatternDetection | null {
    // Check for capability changes that might indicate API evolution
    const features = capabilities.features;
    const deprecatedCount = features.filter(f => f.level === 'partial').length;
    const totalFeatures = features.length;

    if (deprecatedCount / totalFeatures > 0.3) {
      return {
        id: `api-surface-${Date.now()}`,
        timestamp: context.timestamp,
        protocol: capabilities.protocol,
        patternType: 'deprecation',
        description: 'High ratio of partially supported features detected',
        confidence: 0.75,
        evidence: { deprecatedCount, totalFeatures, ratio: deprecatedCount / totalFeatures },
        suggestedAction: 'Review feature support levels and plan migration'
      };
    }

    return null;
  }

  /**
   * Analyze behavior patterns.
   */
  private analyzeBehavior(
    health: AdapterHealth,
    context: SensorContext
  ): PatternDetection | null {
    // Check for behavioral anomalies
    if (health.recentErrors > 10 || health.healthScore < 50) {
      return {
        id: `behavior-${Date.now()}`,
        timestamp: context.timestamp,
        protocol: health.protocol,
        patternType: 'optimization',
        description: 'Degraded adapter performance detected',
        confidence: 0.8,
        evidence: {
          recentErrors: health.recentErrors,
          healthScore: health.healthScore,
          status: health.status
        },
        suggestedAction: 'Investigate error sources and optimize adapter'
      };
    }

    return null;
  }

  /**
   * Analyze version drift.
   */
  private analyzeVersionDrift(
    versionInfo: unknown,
    context: SensorContext
  ): PatternDetection | null {
    // Implementation would compare versions with upstream
    return null;
  }

  /**
   * Analyze error patterns.
   */
  private analyzeErrorPatterns(
    health: AdapterHealth,
    context: SensorContext
  ): PatternDetection | null {
    if (health.lastError) {
      const errorCode = health.lastError.code;
      // Check for recurring error patterns
      const recentDetections = this.detectionHistory.filter(
        d => d.protocol === health.protocol &&
          d.patternType === 'breaking-change' &&
          Date.now() - new Date(d.timestamp).getTime() < 3600000
      );

      if (recentDetections.length >= 3) {
        return {
          id: `error-pattern-${Date.now()}`,
          timestamp: context.timestamp,
          protocol: health.protocol,
          patternType: 'breaking-change',
          description: `Recurring error pattern detected: ${errorCode}`,
          confidence: 0.85,
          evidence: {
            errorCode,
            occurrences: recentDetections.length,
            lastError: health.lastError
          },
          suggestedAction: 'Investigate potential breaking change in upstream protocol'
        };
      }
    }

    return null;
  }

  /**
   * Detect error pattern from context.
   */
  private async detectErrorPattern(
    protocol: AgentFramework,
    context: HookContext
  ): Promise<PatternDetection | null> {
    if (context.error) {
      return {
        id: `error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        protocol,
        patternType: 'breaking-change',
        description: `Error detected: ${context.error.message}`,
        confidence: 0.7,
        evidence: { error: context.error },
        suggestedAction: 'Analyze error and determine if adaptation is needed'
      };
    }
    return null;
  }

  /**
   * Record pattern detection.
   */
  private recordDetection(detection: PatternDetection): void {
    this.detectionHistory.push(detection);
    if (this.detectionHistory.length > this.config.historySize) {
      this.detectionHistory.shift();
    }
  }

  /**
   * Trigger automatic reaction to detected pattern.
   */
  private async triggerAutoReaction(detection: PatternDetection): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.config.reactionDelay));
    this.emitter.emit('auto-reaction', detection);
  }

  /**
   * Get detection history for a protocol.
   */
  getDetectionHistory(protocol?: AgentFramework): PatternDetection[] {
    if (protocol) {
      return this.detectionHistory.filter(d => d.protocol === protocol);
    }
    return [...this.detectionHistory];
  }

  /**
   * Subscribe to pattern detection events.
   */
  onPatternDetected(callback: (detection: PatternDetection) => void): void {
    this.emitter.on('pattern-detected', callback);
  }

  /**
   * Subscribe to auto-reaction events.
   */
  onAutoReaction(callback: (detection: PatternDetection) => void): void {
    this.emitter.on('auto-reaction', callback);
  }
}

/**
 * Pattern sensor interface.
 */
interface PatternSensor {
  id: string;
  type: string;
  protocol: AgentFramework;
  enabled: boolean;
  detect: (context: SensorContext) => Promise<PatternDetection | null>;
}

/**
 * Sensor context for detection.
 */
interface SensorContext {
  point: InstrumentationPoint;
  timestamp: string;
  data: unknown;
  metadata: Record<string, unknown>;
}

/**
 * Pattern detection result.
 */
interface PatternDetection {
  id: string;
  timestamp: string;
  protocol: AgentFramework;
  patternType: PatternType;
  description: string;
  confidence: number;
  evidence: Record<string, unknown>;
  suggestedAction: string;
}

/**
 * Pattern detection configuration.
 */
interface PatternDetectionConfig {
  enabled: boolean;
  historySize: number;
  detectionThreshold: number;
  patternTypes: PatternType[];
  autoReact: boolean;
  reactionDelay: number;
}

// ============================================================================
// Change Propagation System
// ============================================================================

/**
 * Manages change propagation across adapters.
 */
export class ChangePropagationSystem {
  private channels: Map<PropagationChannel, ChannelHandler> = new Map();
  private subscribers: Map<AgentFramework, PropagationSubscription[]> = new Map();
  private messageQueue: PropagationMessage[] = [];
  private emitter: EventEmitter = new EventEmitter();
  private config: PropagationConfig;

  constructor(config: Partial<PropagationConfig> = {}) {
    this.config = {
      enabled: true,
      defaultChannel: 'broadcast',
      maxQueueSize: 1000,
      processingIntervalMs: 100,
      retryAttempts: 3,
      ackTimeoutMs: 5000,
      ...config
    };

    this.initializeChannels();
    this.startProcessing();
  }

  /**
   * Initialize propagation channels.
   */
  private initializeChannels(): void {
    // Broadcast channel - sends to all adapters
    this.channels.set('broadcast', {
      channel: 'broadcast',
      send: async (message) => {
        const subscribers = this.getAllSubscribers();
        for (const sub of subscribers) {
          await sub.handler(message);
        }
      }
    });

    // Targeted channel - sends to specific adapters
    this.channels.set('targeted', {
      channel: 'targeted',
      send: async (message) => {
        if (message.targets === 'all') {
          return this.channels.get('broadcast')!.send(message);
        }
        for (const target of message.targets) {
          const subs = this.subscribers.get(target) || [];
          for (const sub of subs) {
            await sub.handler(message);
          }
        }
      }
    });

    // Event-driven channel - uses event emitter
    this.channels.set('event-driven', {
      channel: 'event-driven',
      send: async (message) => {
        this.emitter.emit(message.changeType, message);
      }
    });

    // Hierarchical channel - parent-child propagation
    this.channels.set('hierarchical', {
      channel: 'hierarchical',
      send: async (message) => {
        // For hierarchical, we propagate based on protocol relationships
        const hierarchy = this.getProtocolHierarchy(message.source);
        for (const protocol of hierarchy) {
          const subs = this.subscribers.get(protocol) || [];
          for (const sub of subs) {
            await sub.handler(message);
          }
        }
      }
    });

    // Peer-to-peer channel - direct communication
    this.channels.set('peer-to-peer', {
      channel: 'peer-to-peer',
      send: async (message) => {
        // Similar to targeted but with acknowledgment
        if (message.targets !== 'all') {
          for (const target of message.targets) {
            const subs = this.subscribers.get(target) || [];
            for (const sub of subs) {
              const result = await sub.handler(message);
              if (message.requiresAck) {
                this.emitter.emit('ack', { messageId: message.id, target, result });
              }
            }
          }
        }
      }
    });
  }

  /**
   * Start message processing loop.
   */
  private startProcessing(): void {
    setInterval(() => {
      this.processQueue();
    }, this.config.processingIntervalMs);
  }

  /**
   * Process queued messages.
   */
  private async processQueue(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (!message) break;

      // Check TTL
      const age = Date.now() - new Date(message.timestamp).getTime();
      if (age > message.ttl) {
        this.emitter.emit('message-expired', message);
        continue;
      }

      try {
        const handler = this.channels.get(message.channel);
        if (handler) {
          await handler.send(message);
          this.emitter.emit('message-sent', message);
        }
      } catch (error) {
        this.emitter.emit('message-failed', { message, error });
      }
    }
  }

  /**
   * Subscribe to changes for a protocol.
   */
  subscribe(
    protocol: AgentFramework,
    handler: (message: PropagationMessage) => Promise<void>,
    options: Partial<SubscriptionOptions> = {}
  ): string {
    const subscriptionId = `sub-${protocol}-${Date.now()}`;
    const subscription: PropagationSubscription = {
      id: subscriptionId,
      protocol,
      handler,
      filter: options.filter,
      priority: options.priority ?? 0
    };

    const existing = this.subscribers.get(protocol) || [];
    existing.push(subscription);
    this.subscribers.set(protocol, existing);

    return subscriptionId;
  }

  /**
   * Unsubscribe from changes.
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [protocol, subs] of this.subscribers) {
      const index = subs.findIndex(s => s.id === subscriptionId);
      if (index >= 0) {
        subs.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Propagate a change.
   */
  propagate(
    changeType: string,
    payload: Record<string, unknown>,
    options: Partial<PropagationOptions> = {}
  ): string {
    const message: PropagationMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      channel: options.channel ?? this.config.defaultChannel,
      source: options.source ?? 'system',
      targets: options.targets ?? 'all',
      changeType,
      payload,
      priority: options.priority ?? 0,
      ttl: options.ttl ?? 60000,
      requiresAck: options.requiresAck ?? false
    };

    this.messageQueue.push(message);
    this.messageQueue.sort((a, b) => b.priority - a.priority);

    // Trim queue if too large
    while (this.messageQueue.length > this.config.maxQueueSize) {
      this.messageQueue.pop();
    }

    this.emitter.emit('message-queued', message);
    return message.id;
  }

  /**
   * Propagate adaptation change.
   */
  propagateAdaptation(
    source: AgentFramework,
    adaptation: ModificationProposal
  ): string {
    return this.propagate('adaptation', {
      proposalId: adaptation.id,
      protocol: adaptation.protocol,
      type: adaptation.type,
      description: adaptation.description,
      confidence: adaptation.confidence
    }, {
      source,
      channel: 'broadcast',
      priority: 1
    });
  }

  /**
   * Propagate pattern detection.
   */
  propagatePatternDetection(detection: PatternDetection): string {
    return this.propagate('pattern-detected', {
      detectionId: detection.id,
      protocol: detection.protocol,
      patternType: detection.patternType,
      confidence: detection.confidence
    }, {
      source: detection.protocol,
      channel: 'broadcast',
      priority: 0.8
    });
  }

  /**
   * Propagate health change.
   */
  propagateHealthChange(
    protocol: AgentFramework,
    oldStatus: AdapterStatus,
    newStatus: AdapterStatus
  ): string {
    return this.propagate('health-change', {
      protocol,
      oldStatus,
      newStatus,
      timestamp: new Date().toISOString()
    }, {
      source: protocol,
      channel: 'broadcast',
      priority: newStatus === 'error' ? 1 : 0.5
    });
  }

  /**
   * Get all subscribers.
   */
  private getAllSubscribers(): PropagationSubscription[] {
    const all: PropagationSubscription[] = [];
    for (const subs of this.subscribers.values()) {
      all.push(...subs);
    }
    return all;
  }

  /**
   * Get protocol hierarchy for propagation.
   */
  private getProtocolHierarchy(source: AgentFramework | 'system'): AgentFramework[] {
    // Define protocol relationships (simplified)
    const hierarchies: Record<string, AgentFramework[]> = {
      'mcp': ['langchain', 'openai', 'semantic-kernel'],
      'a2a': ['openai-agents', 'crewai', 'autogen'],
      'anp': ['a2a', 'mcp'],
      'fipa': ['jade'],
      'ros2': []
    };

    if (source === 'system') {
      return ['mcp', 'a2a', 'anp', 'fipa', 'ros2'] as AgentFramework[];
    }

    return hierarchies[source] || [];
  }

  /**
   * Subscribe to events.
   */
  on(event: string, handler: (data: unknown) => void): void {
    this.emitter.on(event, handler);
  }
}

/**
 * Channel handler interface.
 */
interface ChannelHandler {
  channel: PropagationChannel;
  send: (message: PropagationMessage) => Promise<void>;
}

/**
 * Propagation subscription.
 */
interface PropagationSubscription {
  id: string;
  protocol: AgentFramework;
  handler: (message: PropagationMessage) => Promise<void>;
  filter?: (message: PropagationMessage) => boolean;
  priority: number;
}

/**
 * Subscription options.
 */
interface SubscriptionOptions {
  filter: (message: PropagationMessage) => boolean;
  priority: number;
}

/**
 * Propagation options.
 */
interface PropagationOptions {
  channel: PropagationChannel;
  source: AgentFramework | 'system';
  targets: AgentFramework[] | 'all';
  priority: number;
  ttl: number;
  requiresAck: boolean;
}

/**
 * Propagation configuration.
 */
interface PropagationConfig {
  enabled: boolean;
  defaultChannel: PropagationChannel;
  maxQueueSize: number;
  processingIntervalMs: number;
  retryAttempts: number;
  ackTimeoutMs: number;
}

// ============================================================================
// Self-Modification Interface
// ============================================================================

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

/**
 * Modification execution record.
 */
interface ModificationExecution {
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

// ============================================================================
// Integrated Cross-Cutting Controller
// ============================================================================

/**
 * Central controller integrating all cross-cutting AI adaptation concerns.
 */
export class CrossCuttingController {
  private patternDetector: PatternDetectionInstrumentor;
  private propagationSystem: ChangePropagationSystem;
  private selfModification: SelfModificationInterface;
  private adaptationPipeline?: AdaptationPipeline;
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
   * Connect to adaptation pipeline.
   */
  connectPipeline(pipeline: AdaptationPipeline): void {
    this.adaptationPipeline = pipeline;
    
    // Forward pattern detections to pipeline
    this.patternDetector.onPatternDetected(async (detection) => {
      // Pipeline integration point
      this.emitter.emit('pipeline-input', detection);
    });
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
    const healthMap = new Map<AgentFramework, AdaptiveHealth>();

    for (const [protocol, adapter] of this.instrumentedAdapters) {
      const baseHealth = await adapter.getHealth();
      const detections = this.patternDetector.getDetectionHistory(protocol);
      const modifications = this.selfModification.getHistory(protocol);

      const adaptiveHealth: AdaptiveHealth = {
        ...baseHealth,
        adaptationMetrics: {
          patternDetectionRate: this.calculateDetectionRate(detections),
          modificationSuccessRate: this.calculateModificationRate(modifications),
          propagationLatency: 0, // Would be tracked in real implementation
          selfHealingEvents: modifications.filter(m => m.rollbackPerformed).length,
          evolutionScore: this.calculateEvolutionScore(detections, modifications)
        },
        pendingModifications: this.selfModification.getPending()
          .filter(m => m.protocol === protocol).length,
        lastAdaptation: modifications[modifications.length - 1]?.endTime,
        adaptationStatus: this.getAdaptationStatus(protocol)
      };

      healthMap.set(protocol, adaptiveHealth);
    }

    return healthMap;
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
}

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

// ============================================================================
// Global Instances
// ============================================================================

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

// ============================================================================
// Exports
// ============================================================================

export default {
  CrossCuttingController,
  PatternDetectionInstrumentor,
  ChangePropagationSystem,
  SelfModificationInterface,
  crossCuttingController,
  patternDetectionInstrumentor,
  changePropagationSystem,
  selfModificationInterface
};
