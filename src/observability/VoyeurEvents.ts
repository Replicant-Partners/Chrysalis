/**
 * Voyeur observability stream
 * 
 * Lightweight event bus for exposing agent cognition/merge steps
 * to UIs or logs, with optional slow-mode delays for human-speed playback.
 */

export type VoyeurEventKind =
  | 'ingest.start'
  | 'ingest.complete'
  | 'embed.request'
  | 'embed.fallback'
  | 'match.candidate'
  | 'match.none'
  | 'merge.applied'
  | 'merge.deferred'
  | 'job.state'
  | 'job.progress'
  | 'job.output'
  | 'job.error'
  | 'error';

export interface VoyeurEvent {
  kind: VoyeurEventKind | string;
  timestamp: string;
  memoryHash?: string;
  similarity?: number;
  threshold?: number;
  sourceInstance?: string;
  latencyMs?: number;
  decision?: string;
  details?: Record<string, any>;
}

export interface VoyeurSink {
  emit(event: VoyeurEvent): void | Promise<void>;
}

export class VoyeurBus {
  private sinks: Set<VoyeurSink>;
  private slowModeMs: number;

  constructor(opts?: { sinks?: VoyeurSink[]; slowModeMs?: number }) {
    this.sinks = new Set(opts?.sinks || []);
    this.slowModeMs = opts?.slowModeMs ?? 0;
  }

  addSink(sink: VoyeurSink): void {
    this.sinks.add(sink);
  }

  removeSink(sink: VoyeurSink): void {
    this.sinks.delete(sink);
  }

  setSlowMode(delayMs: number): void {
    this.slowModeMs = Math.max(0, delayMs);
  }

  async emit(event: VoyeurEvent): Promise<void> {
    if (!this.sinks.size) return;
    for (const sink of this.sinks) {
      await sink.emit(event);
    }
    if (this.slowModeMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.slowModeMs));
    }
  }
}