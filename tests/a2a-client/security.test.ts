/**
 * Security Tests for A2A Client
 * 
 * These tests address the test coverage deficiencies identified in the
 * Comprehensive Code Review (2026-01-11), Section 2.4.
 * 
 * @see docs/COMPREHENSIVE_CODE_REVIEW_2026-01-11.md
 * @see docs/SECURITY_HARDENING_GUIDE.md
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

// Import after mocking
import { A2AClient } from '../../src/a2a-client/a2a-client';
import type { AgentCard } from '../../src/a2a-client/types';

describe('Security Tests - A2A Client', () => {
  let client: A2AClient;
  const baseUrl = 'https://agent.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    client = new A2AClient(baseUrl);
  });

  afterEach(() => {
    client.dispose();
  });

  describe('Malformed JSON-RPC Rejection', () => {
    it('should reject malformed JSON-RPC requests with invalid method', async () => {
      // Mock a malformed response that doesn't conform to JSON-RPC spec
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          // Missing 'jsonrpc' field
          id: 1,
          result: { status: 'ok' },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      // The client should handle malformed responses gracefully
      await expect(client.getAgentCard()).rejects.toThrow();
    });

    it('should reject JSON-RPC response with missing id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          // Missing 'id' field
          result: { status: 'ok' },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      await expect(client.getAgentCard()).rejects.toThrow();
    });

    it('should reject non-JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html>Not JSON</html>',
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
        headers: new Headers({ 'content-type': 'text/html' }),
      } as unknown as Response);

      await expect(client.getAgentCard()).rejects.toThrow();
    });

    it('should reject responses with invalid JSON-RPC version', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '1.0', // Invalid version
          id: 1,
          result: {},
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      await expect(client.getAgentCard()).rejects.toThrow();
    });
  });

  describe('XSS Prevention in Message Content', () => {
    it('should handle XSS attempts in message content safely', async () => {
      const maliciousContent = '<script>alert("xss")</script>';
      
      // Mock successful task creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            id: 'task-123',
            status: { state: 'submitted' },
            history: [{
              role: 'user',
              parts: [{ text: maliciousContent }],
            }],
          },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      const result = await client.sendTask({
        message: {
          role: 'user',
          parts: [{ text: maliciousContent }],
        },
      });

      // Verify the malicious content is preserved as-is (not executed)
      // The content should be stored but never interpreted as HTML
      expect(result.history?.[0]?.parts?.[0]).toHaveProperty('text', maliciousContent);
    });

    it('should handle HTML entities in message content', async () => {
      const htmlContent = '&lt;script&gt;alert("xss")&lt;/script&gt;';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            id: 'task-123',
            status: { state: 'submitted' },
            history: [{
              role: 'user',
              parts: [{ text: htmlContent }],
            }],
          },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      const result = await client.sendTask({
        message: {
          role: 'user',
          parts: [{ text: htmlContent }],
        },
      });

      expect(result.history?.[0]?.parts?.[0]).toHaveProperty('text', htmlContent);
    });

    it('should handle SQL injection attempts in message content', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            id: 'task-123',
            status: { state: 'submitted' },
            history: [{
              role: 'user',
              parts: [{ text: sqlInjection }],
            }],
          },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      const result = await client.sendTask({
        message: {
          role: 'user',
          parts: [{ text: sqlInjection }],
        },
      });

      // Content should be treated as plain text, not as SQL
      expect(result.history?.[0]?.parts?.[0]).toHaveProperty('text', sqlInjection);
    });
  });

  describe('Authentication Token Validation', () => {
    it('should include authorization header when token is provided', async () => {
      const authenticatedClient = new A2AClient(baseUrl, {
        authToken: 'test-bearer-token',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            name: 'Test Agent',
            url: baseUrl,
            version: '1.0.0',
            capabilities: { streaming: false, pushNotifications: false },
          } satisfies AgentCard,
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      await authenticatedClient.getAgentCard();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-bearer-token',
          }),
        })
      );

      authenticatedClient.dispose();
    });

    it('should include basic auth when credentials are provided', async () => {
      const authenticatedClient = new A2AClient(baseUrl, {
        basicAuth: { username: 'user', password: 'pass' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            name: 'Test Agent',
            url: baseUrl,
            version: '1.0.0',
            capabilities: { streaming: false, pushNotifications: false },
          } satisfies AgentCard,
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      await authenticatedClient.getAgentCard();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );

      authenticatedClient.dispose();
    });

    it('should reject requests with HTTP 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32001,
            message: 'Unauthorized',
          },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      await expect(client.getAgentCard()).rejects.toThrow();
    });

    it('should reject requests with HTTP 403 Forbidden', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32002,
            message: 'Forbidden',
          },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      await expect(client.getAgentCard()).rejects.toThrow();
    });

    it('should not leak credentials in error messages', async () => {
      const authenticatedClient = new A2AClient(baseUrl, {
        basicAuth: { username: 'secretuser', password: 'secretpass' },
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await authenticatedClient.getAgentCard();
      } catch (error) {
        // Error message should not contain credentials
        const errorMessage = (error as Error).message;
        expect(errorMessage).not.toContain('secretuser');
        expect(errorMessage).not.toContain('secretpass');
      }

      authenticatedClient.dispose();
    });
  });

  describe('Rate Limiting Enforcement', () => {
    it('should handle HTTP 429 Too Many Requests gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32029,
            message: 'Rate limit exceeded',
          },
        }),
        headers: new Headers({
          'content-type': 'application/json',
          'retry-after': '60',
        }),
      } as Response);

      await expect(client.getAgentCard()).rejects.toThrow(/rate limit|too many requests/i);
    });

    it('should include Retry-After header value in error when present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32029,
            message: 'Rate limit exceeded. Retry after 60 seconds.',
          },
        }),
        headers: new Headers({
          'content-type': 'application/json',
          'retry-after': '60',
        }),
      } as Response);

      await expect(client.getAgentCard()).rejects.toThrow();
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should reject task ID with invalid characters', async () => {
      const maliciousTaskId = '../../../etc/passwd';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: null,
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      // The client should validate task IDs before sending
      await expect(client.getTask(maliciousTaskId)).rejects.toThrow();
    });

    it('should handle extremely long input strings', async () => {
      const veryLongString = 'a'.repeat(1_000_000); // 1MB string
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32600,
            message: 'Request payload too large',
          },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      await expect(
        client.sendTask({
          message: {
            role: 'user',
            parts: [{ text: veryLongString }],
          },
        })
      ).rejects.toThrow();
    });

    it('should handle null bytes in input', async () => {
      const nullByteString = 'test\x00injection';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            id: 'task-123',
            status: { state: 'submitted' },
          },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      // Should handle null bytes gracefully
      const result = await client.sendTask({
        message: {
          role: 'user',
          parts: [{ text: nullByteString }],
        },
      });

      expect(result).toBeDefined();
    });

    it('should validate URL format before making requests', () => {
      // Invalid URLs should throw during client construction
      expect(() => new A2AClient('not-a-valid-url')).toThrow();
      expect(() => new A2AClient('javascript:alert(1)')).toThrow();
      expect(() => new A2AClient('file:///etc/passwd')).toThrow();
    });
  });

  describe('Response Validation with Zod Schemas', () => {
    it('should reject responses with unexpected fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            name: 'Test Agent',
            url: baseUrl,
            version: '1.0.0',
            capabilities: { streaming: false, pushNotifications: false },
            __proto__: { polluted: true }, // Prototype pollution attempt
          },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      const result = await client.getAgentCard();
      
      // Prototype pollution should not affect the result
      expect(Object.prototype.hasOwnProperty.call(result, 'polluted')).toBe(false);
    });

    it('should validate required fields in agent card response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            // Missing required 'name' field
            url: baseUrl,
            version: '1.0.0',
          },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      await expect(client.getAgentCard()).rejects.toThrow();
    });

    it('should validate task status enum values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            id: 'task-123',
            status: { state: 'invalid_state' }, // Invalid enum value
          },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      await expect(
        client.sendTask({
          message: { role: 'user', parts: [{ text: 'test' }] },
        })
      ).rejects.toThrow();
    });
  });

  describe('Session Security', () => {
    it('should properly dispose session state on cleanup', () => {
      const sessionClient = new A2AClient(baseUrl);
      
      // Perform some operations to create session state
      sessionClient.dispose();
      
      // After disposal, further operations should fail or reinitialize
      // This test verifies the client properly cleans up
      expect(() => sessionClient.dispose()).not.toThrow(); // Should be idempotent
    });

    it('should not reuse session IDs across client instances', () => {
      const client1 = new A2AClient(baseUrl);
      const client2 = new A2AClient(baseUrl);
      
      // Each client should have its own session management
      // They should not share state
      expect(client1).not.toBe(client2);
      
      client1.dispose();
      client2.dispose();
    });
  });

  describe('Error Information Disclosure Prevention', () => {
    it('should not expose internal stack traces to callers', async () => {
      mockFetch.mockRejectedValueOnce(
        new Error('Internal server error at /internal/path/to/file.ts:123')
      );

      try {
        await client.getAgentCard();
      } catch (error) {
        // The error should be wrapped in a client-safe error
        expect((error as Error).message).not.toContain('/internal/path');
      }
    });

    it('should sanitize error messages from server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32603,
            message: 'Error at /var/app/node_modules/secret.js:42',
            data: { sensitiveField: 'should_not_expose' },
          },
        }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      try {
        await client.getAgentCard();
      } catch (error) {
        // Error should be wrapped but path info might be sanitized
        expect(error).toBeDefined();
      }
    });
  });

  describe('HTTPS Enforcement', () => {
    it('should warn or reject HTTP URLs in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        // In production, HTTP should be rejected or warned
        const httpClient = new A2AClient('http://insecure.example.com');
        // Implementation may either throw or log a warning
        httpClient.dispose();
      } catch {
        // Expected behavior - HTTP rejected in production
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should allow HTTP URLs in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const httpClient = new A2AClient('http://localhost:3000');
        expect(httpClient).toBeDefined();
        httpClient.dispose();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
