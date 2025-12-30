import { createServer, IncomingMessage, ServerResponse } from 'http';
import { VoyeurBus, VoyeurEvent, VoyeurSink } from './VoyeurEvents';

/**
 * Lightweight SSE dashboard server (no extra deps).
 * Serves an HTML viewer at "/" and an SSE stream at "/voyeur-stream".
 */
export function startVoyeurWebServer(bus: VoyeurBus, opts?: { port?: number; path?: string; redact?: boolean }): void {
  const port = opts?.port ?? 8787;
  const streamPath = opts?.path ?? '/voyeur-stream';

  const clients: Set<ServerResponse> = new Set();

  const sink: VoyeurSink = {
    emit(event: VoyeurEvent) {
      const payload = opts?.redact ? { ...event, details: undefined } : event;
      const msg = `data: ${JSON.stringify(payload)}\n\n`;
      for (const res of clients) {
        res.write(msg);
      }
    }
  };

  bus.addSink(sink);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === streamPath) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write('\n');
      clients.add(res);
      req.on('close', () => {
        clients.delete(res);
      });
      return;
    }

    // simple HTML viewer
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(renderHtml(streamPath));
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Voyeur SSE server listening on http://localhost:${port} (stream: ${streamPath})`);
  });
}

function renderHtml(streamPath: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Voyeur</title>
  <style>
    body { font-family: sans-serif; background: #0b1224; color: #e5e7eb; margin: 0; padding: 0; }
    header { padding: 12px 16px; background: #111827; border-bottom: 1px solid #1f2937; }
    .log { padding: 12px 16px; height: calc(100vh - 56px); overflow-y: auto; font-family: monospace; }
    .event { padding: 6px 8px; border-bottom: 1px solid #1f2937; }
    .kind { color: #93c5fd; margin-right: 6px; }
    .meta { color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <header>Voyeur Stream</header>
  <div class="log" id="log"></div>
  <script>
    const log = document.getElementById('log');
    const evt = new EventSource('${streamPath}');
    evt.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const div = document.createElement('div');
      div.className = 'event';
      div.innerHTML = '<span class="kind">' + data.kind + '</span>' +
        '<span class="meta">' + (data.timestamp || '') + ' ' + (data.sourceInstance || '') + '</span>' +
        '<pre style="margin:4px 0 0 0; white-space: pre-wrap;">' + JSON.stringify(data, null, 2) + '</pre>';
      log.prepend(div);
    };
  </script>
</body>
</html>`;
}
