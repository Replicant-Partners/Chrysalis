/**
 * Critic Types
 *
 * Minimal OpenHands-lite critic contracts for response evaluation.
 */

export interface CriticContext {
  agentId: string;
  userMessage: {
    role: string;
    content: string;
  };
  response: {
    content: string;
    agentId: string;
  };
  condensedMessages?: Array<{ role: string; content: string }>;
  stuckDetected?: boolean;
  intentType?: string;
}

export interface CriticResult {
  score: number;
  verdict: 'pass' | 'revise' | 'reject';
  message: string;
  suggestions: string[];
  criticId: string;
}
