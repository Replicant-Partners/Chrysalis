import { VoyeurBus } from '../observability/VoyeurEvents';
import { ConsoleVoyeurSink } from '../observability/ConsoleVoyeurSink';

/**
 * Start a simple console tail for voyeur events.
 */
export function startVoyeurTail(bus: VoyeurBus, opts?: { slowModeMs?: number; redact?: boolean }): void {
  if (opts?.slowModeMs) {
    bus.setSlowMode(opts.slowModeMs);
  }
  bus.addSink(new ConsoleVoyeurSink({ redact: opts?.redact }));
}
