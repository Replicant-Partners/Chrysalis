import { createServer, IncomingMessage, ServerResponse } from 'http';
import { VoyeurBus, VoyeurEvent, VoyeurSink } from './VoyeurEvents';

/**
 * Lightweight SSE dashboard server (no extra deps).
 * Serves an HTML viewer at "/" and an SSE stream at "/voyeur-stream".
 *
 * @param bus - VoyeurBus to subscribe to events
 * @param opts.port - Port to listen on (default: 8787)
 * @param opts.path - SSE stream path (default: /voyeur-stream)
 * @param opts.redact - Whether to redact event details
 * @param opts.allowedOrigins - CORS allowed origins (default: localhost only)
 */
export function startVoyeurWebServer(bus: VoyeurBus, opts?: {
  port?: number;
  path?: string;
  redact?: boolean;
  allowedOrigins?: string[];
}): void {
  const port = opts?.port ?? 8787;
  const streamPath = opts?.path ?? '/voyeur-stream';

  // CORS: Default to localhost for development security
  // In production, explicitly pass allowed origins
  const allowedOrigins = new Set(opts?.allowedOrigins ?? [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
  ]);

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
    // Validate and set CORS headers
    const origin = req.headers.origin || '';
    const corsHeaders: Record<string, string> = {};
    if (origin && allowedOrigins.has(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    }

    if (req.url === streamPath) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...corsHeaders
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

    // Note: We use DOM APIs (createElement + textContent) which automatically
    // escape HTML, making manual escaping unnecessary. This is the preferred
    // approach as it's impossible to accidentally bypass.

    evt.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const div = document.createElement('div');
      div.className = 'event';

      // Use DOM APIs instead of innerHTML to prevent XSS
      const kindSpan = document.createElement('span');
      kindSpan.className = 'kind';
      kindSpan.textContent = data.kind || '';

      const metaSpan = document.createElement('span');
      metaSpan.className = 'meta';
      metaSpan.textContent = (data.timestamp || '') + ' ' + (data.sourceInstance || '');

      const pre = document.createElement('pre');
      pre.style.cssText = 'margin:4px 0 0 0; white-space: pre-wrap;';
      pre.textContent = JSON.stringify(data, null, 2);

      div.appendChild(kindSpan);
      div.appendChild(metaSpan);
      div.appendChild(pre);
      log.prepend(div);
    };
  </script>
</body>
</html>`;
}
