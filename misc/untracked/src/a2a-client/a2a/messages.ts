/**
 * Message Helper Functions
 * 
 * Factory functions for creating A2A messages and task inputs.
 * 
 * @module a2a-client/a2a/messages
 */

import {
  Message,
  MessageRole,
  ContentPart,
  TextPart,
  DataPart,
  TaskInput
} from '../types';

export function createTextMessage(text: string, role: MessageRole = 'user'): Message {
  return {
    role,
    parts: [{ type: 'text', text }]
  };
}

export function createFileMessage(
  file: { name?: string; mimeType?: string; uri?: string; bytes?: string },
  role: MessageRole = 'user'
): Message {
  return {
    role,
    parts: [{ type: 'file', file }]
  };
}

export function createDataMessage(
  data: Record<string, unknown>,
  role: MessageRole = 'user'
): Message {
  return {
    role,
    parts: [{ type: 'data', data }]
  };
}

export function createTextInput(text: string, skillId?: string): TaskInput {
  return {
    message: createTextMessage(text),
    skillId
  };
}

export function extractText(parts: ContentPart[]): string {
  return parts
    .filter((p): p is TextPart => p.type === 'text')
    .map(p => p.text)
    .join('\n');
}

export function extractData(parts: ContentPart[]): Record<string, unknown>[] {
  return parts
    .filter((p): p is DataPart => p.type === 'data')
    .map(p => p.data);
}
