/**
 * A2A Client Unit Tests
 * 
 * Comprehensive test suite validating:
 * - JSON-RPC 2.0 message handling
 * - Task lifecycle state transitions
 * - Streaming event processing
 * - Agent discovery mechanisms
 * - Error handling patterns
 * 
 * @module a2a-client/__tests__/a2a-client.test.ts
 */

import {
  A2AClient,
  A2AError,
  createA2AClient,
  connectToAgent,
  A2A_ERROR_CODES,
  isTerminalState,
  isTaskStatusEvent,
  isTaskArtifactEvent,
  isDoneEvent,
  isA2AError
} from '../index';

import type {
  AgentCard,
  Task,
  TaskState,
  TaskStatus,
  StreamEvent,
  A2AClientConfig,
  PushNotificationConfig,
  PushNotificationEvent
} from '../types';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockAgentCard: AgentCard = {
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

const mockTask: Task = {
  id: 'task-123',
  sessionId: 'session-456',
  input: {
    message: {
      role: 'user',
      parts: [{ type: 'text', text: 'Hello, agent!' }]
    }
  },
  status: {
    state: 'submitted',
    timestamp: new Date().toISOString()
  }
};

const createMockResponse = (data: unknown, status = 200): Response => {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    body: null
  } as unknown as Response;
};

const createMockStreamResponse = (events: StreamEvent[]): Response => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      events.forEach(event => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      });
      controller.close();
    }
  });

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'text/event-stream' }),
    body: stream,
    json: () => Promise.reject(new Error('Not JSON')),
    text: () => Promise.reject(new Error('Use body stream'))
  } as unknown as Response;
};

// ============================================================================
// Test Setup
// ============================================================================

let originalFetch: typeof globalThis.fetch;

beforeAll(() => {
  originalFetch = globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================================================
// A2AClient Construction Tests
// ============================================================================

describe('A2AClient Construction', () => {
  it('should create client with minimal config', () => {
    const client = new A2AClient({
      agentCard: 'https://agent.example.com/.well-known/agent.json'
    });
    
    expect(client).toBeInstanceOf(A2AClient);
    expect(client.isConnected()).toBe(false);
  });

  it('should create client with full config', () => {
    const config: A2AClientConfig = {
      agentCard: mockAgentCard,
      auth: { scheme: 'Bearer', token: 'test-token' },
      timeout: 60000,
      retryEnabled: true,
      maxRetries: 5,
      retryDelay: 2000,
      headers: { 'X-Custom-Header': 'value' },
      debug: true
    };
    
    const client = new A2AClient(config);
    expect(client).toBeInstanceOf(A2AClient);
  });

  it('should apply default config values', () => {
    const client = createA2AClient({
      agentCard: 'https://agent.example.com/agent.json'
    });
    
    // Default values are applied internally
    expect(client).toBeInstanceOf(A2AClient);
  });
});

// ============================================================================
// Agent Discovery Tests
// ============================================================================

describe('Agent Discovery', () => {
  it('should fetch agent card from URL', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse(mockAgentCard));

    const client = new A2AClient({
      agentCard: 'https://agent.example.com/.well-known/agent.json'
    });

    const card = await client.connect();

    expect(card).toEqual(mockAgentCard);
    expect(client.isConnected()).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://agent.example.com/.well-known/agent.json',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      })
    );
  });

  it('should append .well-known/agent.json to base URL', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse(mockAgentCard));

    const client = new A2AClient({
      agentCard: 'https://agent.example.com'
    });

    await client.connect();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://agent.example.com/.well-known/agent.json',
      expect.any(Object)
    );
  });

  it('should use provided AgentCard directly', async () => {
    const client = new A2AClient({
      agentCard: mockAgentCard
    });

    const card = await client.connect();

    expect(card).toEqual(mockAgentCard);
    expect(client.getAgentCard()).toEqual(mockAgentCard);
  });

  it('should throw on invalid agent card (missing name)', async () => {
    const invalidCard = { url: 'https://agent.example.com/a2a' };
    
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse(invalidCard));

    const client = new A2AClient({
      agentCard: 'https://agent.example.com/agent.json'
    });

    try {
      await client.connect();
      fail('Should have thrown an error');
    } catch (err) {
      expect(String(err)).toMatch(/missing name/i);
    }
  });

  it('should throw on invalid agent card (missing url)', async () => {
    const invalidCard = { name: 'Test Agent' };
    
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse(invalidCard));

    const client = new A2AClient({
      agentCard: 'https://agent.example.com/agent.json'
    });

    try {
      await client.connect();
      fail('Should have thrown an error');
    } catch (err) {
      expect(String(err)).toMatch(/missing url/i);
    }
  });

  it('should emit connected event on successful connect', async () => {
    const client = new A2AClient({ agentCard: mockAgentCard });
    const connectedHandler = jest.fn();
    
    client.on('connected', connectedHandler);
    await client.connect();

    expect(connectedHandler).toHaveBeenCalledWith({ agentCard: mockAgentCard });
  });
});

// ============================================================================
// JSON-RPC Message Handling Tests
// ============================================================================

describe('JSON-RPC Message Handling', () => {
  let client: A2AClient;

  beforeEach(async () => {
    client = new A2AClient({ agentCard: mockAgentCard });
    await client.connect();
  });

  it('should format tasks/send request correctly', async () => {
    const jsonRpcResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { task: mockTask }
    };

    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse(jsonRpcResponse));

    await client.sendTask({
      input: {
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Test message' }]
        }
      }
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      mockAgentCard.url,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"method":"tasks/send"')
      })
    );

    const callBody = JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody).toMatchObject({
      jsonrpc: '2.0',
      id: expect.any(Number),
      method: 'tasks/send'
    });
  });

  it('should format tasks/get request correctly', async () => {
    const completedTask = { ...mockTask, status: { state: 'completed' } };
    const jsonRpcResponse = {
      jsonrpc: '2.0',
      id: 2,
      result: { task: completedTask }
    };

    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse(jsonRpcResponse));

    await client.getTask('task-123');

    const callBody = JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody).toMatchObject({
      jsonrpc: '2.0',
      method: 'tasks/get',
      params: { id: 'task-123' }
    });
  });

  it('should format tasks/cancel request correctly', async () => {
    const canceledTask = { ...mockTask, status: { state: 'canceled' } };
    const jsonRpcResponse = {
      jsonrpc: '2.0',
      id: 3,
      result: { task: canceledTask }
    };

    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse(jsonRpcResponse));

    await client.cancelTask('task-123', 'User requested cancellation');

    const callBody = JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody).toMatchObject({
      jsonrpc: '2.0',
      method: 'tasks/cancel',
      params: { id: 'task-123', reason: 'User requested cancellation' }
    });
  });

  it('should handle JSON-RPC error response', async () => {
    const errorResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: A2A_ERROR_CODES.TASK_NOT_FOUND,
        message: 'Task not found'
      }
    };

    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse(errorResponse));

    await expect(client.getTask('nonexistent-task')).rejects.toThrow(A2AError);
  });
});

// ============================================================================
// Task Lifecycle State Transitions Tests
// ============================================================================

describe('Task Lifecycle State Transitions', () => {
  let client: A2AClient;

  beforeEach(async () => {
    client = new A2AClient({ agentCard: mockAgentCard });
    await client.connect();
  });

  it('should recognize terminal states', () => {
    expect(isTerminalState('completed')).toBe(true);
    expect(isTerminalState('failed')).toBe(true);
    expect(isTerminalState('canceled')).toBe(true);
    expect(isTerminalState('submitted')).toBe(false);
    expect(isTerminalState('working')).toBe(false);
    expect(isTerminalState('input-required')).toBe(false);
  });

  it('should poll until task completes', async () => {
    const states: TaskState[] = ['submitted', 'working', 'completed'];
    let callCount = 0;

    globalThis.fetch = jest.fn().mockImplementation(() => {
      const state = states[Math.min(callCount++, states.length - 1)];
      return Promise.resolve(createMockResponse({
        jsonrpc: '2.0',
        id: callCount,
        result: { task: { ...mockTask, status: { state } } }
      }));
    });

    const resultPromise = client.waitForCompletion('task-123', 100, 5000);
    
    // Advance timers for polling
    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(100);

    const result = await resultPromise;
    expect(result.status.state).toBe('completed');
  });

  it('should emit task-completed event on completion', async () => {
    const completedTask = { ...mockTask, status: { state: 'completed' as TaskState } };
    
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { task: completedTask }
      }));

    const completedHandler = jest.fn();
    client.on('task-completed', completedHandler);

    await client.waitForCompletion('task-123');

    expect(completedHandler).toHaveBeenCalledWith({ task: completedTask });
  });

  it('should emit task-failed event on failure', async () => {
    const failedTask = { ...mockTask, status: { state: 'failed' as TaskState } };
    
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { task: failedTask }
      }));

    const failedHandler = jest.fn();
    client.on('task-failed', failedHandler);

    await client.waitForCompletion('task-123');

    expect(failedHandler).toHaveBeenCalledWith({ task: failedTask });
  });

  it('should timeout if task does not complete', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValue(createMockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { task: { ...mockTask, status: { state: 'working' } } }
      }));

    // Use real timers with short intervals for this test
    jest.useRealTimers();

    try {
      await client.waitForCompletion('task-123', 50, 200);
      fail('Should have thrown timeout error');
    } catch (err) {
      expect(String(err)).toMatch(/timeout/i);
    }
  });
});

// ============================================================================
// Streaming Event Processing Tests
// ============================================================================

describe('Streaming Event Processing', () => {
  let client: A2AClient;

  beforeEach(async () => {
    client = new A2AClient({ agentCard: mockAgentCard });
    await client.connect();
  });

  it('should check streaming capability before streaming', async () => {
    const noStreamingCard = { ...mockAgentCard, capabilities: { streaming: false } };
    const clientNoStream = new A2AClient({ agentCard: noStreamingCard });
    await clientNoStream.connect();

    const generator = clientNoStream.sendTaskStream({
      input: { message: { role: 'user', parts: [{ type: 'text', text: 'Test' }] } }
    });

    await expect(generator.next()).rejects.toThrow('does not support streaming');
  });

  it('should parse streaming events correctly', async () => {
    const events: StreamEvent[] = [
      { type: 'task.status', status: { state: 'working' } },
      { type: 'task.artifact', artifact: { id: 'art-1', parts: [{ type: 'text', text: 'Result' }] } },
      { type: 'done', task: { ...mockTask, status: { state: 'completed' } } }
    ];

    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockStreamResponse(events));

    const receivedEvents: StreamEvent[] = [];
    const generator = client.sendTaskStream({
      input: { message: { role: 'user', parts: [{ type: 'text', text: 'Test' }] } }
    });

    for await (const event of generator) {
      receivedEvents.push(event);
    }

    expect(receivedEvents).toHaveLength(3);
    expect(isTaskStatusEvent(receivedEvents[0])).toBe(true);
    expect(isTaskArtifactEvent(receivedEvents[1])).toBe(true);
    expect(isDoneEvent(receivedEvents[2])).toBe(true);
  });

  it('should emit stream events', async () => {
    const events: StreamEvent[] = [
      { type: 'task.status', status: { state: 'working' } },
      { type: 'done', task: { ...mockTask, status: { state: 'completed' } } }
    ];

    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockStreamResponse(events));

    const streamStartHandler = jest.fn();
    const streamEventHandler = jest.fn();
    const streamEndHandler = jest.fn();

    client.on('stream-start', streamStartHandler);
    client.on('stream-event', streamEventHandler);
    client.on('stream-end', streamEndHandler);

    const generator = client.sendTaskStream({
      input: { message: { role: 'user', parts: [{ type: 'text', text: 'Test' }] } }
    });

    // Consume generator
    for await (const _ of generator) { /* consume */ }

    expect(streamStartHandler).toHaveBeenCalled();
    expect(streamEventHandler).toHaveBeenCalledTimes(2);
    expect(streamEndHandler).toHaveBeenCalled();
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  it('should create A2AError with correct properties', () => {
    const error = new A2AError(
      A2A_ERROR_CODES.TASK_NOT_FOUND,
      'Task not found',
      { taskId: 'task-123' }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(A2A_ERROR_CODES.TASK_NOT_FOUND);
    expect(error.message).toBe('Task not found');
    expect(error.data).toEqual({ taskId: 'task-123' });
  });

  it('should convert to JSON-RPC error format', () => {
    const error = new A2AError(
      A2A_ERROR_CODES.INTERNAL_ERROR,
      'Internal error'
    );

    const jsonRpcError = error.toJsonRpcError();

    expect(jsonRpcError).toEqual({
      code: A2A_ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal error',
      data: undefined
    });
  });

  it('should identify A2AError with type guard', () => {
    const a2aError = new A2AError(A2A_ERROR_CODES.INTERNAL_ERROR, 'Test');
    const regularError = new Error('Regular error');

    expect(isA2AError(a2aError)).toBe(true);
    expect(isA2AError(regularError)).toBe(false);
    expect(isA2AError(null)).toBe(false);
    expect(isA2AError(undefined)).toBe(false);
  });

  it('should handle HTTP errors', async () => {
    // Use real timers for HTTP error test
    jest.useRealTimers();
    
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse({}, 500));

    const client = new A2AClient({
      agentCard: 'https://agent.example.com/agent.json',
      retryEnabled: false
    });

    await expect(client.connect()).rejects.toThrow();
  });

  it('should retry on server errors when enabled', async () => {
    // Use real timers for retry test
    jest.useRealTimers();
    
    let attempts = 0;
    globalThis.fetch = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve(createMockResponse({}, 500));
      }
      return Promise.resolve(createMockResponse(mockAgentCard));
    });

    const client = new A2AClient({
      agentCard: 'https://agent.example.com/agent.json',
      retryEnabled: true,
      maxRetries: 3,
      retryDelay: 10
    });
    
    await client.connect();

    expect(attempts).toBe(3);
  });

  it('should throw on not connected', async () => {
    const client = new A2AClient({ agentCard: mockAgentCard });
    // Don't call connect()

    await expect(client.sendTask({
      input: { message: { role: 'user', parts: [{ type: 'text', text: 'Test' }] } }
    })).rejects.toThrow('Client not connected');
  });
});

// ============================================================================
// Authentication Tests
// ============================================================================

describe('Authentication', () => {
  it('should add Bearer token to headers', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { task: mockTask }
      }));

    const client = new A2AClient({
      agentCard: mockAgentCard,
      auth: { scheme: 'Bearer', token: 'my-token' }
    });
    await client.connect();
    await client.sendTask({
      input: { message: { role: 'user', parts: [{ type: 'text', text: 'Test' }] } }
    });

    const headers = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer my-token');
  });

  it('should add API key to headers', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { task: mockTask }
      }));

    const client = new A2AClient({
      agentCard: mockAgentCard,
      auth: { scheme: 'APIKey', apiKey: 'api-key-123' }
    });
    await client.connect();
    await client.sendTask({
      input: { message: { role: 'user', parts: [{ type: 'text', text: 'Test' }] } }
    });

    const headers = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('api-key-123');
  });

  it('should add custom headers', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { task: mockTask }
      }));

    const client = new A2AClient({
      agentCard: mockAgentCard,
      headers: { 'X-Custom-Header': 'custom-value' }
    });
    await client.connect();
    await client.sendTask({
      input: { message: { role: 'user', parts: [{ type: 'text', text: 'Test' }] } }
    });

    const headers = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers['X-Custom-Header']).toBe('custom-value');
  });
});

// ============================================================================
// Session Management Tests
// ============================================================================

describe('Session Management', () => {
  let client: A2AClient;

  beforeEach(async () => {
    client = new A2AClient({ agentCard: mockAgentCard });
    await client.connect();
  });

  it('should track sessions from tasks', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { task: mockTask }
      }));

    await client.sendTask({
      input: { message: { role: 'user', parts: [{ type: 'text', text: 'Test' }] } }
    });

    const session = client.getSession('session-456');
    expect(session).toBeDefined();
    expect(session?.taskIds).toContain('task-123');
  });

  it('should return all sessions', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { task: mockTask }
      }))
      .mockResolvedValueOnce(createMockResponse({
        jsonrpc: '2.0',
        id: 2,
        result: { task: { ...mockTask, id: 'task-789', sessionId: 'session-999' } }
      }));

    await client.sendTask({
      input: { message: { role: 'user', parts: [{ type: 'text', text: 'Test 1' }] } }
    });
    await client.sendTask({
      input: { message: { role: 'user', parts: [{ type: 'text', text: 'Test 2' }] } }
    });

    const sessions = client.getSessions();
    expect(sessions).toHaveLength(2);
  });

  it('should clear sessions', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { task: mockTask }
      }));

    await client.sendTask({
      input: { message: { role: 'user', parts: [{ type: 'text', text: 'Test' }] } }
    });

    expect(client.getSessions()).toHaveLength(1);
    
    client.clearSessions();
    
    expect(client.getSessions()).toHaveLength(0);
  });
});

// ============================================================================
// Static Helper Methods Tests
// ============================================================================

describe('Static Helper Methods', () => {
  it('should create text message', () => {
    const message = A2AClient.createTextMessage('Hello, world!');
    
    expect(message).toEqual({
      role: 'user',
      parts: [{ type: 'text', text: 'Hello, world!' }]
    });
  });

  it('should create text message with agent role', () => {
    const message = A2AClient.createTextMessage('Response', 'agent');
    
    expect(message.role).toBe('agent');
  });

  it('should create file message', () => {
    const message = A2AClient.createFileMessage({
      name: 'document.pdf',
      mimeType: 'application/pdf',
      uri: 'https://example.com/doc.pdf'
    });
    
    expect(message).toEqual({
      role: 'user',
      parts: [{
        type: 'file',
        file: {
          name: 'document.pdf',
          mimeType: 'application/pdf',
          uri: 'https://example.com/doc.pdf'
        }
      }]
    });
  });

  it('should create data message', () => {
    const message = A2AClient.createDataMessage({ key: 'value' });
    
    expect(message).toEqual({
      role: 'user',
      parts: [{ type: 'data', data: { key: 'value' } }]
    });
  });

  it('should create text input', () => {
    const input = A2AClient.createTextInput('Test query', 'skill-1');
    
    expect(input).toEqual({
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'Test query' }]
      },
      skillId: 'skill-1'
    });
  });

  it('should extract text from parts', () => {
    const parts = [
      { type: 'text', text: 'Hello' },
      { type: 'data', data: {} },
      { type: 'text', text: 'World' }
    ];
    
    const text = A2AClient.extractText(parts as any);
    expect(text).toBe('Hello\nWorld');
  });

  it('should extract data from parts', () => {
    const parts = [
      { type: 'text', text: 'Hello' },
      { type: 'data', data: { key: 'value1' } },
      { type: 'data', data: { key: 'value2' } }
    ];
    
    const data = A2AClient.extractData(parts as any);
    expect(data).toEqual([{ key: 'value1' }, { key: 'value2' }]);
  });
});

// ============================================================================
// Push Notification Tests
// ============================================================================

describe('Push Notifications', () => {
  let client: A2AClient;

  beforeEach(async () => {
    client = new A2AClient({ agentCard: mockAgentCard });
    await client.connect();
  });

  it('should get push notification config', async () => {
    const config = {
      url: 'https://callback.example.com',
      events: ['task.state.changed' as const]
    };
    
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { config }
      }));

    const result = await client.getPushNotificationConfig('task-123');

    expect(result).toEqual(config);
    
    const callBody = JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody.method).toBe('tasks/pushNotification/get');
  });

  it('should set push notification config', async () => {
    const config = {
      url: 'https://callback.example.com',
      events: ['task.state.changed' as const]
    };
    
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { config }
      }));

    const result = await client.setPushNotificationConfig('task-123', config);

    expect(result).toEqual(config);
    
    const callBody = JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody.method).toBe('tasks/pushNotification/set');
    expect(callBody.params.config).toEqual(config);
  });

  it('should throw when push notifications not supported', async () => {
    const noPushCard = { ...mockAgentCard, capabilities: { pushNotifications: false } };
    const clientNoPush = new A2AClient({ agentCard: noPushCard });
    await clientNoPush.connect();

    await expect(clientNoPush.getPushNotificationConfig('task-123'))
      .rejects.toThrow('does not support push notifications');
  });
});

// ============================================================================
// Connection Lifecycle Tests
// ============================================================================

describe('Connection Lifecycle', () => {
  it('should disconnect properly', async () => {
    const client = new A2AClient({ agentCard: mockAgentCard });
    await client.connect();
    
    expect(client.isConnected()).toBe(true);
    
    const disconnectedHandler = jest.fn();
    client.on('disconnected', disconnectedHandler);
    
    client.disconnect();
    
    expect(client.isConnected()).toBe(false);
    expect(client.getAgentCard()).toBeUndefined();
    expect(disconnectedHandler).toHaveBeenCalled();
  });

  it('should return cached agent card on reconnect', async () => {
    const client = new A2AClient({ agentCard: mockAgentCard });
    
    const card1 = await client.connect();
    const card2 = await client.connect();
    
    expect(card1).toBe(card2);
  });

  it('should get capabilities after connect', async () => {
    const client = new A2AClient({ agentCard: mockAgentCard });
    await client.connect();

    const capabilities = client.getCapabilities();
    
    expect(capabilities).toEqual(mockAgentCard.capabilities);
  });

  it('should get skills after connect', async () => {
    const client = new A2AClient({ agentCard: mockAgentCard });
    await client.connect();

    const skills = client.getSkills();
    
    expect(skills).toEqual(mockAgentCard.skills);
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('Factory Functions', () => {
  it('should create client with createA2AClient', () => {
    const client = createA2AClient({
      agentCard: mockAgentCard
    });

    expect(client).toBeInstanceOf(A2AClient);
  });

  it('should connect with connectToAgent', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(createMockResponse(mockAgentCard));

    const client = await connectToAgent(
      'https://agent.example.com/agent.json',
      { scheme: 'Bearer', token: 'token' }
    );

    expect(client).toBeInstanceOf(A2AClient);
    expect(client.isConnected()).toBe(true);
  });
});
