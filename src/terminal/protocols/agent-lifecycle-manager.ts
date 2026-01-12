import { AgentCanvasManager } from './agent-canvas-manager';

/**
 * Placeholder lifecycle manager for lean mode.
 */
export class AgentLifecycleManager {
  constructor(private canvas: AgentCanvasManager) {}

  wakeAgent(agentId: string): void {
    this.canvas.setAgentState(agentId, 'awake');
  }

  sleepAgent(agentId: string): void {
    this.canvas.setAgentState(agentId, 'dormant');
  }
}

export function createAgentLifecycleManager(canvas: AgentCanvasManager): AgentLifecycleManager {
  return new AgentLifecycleManager(canvas);
}
