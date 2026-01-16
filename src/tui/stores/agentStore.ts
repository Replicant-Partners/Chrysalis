/**
 * Agent Store (Zustand)
 *
 * Manages agent state in the TUI.
 *
 * @module tui/stores/agentStore
 */

import { create } from 'zustand';
import type { Agent, AgentStatus, AgentStats, AgentHandoff } from '../types/agents';
import { DEFAULT_AGENTS } from '../types/agents';

/**
 * Agent store state
 */
interface AgentState {
  /** All registered agents */
  agents: Record<string, Agent>;

  /** Currently focused agent ID */
  focusedAgentId: string | null;

  /** Active agent ID (currently responding) */
  activeAgentId: string | null;

  /** Agent statistics */
  stats: Record<string, AgentStats>;

  /** Recent handoffs */
  handoffs: AgentHandoff[];
}

/**
 * Agent store actions
 */
interface AgentActions {
  /** Set all agents */
  setAgents: (agents: Agent[]) => void;

  /** Add or update an agent */
  upsertAgent: (agent: Agent) => void;

  /** Remove an agent */
  removeAgent: (agentId: string) => void;

  /** Set agent status */
  setAgentStatus: (agentId: string, status: AgentStatus, task?: string) => void;

  /** Set focused agent */
  setFocusedAgent: (agentId: string | null) => void;

  /** Set active agent */
  setActiveAgent: (agentId: string | null) => void;

  /** Record agent handoff */
  recordHandoff: (handoff: Omit<AgentHandoff, 'timestamp'>) => void;

  /** Update agent stats */
  updateStats: (agentId: string, update: Partial<AgentStats>) => void;

  /** Get agent by ID */
  getAgent: (agentId: string) => Agent | undefined;

  /** Get all agents as array */
  getAgentList: () => Agent[];

  /** Get active agent */
  getActiveAgent: () => Agent | undefined;
}

/**
 * Combined store type
 */
type AgentStore = AgentState & AgentActions;

/**
 * Initialize default agents as record
 */
function initializeAgents(): Record<string, Agent> {
  const record: Record<string, Agent> = {};
  for (const agent of DEFAULT_AGENTS) {
    record[agent.id] = agent;
  }
  return record;
}

/**
 * Initialize empty stats
 */
function createEmptyStats(): AgentStats {
  return {
    messageCount: 0,
    totalTokens: 0,
    totalCost: 0,
    avgResponseTime: 0,
    toolCalls: 0,
  };
}

/**
 * Create agent store
 */
export const useAgentStore = create<AgentStore>((set, get) => ({
  // Initial state
  agents: initializeAgents(),
  focusedAgentId: null,
  activeAgentId: null,
  stats: {},
  handoffs: [],

  // Actions
  setAgents: (agents) => {
    const record: Record<string, Agent> = {};
    for (const agent of agents) {
      record[agent.id] = agent;
    }
    set({ agents: record });
  },

  upsertAgent: (agent) => {
    set((state) => ({
      agents: {
        ...state.agents,
        [agent.id]: agent,
      },
    }));
  },

  removeAgent: (agentId) => {
    set((state) => {
      const { [agentId]: removed, ...remaining } = state.agents;
      return { agents: remaining };
    });
  },

  setAgentStatus: (agentId, status, task) => {
    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: state.agents[agentId]
          ? {
              ...state.agents[agentId],
              status,
              currentTask: task,
              lastActive: new Date(),
            }
          : state.agents[agentId],
      },
    }));
  },

  setFocusedAgent: (agentId) => {
    set({ focusedAgentId: agentId });
  },

  setActiveAgent: (agentId) => {
    set({ activeAgentId: agentId });
  },

  recordHandoff: (handoff) => {
    const fullHandoff: AgentHandoff = {
      ...handoff,
      timestamp: new Date(),
    };

    set((state) => ({
      handoffs: [...state.handoffs.slice(-10), fullHandoff], // Keep last 10
    }));
  },

  updateStats: (agentId, update) => {
    set((state) => ({
      stats: {
        ...state.stats,
        [agentId]: {
          ...(state.stats[agentId] || createEmptyStats()),
          ...update,
        },
      },
    }));
  },

  getAgent: (agentId) => {
    return get().agents[agentId];
  },

  getAgentList: () => {
    return Object.values(get().agents);
  },

  getActiveAgent: () => {
    const { activeAgentId, agents } = get();
    return activeAgentId ? agents[activeAgentId] : undefined;
  },
}));

export type { AgentStore };
