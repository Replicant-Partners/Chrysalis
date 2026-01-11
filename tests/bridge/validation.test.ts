/**
 * Tests for Bridge Schema Validation
 * 
 * @module tests/bridge/validation
 */

import {
  S,
  SchemaRegistry,
  getSchemaRegistry,
  URISchema,
  ISOTimestampSchema,
  AgentIdSchema,
  USAAgentSchema,
  LMOSAgentSchema,
  MCPAgentSchema,
  LangChainAgentSchema,
  validateAgentData,
  parseAgentData,
} from '../../src/bridge/validation';

import { ValidationError } from '../../src/bridge/errors';

describe('Schema Builder', () => {
  describe('S.string()', () => {
    it('should validate strings', () => {
      const schema = S.string();
      const result = schema.validate('hello');
      
      expect(result.valid).toBe(true);
    });

    it('should reject non-strings', () => {
      const schema = S.string();
      const result = schema.validate(123);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('string');
    });

    it('should validate minLength', () => {
      const schema = S.string({ minLength: 3 });
      
      expect(schema.validate('ab').valid).toBe(false);
      expect(schema.validate('abc').valid).toBe(true);
    });

    it('should validate maxLength', () => {
      const schema = S.string({ maxLength: 5 });
      
      expect(schema.validate('12345').valid).toBe(true);
      expect(schema.validate('123456').valid).toBe(false);
    });

    it('should validate pattern', () => {
      const schema = S.string({ pattern: /^[a-z]+$/ });
      
      expect(schema.validate('abc').valid).toBe(true);
      expect(schema.validate('ABC').valid).toBe(false);
      expect(schema.validate('abc123').valid).toBe(false);
    });
  });

  describe('S.number()', () => {
    it('should validate numbers', () => {
      const schema = S.number();
      
      expect(schema.validate(42).valid).toBe(true);
      expect(schema.validate(3.14).valid).toBe(true);
    });

    it('should reject non-numbers', () => {
      const schema = S.number();
      
      expect(schema.validate('42').valid).toBe(false);
      expect(schema.validate(null).valid).toBe(false);
    });

    it('should validate min/max', () => {
      const schema = S.number({ min: 0, max: 100 });
      
      expect(schema.validate(-1).valid).toBe(false);
      expect(schema.validate(0).valid).toBe(true);
      expect(schema.validate(100).valid).toBe(true);
      expect(schema.validate(101).valid).toBe(false);
    });

    it('should validate integer constraint', () => {
      const schema = S.number({ integer: true });
      
      expect(schema.validate(42).valid).toBe(true);
      expect(schema.validate(3.14).valid).toBe(false);
    });
  });

  describe('S.boolean()', () => {
    it('should validate booleans', () => {
      const schema = S.boolean();
      
      expect(schema.validate(true).valid).toBe(true);
      expect(schema.validate(false).valid).toBe(true);
    });

    it('should reject non-booleans', () => {
      const schema = S.boolean();
      
      expect(schema.validate(1).valid).toBe(false);
      expect(schema.validate('true').valid).toBe(false);
    });
  });

  describe('S.array()', () => {
    it('should validate arrays', () => {
      const schema = S.array(S.string());
      
      expect(schema.validate(['a', 'b', 'c']).valid).toBe(true);
    });

    it('should validate item types', () => {
      const schema = S.array(S.number());
      
      expect(schema.validate([1, 2, 3]).valid).toBe(true);
      expect(schema.validate([1, 'two', 3]).valid).toBe(false);
    });

    it('should validate minItems/maxItems', () => {
      const schema = S.array(S.string(), { minItems: 1, maxItems: 3 });
      
      expect(schema.validate([]).valid).toBe(false);
      expect(schema.validate(['a']).valid).toBe(true);
      expect(schema.validate(['a', 'b', 'c', 'd']).valid).toBe(false);
    });

    it('should reject non-arrays', () => {
      const schema = S.array(S.string());
      
      expect(schema.validate('not array').valid).toBe(false);
      expect(schema.validate({ 0: 'a' }).valid).toBe(false);
    });
  });

  describe('S.object()', () => {
    it('should validate objects', () => {
      const schema = S.object({
        name: S.string(),
        age: S.number(),
      });
      
      const result = schema.validate({ name: 'John', age: 30 });
      expect(result.valid).toBe(true);
    });

    it('should validate required properties', () => {
      const schema = S.object(
        { name: S.string(), age: S.number() },
        { required: ['name'] }
      );
      
      expect(schema.validate({ name: 'John' }).valid).toBe(true);
      expect(schema.validate({ age: 30 }).valid).toBe(false);
    });

    it('should validate property types', () => {
      const schema = S.object({
        name: S.string(),
        age: S.number(),
      });
      
      const result = schema.validate({ name: 123, age: 'thirty' });
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow additional properties by default', () => {
      const schema = S.object({ name: S.string() });
      
      const result = schema.validate({ name: 'John', extra: 'allowed' });
      expect(result.valid).toBe(true);
    });

    it('should reject additional properties when strict', () => {
      const schema = S.object(
        { name: S.string() },
        { additionalProperties: false }
      );
      
      const result = schema.validate({ name: 'John', extra: 'not allowed' });
      expect(result.valid).toBe(false);
    });
  });

  describe('S.enum()', () => {
    it('should validate enum values', () => {
      const schema = S.enum(['A', 'B', 'C'] as const);
      
      expect(schema.validate('A').valid).toBe(true);
      expect(schema.validate('B').valid).toBe(true);
      expect(schema.validate('D').valid).toBe(false);
    });
  });

  describe('S.literal()', () => {
    it('should validate literal values', () => {
      const schema = S.literal('exact');
      
      expect(schema.validate('exact').valid).toBe(true);
      expect(schema.validate('other').valid).toBe(false);
    });
  });

  describe('S.union()', () => {
    it('should validate union types', () => {
      const schema = S.union([S.string(), S.number()]);
      
      expect(schema.validate('hello').valid).toBe(true);
      expect(schema.validate(42).valid).toBe(true);
      expect(schema.validate(true).valid).toBe(false);
    });
  });

  describe('S.optional()', () => {
    it('should allow undefined', () => {
      const schema = S.optional(S.string());
      
      expect(schema.validate(undefined).valid).toBe(true);
      expect(schema.validate('value').valid).toBe(true);
      expect(schema.validate(123).valid).toBe(false);
    });
  });

  describe('S.nullable()', () => {
    it('should allow null', () => {
      const schema = S.nullable(S.string());
      
      expect(schema.validate(null).valid).toBe(true);
      expect(schema.validate('value').valid).toBe(true);
      expect(schema.validate(123).valid).toBe(false);
    });
  });
});

describe('Pre-defined Schemas', () => {
  describe('URISchema', () => {
    it('should validate URIs', () => {
      expect(URISchema.validate('urn:chrysalis:agent:test').valid).toBe(true);
      expect(URISchema.validate('https://example.com').valid).toBe(true);
    });

    it('should reject invalid URIs', () => {
      expect(URISchema.validate('').valid).toBe(false);
    });
  });

  describe('ISOTimestampSchema', () => {
    it('should validate ISO timestamps', () => {
      expect(ISOTimestampSchema.validate('2024-01-15T10:30:00.000Z').valid).toBe(true);
    });

    it('should reject invalid timestamps', () => {
      expect(ISOTimestampSchema.validate('not a date').valid).toBe(false);
      expect(ISOTimestampSchema.validate('2024-13-45').valid).toBe(false);
    });
  });

  describe('AgentIdSchema', () => {
    it('should validate agent IDs', () => {
      expect(AgentIdSchema.validate('agent-123').valid).toBe(true);
      expect(AgentIdSchema.validate('a1b2c3d4-e5f6-7890-abcd-ef1234567890').valid).toBe(true);
    });

    it('should reject empty IDs', () => {
      expect(AgentIdSchema.validate('').valid).toBe(false);
    });
  });

  describe('USAAgentSchema', () => {
    const validUSAAgent = {
      apiVersion: 'usa/v2',
      kind: 'Agent',
      metadata: {
        name: 'test-agent',
        namespace: 'default',
      },
      identity: {
        id: 'agent-123',
        name: 'Test Agent',
      },
      execution: {
        runtime: 'node',
      },
    };

    it('should validate valid USA agents', () => {
      const result = USAAgentSchema.validate(validUSAAgent);
      expect(result.valid).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalid = { ...validUSAAgent };
      delete (invalid as Record<string, unknown>).apiVersion;
      
      const result = USAAgentSchema.validate(invalid);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid apiVersion format', () => {
      const invalid = { ...validUSAAgent, apiVersion: 'v2' };
      
      const result = USAAgentSchema.validate(invalid);
      expect(result.valid).toBe(false);
    });
  });

  describe('LMOSAgentSchema', () => {
    const validLMOSAgent = {
      name: 'test-agent',
      description: 'A test agent',
      capabilities: ['chat', 'code'],
      version: '1.0.0',
    };

    it('should validate valid LMOS agents', () => {
      const result = LMOSAgentSchema.validate(validLMOSAgent);
      expect(result.valid).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalid = { ...validLMOSAgent };
      delete (invalid as Record<string, unknown>).name;
      
      const result = LMOSAgentSchema.validate(invalid);
      expect(result.valid).toBe(false);
    });
  });

  describe('MCPAgentSchema', () => {
    const validMCPAgent = {
      name: 'test-server',
      version: '1.0.0',
      capabilities: [
        { name: 'tools', methods: ['list', 'call'] },
      ],
    };

    it('should validate valid MCP agents', () => {
      const result = MCPAgentSchema.validate(validMCPAgent);
      expect(result.valid).toBe(true);
    });
  });

  describe('LangChainAgentSchema', () => {
    const validLangChainAgent = {
      name: 'react-agent',
      type: 'agent',
      tools: [
        { name: 'search', description: 'Search tool' },
      ],
    };

    it('should validate valid LangChain agents', () => {
      const result = LangChainAgentSchema.validate(validLangChainAgent);
      expect(result.valid).toBe(true);
    });
  });
});

describe('SchemaRegistry', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry();
  });

  it('should register and retrieve schemas', () => {
    const schema = S.string();
    registry.register('test', schema);
    
    const retrieved = registry.get('test');
    expect(retrieved).toBe(schema);
  });

  it('should return undefined for unregistered schemas', () => {
    const retrieved = registry.get('nonexistent');
    expect(retrieved).toBeUndefined();
  });

  it('should check if schema exists', () => {
    registry.register('test', S.string());
    
    expect(registry.has('test')).toBe(true);
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('should list all schema names', () => {
    registry.register('schema1', S.string());
    registry.register('schema2', S.number());
    
    const names = registry.names();
    expect(names).toContain('schema1');
    expect(names).toContain('schema2');
  });

  describe('getSchemaRegistry()', () => {
    it('should return singleton instance', () => {
      const instance1 = getSchemaRegistry();
      const instance2 = getSchemaRegistry();
      
      expect(instance1).toBe(instance2);
    });

    it('should have pre-registered framework schemas', () => {
      const registry = getSchemaRegistry();
      
      expect(registry.has('USA')).toBe(true);
      expect(registry.has('LMOS')).toBe(true);
      expect(registry.has('MCP')).toBe(true);
      expect(registry.has('LangChain')).toBe(true);
    });
  });
});

describe('Validation Helpers', () => {
  describe('validateAgentData()', () => {
    it('should validate USA agent data', () => {
      const data = {
        apiVersion: 'usa/v2',
        kind: 'Agent',
        metadata: { name: 'test' },
        identity: { id: 'test' },
        execution: {},
      };
      
      const result = validateAgentData('USA', data);
      expect(result.valid).toBe(true);
    });

    it('should return errors for invalid data', () => {
      const data = { invalid: true };
      
      const result = validateAgentData('USA', data);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('parseAgentData()', () => {
    it('should return parsed data on success', () => {
      const data = {
        apiVersion: 'usa/v2',
        kind: 'Agent',
        metadata: { name: 'test' },
        identity: { id: 'test' },
        execution: {},
      };
      
      const result = parseAgentData('USA', data);
      expect(result).toEqual(data);
    });

    it('should throw ValidationError on failure', () => {
      const data = { invalid: true };
      
      expect(() => parseAgentData('USA', data)).toThrow(ValidationError);
    });
  });
});
