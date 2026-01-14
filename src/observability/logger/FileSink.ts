/**
 * File Sink - Persistent file logging
 * @module observability/logger/FileSink
 */

import type { LogEntry, LogSink } from './types';

export class FileSink implements LogSink {
  name = 'file';
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private filePath: string;
  private maxBufferSize: number;
  private fs: typeof import('fs') | null = null;

  constructor(opts: { filePath: string; maxBufferSize?: number; flushIntervalMs?: number }) {
    this.filePath = opts.filePath;
    this.maxBufferSize = opts.maxBufferSize ?? 100;

    try {
      this.fs = require('fs');
    } catch {
      console.warn('FileSink: fs module not available');
    }

    if (opts.flushIntervalMs) {
      this.flushInterval = setInterval(() => this.flush(), opts.flushIntervalMs);
    }
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  flush(): void {
    if (!this.fs || this.buffer.length === 0) return;

    const lines = this.buffer.map(e => JSON.stringify(e)).join('\n') + '\n';
    this.buffer = [];

    try {
      this.fs.appendFileSync(this.filePath, lines);
    } catch (err) {
      console.error('FileSink: Failed to write to file', err);
    }
  }

  close(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}
