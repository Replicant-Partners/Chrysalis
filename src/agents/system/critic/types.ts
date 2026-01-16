/**
 * Critic Types
 *
 * Minimal OpenHands-lite critic contracts for response evaluation.
 */

import type { CondenserMessage } from '../../../experience/ContextCondenser';
import type { ChatMessage, AgentResponse } from '../SystemAgentChatService';

export interface CriticContext {
  agentId: string;
  userMessage: ChatMessage;
  response: AgentResponse;
  condensedMessages?: CondenserMessage[];
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
