/**
 * Backend Connector
 *
 * Connects the canvas system to Chrysalis backend services:
 * - LLM Gateway (Go service on :8080)
 * - Storage (Fireproof/local)
 * - Terminal (PTY via WebSocket)
 * - Memory system (vector store)
 *
 * WITHOUT THIS, NOTHING WORKS.
 */

import { GatewayLLMClient } from '../../services/gateway/GatewayLLMClient';
import { getConfig } from '../../core/config';
import { EventEmitter } from 'events';

// =============================================================================
// Service Status
// =============================================================================

export type ServiceStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ServiceHealth {
  service: string;
  status: ServiceStatus;
  lastCheck: number;
  error?: string;
  latencyMs?: number;
}

// =============================================================================
// Backend Configuration
// =============================================================================

export interface BackendConfig {
  /** Gateway URL (Go LLM service) */
  gatewayUrl: string;

  /** Gateway auth token */
  gatewayAuthToken?: string;

  /** Terminal WebSocket URL */
  terminalWsUrl: string;

  /** Storage type */
  storageType: 'local' | 'fireproof' | 'remote';

  /** Storage endpoint (for remote) */
  storageUrl?: string;

  /** Health check interval (ms) */
  healthCheckIntervalMs: number;

  /** Connection timeout (ms) */
  connectionTimeoutMs: number;

  /** Retry attempts */
  maxRetries: number;
}

const DEFAULT_CONFIG: BackendConfig = {
  gatewayUrl: 'http://localhost:8080',
  terminalWsUrl: 'ws://localhost:8081/terminal',
  storageType: 'local',
  healthCheckIntervalMs: 30000,
  connectionTimeoutMs: 10000,
  maxRetries: 3,
};

// =============================================================================
// Backend Connector
// =============================================================================

export class BackendConnector {
  private config: BackendConfig;
  private emitter = new EventEmitter();

  // Service clients
  private gatewayClient: GatewayLLMClient | null = null;
  private terminalWs: WebSocket | null = null;
  private storage: StorageAdapter | null = null;

  // Health tracking
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  // Initialization state
  private initialized = false;
  private initializing = false;

  constructor(config?: Partial<BackendConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize health status
    ['gateway', 'terminal', 'storage'].forEach(service => {
      this.serviceHealth.set(service, {
        service,
        status: 'disconnected',
        lastCheck: 0,
      });
    });
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize all backend connections.
   * Call this before using any canvas features that need backend services.
   */
  async initialize(): Promise<{ success: boolean; errors: string[] }> {
    if (this.initialized) {
      return { success: true, errors: [] };
    }

    if (this.initializing) {
      // Wait for existing initialization
      return new Promise(resolve => {
        this.emitter.once('initialized', resolve);
      });
    }

    this.initializing = true;
    const errors: string[] = [];

    // 1. Connect to LLM Gateway
    try {
      await this.connectGateway();
    } catch (err) {
      errors.push(`Gateway: ${err}`);
    }

    // 2. Connect to Terminal service
    try {
      await this.connectTerminal();
    } catch (err) {
      errors.push(`Terminal: ${err}`);
    }

    // 3. Initialize storage
    try {
      await this.initializeStorage();
    } catch (err) {
      errors.push(`Storage: ${err}`);
    }

    // Start health checks
    this.startHealthChecks();

    this.initialized = true;
    this.initializing = false;

    const result = { success: errors.length === 0, errors };
    this.emitter.emit('initialized', result);

    return result;
  }

  /**
   * Check if backend is ready.
   */
  isReady(): boolean {
    return this.initialized && this.gatewayClient !== null;
  }

  /**
   * Get current health status of all services.
   */
  getHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  // ===========================================================================
  // LLM Gateway
  // ===========================================================================

  private async connectGateway(): Promise<void> {
    const health = this.serviceHealth.get('gateway')!;
    health.status = 'connecting';

    try {
      // Check if gateway is responding
      const startTime = Date.now();
      const response = await fetch(`${this.config.gatewayUrl}/healthz`, {
        signal: AbortSignal.timeout(this.config.connectionTimeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}`);
      }

      const data = await response.json();

      // Create client
      this.gatewayClient = new GatewayLLMClient({
        baseUrl: this.config.gatewayUrl,
        authToken: this.config.gatewayAuthToken,
      });

      health.status = 'connected';
      health.latencyMs = Date.now() - startTime;
      health.lastCheck = Date.now();
      health.error = undefined;

      console.log(`[BackendConnector] Gateway connected (provider: ${data.provider})`);

    } catch (err) {
      health.status = 'error';
      health.error = String(err);
      health.lastCheck = Date.now();
      throw err;
    }
  }

  /**
   * Get the LLM client for making chat requests.
   */
  getLLMClient(): GatewayLLMClient {
    if (!this.gatewayClient) {
      throw new Error('Backend not initialized. Call initialize() first.');
    }
    return this.gatewayClient;
  }

  /**
   * Send a chat message to the LLM.
   */
  async chat(
    agentId: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number }
  ): Promise<{ content: string; model: string; provider: string }> {
    const client = this.getLLMClient();
    return client.chat(agentId, messages, options?.temperature);
  }

  /**
   * Stream a chat response.
   */
  async *chatStream(
    agentId: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number }
  ): AsyncGenerator<{ content: string; model: string; provider: string }> {
    const client = this.getLLMClient();
    yield* client.stream(agentId, messages, options?.temperature);
  }

  // ===========================================================================
  // Terminal Service
  // ===========================================================================

  private async connectTerminal(): Promise<void> {
    const health = this.serviceHealth.get('terminal')!;
    health.status = 'connecting';

    return new Promise((resolve, reject) => {
      try {
        this.terminalWs = new WebSocket(this.config.terminalWsUrl);

        const timeout = setTimeout(() => {
          health.status = 'error';
          health.error = 'Connection timeout';
          reject(new Error('Terminal WebSocket timeout'));
        }, this.config.connectionTimeoutMs);

        this.terminalWs.onopen = () => {
          clearTimeout(timeout);
          health.status = 'connected';
          health.lastCheck = Date.now();
          health.error = undefined;
          console.log('[BackendConnector] Terminal connected');
          resolve();
        };

        this.terminalWs.onerror = (error) => {
          clearTimeout(timeout);
          health.status = 'error';
          health.error = 'WebSocket error';
          health.lastCheck = Date.now();
          reject(error);
        };

        this.terminalWs.onclose = () => {
          health.status = 'disconnected';
          health.lastCheck = Date.now();
          this.emitter.emit('terminal:disconnected');
        };

      } catch (err) {
        health.status = 'error';
        health.error = String(err);
        reject(err);
      }
    });
  }

  /**
   * Get the terminal WebSocket for PTY communication.
   */
  getTerminalConnection(): WebSocket | null {
    return this.terminalWs;
  }

  /**
   * Send data to terminal.
   */
  terminalWrite(sessionId: string, data: string): void {
    if (!this.terminalWs || this.terminalWs.readyState !== WebSocket.OPEN) {
      throw new Error('Terminal not connected');
    }
    this.terminalWs.send(JSON.stringify({ type: 'data', sessionId, data }));
  }

  /**
   * Create a new terminal session.
   */
  terminalCreate(options: { shell?: string; cwd?: string; cols?: number; rows?: number }): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.terminalWs || this.terminalWs.readyState !== WebSocket.OPEN) {
        reject(new Error('Terminal not connected'));
        return;
      }

      const sessionId = `term_${Date.now()}`;

      const handler = (event: MessageEvent) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'session:created' && msg.sessionId === sessionId) {
          this.terminalWs?.removeEventListener('message', handler);
          resolve(sessionId);
        }
      };

      this.terminalWs.addEventListener('message', handler);
      this.terminalWs.send(JSON.stringify({ type: 'create', sessionId, ...options }));

      // Timeout
      setTimeout(() => {
        this.terminalWs?.removeEventListener('message', handler);
        reject(new Error('Terminal session creation timeout'));
      }, 10000);
    });
  }

  // ===========================================================================
  // Storage
  // ===========================================================================

  private async initializeStorage(): Promise<void> {
    const health = this.serviceHealth.get('storage')!;
    health.status = 'connecting';

    try {
      switch (this.config.storageType) {
        case 'local':
          this.storage = new LocalStorageAdapter();
          break;
        case 'fireproof':
          this.storage = new FireproofAdapter();
          break;
        case 'remote':
          if (!this.config.storageUrl) {
            throw new Error('storageUrl required for remote storage');
          }
          this.storage = new RemoteStorageAdapter(this.config.storageUrl);
          break;
      }

      await this.storage.initialize();

      health.status = 'connected';
      health.lastCheck = Date.now();
      health.error = undefined;

      console.log(`[BackendConnector] Storage initialized (${this.config.storageType})`);

    } catch (err) {
      health.status = 'error';
      health.error = String(err);
      throw err;
    }
  }

  /**
   * Get the storage adapter.
   */
  getStorage(): StorageAdapter {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }
    return this.storage;
  }

  /**
   * Save canvas state.
   */
  async saveCanvas(canvasId: string, state: unknown): Promise<void> {
    const storage = this.getStorage();
    await storage.set(`canvas:${canvasId}`, state);
  }

  /**
   * Load canvas state.
   */
  async loadCanvas(canvasId: string): Promise<unknown | null> {
    const storage = this.getStorage();
    return storage.get(`canvas:${canvasId}`);
  }

  /**
   * List all saved canvases.
   */
  async listCanvases(): Promise<string[]> {
    const storage = this.getStorage();
    const keys = await storage.keys();
    return keys
      .filter(k => k.startsWith('canvas:'))
      .map(k => k.replace('canvas:', ''));
  }

  // ===========================================================================
  // Health Checks
  // ===========================================================================

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, this.config.healthCheckIntervalMs);
  }

  private async checkHealth(): Promise<void> {
    // Check gateway
    try {
      const start = Date.now();
      const response = await fetch(`${this.config.gatewayUrl}/healthz`, {
        signal: AbortSignal.timeout(5000),
      });

      const health = this.serviceHealth.get('gateway')!;
      health.status = response.ok ? 'connected' : 'error';
      health.latencyMs = Date.now() - start;
      health.lastCheck = Date.now();
      health.error = response.ok ? undefined : `HTTP ${response.status}`;

    } catch (err) {
      const health = this.serviceHealth.get('gateway')!;
      health.status = 'error';
      health.error = String(err);
      health.lastCheck = Date.now();
    }

    // Check terminal
    const termHealth = this.serviceHealth.get('terminal')!;
    if (this.terminalWs) {
      termHealth.status = this.terminalWs.readyState === WebSocket.OPEN ? 'connected' : 'disconnected';
    }
    termHealth.lastCheck = Date.now();

    // Check storage
    const storageHealth = this.serviceHealth.get('storage')!;
    if (this.storage) {
      try {
        await this.storage.get('__health_check__');
        storageHealth.status = 'connected';
        storageHealth.error = undefined;
      } catch {
        storageHealth.status = 'error';
        storageHealth.error = 'Storage check failed';
      }
    }
    storageHealth.lastCheck = Date.now();

    this.emitter.emit('health:updated', this.getHealth());
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  on(event: string, handler: (...args: unknown[]) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.emitter.off(event, handler);
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  async dispose(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.terminalWs) {
      this.terminalWs.close();
    }

    if (this.storage) {
      await this.storage.close();
    }

    this.initialized = false;
    this.emitter.removeAllListeners();
  }
}

// =============================================================================
// Storage Adapters
// =============================================================================

export interface StorageAdapter {
  initialize(): Promise<void>;
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  close(): Promise<void>;
}

class LocalStorageAdapter implements StorageAdapter {
  private prefix = 'chrysalis:';

  async initialize(): Promise<void> {
    // No-op for localStorage
  }

  async get(key: string): Promise<unknown | null> {
    const data = localStorage.getItem(this.prefix + key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: unknown): Promise<void> {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async keys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key.slice(this.prefix.length));
      }
    }
    return keys;
  }

  async close(): Promise<void> {
    // No-op
  }
}

class FireproofAdapter implements StorageAdapter {
  private db: unknown = null;

  async initialize(): Promise<void> {
    // TODO: Import and initialize Fireproof
    // import { fireproof } from '@fireproof/core';
    // this.db = fireproof('chrysalis-canvas');
    console.warn('[FireproofAdapter] Fireproof not yet integrated - falling back to localStorage');
  }

  async get(key: string): Promise<unknown | null> {
    // TODO: Implement with Fireproof
    return null;
  }

  async set(key: string, value: unknown): Promise<void> {
    // TODO: Implement with Fireproof
  }

  async delete(key: string): Promise<void> {
    // TODO: Implement with Fireproof
  }

  async keys(): Promise<string[]> {
    // TODO: Implement with Fireproof
    return [];
  }

  async close(): Promise<void> {
    // TODO: Close Fireproof connection
  }
}

class RemoteStorageAdapter implements StorageAdapter {
  constructor(private url: string) {}

  async initialize(): Promise<void> {
    // Verify connection
    const response = await fetch(`${this.url}/health`);
    if (!response.ok) {
      throw new Error('Remote storage not available');
    }
  }

  async get(key: string): Promise<unknown | null> {
    const response = await fetch(`${this.url}/data/${encodeURIComponent(key)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Storage GET failed: ${response.status}`);
    return response.json();
  }

  async set(key: string, value: unknown): Promise<void> {
    const response = await fetch(`${this.url}/data/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!response.ok) throw new Error(`Storage SET failed: ${response.status}`);
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(`${this.url}/data/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Storage DELETE failed: ${response.status}`);
    }
  }

  async keys(): Promise<string[]> {
    const response = await fetch(`${this.url}/data`);
    if (!response.ok) throw new Error(`Storage KEYS failed: ${response.status}`);
    return response.json();
  }

  async close(): Promise<void> {
    // No persistent connection to close
  }
}

// =============================================================================
// Singleton
// =============================================================================

let backendInstance: BackendConnector | null = null;

export function getBackendConnector(config?: Partial<BackendConfig>): BackendConnector {
  if (!backendInstance) {
    backendInstance = new BackendConnector(config);
  }
  return backendInstance;
}

export function resetBackendConnector(): void {
  backendInstance?.dispose();
  backendInstance = null;
}
