/**
 * AgentMemoryAdapter
 *
 * TypeScript client for the Rust/Python memory system HTTP API.
 * This is a thin UI adapter that connects the React frontend to the
 * high-performance Rust memory backend.
 *
 * NOTE: Core logic is in Rust (src/native/rust-system-agents/src/memory_adapter.rs)
 * This file is ONLY for UI integration.
 *
 * @module memory/AgentMemoryAdapter
 */

export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: Date;
  agentId: string;
  role?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentMemoryAdapter {
  store(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<MemoryEntry>;
  retrieve(query: string, limit?: number): Promise<MemoryEntry[]>;
  recent(limit?: number, agentId?: string): Promise<MemoryEntry[]>;
  get(id: string): Promise<MemoryEntry | null>;
  delete(id: string): Promise<void>;
  health(): Promise<{ status: string; beadsCount: number }>;

  // Extended search methods for semantic memory
  search(query: string, limit?: number): Promise<MemoryEntry[]>;
  searchEpisodic(query: string, limit?: number): Promise<MemoryEntry[]>;
  searchSemantic(query: string, limit?: number): Promise<MemoryEntry[]>;
  searchSkills(query: string, limit?: number): Promise<MemoryEntry[]>;
}

interface BeadResponse {
  id: string;
  content: string;
  role: string;
  importance: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface HealthResponse {
  status: string;
  beads_count: number;
  version?: string;
}

/**
 * Create an AgentMemoryAdapter connected to the Python/Rust memory API.
 *
 * @param baseUrl - Base URL of the memory API (default: http://localhost:8082)
 */
export function createAgentMemoryAdapter(
  baseUrl: string = 'http://localhost:8082'
): AgentMemoryAdapter {
  const apiCall = async <T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Memory API error: ${response.status} ${text}`);
    }

    return response.json();
  };

  const beadToEntry = (bead: BeadResponse): MemoryEntry => ({
    id: bead.id,
    content: bead.content,
    timestamp: new Date(bead.timestamp * 1000),
    agentId: (bead.metadata?.agent_id as string) || 'unknown',
    role: bead.role,
    importance: bead.importance,
    metadata: bead.metadata,
  });

  return {
    async store(entry): Promise<MemoryEntry> {
      const bead = await apiCall<BeadResponse>('/memories', {
        method: 'POST',
        body: JSON.stringify({
          content: entry.content,
          role: entry.role || 'assistant',
          importance: entry.importance || 0.5,
          agent_id: entry.agentId,
          metadata: entry.metadata,
        }),
      });

      return beadToEntry(bead);
    },

    async retrieve(query: string, limit = 10): Promise<MemoryEntry[]> {
      const beads = await apiCall<BeadResponse[]>('/memories/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit,
          agent_id: 'default',
        }),
      });

      return beads.map(beadToEntry);
    },

    async recent(limit = 20, agentId?: string): Promise<MemoryEntry[]> {
      const params = new URLSearchParams({ limit: String(limit) });
      if (agentId) {
        params.set('agent_id', agentId);
      }

      const beads = await apiCall<BeadResponse[]>(`/memories?${params}`);
      return beads.map(beadToEntry);
    },

    async get(id: string): Promise<MemoryEntry | null> {
      try {
        const bead = await apiCall<BeadResponse>(`/memories/${id}`);
        return beadToEntry(bead);
      } catch (error) {
        if (String(error).includes('404')) {
          return null;
        }
        throw error;
      }
    },

    async delete(id: string): Promise<void> {
      await apiCall(`/memories/${id}`, { method: 'DELETE' });
    },

    async health(): Promise<{ status: string; beadsCount: number }> {
      const response = await apiCall<HealthResponse>('/health');
      return {
        status: response.status,
        beadsCount: response.beads_count,
      };
    },

    async search(query: string, limit = 10): Promise<MemoryEntry[]> {
      return this.retrieve(query, limit);
    },

    async searchEpisodic(query: string, limit = 10): Promise<MemoryEntry[]> {
      const beads = await apiCall<BeadResponse[]>('/memories/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit,
          memory_types: ['episodic'],
        }),
      });
      return beads.map(beadToEntry);
    },

    async searchSemantic(query: string, limit = 10): Promise<MemoryEntry[]> {
      const beads = await apiCall<BeadResponse[]>('/memories/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit,
          memory_types: ['semantic'],
        }),
      });
      return beads.map(beadToEntry);
    },

    async searchSkills(query: string, limit = 10): Promise<MemoryEntry[]> {
      const beads = await apiCall<BeadResponse[]>('/memories/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit,
          memory_types: ['procedural'],
          tags: ['skill'],
        }),
      });
      return beads.map(beadToEntry);
    },
  };
}

export default AgentMemoryAdapter;
