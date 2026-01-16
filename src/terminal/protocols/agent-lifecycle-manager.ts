import { AgentCanvasManager } from './agent-canvas-manager';

class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} is not implemented in placeholder AgentLifecycleManager`);
    this.name = 'NotImplementedError';
  }
}

/**
 * Placeholder lifecycle manager for lean mode.
 * All methods throw NotImplementedError.
 */
export class AgentLifecycleManager {
  constructor(private canvas: AgentCanvasManager) {}

  wakeAgent(_agentId: string): void {
    throw new NotImplementedError('wakeAgent');
  }

  sleepAgent(_agentId: string): void {
    throw new NotImplementedError('sleepAgent');
  }
}

export function createAgentLifecycleManager(canvas: AgentCanvasManager): AgentLifecycleManager {
  return new AgentLifecycleManager(canvas);
}
