import { AgentCanvasState, CanvasAgent, AgentLayout, AgentPosition, AgentState, AgentCanvasMetadata } from './common-types';

/**
 * Lean AgentCanvasManager (in-memory, non-YJS) for compatibility.
 */
export class AgentCanvasManager {
  private state: AgentCanvasState;

  constructor(canvasId: string, createdBy: string) {
    const now = Date.now();
    this.state = {
      id: canvasId,
      metadata: {
        id: canvasId,
        name: 'Agent Canvas',
        createdAt: now,
        updatedAt: now,
        createdBy
      },
      agents: [],
      layouts: {}
    };
  }

  getState(): AgentCanvasState {
    return this.state;
  }

  addAgent(agent: CanvasAgent): void {
    this.state.agents.push(agent);
    this.state.layouts[agent.id] = {
      agentId: agent.id,
      position: agent.position,
      collapsed: false,
      selected: false,
      pinned: false,
      updatedAt: Date.now()
    };
    this.state.metadata.updatedAt = Date.now();
  }

  getAgent(agentId: string): CanvasAgent | undefined {
    return this.state.agents.find(a => a.id === agentId);
  }

  updateAgent(agentId: string, updates: Partial<CanvasAgent>): void {
    const agent = this.getAgent(agentId);
    if (!agent) return;
    Object.assign(agent, updates, { updatedAt: Date.now() });
    this.state.metadata.updatedAt = Date.now();
  }

  moveAgent(agentId: string, position: Partial<AgentPosition>): void {
    const layout = this.state.layouts[agentId];
    if (!layout) return;
    layout.position = { ...layout.position, ...position };
    layout.updatedAt = Date.now();
    this.state.metadata.updatedAt = Date.now();
  }

  setAgentState(agentId: string, state: AgentState): void {
    this.updateAgent(agentId, { state });
  }

  selectAgent(agentId: string | undefined): void {
    this.state.selectedAgentId = agentId;
  }
}

export function createAgentCanvasManager(canvasId: string, createdBy: string): AgentCanvasManager {
  return new AgentCanvasManager(canvasId, createdBy);
}
