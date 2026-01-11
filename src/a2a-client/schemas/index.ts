/**
 * A2A Client Zod Schemas
 * 
 * Runtime validation schemas for A2A protocol types.
 * Provides type-safe parsing of untrusted data from network.
 * 
 * @module a2a-client/schemas
 * @version 1.0.0
 */

import { z } from 'zod';

// ============================================================================
// Content Part Schemas
// ============================================================================

/**
 * Text content part schema
 */
export const TextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string()
});

/**
 * File content part schema
 */
export const FilePartSchema = z.object({
  type: z.literal('file'),
  file: z.object({
    name: z.string().optional(),
    mimeType: z.string().optional(),
    uri: z.string().optional(),
    bytes: z.string().optional()
  })
});

/**
 * Data content part schema
 */
export const DataPartSchema = z.object({
  type: z.literal('data'),
  data: z.record(z.unknown())
});

/**
 * Union of all content part types
 */
export const ContentPartSchema = z.discriminatedUnion('type', [
  TextPartSchema,
  FilePartSchema,
  DataPartSchema
]);

// ============================================================================
// Message Schemas
// ============================================================================

/**
 * Message role schema
 */
export const MessageRoleSchema = z.enum(['user', 'agent']);

/**
 * Message schema
 */
export const MessageSchema = z.object({
  role: MessageRoleSchema,
  parts: z.array(ContentPartSchema)
});

// ============================================================================
// Task Status Schemas
// ============================================================================

/**
 * Task state schema
 */
export const TaskStateSchema = z.enum([
  'submitted',
  'working',
  'input-required',
  'completed',
  'failed',
  'canceled'
]);

/**
 * Task status schema
 */
export const TaskStatusSchema = z.object({
  state: TaskStateSchema,
  timestamp: z.string().optional(),
  message: z.string().optional()
});

// ============================================================================
// Artifact Schemas
// ============================================================================

/**
 * Artifact schema
 */
export const ArtifactSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  parts: z.array(ContentPartSchema),
  index: z.number().optional(),
  append: z.boolean().optional(),
  lastChunk: z.boolean().optional()
});

// ============================================================================
// Task Schemas
// ============================================================================

/**
 * Task input schema
 */
export const TaskInputSchema = z.object({
  message: MessageSchema.optional(),
  skillId: z.string().optional()
});

/**
 * Task output schema
 */
export const TaskOutputSchema = z.object({
  message: MessageSchema.optional(),
  artifacts: z.array(ArtifactSchema).optional()
});

/**
 * Task schema
 */
export const TaskSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  status: TaskStatusSchema,
  input: TaskInputSchema.optional(),
  output: TaskOutputSchema.optional(),
  history: z.array(z.object({
    status: TaskStatusSchema,
    timestamp: z.string()
  })).optional()
});

// ============================================================================
// Stream Event Schemas
// ============================================================================

/**
 * Task status event schema
 */
export const TaskStatusEventSchema = z.object({
  type: z.literal('task.status'),
  status: TaskStatusSchema,
  final: z.boolean().optional()
});

/**
 * Task artifact event schema
 */
export const TaskArtifactEventSchema = z.object({
  type: z.literal('task.artifact'),
  artifact: ArtifactSchema
});

/**
 * Task output event schema
 */
export const TaskOutputEventSchema = z.object({
  type: z.literal('task.output'),
  output: TaskOutputSchema
});

/**
 * Error event schema
 */
export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional()
  })
});

/**
 * Done event schema
 */
export const DoneEventSchema = z.object({
  type: z.literal('done'),
  task: TaskSchema
});

/**
 * Union of all stream event types
 */
export const StreamEventSchema = z.discriminatedUnion('type', [
  TaskStatusEventSchema,
  TaskArtifactEventSchema,
  TaskOutputEventSchema,
  ErrorEventSchema,
  DoneEventSchema
]);

// ============================================================================
// Agent Card Schemas
// ============================================================================

/**
 * Agent capabilities schema
 */
export const AgentCapabilitiesSchema = z.object({
  streaming: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  stateTransitionHistory: z.boolean().optional()
});

/**
 * Agent skill schema
 */
export const AgentSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  inputModes: z.array(z.string()).optional(),
  outputModes: z.array(z.string()).optional()
});

/**
 * Agent card schema
 */
export const AgentCardSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string().url(),
  version: z.string().optional(),
  capabilities: AgentCapabilitiesSchema.optional(),
  skills: z.array(AgentSkillSchema).optional(),
  provider: z.object({
    organization: z.string().optional(),
    contactEmail: z.string().email().optional()
  }).optional()
});

// ============================================================================
// JSON-RPC Schemas
// ============================================================================

/**
 * JSON-RPC error schema
 */
export const JsonRpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional()
});

/**
 * JSON-RPC response schema (generic)
 */
export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.unknown().optional(),
  error: JsonRpcErrorSchema.optional()
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type ValidatedTextPart = z.infer<typeof TextPartSchema>;
export type ValidatedFilePart = z.infer<typeof FilePartSchema>;
export type ValidatedDataPart = z.infer<typeof DataPartSchema>;
export type ValidatedContentPart = z.infer<typeof ContentPartSchema>;
export type ValidatedMessage = z.infer<typeof MessageSchema>;
export type ValidatedTaskState = z.infer<typeof TaskStateSchema>;
export type ValidatedTaskStatus = z.infer<typeof TaskStatusSchema>;
export type ValidatedArtifact = z.infer<typeof ArtifactSchema>;
export type ValidatedTask = z.infer<typeof TaskSchema>;
export type ValidatedStreamEvent = z.infer<typeof StreamEventSchema>;
export type ValidatedTaskStatusEvent = z.infer<typeof TaskStatusEventSchema>;
export type ValidatedTaskArtifactEvent = z.infer<typeof TaskArtifactEventSchema>;
export type ValidatedDoneEvent = z.infer<typeof DoneEventSchema>;
export type ValidatedAgentCard = z.infer<typeof AgentCardSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: z.ZodError;
}

/**
 * Safely parse a stream event with detailed error information.
 * 
 * @param data - The raw data to parse
 * @returns Validation result with parsed data or error
 */
export function parseStreamEvent(data: unknown): ValidationResult<ValidatedStreamEvent> {
  const result = StreamEventSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Safely parse an agent card with detailed error information.
 * 
 * @param data - The raw data to parse
 * @returns Validation result with parsed data or error
 */
export function parseAgentCard(data: unknown): ValidationResult<ValidatedAgentCard> {
  const result = AgentCardSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Safely parse a task with detailed error information.
 * 
 * @param data - The raw data to parse
 * @returns Validation result with parsed data or error
 */
export function parseTask(data: unknown): ValidationResult<ValidatedTask> {
  const result = TaskSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Type guard for task status events
 */
export function isTaskStatusEvent(event: ValidatedStreamEvent): event is ValidatedTaskStatusEvent {
  return event.type === 'task.status';
}

/**
 * Type guard for task artifact events
 */
export function isTaskArtifactEvent(event: ValidatedStreamEvent): event is ValidatedTaskArtifactEvent {
  return event.type === 'task.artifact';
}

/**
 * Type guard for done events
 */
export function isDoneEvent(event: ValidatedStreamEvent): event is ValidatedDoneEvent {
  return event.type === 'done';
}

/**
 * Check if a task state is terminal
 */
export function isTerminalState(state: ValidatedTaskState): boolean {
  return state === 'completed' || state === 'failed' || state === 'canceled';
}

export default {
  // Schemas
  TextPartSchema,
  FilePartSchema,
  DataPartSchema,
  ContentPartSchema,
  MessageSchema,
  TaskStateSchema,
  TaskStatusSchema,
  ArtifactSchema,
  TaskSchema,
  StreamEventSchema,
  AgentCardSchema,
  JsonRpcResponseSchema,
  
  // Helpers
  parseStreamEvent,
  parseAgentCard,
  parseTask,
  isTaskStatusEvent,
  isTaskArtifactEvent,
  isDoneEvent,
  isTerminalState
};
