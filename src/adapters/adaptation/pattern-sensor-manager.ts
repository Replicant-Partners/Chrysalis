/**
 * Pattern Sensor Manager
 *
 * Manages pattern detection sensors for autonomous monitoring.
 *
 * @module adapters/adaptation/pattern-sensor-manager
 */

import { EventEmitter } from 'events';
import { AgentFramework } from '../protocol-types';

/**
 * Sensor for detecting evolutionary patterns in adapter behavior.
 */
export interface PatternSensor {
  /** Sensor ID */
  sensorId: string;
  /** Sensor name */
  name: string;
  /** Pattern ID this sensor detects */
  patternId: string;
  /** Detection function */
  detect: PatternDetectionFn;
  /** Is sensor active */
  active: boolean;
  /** Protocols to monitor (undefined = all) */
  protocols?: AgentFramework[];
  /** Detection threshold (0-1) */
  threshold: number;
  /** Cooldown between detections (ms) */
  cooldownMs: number;
  /** Last detection timestamp */
  lastDetection?: string;
}

/**
 * Pattern detection function.
 */
export type PatternDetectionFn = (context: SensorContext) => Promise<SensorReading> | SensorReading;

/**
 * Context for sensor detection.
 */
export interface SensorContext {
  protocol: AgentFramework;
  eventType: string;
  data: unknown;
  metrics: SensorMetrics;
  history: SensorHistoryEntry[];
}

/**
 * Metrics available to sensors.
 */
export interface SensorMetrics {
  errorRate: number;
  latencyMs: number;
  throughput: number;
  healthScore: number;
  versionMismatches: number;
  conversionFailures: number;
}

/**
 * Sensor history entry.
 */
export interface SensorHistoryEntry {
  timestamp: string;
  eventType: string;
  protocol: AgentFramework;
  success: boolean;
  latencyMs?: number;
}

/**
 * Sensor reading result.
 */
export interface SensorReading {
  detected: boolean;
  patternId: string;
  confidence: number;
  evidence: string[];
  recommendedAction?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Manages pattern detection sensors.
 */
export class PatternSensorManager extends EventEmitter {
  private sensors: Map<string, PatternSensor> = new Map();
  private history: SensorHistoryEntry[] = [];
  private metrics: Map<AgentFramework, SensorMetrics> = new Map();
  private sensorIdCounter = 0;

  /**
   * Register a pattern sensor.
   */
  registerSensor(
    patternId: string,
    detect: PatternDetectionFn,
    options: Partial<Omit<PatternSensor, 'sensorId' | 'patternId' | 'detect'>> = {}
  ): string {
    const sensorId = `sensor-${patternId}-${++this.sensorIdCounter}`;

    const sensor: PatternSensor = {
      sensorId,
      name: options.name ?? sensorId,
      patternId,
      detect,
      active: options.active ?? true,
      protocols: options.protocols,
      threshold: options.threshold ?? 0.7,
      cooldownMs: options.cooldownMs ?? 60000, // 1 minute default
    };

    this.sensors.set(sensorId, sensor);
    this.emit('sensor:registered', sensor);
    return sensorId;
  }

  /**
   * Run all applicable sensors for an event.
   */
  async runSensors(
    protocol: AgentFramework,
    eventType: string,
    data: unknown
  ): Promise<SensorReading[]> {
    const readings: SensorReading[] = [];
    const metrics = this.getOrCreateMetrics(protocol);
    const context: SensorContext = {
      protocol,
      eventType,
      data,
      metrics,
      history: this.getRecentHistory(protocol, 100),
    };

    const allSensors = Array.from(this.sensors.values());
    for (const sensor of allSensors) {
      if (!this.isSensorApplicable(sensor, protocol)) continue;
      if (this.isInCooldown(sensor)) continue;

      try {
        const reading = await sensor.detect(context);

        if (reading.detected && reading.confidence >= sensor.threshold) {
          readings.push(reading);
          sensor.lastDetection = new Date().toISOString();
          this.emit('pattern:detected', sensor, reading);
        }
      } catch (error) {
        this.emit('sensor:error', sensor, error);
      }
    }

    return readings;
  }

  /**
   * Record an event for history.
   */
  recordEvent(
    protocol: AgentFramework,
    eventType: string,
    success: boolean,
    latencyMs?: number
  ): void {
    this.history.push({
      timestamp: new Date().toISOString(),
      eventType,
      protocol,
      success,
      latencyMs,
    });

    // Keep history bounded
    if (this.history.length > 10000) {
      this.history = this.history.slice(-5000);
    }

    // Update metrics
    this.updateMetrics(protocol, success, latencyMs);
  }

  /**
   * Get or create metrics for a protocol.
   */
  private getOrCreateMetrics(protocol: AgentFramework): SensorMetrics {
    if (!this.metrics.has(protocol)) {
      this.metrics.set(protocol, {
        errorRate: 0,
        latencyMs: 0,
        throughput: 0,
        healthScore: 100,
        versionMismatches: 0,
        conversionFailures: 0,
      });
    }
    return this.metrics.get(protocol)!;
  }

  /**
   * Update metrics for a protocol.
   */
  private updateMetrics(protocol: AgentFramework, success: boolean, latencyMs?: number): void {
    const metrics = this.getOrCreateMetrics(protocol);

    // Simple exponential moving average
    const alpha = 0.1;

    if (!success) {
      metrics.errorRate = metrics.errorRate * (1 - alpha) + 1 * alpha;
      metrics.conversionFailures++;
    } else {
      metrics.errorRate = metrics.errorRate * (1 - alpha);
    }

    if (latencyMs !== undefined) {
      metrics.latencyMs = metrics.latencyMs * (1 - alpha) + latencyMs * alpha;
    }

    metrics.healthScore = Math.max(0, 100 - metrics.errorRate * 100);
  }

  /**
   * Get recent history for a protocol.
   */
  private getRecentHistory(protocol: AgentFramework, limit: number): SensorHistoryEntry[] {
    return this.history.filter((e) => e.protocol === protocol).slice(-limit);
  }

  /**
   * Check if sensor is applicable to protocol.
   */
  private isSensorApplicable(sensor: PatternSensor, protocol: AgentFramework): boolean {
    if (!sensor.active) return false;
    if (!sensor.protocols || sensor.protocols.length === 0) return true;
    return sensor.protocols.includes(protocol);
  }

  /**
   * Check if sensor is in cooldown.
   */
  private isInCooldown(sensor: PatternSensor): boolean {
    if (!sensor.lastDetection) return false;
    const elapsed = Date.now() - new Date(sensor.lastDetection).getTime();
    return elapsed < sensor.cooldownMs;
  }

  /**
   * Get all registered sensors.
   */
  getSensors(): PatternSensor[] {
    return Array.from(this.sensors.values());
  }

  /**
   * Get metrics for all protocols.
   */
  getAllMetrics(): Map<AgentFramework, SensorMetrics> {
    return new Map(this.metrics);
  }
}
