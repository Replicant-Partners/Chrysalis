/**
 * Logger Types - Core type definitions for the logging system
 * @module observability/logger/types
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  logger: string;
  correlationId?: string;
  spanId?: string;
  parentSpanId?: string;
  traceId?: string;
  context?: Record<string, unknown>;
  error?: ErrorDetails;
  durationMs?: number;
  source?: SourceLocation;
  tags?: string[];
  metrics?: Record<string, number>;
}

export interface ErrorDetails {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  cause?: ErrorDetails;
}

export interface SourceLocation {
  file?: string;
  line?: number;
  column?: number;
  function?: string;
}

export interface LogSink {
  name: string;
  write(entry: LogEntry): void | Promise<void>;
  flush?(): void | Promise<void>;
  close?(): void | Promise<void>;
}

export interface LoggerConfig {
  level: LogLevel;
  name: string;
  defaultContext?: Record<string, unknown>;
  defaultTags?: string[];
  captureSource?: boolean;
  sinks?: LogSink[];
}

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  children: Span[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}
