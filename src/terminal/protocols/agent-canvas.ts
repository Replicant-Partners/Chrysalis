import {
  AgentCanvasState,
  AgentCanvasMetadata,
  CanvasAgent,
  AgentSpecSummary,
  AgentState,
  AgentPosition,
  AgentLayout
} from './common-types';

// Re-export lean types for compatibility with existing imports.
export {
  AgentCanvasState,
  AgentCanvasMetadata,
  CanvasAgent,
  AgentSpecSummary,
  AgentState,
  AgentPosition,
  AgentLayout
};

export const AGENT_CANVAS_CONSTANTS = {
  MAX_AGENTS: 50
};

export function createCanvasAgent(spec: AgentSpecSummary, position: AgentPosition, state: AgentState = 'dormant'): CanvasAgent {
  const now = Date.now();
  return {
    id: `agent-${now}`,
    spec,
    state,
    position,
    createdAt: now,
    updatedAt: now
  };
}

export function isCanvasAgent(obj: unknown): obj is CanvasAgent {
  return typeof obj === 'object' && obj !== null && 'spec' in obj && 'state' in obj && 'position' in obj;
}
