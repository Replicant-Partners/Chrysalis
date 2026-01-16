class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} is not implemented in stub AgentChatIntegration`);
    this.name = 'NotImplementedError';
  }
}

/**
 * Lean stub for AgentChatIntegration: chat operations are handled by AgentTerminalClient/ChrysalisTerminal.
 * All methods throw NotImplementedError.
 */
export class AgentChatIntegration {
  constructor() {}

  sendMessage(_message: string): void {
    throw new NotImplementedError('sendMessage');
  }

  receiveMessage(): string {
    throw new NotImplementedError('receiveMessage');
  }

  connect(): void {
    throw new NotImplementedError('connect');
  }

  disconnect(): void {
    throw new NotImplementedError('disconnect');
  }
}
