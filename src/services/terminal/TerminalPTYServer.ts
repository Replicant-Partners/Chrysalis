/**
 * Terminal PTY WebSocket Server
 *
 * Provides PTY (pseudo-terminal) backend for terminal widgets:
 * - WebSocket server for frontend communication
 * - Spawns shell processes via node-pty
 * - Session management (create, resize, close)
 * - Data streaming
 *
 * Run with: npx ts-node src/services/terminal/TerminalPTYServer.ts
 * Or: node dist/services/terminal/TerminalPTYServer.js
 */

import WS, { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import path from 'path';
import { spawn, IPty } from 'node-pty';
import { EventEmitter } from 'events';
import { createLogger } from '../../shared/logger';

// =============================================================================
// Types
// =============================================================================

interface PTYSession {
  id: string;
  pty: IPty;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
  createdAt: number;
  lastActivity: number;
  env: Record<string, string>;
}

interface TerminalMessage {
  type: 'create' | 'data' | 'resize' | 'close';
  sessionId: string;
  shell?: string;
  cwd?: string;
  cols?: number;
  rows?: number;
  data?: string;
}

interface TerminalOutgoingMessage {
  type: 'session:created' | 'data' | 'state' | 'exit' | 'error';
  sessionId: string;
  payload?: unknown;
}

// =============================================================================
// Configuration
// =============================================================================

interface ServerConfig {
  port: number;
  host: string;
  defaultShell: string;
  defaultCwd: string;
  maxSessions: number;
  sessionTimeoutMs: number;
  heartbeatIntervalMs: number;
  authToken?: string;
  allowedShells: string[];
  allowedCwdRoot?: string;
}

const DEFAULT_CONFIG: ServerConfig = {
  port: parseInt(process.env.TERMINAL_WS_PORT || '8081', 10),
  host: process.env.TERMINAL_WS_HOST || '0.0.0.0',
  defaultShell: process.env.TERMINAL_DEFAULT_SHELL || process.env.SHELL || '/bin/bash',
  defaultCwd: process.env.TERMINAL_DEFAULT_CWD || process.env.HOME || '/',
  maxSessions: parseInt(process.env.TERMINAL_MAX_SESSIONS || '50', 10),
  sessionTimeoutMs: parseInt(process.env.TERMINAL_SESSION_TIMEOUT_MS || '3600000', 10), // 1 hour
  heartbeatIntervalMs: 30000,
  authToken: process.env.TERMINAL_WS_TOKEN,
  allowedShells: process.env.TERMINAL_ALLOWED_SHELLS
    ? process.env.TERMINAL_ALLOWED_SHELLS.split(',').map((s) => s.trim()).filter(Boolean)
    : [],
  allowedCwdRoot: process.env.TERMINAL_ALLOWED_CWD_ROOT,
};

const log = createLogger('terminal-pty');

// =============================================================================
type WebSocketServerInstance = InstanceType<typeof WebSocketServer>;

type WebSocketClient = InstanceType<typeof WS>;

type RawData = string | Buffer | ArrayBuffer | Buffer[];

// Terminal PTY Server
// =============================================================================

export class TerminalPTYServer {
  private config: ServerConfig;
  private wss: WebSocketServerInstance | null = null;
  private sessions: Map<string, PTYSession> = new Map();
  private clientSessions: Map<WebSocketClient, Set<string>> = new Map();
  private emitter = new EventEmitter();
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<ServerConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      allowedShells: [...(config?.allowedShells ?? DEFAULT_CONFIG.allowedShells)],
    };
    this.ensureDefaultShellAllowed();
  }

  // ===========================================================================
  // Server Lifecycle
  // ===========================================================================

  /**
   * Start the WebSocket server.
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.config.port,
          host: this.config.host,
        });

        this.wss.on('connection', (ws: WebSocketClient, req: IncomingMessage) => this.handleConnection(ws, req));

        this.wss.on('listening', () => {
          log.info('server listening', { host: this.config.host, port: this.config.port, authProtected: Boolean(this.config.authToken) });
          if (!this.config.authToken) {
            log.warn('Terminal PTY server is running without authentication. Set TERMINAL_WS_TOKEN or provide authToken in config.');
          }
          this.startHeartbeat();
          this.startCleanup();
          resolve();
        });

        this.wss.on('error', (error: Error) => {
          log.error('server error', { error });
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server and clean up all sessions.
   */
  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all sessions
    for (const [sessionId, session] of this.sessions) {
      try {
        session.pty.kill();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.sessions.clear();

    // Close WebSocket server
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss!.close(() => {
          log.info('server stopped');
          resolve();
        });
      });
    }
  }

  // ===========================================================================
  // Connection Handling
  // ===========================================================================

  private handleConnection(ws: WebSocketClient, req: IncomingMessage): void {
    if (!this.isAuthorized(req)) {
      log.warn('Unauthorized PTY connection attempt', { remote: req.socket.remoteAddress });
      ws.close(4401, 'Unauthorized');
      return;
    }

    log.info('client connected', { remote: req.socket.remoteAddress });
    this.clientSessions.set(ws, new Set());

    ws.on('message', (data: RawData) => {
      try {
        const text = typeof data === 'string' ? data : data.toString('utf8');
        const message: TerminalMessage = JSON.parse(text);
        this.handleMessage(ws, message);
      } catch (error) {
        this.sendError(ws, 'unknown', `Invalid message: ${error}`);
      }
    });

    ws.on('close', () => {
      log.info('client disconnected');
      // Note: We don't close sessions on disconnect - they persist for reconnection
      this.clientSessions.delete(ws);
    });

    ws.on('error', (error: Error) => {
      log.error('websocket error', { error });
    });

    // Send ping for heartbeat
    ws.on('pong', () => {
      // Client is alive
    });
  }

  private handleMessage(ws: WebSocketClient, message: TerminalMessage): void {
    switch (message.type) {
      case 'create':
        this.createSession(ws, message);
        break;
      case 'data':
        this.writeToSession(message.sessionId, message.data || '');
        break;
      case 'resize':
        this.resizeSession(message.sessionId, message.cols || 80, message.rows || 24);
        break;
      case 'close':
        this.closeSession(message.sessionId);
        break;
      default:
        this.sendError(ws, message.sessionId, `Unknown message type: ${(message as TerminalMessage & { type: string }).type}`);
    }
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  private createSession(ws: WebSocketClient, message: TerminalMessage): void {
    // Check session limit
    if (this.sessions.size >= this.config.maxSessions) {
      this.sendError(ws, message.sessionId, `Maximum sessions (${this.config.maxSessions}) reached`);
      return;
    }

    const sessionId = message.sessionId;
    const shell = this.resolveShell(message.shell);
    if (!shell) {
      this.sendError(ws, sessionId, 'Shell not allowed');
      return;
    }

    const cwd = this.resolveCwd(message.cwd);
    const cols = message.cols || 80;
    const rows = message.rows || 24;

    try {
      // Spawn PTY process
      const env = this.buildSanitizedEnv();
      const pty = spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env,
      });

      const session: PTYSession = {
        id: sessionId,
        pty,
        shell,
        cwd,
        cols,
        rows,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        env,
      };

      this.sessions.set(sessionId, session);
      this.clientSessions.get(ws)?.add(sessionId);

      // Forward PTY output to WebSocket
      pty.onData((data) => {
        session.lastActivity = Date.now();
        this.broadcast(sessionId, { type: 'data', sessionId, payload: data });
      });

      // Handle PTY exit
      pty.onExit(({ exitCode, signal }) => {
        log.info('session exited', { sessionId, exitCode, signal });
        this.broadcast(sessionId, { type: 'exit', sessionId, payload: exitCode });
        this.sessions.delete(sessionId);
      });

      // Send confirmation
      this.send(ws, { type: 'session:created', sessionId, payload: { shell, cwd, cols, rows } });
      this.send(ws, { type: 'state', sessionId, payload: 'connected' });

      log.info('session created', { sessionId, shell, cwd });

    } catch (error) {
      log.error('failed to create session', { sessionId, error });
      this.sendError(ws, sessionId, `Failed to create session: ${error}`);
      this.send(ws, { type: 'state', sessionId, payload: 'error' });
    }
  }

  private writeToSession(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      session.pty.write(data);
    }
  }

  private resizeSession(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cols = cols;
      session.rows = rows;
      session.pty.resize(cols, rows);
      log.info('session resized', { sessionId, cols, rows });
    }
  }

  private closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        session.pty.kill();
      } catch {
        // Already dead
      }
      this.sessions.delete(sessionId);
      log.info('session closed', { sessionId });
    }
  }

  // ===========================================================================
  // Security Helpers
  // ===========================================================================

  private isAuthorized(req: IncomingMessage): boolean {
    if (!this.config.authToken) {
      // Authentication disabled - warn already emitted at startup
      return true;
    }

    const token = this.extractToken(req);
    return token === this.config.authToken;
  }

  private extractToken(req: IncomingMessage): string | null {
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    const url = this.parseRequestUrl(req);
    const tokenParam = url.searchParams.get('token');
    if (tokenParam) {
      return tokenParam;
    }

    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const tokenCookie = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('terminal_token='));
      if (tokenCookie) {
        const [, value] = tokenCookie.split('=');
        return value;
      }
    }

    return null;
  }

  private parseRequestUrl(req: IncomingMessage): URL {
    try {
      return new URL(req.url || '/', `http://${req.headers.host ?? 'localhost'}`);
    } catch {
      return new URL('/', 'http://localhost');
    }
  }

  private resolveShell(override?: string | null): string | null {
    if (!override) {
      return this.config.defaultShell;
    }

    if (!this.config.allowedShells.length) {
      // Overrides only allowed when explicit allowlist exists
      log.warn('Shell override requested without allowedShells configured; using default');
      return this.config.defaultShell;
    }

    if (this.isShellAllowed(override)) {
      return override;
    }

    log.warn('Rejected shell override', { override });
    return null;
  }

  private normalizeCommand(cmd: string): string {
    return path.basename(cmd.trim());
  }

  private isShellAllowed(shell: string): boolean {
    if (!this.config.allowedShells.length) {
      return true;
    }

    const normalized = this.normalizeCommand(shell);
    return this.config.allowedShells.some((allowed) => {
      const normalizedAllowed = this.normalizeCommand(allowed);
      return normalizedAllowed === normalized || allowed === shell;
    });
  }

  private resolveCwd(override?: string | null): string {
    const fallback = this.config.defaultCwd;
    if (!override) {
      return fallback;
    }

    if (!path.isAbsolute(override)) {
      log.warn('Rejecting non-absolute cwd override', { override });
      return fallback;
    }

    const normalized = path.normalize(override);
    if (this.config.allowedCwdRoot) {
      const normalizedRoot = path.resolve(this.config.allowedCwdRoot);
      if (!normalized.startsWith(normalizedRoot)) {
        log.warn('Rejecting cwd outside allowed root', { override, allowedRoot: normalizedRoot });
        return fallback;
      }
    }

    return normalized;
  }

  private buildSanitizedEnv(extra: Record<string, string> = {}): Record<string, string> {
    const allowedKeys = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'LC_LANG', 'SHELL'];
    const sanitized: Record<string, string> = {};

    for (const key of allowedKeys) {
      const value = process.env[key];
      if (value) {
        sanitized[key] = value;
      }
    }

    sanitized.TERM = 'xterm-256color';
    sanitized.COLORTERM = 'truecolor';

    return { ...sanitized, ...extra };
  }

  private ensureDefaultShellAllowed(): void {
    if (!this.config.allowedShells.length) {
      return;
    }

    const normalizedDefault = this.normalizeCommand(this.config.defaultShell);
    const hasDefault = this.config.allowedShells.some(
      (allowed) => this.normalizeCommand(allowed) === normalizedDefault
    );

    if (!hasDefault) {
      this.config.allowedShells.push(this.config.defaultShell);
    }
  }

  // ===========================================================================
  // Messaging
  // ===========================================================================

  private send(ws: WebSocketClient, message: TerminalOutgoingMessage): void {
    if (ws.readyState === WS.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocketClient, sessionId: string, error: string): void {
    this.send(ws, { type: 'error', sessionId, payload: error });
  }

  private broadcast(sessionId: string, message: TerminalOutgoingMessage): void {
    if (!this.wss) return;

    this.wss.clients.forEach((client: WebSocketClient) => {
      if (client.readyState === WS.OPEN) {
        // Send to all clients that have this session
        const clientSessionIds = this.clientSessions.get(client);
        if (clientSessionIds?.has(sessionId)) {
          client.send(JSON.stringify(message));
        }
      }
    });
  }

  // ===========================================================================
  // Maintenance
  // ===========================================================================

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((ws: WebSocketClient) => {
        if (ws.readyState === WS.OPEN) {
          ws.ping();
        }
      });
    }, this.config.heartbeatIntervalMs);
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      for (const [sessionId, session] of this.sessions) {
        if (now - session.lastActivity > this.config.sessionTimeoutMs) {
          log.warn('session timed out', { sessionId });
          this.closeSession(sessionId);
        }
      }
    }, 60000); // Check every minute
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): { sessions: number; clients: number } {
    return {
      sessions: this.sessions.size,
      clients: this.wss?.clients.size || 0,
    };
  }
}

// =============================================================================
// Main Entry Point
// =============================================================================

if (require.main === module) {
  const server = new TerminalPTYServer();

  // Graceful shutdown
  const shutdown = async () => {
    log.info('shutting down');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  server.start().catch((error) => {
    log.error('failed to start', { error });
    process.exit(1);
  });
}

export default TerminalPTYServer;