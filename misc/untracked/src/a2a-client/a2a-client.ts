/**
 * A2A (Agent-to-Agent) Client Implementation
 * 
 * Client for communicating with A2A-compliant agents.
 * Supports task submission, streaming, and push notifications.
 * 
 * @module a2a-client/a2a-client
 * @version 1.1.0
 * @see https://google.github.io/A2A/
 * 
 * This file is a facade that re-exports from decomposed modules.
 * See ./a2a/ for the modular implementation.
 */

export {
  A2AClient,
  createA2AClient,
  connectToAgent
} from './a2a/client';

export { A2AError } from './a2a/error';

export {
  createTextMessage,
  createFileMessage,
  createDataMessage,
  createTextInput,
  extractText,
  extractData
} from './a2a/messages';

export {
  fetchAgentCard,
  validateAgentCard
} from './a2a/discovery';

export {
  SessionManager,
  type SessionStats,
  type SessionManagerEvents
} from './a2a/session';

export {
  RpcClient,
  type RpcConfig,
  type RpcStats,
  type RpcEvents
} from './a2a/rpc';

export {
  MAX_SESSIONS,
  SESSION_TTL_MS,
  CLEANUP_INTERVAL_MS
} from './a2a/constants';

import { A2AClient } from './a2a/client';
export default A2AClient;
