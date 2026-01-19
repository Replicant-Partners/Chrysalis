/**
 * Cursor Adapter Service
 *
 * Bridges system agents to the Cursor IDE agent.
 * This allows Ada, Lea, Phil, David, and Milton to consult
 * the Cursor agent as an LLM resource.
 *
 * Architecture:
 * SystemAgent -> Go Gateway -> CursorAdapter -> Request Queue -> Cursor IDE Agent
 *
 * The Cursor agent is particularly effective at:
 * - Staying on task and following specific instructions
 * - Building differentiated solutions (not mainstream defaults)
 * - Maintaining context consistency
 *
 * @module services/cursor-adapter/CursorAdapter
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

export interface CursorRequest {
  request_id: string;
  agent_id: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  context?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  wait_timeout_ms?: number;
  created_at: number;
}

export interface CursorResponse {
  request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'timeout';
  content?: string;
  error?: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata: {
    processing_time_ms: number;
    handler_type: 'sync' | 'async' | 'queued';
  };
}

export interface CursorAdapterConfig {
  port: number;
  host: string;
  queueDir: string;
  maxQueueSize: number;
  requestTimeoutMs: number;
  pollIntervalMs: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: CursorAdapterConfig = {
  port: 3210,
  host: '127.0.0.1',
  queueDir: path.join(process.cwd(), '.cursor-adapter-queue'),
  maxQueueSize: 100,
  requestTimeoutMs: 120000, // 2 minutes
  pollIntervalMs: 100,
};

// =============================================================================
// Request Queue
// =============================================================================

/**
 * File-based request queue for Cursor agent requests.
 * Requests are written to disk so they persist across restarts.
 */
class RequestQueue extends EventEmitter {
  private queueDir: string;
  private maxSize: number;
  private pendingRequests: Map<string, CursorRequest> = new Map();
  private responses: Map<string, CursorResponse> = new Map();

  constructor(queueDir: string, maxSize: number) {
    super();
    this.queueDir = queueDir;
    this.maxSize = maxSize;
    this.ensureQueueDir();
  }

  private ensureQueueDir(): void {
    const dirs = [
      this.queueDir,
      path.join(this.queueDir, 'pending'),
      path.join(this.queueDir, 'responses'),
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Enqueue a request for the Cursor agent.
   */
  enqueue(request: CursorRequest): boolean {
    if (this.pendingRequests.size >= this.maxSize) {
      return false;
    }

    this.pendingRequests.set(request.request_id, request);

    // Write to disk for persistence
    const filePath = path.join(this.queueDir, 'pending', `${request.request_id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(request, null, 2));

    this.emit('request:enqueued', request);
    return true;
  }

  /**
   * Get the next pending request (for Cursor agent to process).
   */
  getNextPending(): CursorRequest | null {
    // Sort by priority and creation time
    const sorted = Array.from(this.pendingRequests.values()).sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return a.created_at - b.created_at;
    });

    return sorted[0] || null;
  }

  /**
   * Mark a request as being processed.
   */
  markProcessing(requestId: string): void {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      this.emit('request:processing', request);
    }
  }

  /**
   * Submit a response for a request.
   */
  submitResponse(response: CursorResponse): void {
    this.responses.set(response.request_id, response);
    this.pendingRequests.delete(response.request_id);

    // Write response to disk
    const filePath = path.join(this.queueDir, 'responses', `${response.request_id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(response, null, 2));

    // Clean up pending file
    const pendingPath = path.join(this.queueDir, 'pending', `${response.request_id}.json`);
    if (fs.existsSync(pendingPath)) {
      fs.unlinkSync(pendingPath);
    }

    this.emit('response:submitted', response);
  }

  /**
   * Get a response by request ID.
   */
  getResponse(requestId: string): CursorResponse | null {
    return this.responses.get(requestId) || null;
  }

  /**
   * Wait for a response with timeout.
   */
  async waitForResponse(requestId: string, timeoutMs: number): Promise<CursorResponse | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const response = this.getResponse(requestId);
      if (response) {
        return response;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }

  /**
   * List all pending requests.
   */
  listPending(): CursorRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Get queue statistics.
   */
  getStats(): { pending: number; responses: number } {
    return {
      pending: this.pendingRequests.size,
      responses: this.responses.size,
    };
  }
}

// =============================================================================
// Cursor Adapter Server
// =============================================================================

/**
 * HTTP server that exposes the Cursor Adapter API.
 */
export class CursorAdapterServer {
  private config: CursorAdapterConfig;
  private queue: RequestQueue;
  private server: http.Server | null = null;

  constructor(config?: Partial<CursorAdapterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.queue = new RequestQueue(this.config.queueDir, this.config.maxQueueSize);
  }

  /**
   * Start the HTTP server.
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', reject);
      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`[CursorAdapter] Server listening on http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server.
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[CursorAdapter] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming HTTP requests.
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const method = req.method || 'GET';

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      switch (`${method} ${url.pathname}`) {
        case 'POST /v1/complete':
          await this.handleComplete(req, res);
          break;
        case 'POST /v1/stream':
          await this.handleStream(req, res);
          break;
        case 'GET /v1/pending':
          this.handleListPending(res);
          break;
        case 'POST /v1/respond':
          await this.handleRespond(req, res);
          break;
        case 'GET /health':
        case 'GET /healthz':
          this.handleHealth(res);
          break;
        default:
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error('[CursorAdapter] Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Handle completion request from Go gateway.
   */
  private async handleComplete(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const cursorRequest: CursorRequest = {
      ...body,
      created_at: Date.now(),
    };

    // Enqueue the request
    if (!this.queue.enqueue(cursorRequest)) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Queue full', status: 'error' }));
      return;
    }

    console.log(`[CursorAdapter] Enqueued request ${cursorRequest.request_id} from agent ${cursorRequest.agent_id}`);

    // Wait for response
    const timeoutMs = cursorRequest.wait_timeout_ms || this.config.requestTimeoutMs;
    const response = await this.queue.waitForResponse(cursorRequest.request_id, timeoutMs);

    if (response) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } else {
      // Timeout - return pending status
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        request_id: cursorRequest.request_id,
        status: 'timeout',
        error: 'Request timed out waiting for Cursor agent response',
        model: 'cursor-agent',
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        metadata: { processing_time_ms: timeoutMs, handler_type: 'queued' },
      }));
    }
  }

  /**
   * Handle streaming request (not fully implemented - falls back to complete).
   */
  private async handleStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // For now, streaming is not supported - use regular completion
    await this.handleComplete(req, res);
  }

  /**
   * List pending requests (for Cursor agent to poll).
   */
  private handleListPending(res: http.ServerResponse): void {
    const pending = this.queue.listPending();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      pending,
      stats: this.queue.getStats(),
    }));
  }

  /**
   * Submit a response (from Cursor agent).
   */
  private async handleRespond(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const response: CursorResponse = body;

    this.queue.submitResponse(response);
    console.log(`[CursorAdapter] Response submitted for request ${response.request_id}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  }

  /**
   * Health check endpoint.
   */
  private handleHealth(res: http.ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      stats: this.queue.getStats(),
    }));
  }

  /**
   * Read request body as JSON.
   */
  private readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Get the request queue (for external access).
   */
  getQueue(): RequestQueue {
    return this.queue;
  }
}

// =============================================================================
// Exports
// =============================================================================

export default CursorAdapterServer;
