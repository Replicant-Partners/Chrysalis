/**
 * Pattern Detection Instrumentation
 *
 * Instruments adapters with pattern detection sensors to identify breaking changes,
 * deprecations, enhancements, security issues, and optimization opportunities.
 * Provides real-time monitoring via adaptation hooks and supports automatic
 * reactions to detected patterns.
 *
 * @module ai-maintenance/cross-cutting/pattern-detection-instrumentor
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { AgentFramework } from '../../adapters/protocol-types';
import { UnifiedAdapter, AdapterHealth } from '../../adapters/unified-adapter';
import { ProtocolCapability } from '../../adapters/protocol-capabilities';
import {
  AdaptationHookFn,
  HookContext,
  HookResult,
  hookExecutor,
  patternSensorManager,
  PatternDetectionFn,
  SensorContext,
  SensorReading
} from '../../adapters/adaptation-hooks';
import {
  PatternType,
  InstrumentationPoint
} from './types';
import { PatternMatchContext, matchPatterns } from '../evolutionary-patterns';
import { PatternCategory, PatternSeverity, PatternMatch } from '../types';

// ============================================================================
// Internal Interfaces
// ============================================================================

/**
 * Pattern detection result.
 */
export interface PatternDetection {
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
export interface PatternDetectionConfig {
  enabled: boolean;
  historySize: number;
  detectionThreshold: number;
  patternTypes: PatternType[];
  autoReact: boolean;
  reactionDelay: number;
}

/**
 * Pattern sensor for internal use.
 */
interface InternalPatternSensor {
  id: string;
  type: string;
  protocol: AgentFramework;
  enabled: boolean;
  detect: (context: InternalSensorContext) => Promise<PatternDetection | null>;
}

/**
 * Internal sensor context.
 */
interface InternalSensorContext {
  point: InstrumentationPoint;
  timestamp: string;
  data: unknown;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Pattern Detection Instrumentor
// ============================================================================

/**
 * Instruments adapters with pattern detection sensors.
 */
export class PatternDetectionInstrumentor {
  private sensors: Map<AgentFramework, InternalPatternSensor[]> = new Map();
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
    const sensors: InternalPatternSensor[] = [];

    // API Surface Sensor - detects capability changes
    sensors.push({
      id: `${protocol}-api-surface`,
      type: 'api-surface',
      protocol,
      enabled: true,
      detect: async (context: InternalSensorContext) => {
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
      detect: async (context: InternalSensorContext) => {
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
      detect: async (context: InternalSensorContext) => {
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
      detect: async (context: InternalSensorContext) => {
        const health = await adapter.getHealth();
        return this.analyzeErrorPatterns(health, context);
      }
    });

    // Register sensors
    this.sensors.set(protocol, sensors);

    // Register with global pattern sensor manager
    for (const sensor of sensors) {
      const detectionFn: PatternDetectionFn = async (ctx: SensorContext): Promise<SensorReading> => {
        const internalCtx: InternalSensorContext = {
          point: 'health-check',
          timestamp: new Date().toISOString(),
          data: ctx.data,
          metadata: { metrics: ctx.metrics }
        };
        const detection = await sensor.detect(internalCtx);
        return {
          detected: detection !== null,
          patternId: detection?.patternType || sensor.type,
          confidence: detection?.confidence || 0,
          evidence: detection ? [detection.description] : [],
          recommendedAction: detection?.suggestedAction
        };
      };

      patternSensorManager.registerSensor(
        `${protocol}-${sensor.type}`,
        detectionFn,
        { protocols: [protocol] }
      );
    }

    // Install adaptation hooks
    this.installDetectionHooks(protocol);
  }

  /**
   * Install hooks for real-time pattern detection.
   */
  private installDetectionHooks(protocol: AgentFramework): void {
    // Pre-conversion hook for input pattern detection
    const preConversionFn: AdaptationHookFn = async (ctx: HookContext): Promise<HookResult> => {
      await this.runSensorCheck(protocol, 'pre-conversion', ctx);
      return { continueChain: true, executionTimeMs: 0 };
    };
    hookExecutor.registerHook('pre-conversion', preConversionFn, { protocols: [protocol] });

    // Post-conversion hook for output pattern detection
    const postConversionFn: AdaptationHookFn = async (ctx: HookContext): Promise<HookResult> => {
      await this.runSensorCheck(protocol, 'post-conversion', ctx);
      return { continueChain: true, executionTimeMs: 0 };
    };
    hookExecutor.registerHook('post-conversion', postConversionFn, { protocols: [protocol] });

    // Error hook for failure pattern detection
    const errorFn: AdaptationHookFn = async (ctx: HookContext): Promise<HookResult> => {
      const detection = await this.detectErrorPattern(protocol, ctx);
      if (detection && this.config.autoReact) {
        await this.triggerAutoReaction(detection);
      }
      return { continueChain: true, executionTimeMs: 0 };
    };
    hookExecutor.registerHook('on-error', errorFn, { protocols: [protocol] });
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
    const sensorContext: InternalSensorContext = {
      point,
      timestamp: new Date().toISOString(),
      data: context.inputMessage || context.outputMessage,
      metadata: context.additional || {}
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
    context: InternalSensorContext
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
    context: InternalSensorContext
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
    context: InternalSensorContext
  ): PatternDetection | null {
    // Implementation would compare versions with upstream
    return null;
  }

  /**
   * Analyze error patterns.
   */
  private analyzeErrorPatterns(
    health: AdapterHealth,
    context: InternalSensorContext
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
      const errorMsg = context.error instanceof Error ? context.error.message : String(context.error);
      return {
        id: `error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        protocol,
        patternType: 'breaking-change',
        description: `Error detected: ${errorMsg}`,
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
