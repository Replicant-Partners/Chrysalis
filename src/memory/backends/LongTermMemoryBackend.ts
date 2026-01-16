/**
 * Long-Term Memory Backend - Pluggable Interface
 *
 * Chrysalis Memory Architecture:
 *
 *   ┌─── FIXED CHRYSALIS LAYERS (per agent) ─────────────────────┐
 *   │  Beads → Fireproof (Local CRDT) → Byzantine → Nomic       │
 *   └─────────────────────────────────────────────────────────────┘
 *                                │
 *                                ▼ Syncs to (when online)
 *   ┌─── PLUGGABLE LONG-TERM BACKEND ────────────────────────────┐
 *   │  [ Zep ] | [ Letta ] | [ Mem0 ] | [ Native ]              │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Strategic Roles:
 * - Beads: Short-term context buffer (local, fast, TTL-based)
 * - Fireproof: Durable local cache + sync buffer
 *   - Local-first (works offline)
 *   - CRDT merge for concurrent LOCAL operations
 *   - Sync queue to long-term backend
 * - Nomic: Calibration check + offline fallback when disconnected
 * - Long-term: Remote persistent storage + MULTI-AGENT SYNC
 *   - This is where agents actually share memories (cloud-mediated)
 *
 * Philosophy:
 * - Fireproof provides offline resilience and local durability
 * - Long-term backends (Zep/Letta/Mem0) handle multi-agent sync
 * - Agents push to cloud, retrieve from cloud → shared memory
 * - System works fully offline, syncs when reconnected
 *
 * @module memory/backends/LongTermMemoryBackend
 */

import { EventEmitter } from 'events';

// =============================================================================
// Core Types
// =============================================================================

/**
 * Long-term memory backend types
 */
export type LongTermBackendType =
  | 'zep'        // Zep: fact extraction, entity tracking, session summaries
  | 'letta'      // Letta: memory blocks (persona/human/project), skill learning
  | 'mem0'       // Mem0: user/session/agent memory, graph memory, +26% accuracy
  | 'native';    // Chrysalis: distributed, Byzantine-validated

/**
 * Standardized long-term memory entry
 *
 * This is what gets promoted FROM Fireproof TO the long-term backend.
 * Each backend translates this to their native format.
 */
export interface LongTermMemoryEntry {
  id: string;
  content: string;
  embedding?: number[];
  importance: number;
  timestamp: number;
  source: 'bead_promotion' | 'direct_store' | 'skill_learning' | 'fact_extraction';
  userId?: string;
  sessionId?: string;
  agentId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Search result from long-term backend
 */
export interface LongTermSearchResult {
  entries: LongTermMemoryEntry[];
  scores: number[];
  backend: LongTermBackendType;
  queryTimeMs: number;
}

/**
 * Backend-specific capabilities
 */
export interface LongTermBackendCapabilities {
  supportsGraph: boolean;          // Mem0: Kuzu/Memgraph graph memory
  supportsBlocks: boolean;         // Letta: persona/human/project blocks
  supportsFacts: boolean;          // Zep: automatic fact extraction
  supportsEntities: boolean;       // Zep: entity tracking
  supportsSkillLearning: boolean;  // Letta: /skill command
  supportsReranking: boolean;      // Mem0: reranker layer
  maxStorageBytes?: number;
}

/**
 * Long-term memory backend interface
 *
 * All backends implement this. Beads/Fireproof call these methods.
 */
export interface LongTermMemoryBackend {
  readonly type: LongTermBackendType;
  readonly capabilities: LongTermBackendCapabilities;

  // Lifecycle
  initialize(): Promise<boolean>;
  dispose(): Promise<void>;
  isConnected(): boolean;

  // Core operations (called by Fireproof promotion)
  store(entry: Omit<LongTermMemoryEntry, 'id'>): Promise<LongTermMemoryEntry>;
  retrieve(id: string): Promise<LongTermMemoryEntry | null>;
  search(query: string, options?: SearchOptions): Promise<LongTermSearchResult>;
  update(id: string, updates: Partial<LongTermMemoryEntry>): Promise<boolean>;
  delete(id: string): Promise<boolean>;

  // Batch operations
  storeBatch(entries: Omit<LongTermMemoryEntry, 'id'>[]): Promise<LongTermMemoryEntry[]>;

  // Backend-specific state (for debugging/observability)
  getBackendState(): Record<string, unknown>;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  userId?: string;
  sessionId?: string;
  agentId?: string;
  minImportance?: number;
  tags?: string[];
}

// =============================================================================
// Zep Backend (Already Integrated)
// =============================================================================

/**
 * Zep long-term memory backend
 *
 * Connects to existing FireproofZepSync.
 */
export class ZepLongTermBackend implements LongTermMemoryBackend {
  readonly type: LongTermBackendType = 'zep';
  readonly capabilities: LongTermBackendCapabilities = {
    supportsGraph: false,
    supportsBlocks: false,
    supportsFacts: true,
    supportsEntities: true,
    supportsSkillLearning: false,
    supportsReranking: false,
  };

  private apiKey: string;
  private baseUrl: string;
  private connected = false;

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || process.env.ZEP_API_KEY || '';
    this.baseUrl = config?.baseUrl || process.env.ZEP_API_URL || 'https://api.getzep.com';
  }

  async initialize(): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('[ZepBackend] No ZEP_API_KEY configured');
      return false;
    }
    // Verify connection
    try {
      const response = await fetch(`${this.baseUrl}/healthz`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      this.connected = response.ok;
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async store(entry: Omit<LongTermMemoryEntry, 'id'>): Promise<LongTermMemoryEntry> {
    const id = `zep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Store as Zep memory
    await fetch(`${this.baseUrl}/api/v2/memory`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: entry.sessionId || 'default',
        messages: [{
          role: 'system',
          content: entry.content,
          metadata: entry.metadata,
        }],
      }),
    });

    return { ...entry, id };
  }

  async retrieve(id: string): Promise<LongTermMemoryEntry | null> {
    // Zep retrieves by session, not individual memory ID
    return null;
  }

  async search(query: string, options?: SearchOptions): Promise<LongTermSearchResult> {
    const start = Date.now();

    const response = await fetch(`${this.baseUrl}/api/v2/memory/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: query,
        search_type: 'similarity',
        limit: options?.limit || 10,
      }),
    });

    const data = await response.json();
    const results = data.results || [];

    return {
      entries: results.map((r: { message?: { content?: string }; score?: number }) => ({
        id: `zep-${Date.now()}`,
        content: r.message?.content || '',
        importance: r.score || 0.5,
        timestamp: Date.now(),
        source: 'direct_store' as const,
      })),
      scores: results.map((r: { score?: number }) => r.score || 0),
      backend: 'zep',
      queryTimeMs: Date.now() - start,
    };
  }

  async update(id: string, updates: Partial<LongTermMemoryEntry>): Promise<boolean> {
    // Zep doesn't support individual memory updates
    return false;
  }

  async delete(id: string): Promise<boolean> {
    // Zep doesn't support individual memory deletion
    return false;
  }

  async storeBatch(entries: Omit<LongTermMemoryEntry, 'id'>[]): Promise<LongTermMemoryEntry[]> {
    const results: LongTermMemoryEntry[] = [];
    for (const entry of entries) {
      results.push(await this.store(entry));
    }
    return results;
  }

  getBackendState(): Record<string, unknown> {
    return {
      type: this.type,
      connected: this.connected,
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
    };
  }
}

// =============================================================================
// Mem0 Backend (NEW)
// =============================================================================

/**
 * Mem0 long-term memory backend
 *
 * Key advantages:
 * - +26% accuracy over OpenAI Memory (LOCOMO benchmark)
 * - 91% faster than full-context
 * - 90% fewer tokens
 * - Graph memory (Kuzu, Memgraph)
 * - Reranker layer
 */
export class Mem0LongTermBackend implements LongTermMemoryBackend {
  readonly type: LongTermBackendType = 'mem0';
  readonly capabilities: LongTermBackendCapabilities = {
    supportsGraph: true,
    supportsBlocks: false,
    supportsFacts: false,
    supportsEntities: false,
    supportsSkillLearning: false,
    supportsReranking: true,
  };

  private apiKey: string;
  private baseUrl: string;
  private connected = false;

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || process.env.MEM0_API_KEY || '';
    this.baseUrl = config?.baseUrl || process.env.MEM0_API_URL || 'https://api.mem0.ai';
  }

  async initialize(): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('[Mem0Backend] No MEM0_API_KEY configured');
      return false;
    }

    try {
      // Verify connection with a simple request
      const response = await fetch(`${this.baseUrl}/v1/memories`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      this.connected = response.ok;
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async store(entry: Omit<LongTermMemoryEntry, 'id'>): Promise<LongTermMemoryEntry> {
    const response = await fetch(`${this.baseUrl}/v1/memories`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: entry.content }],
        user_id: entry.userId || 'default',
        metadata: {
          ...entry.metadata,
          importance: entry.importance,
          source: entry.source,
          chrysalis_timestamp: entry.timestamp,
        },
      }),
    });

    const data = await response.json();
    const id = data.results?.[0]?.id || `mem0-${Date.now()}`;

    return { ...entry, id };
  }

  async retrieve(id: string): Promise<LongTermMemoryEntry | null> {
    const response = await fetch(`${this.baseUrl}/v1/memories/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      id: data.id,
      content: data.memory || '',
      importance: data.metadata?.importance || 0.5,
      timestamp: data.metadata?.chrysalis_timestamp || Date.now(),
      source: data.metadata?.source || 'direct_store',
      userId: data.user_id,
      metadata: data.metadata,
    };
  }

  async search(query: string, options?: SearchOptions): Promise<LongTermSearchResult> {
    const start = Date.now();

    const response = await fetch(`${this.baseUrl}/v1/memories/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        user_id: options?.userId || 'default',
        limit: options?.limit || 10,
      }),
    });

    const data = await response.json();
    const results = data.results || [];

    return {
      entries: results.map((r: { id?: string; memory?: string; score?: number; metadata?: Record<string, unknown> }) => ({
        id: r.id || `mem0-${Date.now()}`,
        content: r.memory || '',
        importance: r.metadata?.importance as number || 0.5,
        timestamp: r.metadata?.chrysalis_timestamp as number || Date.now(),
        source: (r.metadata?.source as LongTermMemoryEntry['source']) || 'direct_store',
        metadata: r.metadata,
      })),
      scores: results.map((r: { score?: number }) => r.score || 0),
      backend: 'mem0',
      queryTimeMs: Date.now() - start,
    };
  }

  async update(id: string, updates: Partial<LongTermMemoryEntry>): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/v1/memories/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        memory: updates.content,
        metadata: updates.metadata,
      }),
    });

    return response.ok;
  }

  async delete(id: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/v1/memories/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  }

  async storeBatch(entries: Omit<LongTermMemoryEntry, 'id'>[]): Promise<LongTermMemoryEntry[]> {
    // Mem0 supports batch through messages array
    const response = await fetch(`${this.baseUrl}/v1/memories`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: entries.map(e => ({ role: 'user', content: e.content })),
        user_id: entries[0]?.userId || 'default',
        metadata: { batch: true, count: entries.length },
      }),
    });

    const data = await response.json();
    const results = data.results || [];

    return entries.map((entry, i) => ({
      ...entry,
      id: results[i]?.id || `mem0-${Date.now()}-${i}`,
    }));
  }

  getBackendState(): Record<string, unknown> {
    return {
      type: this.type,
      connected: this.connected,
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
      capabilities: this.capabilities,
    };
  }
}

// =============================================================================
// Letta Backend (Simplified - Long-term only)
// =============================================================================

/**
 * Letta long-term memory backend
 *
 * Note: This is a SIMPLIFIED version that only handles long-term storage.
 * The full LettaMemoryAdapter in ../adapters/ provides complete agent integration.
 */
export class LettaLongTermBackend implements LongTermMemoryBackend {
  readonly type: LongTermBackendType = 'letta';
  readonly capabilities: LongTermBackendCapabilities = {
    supportsGraph: false,
    supportsBlocks: true,
    supportsFacts: false,
    supportsEntities: false,
    supportsSkillLearning: true,
    supportsReranking: false,
  };

  private apiKey: string;
  private baseUrl: string;
  private agentId: string | null = null;
  private connected = false;

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || process.env.LETTA_API_KEY || '';
    this.baseUrl = config?.baseUrl || process.env.LETTA_BASE_URL || 'https://api.letta.com';
  }

  async initialize(): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('[LettaBackend] No LETTA_API_KEY configured');
      return false;
    }

    try {
      // List agents to verify connection
      const response = await fetch(`${this.baseUrl}/v1/agents`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      this.connected = response.ok;

      if (response.ok) {
        const agents = await response.json();
        // Use first agent or create one
        this.agentId = agents[0]?.id || null;
      }

      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async store(entry: Omit<LongTermMemoryEntry, 'id'>): Promise<LongTermMemoryEntry> {
    if (!this.agentId) {
      throw new Error('No Letta agent available');
    }

    // Store as archival memory in Letta
    const response = await fetch(`${this.baseUrl}/v1/agents/${this.agentId}/archival`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: entry.content,
        metadata: {
          importance: entry.importance,
          source: entry.source,
          chrysalis_timestamp: entry.timestamp,
          ...entry.metadata,
        },
      }),
    });

    const data = await response.json();
    return { ...entry, id: data.id || `letta-${Date.now()}` };
  }

  async retrieve(id: string): Promise<LongTermMemoryEntry | null> {
    // Letta archival retrieval by ID not directly supported
    return null;
  }

  async search(query: string, options?: SearchOptions): Promise<LongTermSearchResult> {
    if (!this.agentId) {
      return { entries: [], scores: [], backend: 'letta', queryTimeMs: 0 };
    }

    const start = Date.now();

    const response = await fetch(
      `${this.baseUrl}/v1/agents/${this.agentId}/archival?query=${encodeURIComponent(query)}&limit=${options?.limit || 10}`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      }
    );

    const data = await response.json();
    const passages = data.passages || [];

    return {
      entries: passages.map((p: { id?: string; text?: string; metadata?: Record<string, unknown> }) => ({
        id: p.id || `letta-${Date.now()}`,
        content: p.text || '',
        importance: (p.metadata?.importance as number) || 0.5,
        timestamp: (p.metadata?.chrysalis_timestamp as number) || Date.now(),
        source: (p.metadata?.source as LongTermMemoryEntry['source']) || 'direct_store',
        metadata: p.metadata,
      })),
      scores: passages.map(() => 1.0), // Letta doesn't return scores
      backend: 'letta',
      queryTimeMs: Date.now() - start,
    };
  }

  async update(id: string, updates: Partial<LongTermMemoryEntry>): Promise<boolean> {
    // Letta archival update not directly supported
    return false;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.agentId) return false;

    const response = await fetch(
      `${this.baseUrl}/v1/agents/${this.agentId}/archival/${id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.apiKey}` },
      }
    );

    return response.ok;
  }

  async storeBatch(entries: Omit<LongTermMemoryEntry, 'id'>[]): Promise<LongTermMemoryEntry[]> {
    const results: LongTermMemoryEntry[] = [];
    for (const entry of entries) {
      results.push(await this.store(entry));
    }
    return results;
  }

  getBackendState(): Record<string, unknown> {
    return {
      type: this.type,
      connected: this.connected,
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
      agentId: this.agentId,
      capabilities: this.capabilities,
    };
  }
}

// =============================================================================
// Backend Registry & Factory
// =============================================================================

/**
 * Registry of available long-term backends
 */
class LongTermBackendRegistry extends EventEmitter {
  private factories = new Map<LongTermBackendType, () => LongTermMemoryBackend>();
  private activeBackend: LongTermMemoryBackend | null = null;

  constructor() {
    super();
    // Register default backends
    this.register('zep', () => new ZepLongTermBackend());
    this.register('mem0', () => new Mem0LongTermBackend());
    this.register('letta', () => new LettaLongTermBackend());
  }

  /**
   * Register a backend factory
   */
  register(type: LongTermBackendType, factory: () => LongTermMemoryBackend): void {
    this.factories.set(type, factory);
    this.emit('backend:registered', { type });
  }

  /**
   * Get available backend types
   */
  getAvailableBackends(): LongTermBackendType[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Create and initialize a backend
   */
  async create(type: LongTermBackendType): Promise<LongTermMemoryBackend> {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Long-term backend not registered: ${type}`);
    }

    const backend = factory();
    await backend.initialize();
    return backend;
  }

  /**
   * Get or create the active backend
   */
  async getActiveBackend(type: LongTermBackendType): Promise<LongTermMemoryBackend> {
    if (this.activeBackend && this.activeBackend.type === type && this.activeBackend.isConnected()) {
      return this.activeBackend;
    }

    if (this.activeBackend) {
      await this.activeBackend.dispose();
    }

    this.activeBackend = await this.create(type);
    this.emit('backend:activated', { type });
    return this.activeBackend;
  }

  /**
   * Dispose active backend
   */
  async dispose(): Promise<void> {
    if (this.activeBackend) {
      await this.activeBackend.dispose();
      this.activeBackend = null;
    }
  }
}

// Global registry singleton
export const longTermBackendRegistry = new LongTermBackendRegistry();

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Quick setup for a specific backend
 */
export async function setupLongTermBackend(
  type: LongTermBackendType
): Promise<LongTermMemoryBackend> {
  return longTermBackendRegistry.getActiveBackend(type);
}

/**
 * Get the recommended backend based on available API keys
 */
export function detectAvailableBackend(): LongTermBackendType {
  if (process.env.MEM0_API_KEY) return 'mem0';
  if (process.env.LETTA_API_KEY) return 'letta';
  if (process.env.ZEP_API_KEY) return 'zep';
  return 'native';
}
