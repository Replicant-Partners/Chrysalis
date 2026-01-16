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

import { WebSocketServer, WebSocket } from 'ws';
import { spawn, IPty } from 'node-pty';
import { EventEmitter } from 'events';

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
}

interface IncomingMessage {
  type: 'create' | 'data' | 'resize' | 'close';
  sessionId: string;
  shell?: string;
  cwd?: string;
  cols?: number;
  rows?: number;
  data?: string;
}

interface OutgoingMessage {
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
}

const DEFAULT_CONFIG: ServerConfig = {
  port: parseInt(process.env.TERMINAL_WS_PORT || '8081', 10),
  host: process.env.TERMINAL_WS_HOST || '0.0.0.0',
  defaultShell: process.env.TERMINAL_DEFAULT_SHELL || process.env.SHELL || '/bin/bash',
  defaultCwd: process.env.TERMINAL_DEFAULT_CWD || process.env.HOME || '/',
  maxSessions: parseInt(process.env.TERMINAL_MAX_SESSIONS || '50', 10),
  sessionTimeoutMs: parseInt(process.env.TERMINAL_SESSION_TIMEOUT_MS || '3600000', 10), // 1 hour
  heartbeatIntervalMs: 30000,
};

// =============================================================================
// Terminal PTY Server
// =============================================================================

export class TerminalPTYServer {
  private config: ServerConfig;
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, PTYSession> = new Map();
  private clientSessions: Map<WebSocket, Set<string>> = new Map();
  private emitter = new EventEmitter();
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<ServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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

        this.wss.on('connection', (ws) => this.handleConnection(ws));

        this.wss.on('listening', () => {
          console.log(`[TerminalPTY] Server listening on ws://${this.config.host}:${this.config.port}`);
          this.startHeartbeat();
          this.startCleanup();
          resolve();
        });

        this.wss.on('error', (error) => {
          console.error('[TerminalPTY] Server error:', error);
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
          console.log('[TerminalPTY] Server stopped');
          resolve();
        });
      });
    }
  }

  // ===========================================================================
  // Connection Handling
  // ===========================================================================

  private handleConnection(ws: WebSocket): void {
    console.log('[TerminalPTY] Client connected');
    this.clientSessions.set(ws, new Set());

    ws.on('message', (data) => {
      try {
        const message: IncomingMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        this.sendError(ws, 'unknown', `Invalid message: ${error}`);
      }
    });

    ws.on('close', () => {
      console.log('[TerminalPTY] Client disconnected');
      // Note: We don't close sessions on disconnect - they persist for reconnection
      this.clientSessions.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[TerminalPTY] WebSocket error:', error);
    });

    // Send ping for heartbeat
    ws.on('pong', () => {
      // Client is alive
    });
  }

  private handleMessage(ws: WebSocket, message: IncomingMessage): void {
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
        this.sendError(ws, message.sessionId, `Unknown message type: ${(message as any).type}`);
    }
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  private createSession(ws: WebSocket, message: IncomingMessage): void {
    // Check session limit
    if (this.sessions.size >= this.config.maxSessions) {
      this.sendError(ws, message.sessionId, `Maximum sessions (${this.config.maxSessions}) reached`);
      return;
    }

    const sessionId = message.sessionId;
    const shell = message.shell || this.config.defaultShell;
    const cwd = message.cwd || this.config.defaultCwd;
    const cols = message.cols || 80;
    const rows = message.rows || 24;

    try {
      // Spawn PTY process
      const pty = spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
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
        console.log(`[TerminalPTY] Session ${sessionId} exited (code: ${exitCode}, signal: ${signal})`);
        this.broadcast(sessionId, { type: 'exit', sessionId, payload: exitCode });
        this.sessions.delete(sessionId);
      });

      // Send confirmation
      this.send(ws, { type: 'session:created', sessionId, payload: { shell, cwd, cols, rows } });
      this.send(ws, { type: 'state', sessionId, payload: 'connected' });

      console.log(`[TerminalPTY] Session ${sessionId} created (shell: ${shell}, cwd: ${cwd})`);

    } catch (error) {
      console.error(`[TerminalPTY] Failed to create session ${sessionId}:`, error);
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
      console.log(`[TerminalPTY] Session ${sessionId} resized to ${cols}x${rows}`);
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
      console.log(`[TerminalPTY] Session ${sessionId} closed`);
    }
  }

  // ===========================================================================
  // Messaging
  // ===========================================================================

  private send(ws: WebSocket, message: OutgoingMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, sessionId: string, error: string): void {
    this.send(ws, { type: 'error', sessionId, payload: error });
  }

  private broadcast(sessionId: string, message: OutgoingMessage): void {
    if (!this.wss) return;

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
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
      this.wss?.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
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
          console.log(`[TerminalPTY] Session ${sessionId} timed out`);
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
    console.log('\n[TerminalPTY] Shutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  server.start().catch((error) => {
    console.error('[TerminalPTY] Failed to start:', error);
    process.exit(1);
  });
}

export default TerminalPTYServer;
