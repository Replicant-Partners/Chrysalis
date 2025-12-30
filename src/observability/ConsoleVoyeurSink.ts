import type { VoyeurEvent, VoyeurSink } from './VoyeurEvents';

export interface ConsoleVoyeurOptions {
  redact?: boolean;
  fields?: Array<keyof VoyeurEvent>;
}

/**
 * Simple console sink for voyeur events with optional redaction.
 */
export class ConsoleVoyeurSink implements VoyeurSink {
  private readonly redact: boolean;
  private readonly fields?: Array<keyof VoyeurEvent>;

  constructor(opts?: ConsoleVoyeurOptions) {
    this.redact = opts?.redact ?? true;
    this.fields = opts?.fields;
  }

  emit(event: VoyeurEvent): void {
    const output: Record<string, any> = {};
    const fields = this.fields || ['kind', 'timestamp', 'sourceInstance', 'decision', 'similarity', 'threshold', 'latencyMs'];
    for (const f of fields) {
      output[f] = (event as any)[f];
    }
    if (!this.redact) {
      output.details = event.details;
    }
    // eslint-disable-next-line no-console
    console.log('[voyeur]', JSON.stringify(output));
  }
}
