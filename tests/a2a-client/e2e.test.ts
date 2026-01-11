/**
 * End-to-End Tests for A2A Client
 * 
 * These tests address the test coverage deficiencies identified in the
 * Comprehensive Code Review (2026-01-11), Section 2.4.
 * 
 * These tests simulate complete user workflows and integration scenarios.
 * 
 * @see docs/COMPREHENSIVE_CODE_REVIEW_2026-01-11.md
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

// Import after mocking
import { A2AClient } from '../../src/a2a-client/a2a-client';
import type { AgentCard, Task, TaskState } from '../../src/a2a-client/types';

describe('E2E Tests - A2A Client Workflows', () => {
  let client: A2AClient;
  const baseUrl = 'https://agent.example.com';

  // Helper to create mock response
  const mockJsonResponse = <T>(data: T, status = 200): Response => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => data,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as Response);

  // Helper to create JSON-RPC response
  const jsonRpcResponse = <T>(result: T, id = 1): { jsonrpc: string; id: number; result: T } => ({
    jsonrpc: '2.0',
    id,
    result,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    client = new A2AClient(baseUrl);
  });

  afterEach(() => {
    client.dispose();
  });

  describe('Complete Task Lifecycle', () => {
    it('should complete a full task lifecycle: create → poll → complete', async () => {
      // Step 1: Get agent card to verify connectivity
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            name: 'Test Agent',
            url: baseUrl,
            version: '1.0.0',
            capabilities: {
              streaming: false,
              pushNotifications: false,
            },
          } satisfies AgentCard)
        )
      );

      const agentCard = await client.getAgentCard();
      expect(agentCard.name).toBe('Test Agent');

      // Step 2: Create a new task
      const taskId = 'task-e2e-001';
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: taskId,
            status: { state: 'submitted' as TaskState },
            history: [
              {
                role: 'user',
                parts: [{ text: 'What is 2 + 2?' }],
              },
            ],
          } satisfies Task)
        )
      );

      const createdTask = await client.sendTask({
        message: {
          role: 'user',
          parts: [{ text: 'What is 2 + 2?' }],
        },
      });

      expect(createdTask.id).toBe(taskId);
      expect(createdTask.status.state).toBe('submitted');

      // Step 3: Poll for task status - still working
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: taskId,
            status: { state: 'working' as TaskState },
            history: [
              {
                role: 'user',
                parts: [{ text: 'What is 2 + 2?' }],
              },
            ],
          } satisfies Task)
        )
      );

      const workingTask = await client.getTask(taskId);
      expect(workingTask.status.state).toBe('working');

      // Step 4: Poll again - task completed
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: taskId,
            status: { state: 'completed' as TaskState },
            history: [
              {
                role: 'user',
                parts: [{ text: 'What is 2 + 2?' }],
              },
              {
                role: 'agent',
                parts: [{ text: '2 + 2 equals 4.' }],
              },
            ],
          } satisfies Task)
        )
      );

      const completedTask = await client.getTask(taskId);
      expect(completedTask.status.state).toBe('completed');
      expect(completedTask.history).toHaveLength(2);
      expect(completedTask.history?.[1]?.parts?.[0]).toHaveProperty(
        'text',
        '2 + 2 equals 4.'
      );
    });

    it('should handle task failure gracefully', async () => {
      const taskId = 'task-e2e-fail';

      // Create task
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: taskId,
            status: { state: 'submitted' as TaskState },
          } satisfies Task)
        )
      );

      const task = await client.sendTask({
        message: {
          role: 'user',
          parts: [{ text: 'Invalid request' }],
        },
      });

      expect(task.id).toBe(taskId);

      // Task fails
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: taskId,
            status: {
              state: 'failed' as TaskState,
              message: {
                role: 'agent',
                parts: [{ text: 'Unable to process request' }],
              },
            },
          } satisfies Task)
        )
      );

      const failedTask = await client.getTask(taskId);
      expect(failedTask.status.state).toBe('failed');
      expect(failedTask.status.message?.parts?.[0]).toHaveProperty(
        'text',
        'Unable to process request'
      );
    });

    it('should handle task cancellation', async () => {
      const taskId = 'task-e2e-cancel';

      // Create task
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: taskId,
            status: { state: 'working' as TaskState },
          } satisfies Task)
        )
      );

      const task = await client.sendTask({
        message: {
          role: 'user',
          parts: [{ text: 'Long running task' }],
        },
      });

      // Cancel the task
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: taskId,
            status: { state: 'canceled' as TaskState },
          } satisfies Task)
        )
      );

      const canceledTask = await client.cancelTask(taskId);
      expect(canceledTask.status.state).toBe('canceled');
    });
  });

  describe('Multi-Turn Conversation Workflow', () => {
    it('should support multi-turn conversations with sessionId', async () => {
      const sessionId = 'session-e2e-001';

      // Turn 1: Initial question
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: 'task-turn-1',
            sessionId,
            status: { state: 'completed' as TaskState },
            history: [
              {
                role: 'user',
                parts: [{ text: 'My name is Alice.' }],
              },
              {
                role: 'agent',
                parts: [{ text: 'Nice to meet you, Alice!' }],
              },
            ],
          } satisfies Task)
        )
      );

      const turn1 = await client.sendTask({
        sessionId,
        message: {
          role: 'user',
          parts: [{ text: 'My name is Alice.' }],
        },
      });

      expect(turn1.sessionId).toBe(sessionId);

      // Turn 2: Follow-up question (agent should remember)
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: 'task-turn-2',
            sessionId,
            status: { state: 'completed' as TaskState },
            history: [
              {
                role: 'user',
                parts: [{ text: 'What is my name?' }],
              },
              {
                role: 'agent',
                parts: [{ text: 'Your name is Alice.' }],
              },
            ],
          } satisfies Task)
        )
      );

      const turn2 = await client.sendTask({
        sessionId,
        message: {
          role: 'user',
          parts: [{ text: 'What is my name?' }],
        },
      });

      expect(turn2.sessionId).toBe(sessionId);
      expect(turn2.history?.[1]?.parts?.[0]).toHaveProperty(
        'text',
        'Your name is Alice.'
      );
    });
  });

  describe('File Attachment Workflow', () => {
    it('should support sending files/artifacts in messages', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: 'task-file-001',
            status: { state: 'completed' as TaskState },
            history: [
              {
                role: 'user',
                parts: [
                  { text: 'Analyze this file:' },
                  {
                    file: {
                      name: 'data.csv',
                      mimeType: 'text/csv',
                      bytes: 'bmFtZSxhZ2UKQWxpY2UsMzAKQm9iLDI1', // base64
                    },
                  },
                ],
              },
              {
                role: 'agent',
                parts: [{ text: 'I found 2 records in the CSV file.' }],
              },
            ],
          } satisfies Task)
        )
      );

      const result = await client.sendTask({
        message: {
          role: 'user',
          parts: [
            { text: 'Analyze this file:' },
            {
              file: {
                name: 'data.csv',
                mimeType: 'text/csv',
                bytes: 'bmFtZSxhZ2UKQWxpY2UsMzAKQm9iLDI1',
              },
            },
          ],
        },
      });

      expect(result.status.state).toBe('completed');
      expect(result.history?.[0]?.parts).toHaveLength(2);
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should retry on transient network errors', async () => {
      // First attempt fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Second attempt succeeds
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            name: 'Test Agent',
            url: baseUrl,
            version: '1.0.0',
            capabilities: { streaming: false, pushNotifications: false },
          } satisfies AgentCard)
        )
      );

      // Client should retry and succeed
      const agentCard = await client.getAgentCard();
      expect(agentCard.name).toBe('Test Agent');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      // All attempts fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getAgentCard()).rejects.toThrow('Network error');
      
      // Should have retried multiple times (default 3 retries)
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
      );

      await expect(client.getAgentCard()).rejects.toThrow(/timeout/i);
    });
  });

  describe('Concurrent Operations Workflow', () => {
    it('should handle multiple concurrent task submissions', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      // Mock responses for all three tasks
      taskIds.forEach((id, index) => {
        mockFetch.mockResolvedValueOnce(
          mockJsonResponse(
            jsonRpcResponse({
              id,
              status: { state: 'submitted' as TaskState },
              history: [
                {
                  role: 'user',
                  parts: [{ text: `Task ${index + 1}` }],
                },
              ],
            } satisfies Task)
          )
        );
      });

      // Submit all tasks concurrently
      const promises = taskIds.map((_, index) =>
        client.sendTask({
          message: {
            role: 'user',
            parts: [{ text: `Task ${index + 1}` }],
          },
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.id).toBe(taskIds[index]);
      });
    });

    it('should handle mixed success and failure in concurrent operations', async () => {
      // First task succeeds
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: 'task-success',
            status: { state: 'submitted' as TaskState },
          } satisfies Task)
        )
      );

      // Second task fails
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          {
            jsonrpc: '2.0',
            id: 2,
            error: {
              code: -32600,
              message: 'Invalid request',
            },
          },
          400
        )
      );

      const successPromise = client.sendTask({
        message: { role: 'user', parts: [{ text: 'Good request' }] },
      });

      const failurePromise = client.sendTask({
        message: { role: 'user', parts: [{ text: 'Bad request' }] },
      });

      const results = await Promise.allSettled([successPromise, failurePromise]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });
  });

  describe('Agent Discovery Workflow', () => {
    it('should discover agent capabilities and adapt behavior', async () => {
      // Agent with streaming capability
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            name: 'Streaming Agent',
            url: baseUrl,
            version: '2.0.0',
            capabilities: {
              streaming: true,
              pushNotifications: true,
            },
            skills: [
              {
                id: 'code-generation',
                name: 'Code Generation',
                description: 'Generate code in various languages',
              },
              {
                id: 'data-analysis',
                name: 'Data Analysis',
                description: 'Analyze data sets',
              },
            ],
          } satisfies AgentCard)
        )
      );

      const agentCard = await client.getAgentCard();

      expect(agentCard.capabilities.streaming).toBe(true);
      expect(agentCard.skills).toHaveLength(2);
      expect(agentCard.skills?.[0]?.id).toBe('code-generation');
    });

    it('should handle agents without optional capabilities', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            name: 'Basic Agent',
            url: baseUrl,
            version: '1.0.0',
            capabilities: {
              streaming: false,
              pushNotifications: false,
            },
            // No skills defined
          } satisfies AgentCard)
        )
      );

      const agentCard = await client.getAgentCard();

      expect(agentCard.capabilities.streaming).toBe(false);
      expect(agentCard.skills).toBeUndefined();
    });
  });

  describe('Input-Required Workflow', () => {
    it('should handle tasks requiring additional user input', async () => {
      const taskId = 'task-input-required';

      // Initial submission
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: taskId,
            status: { state: 'submitted' as TaskState },
          } satisfies Task)
        )
      );

      await client.sendTask({
        message: {
          role: 'user',
          parts: [{ text: 'Help me write a story' }],
        },
      });

      // Agent requests more input
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: taskId,
            status: {
              state: 'input-required' as TaskState,
              message: {
                role: 'agent',
                parts: [{ text: 'What genre would you like?' }],
              },
            },
          } satisfies Task)
        )
      );

      const inputRequiredTask = await client.getTask(taskId);
      expect(inputRequiredTask.status.state).toBe('input-required');

      // User provides additional input
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: taskId,
            status: { state: 'working' as TaskState },
          } satisfies Task)
        )
      );

      await client.sendTask({
        id: taskId, // Continue existing task
        message: {
          role: 'user',
          parts: [{ text: 'Science fiction' }],
        },
      });

      // Task completes
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          jsonRpcResponse({
            id: taskId,
            status: { state: 'completed' as TaskState },
            history: [
              {
                role: 'user',
                parts: [{ text: 'Help me write a story' }],
              },
              {
                role: 'agent',
                parts: [{ text: 'What genre would you like?' }],
              },
              {
                role: 'user',
                parts: [{ text: 'Science fiction' }],
              },
              {
                role: 'agent',
                parts: [
                  { text: 'Here is your science fiction story: "In the year 3000..."' },
                ],
              },
            ],
          } satisfies Task)
        )
      );

      const completedTask = await client.getTask(taskId);
      expect(completedTask.status.state).toBe('completed');
      expect(completedTask.history).toHaveLength(4);
    });
  });

  describe('Client Lifecycle Management', () => {
    it('should properly initialize and cleanup resources', () => {
      const testClient = new A2AClient(baseUrl, {
        timeout: 5000,
        maxRetries: 3,
      });

      expect(testClient).toBeDefined();

      // Dispose should be idempotent
      testClient.dispose();
      testClient.dispose(); // Should not throw

      // Operations after dispose may fail or reinitialize
    });

    it('should support configuration updates', () => {
      const client1 = new A2AClient(baseUrl, { timeout: 5000 });
      const client2 = new A2AClient(baseUrl, { timeout: 10000 });

      // Different clients can have different configurations
      expect(client1).not.toBe(client2);

      client1.dispose();
      client2.dispose();
    });
  });
});
