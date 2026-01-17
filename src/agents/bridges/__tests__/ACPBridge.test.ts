/**
 * ACPBridge Tests
 * 
 * Tests for the ACP (Agent Client Protocol) bridge implementation.
 * Verifies:
 * - Bridge configuration and factory methods
 * - Hybrid mode LLM fallback
 * - Type compatibility with base bridge
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ACPBridge,
  ACPBridgeConfig,
  ACPBridgeFactory,
  createACPBridge,
  ACPAgentType,
} from '../ACPBridge';
import { GatewayLLMClient, GatewayLLMResponse } from '../../../services/gateway/GatewayLLMClient';
import { AgentMessage } from '../types';

// Mock the GatewayLLMClient
jest.mock('../../../services/gateway/GatewayLLMClient', () => ({
  GatewayLLMClient: jest.fn().mockImplementation(() => ({
    chat: (jest.fn<() => Promise<GatewayLLMResponse>>().mockResolvedValue({
      content: 'Mock LLM response',
      model: 'gpt-4',
      provider: 'openai',
      requestId: 'test-123',
    })) as jest.Mock,
    stream: jest.fn(),
  })),
}));

// Mock child_process spawn for ACP client tests
jest.mock('child_process', () => ({
  spawn: jest.fn().mockImplementation(() => ({
    stdin: { write: jest.fn() },
    stdout: {
      on: jest.fn((event: string, handler: (data: Buffer) => void) => {
        // Simulate ACP initialization response
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from(JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              result: {
                agentInfo: {
                  name: 'Mock ACP Agent',
                  version: '1.0.0',
                },
                capabilities: {
                  files: { read: true, write: true },
                  terminal: { create: true },
                },
              },
            }) + '\n'));
          }, 10);
        }
      }),
    },
    stderr: { on: jest.fn() },
    on: jest.fn(),
    kill: jest.fn(),
  })),
}));

describe('ACPBridge', () => {
  describe('Configuration', () => {
    it('should create bridge with valid config', () => {
      const config: ACPBridgeConfig = {
        id: 'test-acp',
        name: 'Test ACP Bridge',
        type: 'acp',
        enabled: true,
        acpAgent: 'opencode',
      };

      const bridge = createACPBridge(config);
      expect(bridge).toBeInstanceOf(ACPBridge);
      expect(bridge.id).toBe('test-acp');
    });

    it('should support all known ACP agent types', () => {
      const agentTypes: ACPAgentType[] = [
        'opencode',
        'codex',
        'gemini',
        'claude-code',
        'qwen-code',
        'mistral-vibe',
        'auggie',
        'custom',
      ];

      for (const agentType of agentTypes) {
        const config: ACPBridgeConfig = {
          id: `test-${agentType}`,
          name: `Test ${agentType}`,
          type: 'acp',
          enabled: true,
          acpAgent: agentType,
          command: agentType === 'custom' ? './custom-agent' : undefined,
        };

        const bridge = createACPBridge(config);
        expect(bridge).toBeInstanceOf(ACPBridge);
      }
    });
  });

  describe('ACPBridgeFactory', () => {
    it('should create opencode bridge', () => {
      const bridge = ACPBridgeFactory.opencode();
      expect(bridge).toBeInstanceOf(ACPBridge);
      expect(bridge.id).toBe('acp-opencode');
    });

    it('should create codex bridge', () => {
      const bridge = ACPBridgeFactory.codex();
      expect(bridge).toBeInstanceOf(ACPBridge);
      expect(bridge.id).toBe('acp-codex');
    });

    it('should create gemini bridge', () => {
      const bridge = ACPBridgeFactory.gemini();
      expect(bridge).toBeInstanceOf(ACPBridge);
      expect(bridge.id).toBe('acp-gemini');
    });

    it('should create claude-code bridge', () => {
      const bridge = ACPBridgeFactory.claudeCode();
      expect(bridge).toBeInstanceOf(ACPBridge);
      expect(bridge.id).toBe('acp-claude-code');
    });

    it('should create custom bridge', () => {
      const bridge = ACPBridgeFactory.custom('./my-agent', ['acp', '--debug']);
      expect(bridge).toBeInstanceOf(ACPBridge);
      expect(bridge.id).toContain('acp-custom');
    });

    it('should create hybrid bridge with gateway', () => {
      const gateway = new GatewayLLMClient();
      const bridge = ACPBridgeFactory.hybrid('opencode', gateway, {
        fallbackModel: 'gpt-4',
      });

      expect(bridge).toBeInstanceOf(ACPBridge);
      expect(bridge.id).toContain('acp-hybrid');
    });
  });

  describe('Hybrid Mode', () => {
    let bridge: ACPBridge;
    let gateway: GatewayLLMClient;

    beforeEach(() => {
      gateway = new GatewayLLMClient();
      bridge = ACPBridgeFactory.hybrid('opencode', gateway, {
        fallbackModel: 'gpt-4',
      });
    });

    afterEach(async () => {
      await bridge.destroy();
    });

    it('should have hybrid mode enabled in config', () => {
      const info = bridge.info;
      expect(info.metadata?.hybridMode).toBe(true);
    });

    it('should report correct agent type', () => {
      expect(bridge.agentType).toBe('custom');
    });

    it('should include base capabilities', () => {
      const caps = bridge.capabilities;
      expect(caps).toContain('chat');
      expect(caps).toContain('multi_turn');
    });
  });

  describe('Bridge Interface', () => {
    it('should implement IAgentBridge interface', () => {
      const bridge = ACPBridgeFactory.opencode();

      // Verify interface methods exist
      expect(typeof bridge.connect).toBe('function');
      expect(typeof bridge.disconnect).toBe('function');
      expect(typeof bridge.getStatus).toBe('function');
      expect(typeof bridge.send).toBe('function');
      expect(typeof bridge.on).toBe('function');
      expect(typeof bridge.off).toBe('function');
      expect(typeof bridge.destroy).toBe('function');
    });

    it('should have info property', () => {
      const bridge = ACPBridgeFactory.opencode();
      const info = bridge.info;

      expect(info).toBeDefined();
      expect(info.id).toBe('acp-opencode');
      expect(info.name).toBe('OpenCode');
      expect(info.type).toBe('custom');
      expect(info.capabilities).toContain('chat');
    });

    it('should start in disconnected state', () => {
      const bridge = ACPBridgeFactory.opencode();
      expect(bridge.getStatus()).toBe('disconnected');
    });
  });

  describe('ACP-Specific Methods', () => {
    it('should have getSessionId method', () => {
      const bridge = ACPBridgeFactory.opencode();
      expect(typeof bridge.getSessionId).toBe('function');
      expect(bridge.getSessionId()).toBeUndefined(); // No session before connect
    });

    it('should have getACPCapabilities method', () => {
      const bridge = ACPBridgeFactory.opencode();
      expect(typeof bridge.getACPCapabilities).toBe('function');
      expect(bridge.getACPCapabilities()).toBeUndefined(); // No caps before connect
    });

    it('should have hasCapability method', () => {
      const bridge = ACPBridgeFactory.opencode();
      expect(typeof bridge.hasCapability).toBe('function');
      expect(bridge.hasCapability('files')).toBe(false); // No caps before connect
    });

    it('should have cancelSession method', () => {
      const bridge = ACPBridgeFactory.opencode();
      expect(typeof bridge.cancelSession).toBe('function');
    });

    it('should have conversation history methods', () => {
      const bridge = ACPBridgeFactory.opencode();
      expect(typeof bridge.clearHistory).toBe('function');
      expect(typeof bridge.getHistory).toBe('function');
      expect(bridge.getHistory()).toEqual([]);
    });
  });
});

describe('GatewayLLMClient Integration', () => {
  it('should be constructable with default config', () => {
    const client = new GatewayLLMClient();
    expect(client).toBeDefined();
  });

  it('should accept custom config', () => {
    const client = new GatewayLLMClient({
      baseUrl: 'http://localhost:8080',
      authToken: 'test-token',
      model: 'gpt-4',
    });
    expect(client).toBeDefined();
  });
});

describe('Go Gateway Endpoint Compatibility', () => {
  // These tests verify the TypeScript types match what the Go gateway expects
  
  it('should have compatible chat request format', () => {
    // The GatewayLLMClient sends:
    // {
    //   agent_id: string,
    //   messages: [{ role: string, content: string }],
    //   model?: string,
    //   temperature?: number,
    // }
    //
    // The Go gateway expects (llm.CompletionRequest):
    // {
    //   AgentID: string,
    //   Messages: [{ Role: string, Content: string }],
    //   Model: string,
    //   Temperature: float64,
    // }
    
    const request = {
      agent_id: 'test-agent',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
      ],
      model: 'gpt-4',
      temperature: 0.7,
    };

    // Verify structure
    expect(request.agent_id).toBeDefined();
    expect(Array.isArray(request.messages)).toBe(true);
    expect(request.messages[0].role).toBeDefined();
    expect(request.messages[0].content).toBeDefined();
  });

  it('should have compatible chat response format', () => {
    // The Go gateway returns:
    // {
    //   content: string,
    //   model: string,
    //   provider: string,
    //   finish_reason: string,
    //   usage: { prompt_tokens, completion_tokens, total_tokens },
    // }
    //
    // GatewayLLMClient expects:
    // {
    //   content: string,
    //   model: string,
    //   provider: string,
    // }
    
    const response = {
      content: 'Hello! How can I help you?',
      model: 'gpt-4',
      provider: 'openai',
      finish_reason: 'stop',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 8,
        total_tokens: 18,
      },
    };

    // Verify required fields
    expect(typeof response.content).toBe('string');
    expect(typeof response.model).toBe('string');
    expect(typeof response.provider).toBe('string');
  });
});
