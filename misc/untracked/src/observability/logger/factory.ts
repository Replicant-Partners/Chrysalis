/**
 * Logger Factory - Global logger initialization and access
 * @module observability/logger/factory
 */

import { v4 as uuidv4 } from 'uuid';
import { AdaptationSink } from './AdaptationSink';
import { CentralizedLogger } from './CentralizedLogger';
import { ConsoleSink } from './ConsoleSink';
import { TracingManager } from './TracingManager';
import type { LoggerConfig, LogLevel } from './types';

let globalLogger: CentralizedLogger | null = null;
let globalTracer: TracingManager | null = null;
let globalAdaptationSink: AdaptationSink | null = null;

export function initializeLogger(config?: Partial<LoggerConfig>): CentralizedLogger {
  const adaptationSink = new AdaptationSink();
  globalAdaptationSink = adaptationSink;

  const defaultConfig: LoggerConfig = {
    level: (process.env.LOG_LEVEL as LogLevel) ?? 'info',
    name: 'chrysalis',
    captureSource: process.env.NODE_ENV !== 'production',
    sinks: [
      new ConsoleSink({ prettyPrint: process.env.NODE_ENV !== 'production' }),
      adaptationSink,
    ],
    ...config,
  };

  globalLogger = new CentralizedLogger(defaultConfig);
  globalTracer = new TracingManager(globalLogger);

  return globalLogger;
}

export function getLogger(name?: string): CentralizedLogger {
  if (!globalLogger) {
    initializeLogger();
  }

  if (name) {
    return globalLogger!.child({ component: name });
  }

  return globalLogger!;
}

export function getTracer(): TracingManager {
  if (!globalTracer) {
    initializeLogger();
  }
  return globalTracer!;
}

export function getAdaptationSink(): AdaptationSink | null {
  return globalAdaptationSink;
}

export function createCorrelationId(): string {
  return uuidv4();
}
