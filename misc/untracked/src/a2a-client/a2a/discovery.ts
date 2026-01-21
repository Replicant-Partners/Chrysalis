/**
 * Agent Discovery
 * 
 * Agent card fetching and validation.
 * 
 * @module a2a-client/a2a/discovery
 */

import { AgentCard, A2A_ERROR_CODES } from '../types';
import { A2AError } from './error';

export interface DiscoveryConfig {
  timeout?: number;
  retryEnabled?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export async function fetchAgentCard(
  url: string,
  fetchFn: (url: string, options: RequestInit) => Promise<Response>
): Promise<AgentCard> {
  const cardUrl = url.endsWith('.json') 
    ? url 
    : `${url.replace(/\/$/, '')}/.well-known/agent.json`;
  
  const response = await fetchFn(cardUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new A2AError(
      A2A_ERROR_CODES.INVALID_AGENT_CARD,
      `Failed to fetch agent card: ${response.status}`
    );
  }
  
  return response.json() as Promise<AgentCard>;
}

export function validateAgentCard(card: AgentCard): void {
  if (!card.name) {
    throw new A2AError(A2A_ERROR_CODES.INVALID_AGENT_CARD, 'Agent card missing name');
  }
  
  if (!card.url) {
    throw new A2AError(A2A_ERROR_CODES.INVALID_AGENT_CARD, 'Agent card missing url');
  }
  
  try {
    new URL(card.url);
  } catch {
    throw new A2AError(A2A_ERROR_CODES.INVALID_AGENT_CARD, 'Agent card has invalid url');
  }
}
