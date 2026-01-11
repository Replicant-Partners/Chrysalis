/**
 * Tests for Bridge Type Definitions
 * 
 * @module tests/bridge/types
 */

import {
  uri,
  isoTimestamp,
  agentId,
  generateCorrelationId,
  AGENT_FRAMEWORKS,
  isAgentFramework,
  isUSAAgent,
  isLMOSAgent,
  isMCPAgent,
  isLangChainAgent,
  isNativeAgent,
  isCanonicalAgent,
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  mapResult,
  flatMapResult,
  type URI,
  type ISOTimestamp,
  type AgentId,
  type CorrelationId,
  type AgentFramework,
  type NativeAgent,
  type CanonicalAgent,
  type USAAgentData,
  type LMOSAgentData,
  type MCPAgentData,
  type LangChainAgentData,
  type Result,
} from '../../src/bridge/types';

import { BridgeError } from '../../src/bridge/errors';

describe('Branded Type Factories', () => {
  describe('uri()', () => {
    it('should create a valid URI', () => {
      const result: URI = uri('urn:chrysalis:agent:test');
      expect(result).toBe('urn:chrysalis:agent:test');
    });

    it('should preserve URI as string', () => {
      const testUri: URI = uri('https://example.com');
      const str: string = testUri; // Should compile
      expect(str).toBe('https://example.com');
    });
  });

  describe('isoTimestamp()', () => {
    it('should create timestamp from Date', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result: ISOTimestamp = isoTimestamp(date);
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should create timestamp from string', () => {
      const result: ISOTimestamp = isoTimestamp('2024-01-15T10:30:00Z');
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should create current timestamp when no argument', () => {
      const before = Date.now();
      const result: ISOTimestamp = isoTimestamp();
      const after = Date.now();
      
      const resultTime = new Date(result).getTime();
      expect(resultTime).toBeGreaterThanOrEqual(before);
      expect(resultTime).toBeLessThanOrEqual(after);
    });
  });

  describe('agentId()', () => {
    it('should create agent ID from string', () => {
      const result: AgentId = agentId('agent-123');
      expect(result).toBe('agent-123');
    });

    it('should generate UUID when no argument', () => {
      const result: AgentId = agentId();
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('generateCorrelationId()', () => {
    it('should generate unique correlation IDs', () => {
      const id1: CorrelationId = generateCorrelationId();
      const id2: CorrelationId = generateCorrelationId();
      
      expect(id1).not.toBe(id2);
    });

    it('should have correct format', () => {
      const id: CorrelationId = generateCorrelationId();
      // Should be a UUID
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });
});

describe('Agent Framework Types', () => {
  describe('AGENT_FRAMEWORKS', () => {
    it('should contain all supported frameworks', () => {
      expect(AGENT_FRAMEWORKS).toContain('USA');
      expect(AGENT_FRAMEWORKS).toContain('LMOS');
      expect(AGENT_FRAMEWORKS).toContain('MCP');
      expect(AGENT_FRAMEWORKS).toContain('LangChain');
      expect(AGENT_FRAMEWORKS).toContain('OpenAI');
      expect(AGENT_FRAMEWORKS).toContain('SemanticKernel');
    });

    it('should be readonly', () => {
      // @ts-expect-error - attempting to modify readonly array
      expect(() => { AGENT_FRAMEWORKS.push('New'); }).toThrow();
    });
  });

  describe('isAgentFramework()', () => {
    it('should return true for valid frameworks', () => {
      expect(isAgentFramework('USA')).toBe(true);
      expect(isAgentFramework('LMOS')).toBe(true);
      expect(isAgentFramework('MCP')).toBe(true);
      expect(isAgentFramework('LangChain')).toBe(true);
    });

    it('should return false for invalid frameworks', () => {
      expect(isAgentFramework('Unknown')).toBe(false);
      expect(isAgentFramework('')).toBe(false);
      expect(isAgentFramework(null)).toBe(false);
      expect(isAgentFramework(undefined)).toBe(false);
    });
  });
});

describe('Agent Type Guards', () => {
  const usaAgent: NativeAgent<USAAgentData> = {
    framework: 'USA',
    data: {
      apiVersion: 'usa/v2',
      kind: 'Agent',
      metadata: { name: 'test', namespace: 'default' },
      identity: { id: 'test-id', name: 'Test' },
      execution: { runtime: 'node' },
    },
  };

  const lmosAgent: NativeAgent<LMOSAgentData> = {
    framework: 'LMOS',
    data: {
      name: 'test',
      description: 'Test agent',
      capabilities: [],
      version: '1.0.0',
    },
  };

  const mcpAgent: NativeAgent<MCPAgentData> = {
    framework: 'MCP',
    data: {
      name: 'test',
      version: '1.0.0',
      capabilities: [],
    },
  };

  const langChainAgent: NativeAgent<LangChainAgentData> = {
    framework: 'LangChain',
    data: {
      name: 'test',
      type: 'agent',
      tools: [],
    },
  };

  describe('isUSAAgent()', () => {
    it('should return true for USA agents', () => {
      expect(isUSAAgent(usaAgent)).toBe(true);
    });

    it('should return false for other frameworks', () => {
      expect(isUSAAgent(lmosAgent)).toBe(false);
      expect(isUSAAgent(mcpAgent)).toBe(false);
    });

    it('should return false for non-agents', () => {
      expect(isUSAAgent({})).toBe(false);
      expect(isUSAAgent(null)).toBe(false);
    });
  });

  describe('isLMOSAgent()', () => {
    it('should return true for LMOS agents', () => {
      expect(isLMOSAgent(lmosAgent)).toBe(true);
    });

    it('should return false for other frameworks', () => {
      expect(isLMOSAgent(usaAgent)).toBe(false);
    });
  });

  describe('isMCPAgent()', () => {
    it('should return true for MCP agents', () => {
      expect(isMCPAgent(mcpAgent)).toBe(true);
    });

    it('should return false for other frameworks', () => {
      expect(isMCPAgent(usaAgent)).toBe(false);
    });
  });

  describe('isLangChainAgent()', () => {
    it('should return true for LangChain agents', () => {
      expect(isLangChainAgent(langChainAgent)).toBe(true);
    });

    it('should return false for other frameworks', () => {
      expect(isLangChainAgent(usaAgent)).toBe(false);
    });
  });

  describe('isNativeAgent()', () => {
    it('should return true for any native agent', () => {
      expect(isNativeAgent(usaAgent)).toBe(true);
      expect(isNativeAgent(lmosAgent)).toBe(true);
      expect(isNativeAgent(mcpAgent)).toBe(true);
      expect(isNativeAgent(langChainAgent)).toBe(true);
    });

    it('should return false for invalid objects', () => {
      expect(isNativeAgent({})).toBe(false);
      expect(isNativeAgent({ framework: 'Unknown' })).toBe(false);
      expect(isNativeAgent(null)).toBe(false);
    });
  });

  describe('isCanonicalAgent()', () => {
    const canonicalAgent: CanonicalAgent = {
      uri: uri('urn:chrysalis:agent:test'),
      sourceFramework: 'USA',
      identity: {
        id: agentId('test'),
        name: 'Test Agent',
      },
      capabilities: [],
      validTime: {
        start: isoTimestamp(),
      },
      transactionTime: {
        recorded: isoTimestamp(),
      },
    };

    it('should return true for canonical agents', () => {
      expect(isCanonicalAgent(canonicalAgent)).toBe(true);
    });

    it('should return false for native agents', () => {
      expect(isCanonicalAgent(usaAgent)).toBe(false);
    });

    it('should return false for invalid objects', () => {
      expect(isCanonicalAgent({})).toBe(false);
      expect(isCanonicalAgent({ uri: 'test' })).toBe(false);
    });
  });
});

describe('Result Pattern', () => {
  describe('ok()', () => {
    it('should create success result', () => {
      const result = ok(42);
      
      expect(result.success).toBe(true);
      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);
    });

    it('should store the value', () => {
      const result = ok({ data: 'test' });
      
      if (result.success) {
        expect(result.value).toEqual({ data: 'test' });
      }
    });
  });

  describe('err()', () => {
    it('should create error result', () => {
      const error = new BridgeError('Test error');
      const result = err(error);
      
      expect(result.success).toBe(false);
      expect(isOk(result)).toBe(false);
      expect(isErr(result)).toBe(true);
    });

    it('should store the error', () => {
      const error = new BridgeError('Test error');
      const result = err(error);
      
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('unwrap()', () => {
    it('should return value for success', () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('should throw for error', () => {
      const error = new BridgeError('Test error');
      const result = err(error);
      
      expect(() => unwrap(result)).toThrow(error);
    });
  });

  describe('unwrapOr()', () => {
    it('should return value for success', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('should return default for error', () => {
      const error = new BridgeError('Test error');
      const result = err<number>(error);
      
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe('mapResult()', () => {
    it('should transform success value', () => {
      const result = ok(5);
      const mapped = mapResult(result, (x) => x * 2);
      
      expect(unwrap(mapped)).toBe(10);
    });

    it('should pass through error', () => {
      const error = new BridgeError('Test error');
      const result = err<number>(error);
      const mapped = mapResult(result, (x) => x * 2);
      
      expect(isErr(mapped)).toBe(true);
      if (!mapped.success) {
        expect(mapped.error).toBe(error);
      }
    });
  });

  describe('flatMapResult()', () => {
    it('should chain success results', () => {
      const result = ok(5);
      const chained = flatMapResult(result, (x) => ok(x * 2));
      
      expect(unwrap(chained)).toBe(10);
    });

    it('should short-circuit on first error', () => {
      const error = new BridgeError('Test error');
      const result = err<number>(error);
      const chained = flatMapResult(result, (x) => ok(x * 2));
      
      expect(isErr(chained)).toBe(true);
    });

    it('should propagate error from mapper', () => {
      const error = new BridgeError('Mapper error');
      const result = ok(5);
      const chained = flatMapResult(result, () => err(error));
      
      expect(isErr(chained)).toBe(true);
      if (!chained.success) {
        expect(chained.error).toBe(error);
      }
    });
  });
});

describe('Type Narrowing', () => {
  it('should narrow native agent types', () => {
    const agent: NativeAgent = {
      framework: 'USA',
      data: {
        apiVersion: 'usa/v2',
        kind: 'Agent',
        metadata: { name: 'test' },
        identity: { id: 'test' },
        execution: {},
      },
    };

    if (isUSAAgent(agent)) {
      // TypeScript should know this is USAAgentData
      const apiVersion = agent.data.apiVersion;
      expect(apiVersion).toBeDefined();
    }
  });

  it('should narrow result types', () => {
    const result: Result<number> = ok(42);

    if (isOk(result)) {
      // TypeScript should know value exists
      const value: number = result.value;
      expect(value).toBe(42);
    }

    if (isErr(result)) {
      // TypeScript should know error exists
      const error: BridgeError = result.error;
      expect(error).toBeInstanceOf(BridgeError);
    }
  });
});
