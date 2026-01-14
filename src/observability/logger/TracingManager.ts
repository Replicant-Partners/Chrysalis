/**
 * Tracing Manager - Distributed tracing support
 * @module observability/logger/TracingManager
 */

import { v4 as uuidv4 } from 'uuid';
import type { CentralizedLogger } from './CentralizedLogger';
import type { Span } from './types';

export class TracingManager {
  private activeSpans: Map<string, Span> = new Map();
  private completedSpans: Span[] = [];
  private maxCompletedSpans: number;
  private logger: CentralizedLogger;

  constructor(logger: CentralizedLogger, opts?: { maxCompletedSpans?: number }) {
    this.logger = logger;
    this.maxCompletedSpans = opts?.maxCompletedSpans ?? 1000;
  }

  startTrace(operationName: string, attributes?: Record<string, unknown>): Span {
    const traceId = uuidv4();
    const spanId = uuidv4();

    const span: Span = {
      spanId,
      traceId,
      operationName,
      startTime: Date.now(),
      status: 'unset',
      attributes: attributes ?? {},
      events: [],
      children: [],
    };

    this.activeSpans.set(spanId, span);
    this.logger.setTraceContext(traceId, spanId);
    this.logger.debug(`Trace started: ${operationName}`, { traceId, spanId });

    return span;
  }

  startSpan(parentSpan: Span, operationName: string, attributes?: Record<string, unknown>): Span {
    const spanId = uuidv4();

    const span: Span = {
      spanId,
      traceId: parentSpan.traceId,
      parentSpanId: parentSpan.spanId,
      operationName,
      startTime: Date.now(),
      status: 'unset',
      attributes: attributes ?? {},
      events: [],
      children: [],
    };

    parentSpan.children.push(span);
    this.activeSpans.set(spanId, span);
    this.logger.setTraceContext(parentSpan.traceId, spanId, parentSpan.spanId);
    this.logger.debug(`Span started: ${operationName}`, {
      traceId: span.traceId,
      spanId,
      parentSpanId: parentSpan.spanId,
    });

    return span;
  }

  addEvent(span: Span, name: string, attributes?: Record<string, unknown>): void {
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  setStatus(span: Span, status: 'ok' | 'error', message?: string): void {
    span.status = status;
    if (message) {
      span.attributes['status.message'] = message;
    }
  }

  endSpan(span: Span): void {
    span.endTime = Date.now();
    this.activeSpans.delete(span.spanId);

    if (!span.parentSpanId) {
      this.completedSpans.push(span);
      if (this.completedSpans.length > this.maxCompletedSpans) {
        this.completedSpans.shift();
      }
    }

    const durationMs = span.endTime - span.startTime;
    this.logger.timed('info', `Span ended: ${span.operationName}`, durationMs, {
      traceId: span.traceId,
      spanId: span.spanId,
      status: span.status,
    });
  }

  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  getCompletedTraces(limit: number = 100): Span[] {
    return this.completedSpans.slice(-limit);
  }

  async withSpan<T>(
    parentSpan: Span | null,
    operationName: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, unknown>
  ): Promise<T> {
    const span = parentSpan
      ? this.startSpan(parentSpan, operationName, attributes)
      : this.startTrace(operationName, attributes);

    try {
      const result = await fn(span);
      this.setStatus(span, 'ok');
      return result;
    } catch (error) {
      this.setStatus(span, 'error', (error as Error).message);
      this.addEvent(span, 'exception', {
        'exception.type': (error as Error).name,
        'exception.message': (error as Error).message,
        'exception.stacktrace': (error as Error).stack,
      });
      throw error;
    } finally {
      this.endSpan(span);
    }
  }
}
