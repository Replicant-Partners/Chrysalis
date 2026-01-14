/**
 * Console Sink - Colored console output for logging
 * @module observability/logger/ConsoleSink
 */

import type { LogEntry, LogLevel, LogSink } from './types';

export class ConsoleSink implements LogSink {
  name = 'console';
  private useColors: boolean;
  private prettyPrint: boolean;

  constructor(opts?: { useColors?: boolean; prettyPrint?: boolean }) {
    this.useColors = opts?.useColors ?? true;
    this.prettyPrint = opts?.prettyPrint ?? false;
  }

  private getColor(level: LogLevel): string {
    if (!this.useColors) return '';
    const colors: Record<LogLevel, string> = {
      trace: '\x1b[90m',
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      fatal: '\x1b[35m',
    };
    return colors[level];
  }

  private reset(): string {
    return this.useColors ? '\x1b[0m' : '';
  }

  write(entry: LogEntry): void {
    const color = this.getColor(entry.level);
    const reset = this.reset();
    const levelStr = entry.level.toUpperCase().padEnd(5);

    if (this.prettyPrint) {
      const timestamp = new Date(entry.timestamp).toISOString();
      const correlationStr = entry.correlationId ? ` [${entry.correlationId.slice(0, 8)}]` : '';
      const prefix = `${color}${timestamp} ${levelStr}${reset}${correlationStr} [${entry.logger}]`;

      console.log(`${prefix} ${entry.message}`);

      if (entry.context && Object.keys(entry.context).length > 0) {
        console.log(`  Context: ${JSON.stringify(entry.context, null, 2)}`);
      }

      if (entry.error) {
        console.log(`  Error: ${entry.error.name}: ${entry.error.message}`);
        if (entry.error.stack) {
          console.log(`  Stack: ${entry.error.stack}`);
        }
      }

      if (entry.durationMs !== undefined) {
        console.log(`  Duration: ${entry.durationMs}ms`);
      }
    } else {
      console.log(JSON.stringify(entry));
    }
  }
}
