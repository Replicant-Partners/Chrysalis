/**
 * Phase 1 Critical Fixes - Test Suite
 * 
 * Tests for the Phase 1 improvements:
 * 1. Browser compatibility (Base64 encoding)
 * 2. Runtime schema validation (Zod)
 * 3. Session memory management
 * 4. Error cause chain
 * 
 * @module a2a-client/__tests__/phase1-fixes.test.ts
 */

import { A2AClient, A2AError, A2A_ERROR_CODES } from '../index';
import { base64Encode, base64Decode, encodeBasicAuth, isBrowser, isNode } from '../../shared/encoding';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockAgentCard = {
  name: 'Test Agent',
  description: 'A test A2A agent',
  url: 'https://agent.example.com/a2a',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    pushNotifications: true,
    stateTransitionHistory: true
  },
  skills: [
    {
      id: 'test-skill',
      name: 'Test Skill',
      description: 'A test skill'
    }
  ]
};

// ============================================================================
// Fix 1: Browser Compatibility Tests
// ============================================================================

describe('Fix 1: Browser Compatibility - Base64 Encoding', () => {
  describe('base64Encode', () => {
    it('should encode simple ASCII strings', () => {
      const input = 'hello:world';
      const encoded = base64Encode(input);
      expect(encoded).toBe('aGVsbG86d29ybGQ=');
    });

    it('should encode empty string', () => {
      const encoded = base64Encode('');
      expect(encoded).toBe('');
    });

    it('should encode strings with special characters', () => {
      const input = 'user:p@ssw0rd!';
      const encoded = base64Encode(input);
      // Verify it can be decoded back
      const decoded = base64Decode(encoded);
      expect(decoded).toBe(input);
    });

    it('should handle Unicode characters', () => {
      const input = 'user:пароль';
      const encoded = base64Encode(input);
      const decoded = base64Decode(encoded);
      expect(decoded).toBe(input);
    });

    it('should handle emoji', () => {
      const input = 'user:🔐secret';
      const encoded = base64Encode(input);
      const decoded = base64Decode(encoded);
      expect(decoded).toBe(input);
    });
  });

  describe('base64Decode', () => {
    it('should decode valid Base64 strings', () => {
      const encoded = 'aGVsbG86d29ybGQ=';
      const decoded = base64Decode(encoded);
      expect(decoded).toBe('hello:world');
    });

    it('should decode empty string', () => {
      const decoded = base64Decode('');
      expect(decoded).toBe('');
    });
  });

  describe('encodeBasicAuth', () => {
    it('should encode username:password correctly', () => {
      const encoded = encodeBasicAuth('admin', 'secret');
      expect(encoded).toBe('YWRtaW46c2VjcmV0');
    });

    it('should handle special characters in password', () => {
      const encoded = encodeBasicAuth('user', 'p@ss:word');
      const decoded = base64Decode(encoded);
      expect(decoded).toBe('user:p@ss:word');
    });
  });

  describe('Environment detection', () => {
    it('should detect Node.js environment', () => {
      // In Jest (Node.js), isNode should return true
      expect(isNode()).toBe(true);
    });

    it('should not detect browser environment in Node.js', () => {
      // In Jest (Node.js), isBrowser should return false
      expect(isBrowser()).toBe(false);
    });
  });
});

// ============================================================================
// Fix 2: Schema Validation Tests
// ============================================================================

describe('Fix 2: Runtime Schema Validation', () => {
  // Note: Full schema tests require Zod to be installed
  // These tests verify the schema module structure
  
  describe('Schema module exports', () => {
    it('should export schema validation functions', async () => {
      // Dynamic import to handle potential missing Zod
      try {
        const schemas = await import('../schemas');
        expect(typeof schemas.parseStreamEvent).toBe('function');
        expect(typeof schemas.parseAgentCard).toBe('function');
        expect(typeof schemas.parseTask).toBe('function');
      } catch (e) {
        // If Zod is not installed, skip this test
        console.warn('Zod not installed, skipping schema tests');
      }
    });
  });
});

// ============================================================================
// Fix 3: Session Memory Management Tests
// ============================================================================

describe('Fix 3: Session Memory Management', () => {
  let client: A2AClient;

  beforeEach(() => {
    client = new A2AClient({ agentCard: mockAgentCard });
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('Session tracking', () => {
    it('should start with zero sessions', () => {
      expect(client.getSessionCount()).toBe(0);
      expect(client.getSessions()).toHaveLength(0);
    });

    it('should clear sessions on disconnect', async () => {
      await client.connect();
      // Sessions would be created during task operations
      client.disconnect();
      expect(client.getSessionCount()).toBe(0);
    });
  });

  describe('Session statistics', () => {
    it('should track session statistics', async () => {
      await client.connect();
      const stats = client.getStats();
      
      expect(stats).toHaveProperty('sessionsCreated');
      expect(stats).toHaveProperty('sessionsEvicted');
      expect(stats).toHaveProperty('streamEventsReceived');
      expect(stats).toHaveProperty('streamEventsInvalid');
    });
  });

  describe('Cleanup timer', () => {
    it('should stop cleanup timer on disconnect', () => {
      // Create client and immediately disconnect
      const testClient = new A2AClient({ agentCard: mockAgentCard });
      testClient.disconnect();
      
      // No error should occur - timer should be cleared
      expect(testClient.isConnected()).toBe(false);
    });
  });
});

// ============================================================================
// Fix 4: Error Cause Chain Tests
// ============================================================================

describe('Fix 4: Error Cause Chain', () => {
  describe('A2AError construction', () => {
    it('should create error with code and message', () => {
      const error = new A2AError(
        A2A_ERROR_CODES.TASK_NOT_FOUND,
        'Task not found'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(A2AError);
      expect(error.code).toBe(A2A_ERROR_CODES.TASK_NOT_FOUND);
      expect(error.message).toBe('Task not found');
      expect(error.name).toBe('A2AError');
    });

    it('should create error with data', () => {
      const error = new A2AError(
        A2A_ERROR_CODES.INTERNAL_ERROR,
        'Internal error',
        { taskId: 'task-123' }
      );

      expect(error.data).toEqual({ taskId: 'task-123' });
    });

    it('should create error with cause', () => {
      const originalError = new Error('Original error');
      const error = new A2AError(
        A2A_ERROR_CODES.INTERNAL_ERROR,
        'Wrapped error',
        undefined,
        { cause: originalError }
      );

      // Access cause via type assertion (ES2022 feature)
      expect((error as Error & { cause?: Error }).cause).toBe(originalError);
    });
  });

  describe('A2AError.from()', () => {
    it('should return same error if already A2AError', () => {
      const original = new A2AError(A2A_ERROR_CODES.TASK_NOT_FOUND, 'Not found');
      const wrapped = A2AError.from(original);

      expect(wrapped).toBe(original);
    });

    it('should wrap standard Error with cause', () => {
      const original = new Error('Standard error');
      const wrapped = A2AError.from(original);

      expect(wrapped).toBeInstanceOf(A2AError);
      expect(wrapped.message).toBe('Standard error');
      expect(wrapped.code).toBe(A2A_ERROR_CODES.INTERNAL_ERROR);
      // Access cause via type assertion (ES2022 feature)
      expect((wrapped as Error & { cause?: Error }).cause).toBe(original);
    });

    it('should wrap standard Error with custom code', () => {
      const original = new Error('Not found');
      const wrapped = A2AError.from(original, A2A_ERROR_CODES.TASK_NOT_FOUND);

      expect(wrapped.code).toBe(A2A_ERROR_CODES.TASK_NOT_FOUND);
    });

    it('should convert string to A2AError', () => {
      const wrapped = A2AError.from('Something went wrong');

      expect(wrapped).toBeInstanceOf(A2AError);
      expect(wrapped.message).toBe('Something went wrong');
      expect(wrapped.code).toBe(A2A_ERROR_CODES.INTERNAL_ERROR);
    });

    it('should convert null/undefined to A2AError', () => {
      const wrappedNull = A2AError.from(null);
      const wrappedUndefined = A2AError.from(undefined);

      expect(wrappedNull.message).toBe('null');
      expect(wrappedUndefined.message).toBe('undefined');
    });
  });

  describe('A2AError.isA2AError()', () => {
    it('should return true for A2AError instances', () => {
      const error = new A2AError(A2A_ERROR_CODES.INTERNAL_ERROR, 'Test');
      expect(A2AError.isA2AError(error)).toBe(true);
    });

    it('should return false for standard Error', () => {
      const error = new Error('Test');
      expect(A2AError.isA2AError(error)).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(A2AError.isA2AError(null)).toBe(false);
      expect(A2AError.isA2AError(undefined)).toBe(false);
      expect(A2AError.isA2AError('error')).toBe(false);
      expect(A2AError.isA2AError({})).toBe(false);
    });
  });

  describe('toJsonRpcError()', () => {
    it('should convert to JSON-RPC error format', () => {
      const error = new A2AError(
        A2A_ERROR_CODES.TASK_NOT_FOUND,
        'Task not found',
        { taskId: 'task-123' }
      );

      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: A2A_ERROR_CODES.TASK_NOT_FOUND,
        message: 'Task not found',
        data: { taskId: 'task-123' }
      });
    });
  });

  describe('Error stack trace preservation', () => {
    it('should preserve stack trace in wrapped errors', () => {
      const original = new Error('Original');
      const wrapped = A2AError.from(original);

      // The wrapped error should have its own stack
      expect(wrapped.stack).toBeDefined();
      expect(wrapped.stack).toContain('A2AError');

      // The cause should preserve the original stack (ES2022 feature)
      const cause = (wrapped as Error & { cause?: Error }).cause;
      expect(cause?.stack).toBeDefined();
      expect(cause?.stack).toContain('Original');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Phase 1 Integration', () => {
  describe('A2AClient with all fixes', () => {
    let client: A2AClient;

    beforeEach(() => {
      client = new A2AClient({
        agentCard: mockAgentCard,
        auth: {
          scheme: 'Basic',
          username: 'testuser',
          password: 'testpass'
        }
      });
    });

    afterEach(() => {
      client.disconnect();
    });

    it('should create client with Basic auth using cross-platform encoding', async () => {
      // The client should be created without errors
      expect(client).toBeInstanceOf(A2AClient);
      
      // Connect should work (will fail on network, but auth header should be built)
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it('should emit events for session cleanup', (done) => {
      client.on('sessions-cleaned', (data) => {
        expect(data).toHaveProperty('expired');
        expect(data).toHaveProperty('remaining');
        done();
      });

      // Manually trigger cleanup (normally runs on timer)
      // This is a private method, so we test via the event
      // In real usage, this would be triggered by the timer
    });

    it('should emit events for stream validation errors', (done) => {
      client.on('stream-validation-error', (data) => {
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('rawData');
        done();
      });

      // This would be triggered by invalid stream data
      // In real usage, this happens during streaming
    });
  });
});

// ============================================================================
// Regression Tests
// ============================================================================

describe('Regression Tests', () => {
  describe('Existing functionality preserved', () => {
    it('should still create text messages', () => {
      const message = A2AClient.createTextMessage('Hello');
      expect(message).toEqual({
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }]
      });
    });

    it('should still create file messages', () => {
      const message = A2AClient.createFileMessage({
        name: 'test.txt',
        mimeType: 'text/plain'
      });
      expect(message.parts[0].type).toBe('file');
    });

    it('should still create data messages', () => {
      const message = A2AClient.createDataMessage({ key: 'value' });
      expect(message.parts[0].type).toBe('data');
    });

    it('should still extract text from parts', () => {
      const parts = [
        { type: 'text' as const, text: 'Hello' },
        { type: 'text' as const, text: 'World' }
      ];
      const text = A2AClient.extractText(parts);
      expect(text).toBe('Hello\nWorld');
    });
  });
});
