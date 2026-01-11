/**
 * A2A Client Module - Agent-to-Agent Protocol Client
 * 
 * This module provides a complete client implementation for Google's
 * Agent-to-Agent (A2A) protocol, enabling multi-agent communication
 * and task delegation in the Chrysalis ecosystem.
 * 
 * @module a2a-client
 * 
 * @example Basic Usage
 * ```typescript
 * import { A2AClient, createA2AClient, connectToAgent } from './a2a-client';
 * 
 * // Create and connect to an agent
 * const client = await connectToAgent(
 *   'https://agent.example.com/.well-known/agent.json',
 *   { scheme: 'Bearer', token: 'your-token' }
 * );
 * 
 * // Send a task
 * const task = await client.sendTask({
 *   input: {
 *     message: {
 *       role: 'user',
 *       parts: [{ type: 'text', text: 'Hello, agent!' }]
 *     }
 *   }
 * });
 * 
 * // Wait for completion
 * const completed = await client.waitForCompletion(task.id);
 * console.log('Task completed:', completed.status.state);
 * ```
 * 
 * @example Streaming Responses
 * ```typescript
 * import { A2AClient, A2AClientConfig } from './a2a-client';
 * 
 * const client = new A2AClient({
 *   agentCard: 'https://agent.example.com/.well-known/agent.json'
 * });
 * 
 * await client.connect();
 * 
 * // Stream task responses
 * for await (const event of client.sendTaskStream({
 *   input: {
 *     message: {
 *       role: 'user',
 *       parts: [{ type: 'text', text: 'Generate a story' }]
 *     }
 *   }
 * })) {
 *   switch (event.type) {
 *     case 'task.status':
 *       console.log('Status:', event.status.state);
 *       break;
 *     case 'task.artifact':
 *       console.log('Artifact:', event.artifact);
 *       break;
 *     case 'task.output':
 *       console.log('Output:', event.delta);
 *       break;
 *     case 'done':
 *       console.log('Stream complete');
 *       break;
 *   }
 * }
 * ```
 * 
 * @example Multi-Agent Orchestration
 * ```typescript
 * import { A2AClient } from './a2a-client';
 * 
 * // Connect to multiple agents
 * const researchAgent = new A2AClient({ agentCard: 'https://research.example.com/agent.json' });
 * const writerAgent = new A2AClient({ agentCard: 'https://writer.example.com/agent.json' });
 * 
 * await Promise.all([researchAgent.connect(), writerAgent.connect()]);
 * 
 * // Orchestrate task delegation
 * const researchTask = await researchAgent.sendTask({
 *   input: { 
 *     message: A2AClient.createTextMessage('Research quantum computing') 
 *   }
 * });
 * 
 * const researchResult = await researchAgent.waitForCompletion(researchTask.id);
 * 
 * // Pass results to another agent
 * const writeTask = await writerAgent.sendTask({
 *   input: {
 *     message: A2AClient.createTextMessage(`Write an article based on: ${JSON.stringify(researchResult)}`)
 *   }
 * });
 * 
 * const article = await writerAgent.waitForCompletion(writeTask.id);
 * ```
 */

// ============================================================================
// Core Client
// ============================================================================

export {
  A2AClient,
  A2AError,
  createA2AClient,
  connectToAgent
} from './a2a-client';

// Re-export A2A_ERROR_CODES from types
export { A2A_ERROR_CODES } from './types';

// ============================================================================
// Type Definitions
// ============================================================================

// JSON-RPC Types
export type {
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError
} from './types';

// Agent Card Types
export type {
  AgentCard,
  AgentCapabilities,
  AgentSkill,
  AuthenticationInfo,
  AuthScheme,
  AgentProvider,
  SkillExample
} from './types';

// Content Types
export type {
  ContentPart,
  ContentPartBase,
  TextPart,
  FilePart,
  FileContent,
  DataPart
} from './types';

// Message Types
export type {
  Message,
  MessageRole
} from './types';

// Task Types
export type {
  Task,
  TaskState,
  TaskStatus,
  TaskInput,
  TaskOutput,
  TaskError,
  Artifact,
  TaskSendParams,
  TaskSendResult,
  TaskSendSubscribeParams,
  TaskGetParams,
  TaskGetResult,
  TaskCancelParams,
  TaskCancelResult,
  TaskResubscribeParams,
  TaskStateTransition
} from './types';

// Push Notification Types
export type {
  PushNotificationConfig,
  PushNotificationEvent,
  PushNotification,
  PushNotificationGetParams,
  PushNotificationGetResult,
  PushNotificationSetParams,
  PushNotificationSetResult
} from './types';

// Streaming Types
export type {
  StreamEvent,
  StreamEventType,
  StreamEventBase,
  TaskStatusEvent,
  TaskArtifactEvent,
  TaskOutputEvent,
  ErrorEvent,
  DoneEvent
} from './types';

// Configuration Types
export type {
  A2AClientConfig,
  A2AAuthConfig
} from './types';

// Client Event Types
export type {
  ClientEventType,
  ClientEvent
} from './types';

// Utility Types
export type {
  A2AMethod,
  HttpMethod,
  Session
} from './types';

// ============================================================================
// Re-export Static Helpers
// ============================================================================

import { A2AClient, A2AError } from './a2a-client';

/**
 * Create a text message with specified role
 * 
 * @param text - The text content of the message
 * @param role - The role of the message sender (default: 'user')
 * @returns A properly formatted message
 */
export const createTextMessage = A2AClient.createTextMessage;

/**
 * Create a message with file content
 * 
 * @param file - The file content
 * @param role - The role of the message sender (default: 'user')
 * @returns A properly formatted message with file content
 */
export const createFileMessage = A2AClient.createFileMessage;

/**
 * Create a message with structured data
 * 
 * @param data - The structured data content
 * @param role - The role of the message sender (default: 'user')
 * @returns A properly formatted message with data content
 */
export const createDataMessage = A2AClient.createDataMessage;

/**
 * Create task input from text
 * 
 * @param text - The text content
 * @param skillId - Optional skill ID to target
 * @returns Task input ready for submission
 */
export const createTextInput = A2AClient.createTextInput;

/**
 * Extract text from message parts
 * 
 * @param parts - Array of content parts
 * @returns Concatenated text from all text parts
 */
export const extractText = A2AClient.extractText;

/**
 * Extract data from message parts
 * 
 * @param parts - Array of content parts
 * @returns Array of data objects from data parts
 */
export const extractData = A2AClient.extractData;

// ============================================================================
// Constants
// ============================================================================

/**
 * Default timeout for task operations in milliseconds
 */
export const DEFAULT_TASK_TIMEOUT = 300000; // 5 minutes

/**
 * Default polling interval for task status in milliseconds
 */
export const DEFAULT_POLL_INTERVAL = 1000; // 1 second

/**
 * Well-known path for agent card discovery
 */
export const AGENT_CARD_WELL_KNOWN_PATH = '/.well-known/agent.json';

/**
 * A2A protocol version supported by this client
 */
export const A2A_PROTOCOL_VERSION = '1.0';

/**
 * JSON-RPC version used by the A2A protocol
 */
export const JSON_RPC_VERSION = '2.0';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse an agent card URL to extract base URL and path
 * 
 * @param urlOrCard - URL string or AgentCard object
 * @returns Parsed URL components
 */
export function parseAgentCardUrl(urlOrCard: string | { url: string }): {
  baseUrl: string;
  path: string;
  fullUrl: string;
} {
  const url = typeof urlOrCard === 'string' ? urlOrCard : urlOrCard.url;
  const parsed = new URL(url);
  
  return {
    baseUrl: `${parsed.protocol}//${parsed.host}`,
    path: parsed.pathname,
    fullUrl: url
  };
}

/**
 * Check if a task is in a terminal state
 * 
 * @param state - The task state to check
 * @returns True if the task is in a terminal state
 */
export function isTerminalState(state: string): boolean {
  return ['completed', 'failed', 'canceled'].includes(state);
}

/**
 * Check if a task requires user input
 * 
 * @param state - The task state to check
 * @returns True if the task requires user input
 */
export function requiresInput(state: string): boolean {
  return state === 'input-required';
}

/**
 * Extract text content from task artifacts
 * 
 * @param artifacts - Array of task artifacts
 * @returns Concatenated text content from all text parts
 */
export function extractTextFromArtifacts(artifacts: Array<{
  parts: Array<{ type: string; text?: string }>;
}>): string {
  return artifacts
    .flatMap(artifact => artifact.parts)
    .filter(part => part.type === 'text' && part.text)
    .map(part => part.text!)
    .join('\n');
}

/**
 * Build an agent card URL from a base URL
 * 
 * @param baseUrl - The base URL of the agent
 * @returns The full agent card URL
 */
export function buildAgentCardUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = AGENT_CARD_WELL_KNOWN_PATH;
  return url.toString();
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for TaskStatusEvent
 */
export function isTaskStatusEvent(event: unknown): event is { type: 'task.status'; status: unknown } {
  return typeof event === 'object' && event !== null && 
    (event as { type?: string }).type === 'task.status';
}

/**
 * Type guard for TaskArtifactEvent
 */
export function isTaskArtifactEvent(event: unknown): event is { type: 'task.artifact'; artifact: unknown } {
  return typeof event === 'object' && event !== null && 
    (event as { type?: string }).type === 'task.artifact';
}

/**
 * Type guard for TaskOutputEvent
 */
export function isTaskOutputEvent(event: unknown): event is { type: 'task.output'; delta: unknown } {
  return typeof event === 'object' && event !== null && 
    (event as { type?: string }).type === 'task.output';
}

/**
 * Type guard for ErrorEvent
 */
export function isErrorEvent(event: unknown): event is { type: 'error'; error: unknown } {
  return typeof event === 'object' && event !== null && 
    (event as { type?: string }).type === 'error';
}

/**
 * Type guard for DoneEvent
 */
export function isDoneEvent(event: unknown): event is { type: 'done'; task: unknown } {
  return typeof event === 'object' && event !== null && 
    (event as { type?: string }).type === 'done';
}

/**
 * Type guard for A2AError
 */
export function isA2AError(error: unknown): error is A2AError {
  return error instanceof A2AError;
}

// ============================================================================
// Default Export
// ============================================================================

export { default } from './a2a-client';
