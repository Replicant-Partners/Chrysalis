/**
 * Terminal Manager
 *
 * Manages terminal sessions and multiplexing:
 * - Session lifecycle (create, connect, resize, close)
 * - Multiplexing multiple terminals
 * - PTY backend abstraction
 * - Background execution support
 */

import { EventEmitter } from 'events';
import {
  TerminalSession,
  SessionState,
  CreateSessionOptions,
  PTYBackend,
  MultiplexerConfig,
  TerminalEvent,
  TerminalEventType,
  DEFAULT_MULTIPLEXER_CONFIG,
} from './types';
import { createLogger } from '../../shared/logger';

// =============================================================================
// WebSocket PTY Backend
// =============================================================================

/**
 * PTY backend that communicates with a server over WebSocket.
 * This is the typical setup for web-based terminals.
 */
export class WebSocketPTYBackend implements PTYBackend {
  private ws: WebSocket | null = null;
  private sessions: Map<string, TerminalSession> = new Map();
  private dataCallbacks: Map<string, Set<(data: string) => void>> = new Map();
  private stateCallbacks: Map<string, Set<(state: SessionState) => void>> = new Map();
  private closeCallbacks: Map<string, Set<(exitCode: number) => void>> = new Map();
  private messageQueue: Array<{ type: string; payload: unknown }> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private log = createLogger('terminal-manager');

  constructor(private serverUrl: string) {}

  /**
   * Connect to the PTY server.
   */
  async connectToServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          // Flush queued messages
          this.messageQueue.forEach(msg => this.send(msg.type, msg.payload));
          this.messageQueue = [];
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };

        this.ws.onerror = (error) => {
          this.log.error('websocket error', { error: error instanceof Error ? error.message : String(error) });
          reject(error);
        };

        this.ws.onclose = () => {
          this.handleDisconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: { type: string; sessionId?: string; payload?: unknown }): void {
    const { type, sessionId, payload } = message;

    switch (type) {
      case 'session:created': {
        const session = payload as TerminalSession;
        this.sessions.set(session.id, session);
        break;
      }

      case 'data': {
        if (sessionId) {
          const callbacks = this.dataCallbacks.get(sessionId);
          callbacks?.forEach(cb => cb(payload as string));
        }
        break;
      }

      case 'state': {
        if (sessionId) {
          const session = this.sessions.get(sessionId);
          if (session) {
            session.state = payload as SessionState;
            const callbacks = this.stateCallbacks.get(sessionId);
            callbacks?.forEach(cb => cb(payload as SessionState));
          }
        }
        break;
      }

      case 'exit': {
        if (sessionId) {
          const session = this.sessions.get(sessionId);
          if (session) {
            session.state = 'closed';
            session.exitCode = payload as number;
            const callbacks = this.closeCallbacks.get(sessionId);
            callbacks?.forEach(cb => cb(payload as number));
          }
        }
        break;
      }
    }
  }

  private handleDisconnect(): void {
    // Mark all sessions as disconnected
    this.sessions.forEach(session => {
      session.state = 'disconnected';
      const callbacks = this.stateCallbacks.get(session.id);
      callbacks?.forEach(cb => cb('disconnected'));
    });

    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connectToServer().catch((error) => this.log.error('reconnect failed', { error: error instanceof Error ? error.message : String(error) }));
      }, 1000 * this.reconnectAttempts);
    }
  }

  private send(type: string, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      this.messageQueue.push({ type, payload });
    }
  }

  // PTYBackend implementation

  async connect(options: CreateSessionOptions): Promise<TerminalSession> {
    return new Promise((resolve, reject) => {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const session: TerminalSession = {
        id: sessionId,
        name: options.name || 'Terminal',
        shell: options.shell || process.env.SHELL || '/bin/bash',
        shellArgs: options.shellArgs || [],
        cwd: options.cwd || process.env.HOME || '/',
        env: options.env || {},
        state: 'connecting',
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        dimensions: { cols: options.cols || 80, rows: options.rows || 24 },
        isForeground: true,
      };

      this.sessions.set(sessionId, session);

      // Set up one-time listener for session creation confirmation
      const stateCallback = (state: SessionState) => {
        if (state === 'connected') {
          this.stateCallbacks.get(sessionId)?.delete(stateCallback);
          resolve(session);
        } else if (state === 'error') {
          this.stateCallbacks.get(sessionId)?.delete(stateCallback);
          reject(new Error(session.error || 'Failed to connect'));
        }
      };

      if (!this.stateCallbacks.has(sessionId)) {
        this.stateCallbacks.set(sessionId, new Set());
      }
      this.stateCallbacks.get(sessionId)!.add(stateCallback);

      // Send create request to server
      this.send('create', {
        sessionId,
        shell: session.shell,
        shellArgs: session.shellArgs,
        cwd: session.cwd,
        env: session.env,
        cols: session.dimensions.cols,
        rows: session.dimensions.rows,
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (session.state === 'connecting') {
          session.state = 'error';
          session.error = 'Connection timeout';
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
      this.send('data', { sessionId, data });
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.dimensions = { cols, rows };
      this.send('resize', { sessionId, cols, rows });
    }
  }

  close(sessionId: string): void {
    this.send('close', { sessionId });
    this.sessions.delete(sessionId);
    this.dataCallbacks.delete(sessionId);
    this.stateCallbacks.delete(sessionId);
    this.closeCallbacks.delete(sessionId);
  }

  onData(sessionId: string, callback: (data: string) => void): () => void {
    if (!this.dataCallbacks.has(sessionId)) {
      this.dataCallbacks.set(sessionId, new Set());
    }
    this.dataCallbacks.get(sessionId)!.add(callback);
    return () => this.dataCallbacks.get(sessionId)?.delete(callback);
  }

  onStateChange(sessionId: string, callback: (state: SessionState) => void): () => void {
    if (!this.stateCallbacks.has(sessionId)) {
      this.stateCallbacks.set(sessionId, new Set());
    }
    this.stateCallbacks.get(sessionId)!.add(callback);
    return () => this.stateCallbacks.get(sessionId)?.delete(callback);
  }

  onClose(sessionId: string, callback: (exitCode: number) => void): () => void {
    if (!this.closeCallbacks.has(sessionId)) {
      this.closeCallbacks.set(sessionId, new Set());
    }
    this.closeCallbacks.get(sessionId)!.add(callback);
    return () => this.closeCallbacks.get(sessionId)?.delete(callback);
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Disconnect from server and clean up.
   */
  disconnect(): void {
    this.ws?.close();
    this.sessions.clear();
    this.dataCallbacks.clear();
    this.stateCallbacks.clear();
    this.closeCallbacks.clear();
  }
}

// =============================================================================
// Terminal Manager
// =============================================================================

export class TerminalManager {
  private backend: PTYBackend;
  private config: MultiplexerConfig;
  private emitter = new EventEmitter();
  private foregroundSession: string | null = null;
  private idleTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(backend: PTYBackend, config?: Partial<MultiplexerConfig>) {
    this.backend = backend;
    this.config = { ...DEFAULT_MULTIPLEXER_CONFIG, ...config };
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * Create a new terminal session.
   */
  async createSession(options: CreateSessionOptions = {}): Promise<TerminalSession> {
    // Check session limit
    const currentSessions = this.backend.listSessions();
    if (currentSessions.length >= this.config.maxSessions) {
      throw new Error(`Maximum sessions (${this.config.maxSessions}) reached`);
    }

    const session = await this.backend.connect({
      shell: options.shell || this.config.defaultShell,
      cwd: options.cwd || this.config.defaultCwd,
      ...options,
    });

    // Set up event forwarding
    this.setupSessionListeners(session.id);

    // Start idle timer if configured
    this.resetIdleTimer(session.id);

    this.emit('session:created', session.id, { session });

    // Make this the foreground session if it's the first one
    if (!this.foregroundSession) {
      this.setForegroundSession(session.id);
    }

    return session;
  }

  /**
   * Close a terminal session.
   */
  closeSession(sessionId: string): void {
    const session = this.backend.getSession(sessionId);
    if (!session) return;

    // Clear idle timer
    this.clearIdleTimer(sessionId);

    this.backend.close(sessionId);

    // Update foreground session
    if (this.foregroundSession === sessionId) {
      const remaining = this.backend.listSessions();
      this.foregroundSession = remaining.length > 0 ? remaining[0].id : null;
    }

    this.emit('session:closed', sessionId, { exitCode: session.exitCode ?? 0 });
  }

  /**
   * Get a session by ID.
   */
  getSession(sessionId: string): TerminalSession | undefined {
    return this.backend.getSession(sessionId);
  }

  /**
   * List all sessions.
   */
  listSessions(): TerminalSession[] {
    return this.backend.listSessions();
  }

  /**
   * Get session count.
   */
  getSessionCount(): number {
    return this.backend.listSessions().length;
  }

  // ===========================================================================
  // Input/Output
  // ===========================================================================

  /**
   * Write data to a session.
   */
  write(sessionId: string, data: string): void {
    this.backend.write(sessionId, data);
    this.resetIdleTimer(sessionId);
    this.emit('data:sent', sessionId, { data });
  }

  /**
   * Write to the foreground session.
   */
  writeToForeground(data: string): void {
    if (this.foregroundSession) {
      this.write(this.foregroundSession, data);
    }
  }

  /**
   * Subscribe to data from a session.
   */
  onData(sessionId: string, callback: (data: string) => void): () => void {
    return this.backend.onData(sessionId, (data) => {
      this.resetIdleTimer(sessionId);
      this.emit('data:received', sessionId, { data });
      callback(data);
    });
  }

  // ===========================================================================
  // Resize
  // ===========================================================================

  /**
   * Resize a session.
   */
  resize(sessionId: string, cols: number, rows: number): void {
    this.backend.resize(sessionId, cols, rows);
    this.emit('resize', sessionId, { cols, rows });
  }

  // ===========================================================================
  // Foreground/Background
  // ===========================================================================

  /**
   * Set the foreground session.
   */
  setForegroundSession(sessionId: string): void {
    const session = this.backend.getSession(sessionId);
    if (!session) return;

    // Update previous foreground session
    if (this.foregroundSession && this.foregroundSession !== sessionId) {
      const prevSession = this.backend.getSession(this.foregroundSession);
      if (prevSession) {
        prevSession.isForeground = false;
      }
    }

    session.isForeground = true;
    this.foregroundSession = sessionId;

    this.emit('focus', sessionId, {});
  }

  /**
   * Get the foreground session.
   */
  getForegroundSession(): TerminalSession | undefined {
    return this.foregroundSession
      ? this.backend.getSession(this.foregroundSession)
      : undefined;
  }

  /**
   * Blur all sessions (none in foreground).
   */
  blurAll(): void {
    if (this.foregroundSession) {
      const session = this.backend.getSession(this.foregroundSession);
      if (session) {
        session.isForeground = false;
      }
      this.emit('blur', this.foregroundSession, {});
      this.foregroundSession = null;
    }
  }

  // ===========================================================================
  // Background Support
  // ===========================================================================

  /**
   * Pause data flow for background execution (keeps session alive).
   */
  pauseDataFlow(sessionId: string): void {
    // In a real implementation, this would tell the backend to buffer data
    // instead of sending it immediately
  }

  /**
   * Resume data flow when returning to foreground.
   */
  resumeDataFlow(sessionId: string): void {
    // Resume sending buffered data
  }

  /**
   * Check if sessions should be kept alive in background.
   */
  shouldKeepAlive(): boolean {
    return this.config.keepAliveInBackground;
  }

  // ===========================================================================
  // Idle Timeout
  // ===========================================================================

  private resetIdleTimer(sessionId: string): void {
    this.clearIdleTimer(sessionId);

    if (this.config.idleTimeoutMs > 0) {
      const timer = setTimeout(() => {
        this.closeSession(sessionId);
      }, this.config.idleTimeoutMs);
      this.idleTimers.set(sessionId, timer);
    }
  }

  private clearIdleTimer(sessionId: string): void {
    const timer = this.idleTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(sessionId);
    }
  }

  // ===========================================================================
  // Event Setup
  // ===========================================================================

  private setupSessionListeners(sessionId: string): void {
    this.backend.onStateChange(sessionId, (state) => {
      if (state === 'connected') {
        this.emit('session:connected', sessionId, {});
      } else if (state === 'disconnected') {
        this.emit('session:disconnected', sessionId, {});
      } else if (state === 'error') {
        const session = this.backend.getSession(sessionId);
        this.emit('session:error', sessionId, { error: session?.error });
      }
    });

    this.backend.onClose(sessionId, (exitCode) => {
      this.clearIdleTimer(sessionId);

      if (this.config.autoCloseOnExit) {
        // Session already closed by backend
        this.emit('session:closed', sessionId, { exitCode });
      }
    });
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  on(event: TerminalEventType, handler: (e: TerminalEvent) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: TerminalEventType, handler: (e: TerminalEvent) => void): void {
    this.emitter.off(event, handler);
  }

  private emit<T>(type: TerminalEventType, sessionId: string, payload: T): void {
    const event: TerminalEvent<T> = {
      type,
      sessionId,
      timestamp: Date.now(),
      payload,
    };
    this.emitter.emit(type, event);
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Close all sessions and clean up.
   */
  dispose(): void {
    // Clear all idle timers
    this.idleTimers.forEach(timer => clearTimeout(timer));
    this.idleTimers.clear();

    // Close all sessions
    this.backend.listSessions().forEach(session => {
      this.backend.close(session.id);
    });

    this.emitter.removeAllListeners();
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a terminal manager with WebSocket backend.
 */
export function createTerminalManager(
  serverUrl: string,
  config?: Partial<MultiplexerConfig>
): { manager: TerminalManager; backend: WebSocketPTYBackend } {
  const backend = new WebSocketPTYBackend(serverUrl);
  const manager = new TerminalManager(backend, config);
  return { manager, backend };
}
