import https from 'https';
import http from 'http';

export async function readJsonBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  return JSON.parse(raw);
}

export function sendJson(res: http.ServerResponse, status: number, obj: unknown): void {
  const body = JSON.stringify(obj, null, 2);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.end(body);
}

export function sendText(res: http.ServerResponse, status: number, text: string): void {
  res.statusCode = status;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(text);
}

export function notFound(res: http.ServerResponse): void {
  sendJson(res, 404, { error: 'not_found' });
}

export function methodNotAllowed(res: http.ServerResponse): void {
  sendJson(res, 405, { error: 'method_not_allowed' });
}

export function badRequest(res: http.ServerResponse, message: string): void {
  sendJson(res, 400, { error: 'bad_request', message });
}

export function serverError(res: http.ServerResponse, message: string): void {
  sendJson(res, 500, { error: 'server_error', message });
}

export function createHttpsServer(opts: https.ServerOptions, handler: http.RequestListener): https.Server {
  return https.createServer(opts, handler);
}
