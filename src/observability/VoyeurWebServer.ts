import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { VoyeurBus, VoyeurEvent, VoyeurSink } from './VoyeurEvents';

/**
 * Broadcast voyeur events over WebSocket for dashboards.
 */
export function startVoyeurWebServer(bus: VoyeurBus, opts?: { port?: number; path?: string; redact?: boolean }): void {
  const port = opts?.port ?? 8787;
  const path = opts?.path ?? '/voyeur';
  const server = createServer();
  const wss = new WebSocketServer({ server, path });

  const sink: VoyeurSink = {
    emit(event: VoyeurEvent) {
      const payload = opts?.redact ? { ...event, details: undefined } : event;
      const msg = JSON.stringify(payload);
      wss.clients.forEach((client) => {
        if ((client as any).readyState === 1) {
          (client as any).send(msg);
        }
      });
    }
  };

  bus.addSink(sink);

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Voyeur WebSocket server listening on ws://localhost:${port}${path}`);
  });
}
