/**
 * Terminal WebSocket Server
 * 
 * Provides WebSocket endpoint for terminal PTY sessions.
 * Integrates with xterm.js on the frontend.
 * 
 * @module api/terminal/websocket-server
 */

import type { Server as WebSocketServerType } from 'ws';
import type { IncomingMessage } from 'http';
import { EventEmitter } from 'events';
import { logger } from '../../observability';

// Dynamic imports to handle optional dependencies
let WebSocketServer: any = null;
let WebSocket: any = null;
let ptyModule: any = null;

try {
  const ws = require('ws');
  WebSocketServer = ws.WebSocketServer || ws.Server;
  WebSocket = ws.WebSocket || ws;
} catch (e) {
  logger.error('ws module not available - WebSocket support disabled');
}

try {
  ptyModule = require('node-pty');
} catch (e) {
  logger.warn('node-pty not available - PTY sessions disabled');
}

// =============================================================================
// Types
// =============================================================================

export interface TerminalSession {
  id: string;
  pty: any; // IPty from node-pty
  ws: WebSocket;
  created: Date;
  lastActivity: Date;
  cols: number;
  rows: number;
  cwd: string;
  env: Record<string, string>;
}

export interface TerminalServerOptions {
  port?: number;
  shell?: string;
  maxSessions?: number;
  sessionTimeout?: number; // milliseconds
  allowedCommands?: string[]; // whitelist (empty = all allowed)
}

// =============================================================================
// Terminal WebSocket Server
// =============================================================================

export class TerminalWebSocketServer extends EventEmitter {
  private wss: any | null = null;
  private sessions: Map<string, TerminalSession> = new Map();
  private readonly options: Required<TerminalServerOptions>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: TerminalServerOptions = {}) {
    super();
    
    this.options = {
      port: options.port ?? 3001,
      shell: options.shell ?? process.env.SHELL ?? '/bin/bash',
      maxSessions: options.maxSessions ?? 100,
      sessionTimeout: options.sessionTimeout ?? 30 * 60 * 1000, // 30 minutes
      allowedCommands: options.allowedCommands ?? []
    };
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    if (this.wss) {
      logger.warn('Terminal WebSocket server already running');
      return;
    }

    if (!WebSocketServer) {
      throw new Error('WebSocket server not available - install ws package');
    }

    this.wss = new WebSocketServer({ port: this.options.port });

    this.wss.on('connection', (ws: any, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Cleanup inactive sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupSessions();
    }, 5 * 60 * 1000);

    logger.info('Terminal WebSocket server started', { 
      port: this.options.port,
      shell: this.options.shell
    });

    this.emit('started', { port: this.options.port });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all sessions
    for (const session of this.sessions.values()) {
      this.closeSession(session.id);
    }

    // Close WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          logger.info('Terminal WebSocket server stopped');
          resolve();
        });
      });
      this.wss = null;
    }

    this.emit('stopped');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: any, req: IncomingMessage): void {
    if (!WebSocket) {
      ws.close(1011, 'WebSocket support not available');
      return;
    }

    // Check session limit
    if (this.sessions.size >= this.options.maxSessions) {
      logger.warn('Maximum terminal sessions reached', { 
        current: this.sessions.size,
        max: this.options.maxSessions
      });
      ws.close(1008, 'Maximum sessions reached');
      return;
    }

    // Parse terminal ID from URL
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const terminalId = url.searchParams.get('id') || `term-${Date.now()}`;

    // Create PTY session
    const cols = parseInt(url.searchParams.get('cols') || '80');
    const rows = parseInt(url.searchParams.get('rows') || '24');
    const cwd = url.searchParams.get('cwd') || process.env.HOME || process.cwd();

    try {
      if (!ptyModule) {
        logger.error('Cannot create PTY session - node-pty not installed');
        ws.close(1011, 'PTY support not available');
        return;
      }

      const ptyProcess = ptyModule.spawn(this.options.shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: { ...process.env, TERM: 'xterm-256color' }
      });

      const session: TerminalSession = {
        id: terminalId,
        pty: ptyProcess,
        ws,
        created: new Date(),
        lastActivity: new Date(),
        cols,
        rows,
        cwd,
        env: process.env as Record<string, string>
      };

      this.sessions.set(terminalId, session);

      // PTY output -> WebSocket
      ptyProcess.onData((data: string) => {
        if (ws.readyState === 1) { // OPEN state
          ws.send(JSON.stringify({ type: 'data', data }));
        }
      });

      // PTY exit
      ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
        logger.info('PTY session exited', { terminalId, exitCode, signal });
        ws.send(JSON.stringify({ 
          type: 'exit', 
          exitCode, 
          signal 
        }));
        this.closeSession(terminalId);
      });

      // WebSocket messages -> PTY input
      ws.on('message', (message: Buffer) => {
        try {
          const msg = JSON.parse(message.toString());
          session.lastActivity = new Date();

          switch (msg.type) {
            case 'input':
              ptyProcess.write(msg.data);
              break;

            case 'resize':
              ptyProcess.resize(msg.cols, msg.rows);
              session.cols = msg.cols;
              session.rows = msg.rows;
              break;

            default:
              logger.warn('Unknown terminal message type', { type: msg.type });
          }
        } catch (error) {
          logger.error('Error processing terminal message', error as Error);
        }
      });

      // WebSocket close
      ws.on('close', () => {
        this.closeSession(terminalId);
      });

      // WebSocket error
      ws.on('error', (error: Error) => {
        logger.error('WebSocket error', error);
        this.closeSession(terminalId);
      });

      // Send ready message
      ws.send(JSON.stringify({ type: 'ready', terminalId, cols, rows }));

      logger.info('Terminal session created', { terminalId, cols, rows, cwd });
      this.emit('session:created', { terminalId, cols, rows });

    } catch (error) {
      logger.error('Failed to create PTY session', error as Error);
      ws.close(1011, 'Failed to create terminal session');
    }
  }

  /**
   * Close a terminal session
   */
  private closeSession(terminalId: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) return;

    try {
      session.pty.kill();
    } catch (error) {
      logger.error('Error killing PTY', error as Error);
    }

    try {
      session.ws.close();
    } catch (error) {
      // WebSocket might already be closed
    }

    this.sessions.delete(terminalId);
    logger.info('Terminal session closed', { terminalId });
    this.emit('session:closed', { terminalId });
  }

  /**
   * Cleanup inactive sessions
   */
  private cleanupSessions(): void {
    const now = Date.now();
    const timeout = this.options.sessionTimeout;

    for (const [id, session] of this.sessions.entries()) {
      const inactive = now - session.lastActivity.getTime();
      if (inactive > timeout) {
        logger.info('Cleaning up inactive session', { 
          terminalId: id,
          inactive: Math.floor(inactive / 1000)
        });
        this.closeSession(id);
      }
    }
  }

  /**
   * Get active session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get session info
   */
  getSession(terminalId: string): TerminalSession | undefined {
    return this.sessions.get(terminalId);
  }

  /**
   * List all sessions
   */
  listSessions(): Array<{ id: string; created: Date; lastActivity: Date; cols: number; rows: number }> {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      created: s.created,
      lastActivity: s.lastActivity,
      cols: s.cols,
      rows: s.rows
    }));
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let serverInstance: TerminalWebSocketServer | null = null;

/**
 * Get or create the terminal server instance
 */
export function getTerminalServer(options?: TerminalServerOptions): TerminalWebSocketServer {
  if (!serverInstance) {
    serverInstance = new TerminalWebSocketServer(options);
  }
  return serverInstance;
}

/**
 * Start the terminal server (convenience function)
 */
export async function startTerminalServer(options?: TerminalServerOptions): Promise<TerminalWebSocketServer> {
  const server = getTerminalServer(options);
  await server.start();
  return server;
}

/**
 * Stop the terminal server (convenience function)
 */
export async function stopTerminalServer(): Promise<void> {
  if (serverInstance) {
    await serverInstance.stop();
  }
}