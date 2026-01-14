/**
 * Error types for AgentBuilder.
 * @module core/agent-builder/errors
 */

export class AgentBuilderError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'AgentBuilderError';
  }
}
