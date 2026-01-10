/**
 * HTTP utilities for Chrysalis services (TypeScript).
 */

import http from 'http';
import { APIResponse, APIError, ErrorCode, ErrorCategory } from './models';

export async function readJsonBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return null;
  }
  return JSON.parse(raw);
}

export function sendJson<T>(
  res: http.ServerResponse,
  status: number,
  obj: APIResponse<T> | T
): void {
  let response: APIResponse<T>;
  if (isAPIResponse(obj)) {
    response = obj;
  } else {
    // Auto-wrap non-APIResponse objects
    response = {
      success: true,
      data: obj as T,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    };
  }

  const body = JSON.stringify(response, null, 2);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(body, 'utf8'));
  res.end(body);
}

export function sendError(
  res: http.ServerResponse,
  status: number,
  error: APIError
): void {
  const response: APIResponse = {
    success: false,
    error,
    meta: {
      request_id: error.request_id,
      timestamp: error.timestamp || new Date().toISOString(),
      version: 'v1',
    },
  };
  sendJson(res, status, response);
}

export function sendText(res: http.ServerResponse, status: number, text: string): void {
  res.statusCode = status;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(text, 'utf8'));
  res.end(text);
}

export function notFound(res: http.ServerResponse): void {
  const error: APIError = {
    code: ErrorCode.ENDPOINT_NOT_FOUND,
    message: 'Endpoint not found',
    category: ErrorCategory.NOT_FOUND_ERROR,
    timestamp: new Date().toISOString(),
  };
  sendError(res, 404, error);
}

export function methodNotAllowed(res: http.ServerResponse): void {
  const error: APIError = {
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Method not allowed',
    category: ErrorCategory.SERVICE_ERROR,
    timestamp: new Date().toISOString(),
  };
  sendError(res, 405, error);
}

export function badRequest(res: http.ServerResponse, message: string, code?: ErrorCode): void {
  const error: APIError = {
    code: code || ErrorCode.INVALID_FORMAT,
    message,
    category: ErrorCategory.VALIDATION_ERROR,
    timestamp: new Date().toISOString(),
  };
  sendError(res, 400, error);
}

export function serverError(res: http.ServerResponse, message: string, requestId?: string): void {
  const error: APIError = {
    code: ErrorCode.INTERNAL_ERROR,
    message,
    category: ErrorCategory.SERVICE_ERROR,
    request_id: requestId,
    timestamp: new Date().toISOString(),
  };
  sendError(res, 500, error);
}

export function createHttpsServer(
  opts: { key: Buffer; cert: Buffer },
  handler: http.RequestListener
): http.Server {
  const https = require('https');
  return https.createServer(opts, handler);
}

function isAPIResponse<T>(obj: any): obj is APIResponse<T> {
  return obj && typeof obj === 'object' && 'success' in obj;
}
