/**
 * AgentMemoryAdapter
 *
 * TypeScript client for the Python memory system HTTP API.
 * Provides a simple interface for storing and retrieving agent memories (beads).
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
  version: string;
}

/**
 * Create an AgentMemoryAdapter connected to the Python memory API.
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
      const bead = await apiCall<BeadResponse>('/beads', {
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
      const beads = await apiCall<BeadResponse[]>('/beads/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit,
          namespace: 'default',
        }),
      });

      return beads.map(beadToEntry);
    },

    async recent(limit = 20, agentId?: string): Promise<MemoryEntry[]> {
      const params = new URLSearchParams({ limit: String(limit) });
      if (agentId) {
        params.set('agent_id', agentId);
      }

      const beads = await apiCall<BeadResponse[]>(`/beads?${params}`);
      return beads.map(beadToEntry);
    },

    async get(id: string): Promise<MemoryEntry | null> {
      try {
        const bead = await apiCall<BeadResponse>(`/beads/${id}`);
        return beadToEntry(bead);
      } catch (error) {
        if (String(error).includes('404')) {
          return null;
        }
        throw error;
      }
    },

    async delete(id: string): Promise<void> {
      await apiCall(`/beads/${id}`, { method: 'DELETE' });
    },

    async health(): Promise<{ status: string; beadsCount: number }> {
      const response = await apiCall<HealthResponse>('/health');
      return {
        status: response.status,
        beadsCount: response.beads_count,
      };
    },
  };
}

export default AgentMemoryAdapter;
