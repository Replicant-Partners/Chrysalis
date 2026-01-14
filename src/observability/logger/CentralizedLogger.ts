/**
 * Centralized Logger - Core logging implementation
 * @module observability/logger/CentralizedLogger
 */

import { v4 as uuidv4 } from 'uuid';
import { ConsoleSink } from './ConsoleSink';
import type {
  ErrorDetails,
  LogEntry,
  LoggerConfig,
  LogLevel,
  LogSink,
  SourceLocation,
} from './types';
import { LOG_LEVEL_VALUES } from './types';

export class CentralizedLogger {
  private config: LoggerConfig;
  private sinks: LogSink[];
  private correlationId?: string;
  private traceId?: string;
  private spanId?: string;
  private parentSpanId?: string;
  private context: Record<string, unknown>;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.sinks = config.sinks ?? [new ConsoleSink()];
    this.context = config.defaultContext ?? {};
  }

  child(context: Record<string, unknown>): CentralizedLogger {
    const childConfig: LoggerConfig = {
      ...this.config,
      defaultContext: { ...this.context, ...context },
    };
    const child = new CentralizedLogger(childConfig);
    child.correlationId = this.correlationId;
    child.traceId = this.traceId;
    child.spanId = this.spanId;
    child.parentSpanId = this.parentSpanId;
    return child;
  }

  setCorrelationId(id: string): this {
    this.correlationId = id;
    return this;
  }

  setTraceContext(traceId: string, spanId: string, parentSpanId?: string): this {
    this.traceId = traceId;
    this.spanId = spanId;
    this.parentSpanId = parentSpanId;
    return this;
  }

  addContext(context: Record<string, unknown>): this {
    this.context = { ...this.context, ...context };
    return this;
  }

  isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.config.level];
  }

  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    durationMs?: number,
    metrics?: Record<string, number>
  ): LogEntry {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      message,
      logger: this.config.name,
      correlationId: this.correlationId,
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      context: { ...this.context, ...context },
      tags: this.config.defaultTags,
      durationMs,
      metrics,
    };

    if (error) {
      entry.error = this.serializeError(error);
    }

    if (this.config.captureSource) {
      entry.source = this.captureSource();
    }

    return entry;
  }

  private serializeError(error: Error): ErrorDetails {
    const details: ErrorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    if ((error as any).code) {
      details.code = (error as any).code;
    }

    if (error.cause instanceof Error) {
      details.cause = this.serializeError(error.cause);
    }

    return details;
  }

  private captureSource(): SourceLocation | undefined {
    const stack = new Error().stack;
    if (!stack) return undefined;

    const lines = stack.split('\n');
    const callerLine = lines[5];
    if (!callerLine) return undefined;

    const match = callerLine.match(/at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):(\d+)\)?/);
    if (!match) return undefined;

    return {
      function: match[1],
      file: match[2],
      line: parseInt(match[3], 10),
      column: parseInt(match[4], 10),
    };
  }

  private async write(entry: LogEntry): Promise<void> {
    for (const sink of this.sinks) {
      try {
        await sink.write(entry);
      } catch (err) {
        console.error(`Failed to write to sink ${sink.name}:`, err);
      }
    }
  }

  trace(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('trace')) return;
    this.write(this.createEntry('trace', message, context));
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('debug')) return;
    this.write(this.createEntry('debug', message, context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('info')) return;
    this.write(this.createEntry('info', message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('warn')) return;
    this.write(this.createEntry('warn', message, context));
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('error')) return;
    this.write(this.createEntry('error', message, context, error));
  }

  fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('fatal')) return;
    this.write(this.createEntry('fatal', message, context, error));
  }

  timed(
    level: LogLevel,
    message: string,
    durationMs: number,
    context?: Record<string, unknown>,
    metrics?: Record<string, number>
  ): void {
    if (!this.isLevelEnabled(level)) return;
    this.write(this.createEntry(level, message, context, undefined, durationMs, metrics));
  }

  startTimer(operationName: string): () => void {
    const startTime = performance.now();
    return () => {
      const durationMs = performance.now() - startTime;
      this.timed('info', `${operationName} completed`, durationMs, { operation: operationName });
    };
  }

  async withTiming<T>(
    operationName: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const durationMs = performance.now() - startTime;
      this.timed('info', `${operationName} completed`, durationMs, {
        ...context,
        operation: operationName,
        success: true,
      });
      return result;
    } catch (error) {
      const durationMs = performance.now() - startTime;
      this.timed('error', `${operationName} failed`, durationMs, {
        ...context,
        operation: operationName,
        success: false,
      });
      throw error;
    }
  }

  addSink(sink: LogSink): this {
    this.sinks.push(sink);
    return this;
  }

  removeSink(name: string): this {
    this.sinks = this.sinks.filter(s => s.name !== name);
    return this;
  }

  async flush(): Promise<void> {
    for (const sink of this.sinks) {
      if (sink.flush) {
        await sink.flush();
      }
    }
  }

  async close(): Promise<void> {
    for (const sink of this.sinks) {
      if (sink.close) {
        await sink.close();
      }
    }
  }
}
