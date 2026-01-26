/**
 * InMemoryAdapter - Local memory adapter that doesn't require external services
 * 
 * This provides a fully functional memory system using browser localStorage
 * for development and testing without requiring the Python/Rust backend.
 */

import type { AgentMemoryAdapter, MemoryEntry } from './AgentMemoryAdapter';

export function createInMemoryAdapter(): AgentMemoryAdapter {
  const STORAGE_KEY = 'chrysalis-memory-beads';
  
  // Load beads from localStorage
  const loadBeads = (): MemoryEntry[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
      const beads = JSON.parse(stored);
      return beads.map((b: any) => ({
        ...b,
        timestamp: new Date(b.timestamp),
      }));
    } catch {
      return [];
    }
  };

  // Save beads to localStorage
  const saveBeads = (beads: MemoryEntry[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(beads));
  };

  // Simple text similarity for search
  const similarity = (a: string, b: string): number => {
    const wordsA = a.toLowerCase().split(/\s+/);
    const wordsB = b.toLowerCase().split(/\s+/);
    const common = wordsA.filter(w => wordsB.includes(w)).length;
    return common / Math.max(wordsA.length, wordsB.length);
  };

  return {
    async store(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<MemoryEntry> {
      const beads = loadBeads();
      const newBead: MemoryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: new Date(),
      };
      beads.push(newBead);
      saveBeads(beads);
      console.log('[InMemoryAdapter] Stored:', newBead.content.slice(0, 50));
      return newBead;
    },

    async retrieve(query: string, limit: number = 5): Promise<MemoryEntry[]> {
      const beads = loadBeads();
      const scored = beads.map(bead => ({
        bead,
        score: similarity(query, bead.content),
      }));
      scored.sort((a, b) => b.score - a.score);
      const results = scored.slice(0, limit).map(s => s.bead);
      console.log('[InMemoryAdapter] Retrieved', results.length, 'beads for query:', query.slice(0, 30));
      return results;
    },

    async recent(limit: number = 10, agentId?: string): Promise<MemoryEntry[]> {
      const beads = loadBeads();
      let filtered = beads;
      if (agentId) {
        filtered = beads.filter(b => b.agentId === agentId);
      }
      filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return filtered.slice(0, limit);
    },

    async get(id: string): Promise<MemoryEntry | null> {
      const beads = loadBeads();
      return beads.find(b => b.id === id) || null;
    },

    async delete(id: string): Promise<void> {
      const beads = loadBeads();
      const filtered = beads.filter(b => b.id !== id);
      saveBeads(filtered);
    },

    async health(): Promise<{ status: string; beadsCount: number }> {
      const beads = loadBeads();
      return {
        status: 'ok',
        beadsCount: beads.length,
      };
    },

    async search(query: string, limit: number = 5): Promise<MemoryEntry[]> {
      return this.retrieve(query, limit);
    },

    async searchEpisodic(query: string, limit: number = 5): Promise<MemoryEntry[]> {
      const beads = loadBeads();
      const episodic = beads.filter(b => b.role === 'user' || b.role === 'assistant');
      const scored = episodic.map(bead => ({
        bead,
        score: similarity(query, bead.content),
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, limit).map(s => s.bead);
    },

    async searchSemantic(query: string, limit: number = 5): Promise<MemoryEntry[]> {
      const beads = loadBeads();
      const semantic = beads.filter(b => b.role === 'system' || b.metadata?.type === 'semantic');
      const scored = semantic.map(bead => ({
        bead,
        score: similarity(query, bead.content),
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, limit).map(s => s.bead);
    },

    async searchSkills(query: string, limit: number = 5): Promise<MemoryEntry[]> {
      const beads = loadBeads();
      const skills = beads.filter(b => b.metadata?.type === 'skill');
      const scored = skills.map(bead => ({
        bead,
        score: similarity(query, bead.content),
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, limit).map(s => s.bead);
    },
  };
}

export default createInMemoryAdapter;
