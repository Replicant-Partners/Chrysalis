/**
 * AG-UI Message Serialization
 * 
 * Handles serialization and deserialization of AG-UI messages
 * Supports multiple formats: JSON, JSONL, CBOR, MessagePack
 * 
 * @module agui/protocol
 */

import type { AGUIMessage, SerializationFormat, SupportedFormats, SerializationError } from './types';

// =============================================================================
// JSON Serialization
// =============================================================================

export class JSONSerializer implements SerializationFormat {
  serialize(message: AGUIMessage): string {
    try {
      return JSON.stringify(message, null, 2);
    } catch (error) {
      throw new SerializationError(
        `Failed to serialize message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'JSON_SERIALIZE_ERROR',
        { message, error }
      );
    }
  }

  deserialize(data: string): AGUIMessage {
    try {
      const parsed = JSON.parse(data);
      
      // Basic validation
      if (!parsed || typeof parsed !== 'object') {
        throw new SerializationError('Invalid JSON structure', 'JSON_DESERIALIZE_ERROR');
      }
      
      if (!parsed.id || !parsed.role || !parsed.type || !parsed.timestamp) {
        throw new SerializationError('Missing required fields', 'JSON_DESERIALIZE_ERROR');
      }
      
      return parsed as AGUIMessage;
    } catch (error) {
      throw new SerializationError(
        `Failed to deserialize message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'JSON_DESERIALIZE_ERROR',
        { data, error }
      );
    }
  }
}

// =============================================================================
// JSONL Serialization (JSON Lines)
// =============================================================================

export class JSONLSerializer implements SerializationFormat {
  serialize(message: AGUIMessage): string {
    try {
      return JSON.stringify(message);
    } catch (error) {
      throw new SerializationError(
        `Failed to serialize message to JSONL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'JSONL_SERIALIZE_ERROR',
        { message, error }
      );
    }
  }

  deserialize(data: string): AGUIMessage {
    try {
      // JSONL format expects one JSON object per line
      const trimmed = data.trim();
      if (!trimmed) {
        throw new SerializationError('Empty JSONL line', 'JSONL_DESERIALIZE_ERROR');
      }
      
      const parsed = JSON.parse(trimmed);
      
      if (!parsed || typeof parsed !== 'object') {
        throw new SerializationError('Invalid JSONL structure', 'JSONL_DESERIALIZE_ERROR');
      }
      
      if (!parsed.id || !parsed.role || !parsed.type || !parsed.timestamp) {
        throw new SerializationError('Missing required fields', 'JSONL_DESERIALIZE_ERROR');
      }
      
      return parsed as AGUIMessage;
    } catch (error) {
      throw new SerializationError(
        `Failed to deserialize JSONL message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'JSONL_DESERIALIZE_ERROR',
        { data, error }
      );
    }
  }
}

// =============================================================================
// Message Validation
// =============================================================================

export interface IMessageValidator {
  validate(message: AGUIMessage): {
    isValid: boolean;
    errors: string[];
  };
}

export class AGUIMessageValidator implements IMessageValidator {
  validate(message: AGUIMessage): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Required field validation
    if (!message.id) errors.push('Missing required field: id');
    if (!message.sessionId) errors.push('Missing required field: sessionId');
    if (!message.role) errors.push('Missing required field: role');
    if (!message.type) errors.push('Missing required field: type');
    if (!message.timestamp) errors.push('Missing required field: timestamp');
    
    // Type validation
    const validRoles = ['user', 'assistant', 'system', 'tool', 'developer', 'activity'];
    if (!validRoles.includes(message.role)) {
      errors.push(`Invalid role: ${message.role}`);
    }
    
    const validTypes = [
      'message.created', 'message.updated', 'message.deleted',
      'session.started', 'session.ended',
      'agent.connected', 'agent.disconnected',
      'agent.thinking', 'agent.responding',
      'tool.invoked', 'tool.completed', 'tool.failed',
      'user.interaction', 'system.notification',
      'state.changed', 'error.occurred'
    ];
    if (!validTypes.includes(message.type)) {
      errors.push(`Invalid type: ${message.type}`);
    }
    
    // Timestamp validation
    if (message.timestamp) {
      const timestamp = new Date(message.timestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push('Invalid timestamp format');
      }
    }
    
    // Data validation
    if (message.data === undefined) {
      errors.push('Missing required field: data');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// =============================================================================
// Serialization Factory
// =============================================================================

export class SerializationFactory {
  private static serializers = new Map<SupportedFormats, SerializationFormat>([
    ['json', new JSONSerializer()],
    ['jsonl', new JSONLSerializer()],
    // Note: CBOR and MessagePack would require additional dependencies
    // ['cbor', new CBORSerializer()],
    // ['msgpack', new MessagePackSerializer()],
  ]);

  static getSerializer(format: SupportedFormats): SerializationFormat {
    const serializer = this.serializers.get(format);
    if (!serializer) {
      throw new SerializationError(`Unsupported serialization format: ${format}`, 'UNSUPPORTED_FORMAT');
    }
    return serializer;
  }

  static registerSerializer(format: SupportedFormats, serializer: SerializationFormat): void {
    this.serializers.set(format, serializer);
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

export function createMessage(
  role: AGUIMessage['role'],
  type: AGUIMessage['type'],
  data: unknown,
  sessionId?: string,
  metadata?: Record<string, unknown>
): AGUIMessage {
  const message: AGUIMessage = {
    id: crypto.randomUUID(),
    sessionId: sessionId || crypto.randomUUID(),
    role,
    type,
    timestamp: new Date().toISOString(),
    data,
    metadata
  };
  
  const validator = new AGUIMessageValidator();
  const validation = validator.validate(message);
  
  if (!validation.isValid) {
    throw new SerializationError(
      `Invalid message created: ${validation.errors.join(', ')}`,
      'VALIDATION_ERROR',
      { message, errors: validation.errors }
    );
  }
  
  return message;
}

export function serializeMessage(
  message: AGUIMessage,
  format: SupportedFormats = 'json'
): string {
  const serializer = SerializationFactory.getSerializer(format);
  return serializer.serialize(message);
}

export function deserializeMessage(
  data: string,
  format: SupportedFormats = 'json'
): AGUIMessage {
  const serializer = SerializationFactory.getSerializer(format);
  const message = serializer.deserialize(data);
  
  const validator = new AGUIMessageValidator();
  const validation = validator.validate(message);
  
  if (!validation.isValid) {
    throw new SerializationError(
      `Invalid message received: ${validation.errors.join(', ')}`,
      'VALIDATION_ERROR',
      { message, errors: validation.errors }
    );
  }
  
  return message;
}

// =============================================================================
// Batch Operations
// =============================================================================

export function serializeBatch(
  messages: AGUIMessage[],
  format: SupportedFormats = 'json'
): string {
  if (format === 'jsonl') {
    return messages.map(msg => serializeMessage(msg, format)).join('\n');
  } else {
    return serializeMessage(messages, format);
  }
}

export function deserializeBatch(
  data: string,
  format: SupportedFormats = 'json'
): AGUIMessage[] {
  if (format === 'jsonl') {
    const lines = data.trim().split('\n').filter(line => line.trim());
    return lines.map(line => deserializeMessage(line, format));
  } else {
    const messages = JSON.parse(data);
    if (!Array.isArray(messages)) {
      throw new SerializationError('Expected array of messages', 'BATCH_DESERIALIZE_ERROR');
    }
    return messages.map(msg => deserializeMessage(JSON.stringify(msg), format));
  }
}

// =============================================================================
// Message Compression (optional optimization)
// =============================================================================

export async function compressMessage(message: string): Promise<string> {
  if ('CompressionStream' in window) {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(new TextEncoder().encode(message));
    writer.close();
    
    const chunks: Uint8Array[] = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) chunks.push(value);
    }
    
    const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let result = '';
    for (let i = 0; i < compressed.length; i++) {
      result += String.fromCharCode(compressed[i]);
    }
    return btoa(result);
  }
  
  return message; // Fallback to uncompressed
}

export async function decompressMessage(compressed: string): Promise<string> {
  if ('DecompressionStream' in window) {
    try {
      const binary = atob(compressed);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(bytes);
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      return new TextDecoder().decode(decompressed);
    } catch (error) {
      throw new SerializationError(
        `Failed to decompress message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'COMPRESSION_ERROR'
      );
    }
  }
  
  return compressed; // Fallback to original
}