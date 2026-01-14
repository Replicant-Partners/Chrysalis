/**
 * Adaptation Sink - AI-Led Maintenance System integration
 * @module observability/logger/AdaptationSink
 */

import { EventEmitter } from 'events';
import type { LogEntry, LogSink } from './types';

export class AdaptationSink implements LogSink {
  name = 'adaptation';
  private eventEmitter: EventEmitter;
  private errorBuffer: LogEntry[] = [];
  private metricsBuffer: Map<string, number[]> = new Map();
  private patternBuffer: Map<string, number> = new Map();
  private maxBufferSize: number;
  private analysisIntervalMs: number;
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor(opts?: {
    maxBufferSize?: number;
    analysisIntervalMs?: number;
    eventEmitter?: EventEmitter;
  }) {
    this.maxBufferSize = opts?.maxBufferSize ?? 1000;
    this.analysisIntervalMs = opts?.analysisIntervalMs ?? 60000;
    this.eventEmitter = opts?.eventEmitter ?? new EventEmitter();
    this.startAnalysis();
  }

  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  write(entry: LogEntry): void {
    if (entry.level === 'error' || entry.level === 'fatal') {
      this.errorBuffer.push(entry);
      if (this.errorBuffer.length > this.maxBufferSize) {
        this.errorBuffer.shift();
      }

      const pattern = this.extractErrorPattern(entry);
      const count = this.patternBuffer.get(pattern) ?? 0;
      this.patternBuffer.set(pattern, count + 1);
    }

    if (entry.metrics) {
      for (const [key, value] of Object.entries(entry.metrics)) {
        if (!this.metricsBuffer.has(key)) {
          this.metricsBuffer.set(key, []);
        }
        const values = this.metricsBuffer.get(key)!;
        values.push(value);
        if (values.length > this.maxBufferSize) {
          values.shift();
        }
      }
    }

    if (entry.durationMs !== undefined) {
      const key = `duration.${entry.logger}`;
      if (!this.metricsBuffer.has(key)) {
        this.metricsBuffer.set(key, []);
      }
      const values = this.metricsBuffer.get(key)!;
      values.push(entry.durationMs);
      if (values.length > this.maxBufferSize) {
        values.shift();
      }
    }
  }

  private extractErrorPattern(entry: LogEntry): string {
    if (entry.error) {
      return `${entry.error.name}:${entry.logger}`;
    }
    return `${entry.level}:${entry.logger}:${entry.message.slice(0, 50)}`;
  }

  private startAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.analyzePatterns();
    }, this.analysisIntervalMs);
  }

  private analyzePatterns(): void {
    const errorPatterns: Array<{ pattern: string; count: number; severity: string }> = [];
    for (const [pattern, count] of this.patternBuffer) {
      if (count >= 3) {
        errorPatterns.push({
          pattern,
          count,
          severity: count >= 10 ? 'high' : count >= 5 ? 'medium' : 'low',
        });
      }
    }

    if (errorPatterns.length > 0) {
      this.eventEmitter.emit('adaptation:error-patterns', {
        timestamp: new Date().toISOString(),
        patterns: errorPatterns,
        totalErrors: this.errorBuffer.length,
      });
    }

    const anomalies: Array<{ metric: string; value: number; threshold: number; type: string }> = [];
    for (const [metric, values] of this.metricsBuffer) {
      if (values.length < 10) continue;

      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
      );

      const latest = values[values.length - 1];
      const zScore = (latest - avg) / (stdDev || 1);

      if (Math.abs(zScore) > 2) {
        anomalies.push({
          metric,
          value: latest,
          threshold: avg + 2 * stdDev,
          type: zScore > 0 ? 'spike' : 'drop',
        });
      }
    }

    if (anomalies.length > 0) {
      this.eventEmitter.emit('adaptation:metric-anomalies', {
        timestamp: new Date().toISOString(),
        anomalies,
      });
    }

    this.patternBuffer.clear();
  }

  getErrorPatterns(): Map<string, number> {
    return new Map(this.patternBuffer);
  }

  getRecentErrors(limit: number = 100): LogEntry[] {
    return this.errorBuffer.slice(-limit);
  }

  getMetricsSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const summary: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    for (const [metric, values] of this.metricsBuffer) {
      if (values.length === 0) continue;
      summary[metric] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }

    return summary;
  }

  close(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
  }
}
