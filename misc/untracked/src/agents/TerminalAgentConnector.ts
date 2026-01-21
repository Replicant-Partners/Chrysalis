class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} is not implemented in stub TerminalAgentConnector`);
    this.name = 'NotImplementedError';
  }
}

/**
 * Lean stub for TerminalAgentConnector.
 * All methods throw NotImplementedError.
 */
export class TerminalAgentConnector {
  constructor() {}

  connect(): void {
    throw new NotImplementedError('connect');
  }

  disconnect(): void {
    throw new NotImplementedError('disconnect');
  }

  sendCommand(_command: string): void {
    throw new NotImplementedError('sendCommand');
  }

  getStatus(): string {
    throw new NotImplementedError('getStatus');
  }
}
