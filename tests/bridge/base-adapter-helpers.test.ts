/**
 * Chrysalis Universal Agent Bridge - BaseAdapter Helpers Tests
 * 
 * Tests for the P1/P2 extracted quad creation and extension restoration helpers.
 * 
 * @module tests/bridge/base-adapter-helpers
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Import types from temporal-store
import type { Quad, NamedNode, BlankNode, Subject } from '../../src/rdf/temporal-store';
import { DataFactory, chrysalis, rdf, xsd, CHRYSALIS_NS, XSD_NS } from '../../src/rdf/temporal-store';

// Import base adapter types
import type { ExtensionProperty, TranslationWarning } from '../../src/adapters/base-adapter';
import { BaseAdapter, type NativeAgent, type CanonicalAgent, type FieldMapping, type ValidationResult, type AgentFramework } from '../../src/adapters/base-adapter';

// ============================================================================
// Test Adapter Implementation
// ============================================================================

/**
 * Concrete test adapter for testing protected helper methods
 */
class TestAdapter extends BaseAdapter {
  readonly framework: AgentFramework = 'usa';
  readonly name = 'Test Adapter';
  readonly version = '1.0.0';
  readonly extensionNamespace = 'https://test.dev/ns#';

  async toCanonical(native: NativeAgent): Promise<CanonicalAgent> {
    const startTime = Date.now();
    const agentUri = this.generateAgentUri('test-agent');
    const quads: Quad[] = [];
    const mappedFields: string[] = [];
    const unmappedFields: string[] = [];
    const lostFields: string[] = [];
    const extensions: ExtensionProperty[] = [];
    const warnings: TranslationWarning[] = [];

    // Basic agent type triple
    this.addQuadWithTracking(
      quads,
      mappedFields,
      this.uri(agentUri),
      rdf('type'),
      chrysalis('Agent'),
      'type'
    );

    return {
      uri: agentUri,
      quads,
      sourceFramework: this.framework,
      extensions,
      metadata: this.createMetadata(startTime, mappedFields, unmappedFields, lostFields, warnings)
    };
  }

  async fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent> {
    return {
      data: {},
      framework: this.framework
    };
  }

  validateNative(native: NativeAgent): ValidationResult {
    return { valid: true, errors: [], warnings: [] };
  }

  getFieldMappings(): FieldMapping[] {
    return [];
  }

  // =========================================================================
  // Expose protected methods for testing
  // =========================================================================

  public testAddQuadWithTracking(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    object: ReturnType<typeof DataFactory.namedNode> | ReturnType<typeof DataFactory.literal>,
    fieldPath: string
  ): void {
    return this.addQuadWithTracking(quads, mappedFields, subject, predicate, object, fieldPath);
  }

  public testAddOptionalLiteral(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    value: string | number | boolean | undefined | null,
    fieldPath: string,
    datatype?: string
  ): boolean {
    return this.addOptionalLiteral(quads, mappedFields, subject, predicate, value, fieldPath, datatype);
  }

  public testAddOptionalUri(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    uriValue: string | undefined | null,
    fieldPath: string
  ): boolean {
    return this.addOptionalUri(quads, mappedFields, subject, predicate, uriValue, fieldPath);
  }

  public testAddOptionalQuad(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    object: ReturnType<typeof DataFactory.namedNode> | null | undefined,
    fieldPath: string
  ): boolean {
    return this.addOptionalQuad(quads, mappedFields, subject, predicate, object, fieldPath);
  }

  public testCreateTypedBlankNode(
    quads: Quad[],
    parentSubject: Subject,
    linkPredicate: NamedNode,
    typeUri: NamedNode,
    idPrefix: string
  ): BlankNode {
    return this.createTypedBlankNode(quads, parentSubject, linkPredicate, typeUri, idPrefix);
  }

  public testCreateTypedNamedNode(
    quads: Quad[],
    parentSubject: Subject,
    linkPredicate: NamedNode,
    nodeUri: string,
    typeUri: NamedNode
  ): NamedNode {
    return this.createTypedNamedNode(quads, parentSubject, linkPredicate, nodeUri, typeUri);
  }

  public testAddLiteralArray(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    values: (string | number | boolean)[] | undefined | null,
    fieldPath: string,
    datatype?: string
  ): number {
    return this.addLiteralArray(quads, mappedFields, subject, predicate, values, fieldPath, datatype);
  }

  public testAddJsonLiteral(
    quads: Quad[],
    mappedFields: string[],
    subject: Subject,
    predicate: NamedNode,
    value: unknown,
    fieldPath: string
  ): boolean {
    return this.addJsonLiteral(quads, mappedFields, subject, predicate, value, fieldPath);
  }

  public testRestoreExtension<T>(
    extensions: ExtensionProperty[],
    namespace: string,
    property: string,
    defaultValue?: T
  ): T | undefined {
    return this.restoreExtension<T>(extensions, namespace, property, defaultValue);
  }

  public testRestoreExtensionInto<T extends Record<string, unknown>, K extends keyof T>(
    target: T,
    key: K,
    extensions: ExtensionProperty[],
    namespace: string,
    property: string
  ): void {
    return this.restoreExtensionInto(target, key, extensions, namespace, property);
  }

  public testRestoreExtensionIntoPath(
    target: Record<string, unknown>,
    path: string,
    extensions: ExtensionProperty[],
    namespace: string,
    property: string
  ): void {
    return this.restoreExtensionIntoPath(target, path, extensions, namespace, property);
  }

  public testRestoreExtensionsBatch(
    target: Record<string, unknown>,
    extensions: ExtensionProperty[],
    mappings: Array<[string, string, string]>
  ): void {
    return this.restoreExtensionsBatch(target, extensions, mappings);
  }

  // Expose other protected methods needed for tests
  public testUri(value: string): NamedNode {
    return this.uri(value);
  }

  public testLiteral(value: string | number | boolean, datatype?: string) {
    return this.literal(value, datatype);
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe('BaseAdapter Quad Creation Helpers', () => {
  let adapter: TestAdapter;
  let quads: Quad[];
  let mappedFields: string[];
  let subject: NamedNode;

  beforeEach(() => {
    adapter = new TestAdapter();
    quads = [];
    mappedFields = [];
    subject = adapter.testUri('https://test.dev/agent/1');
  });

  describe('addQuadWithTracking()', () => {
    it('should add quad and track field path', () => {
      const predicate = chrysalis('name');
      const object = adapter.testLiteral('Test Agent');

      adapter.testAddQuadWithTracking(quads, mappedFields, subject, predicate, object, 'metadata.name');

      expect(quads).toHaveLength(1);
      expect(quads[0].subject.value).toBe('https://test.dev/agent/1');
      expect(quads[0].predicate.value).toBe(`${CHRYSALIS_NS}name`);
      expect(quads[0].object.value).toBe('Test Agent');
      expect(mappedFields).toContain('metadata.name');
    });

    it('should accumulate multiple quads', () => {
      adapter.testAddQuadWithTracking(quads, mappedFields, subject, chrysalis('name'), adapter.testLiteral('Agent1'), 'name');
      adapter.testAddQuadWithTracking(quads, mappedFields, subject, chrysalis('version'), adapter.testLiteral('1.0'), 'version');

      expect(quads).toHaveLength(2);
      expect(mappedFields).toHaveLength(2);
    });
  });

  describe('addOptionalLiteral()', () => {
    it('should add quad when value is truthy string', () => {
      const result = adapter.testAddOptionalLiteral(
        quads, mappedFields, subject, chrysalis('description'),
        'A description', 'metadata.description'
      );

      expect(result).toBe(true);
      expect(quads).toHaveLength(1);
      expect(quads[0].object.value).toBe('A description');
      expect(mappedFields).toContain('metadata.description');
    });

    it('should add quad when value is number', () => {
      const result = adapter.testAddOptionalLiteral(
        quads, mappedFields, subject, chrysalis('temperature'),
        0.7, 'execution.temperature', `${XSD_NS}float`
      );

      expect(result).toBe(true);
      expect(quads).toHaveLength(1);
      expect(quads[0].object.value).toBe('0.7');
    });

    it('should add quad when value is boolean false', () => {
      const result = adapter.testAddOptionalLiteral(
        quads, mappedFields, subject, chrysalis('enabled'),
        false, 'config.enabled'
      );

      expect(result).toBe(true);
      expect(quads).toHaveLength(1);
    });

    it('should NOT add quad when value is undefined', () => {
      const result = adapter.testAddOptionalLiteral(
        quads, mappedFields, subject, chrysalis('optional'),
        undefined, 'metadata.optional'
      );

      expect(result).toBe(false);
      expect(quads).toHaveLength(0);
      expect(mappedFields).toHaveLength(0);
    });

    it('should NOT add quad when value is null', () => {
      const result = adapter.testAddOptionalLiteral(
        quads, mappedFields, subject, chrysalis('optional'),
        null, 'metadata.optional'
      );

      expect(result).toBe(false);
      expect(quads).toHaveLength(0);
    });

    it('should NOT add quad when value is empty string', () => {
      const result = adapter.testAddOptionalLiteral(
        quads, mappedFields, subject, chrysalis('optional'),
        '', 'metadata.optional'
      );

      expect(result).toBe(false);
      expect(quads).toHaveLength(0);
    });
  });

  describe('addOptionalUri()', () => {
    it('should add URI quad when value exists', () => {
      const result = adapter.testAddOptionalUri(
        quads, mappedFields, subject, chrysalis('endpoint'),
        'https://api.example.com', 'protocols.endpoint'
      );

      expect(result).toBe(true);
      expect(quads).toHaveLength(1);
      expect(quads[0].object.termType).toBe('NamedNode');
      expect(quads[0].object.value).toBe('https://api.example.com');
    });

    it('should NOT add quad when URI is undefined', () => {
      const result = adapter.testAddOptionalUri(
        quads, mappedFields, subject, chrysalis('endpoint'),
        undefined, 'protocols.endpoint'
      );

      expect(result).toBe(false);
      expect(quads).toHaveLength(0);
    });

    it('should NOT add quad when URI is empty string', () => {
      const result = adapter.testAddOptionalUri(
        quads, mappedFields, subject, chrysalis('endpoint'),
        '', 'protocols.endpoint'
      );

      expect(result).toBe(false);
      expect(quads).toHaveLength(0);
    });
  });

  describe('addOptionalQuad()', () => {
    it('should add quad when object exists', () => {
      const object = adapter.testUri('https://test.dev/type/MyType');
      const result = adapter.testAddOptionalQuad(
        quads, mappedFields, subject, rdf('type'),
        object, 'type'
      );

      expect(result).toBe(true);
      expect(quads).toHaveLength(1);
    });

    it('should NOT add quad when object is null', () => {
      const result = adapter.testAddOptionalQuad(
        quads, mappedFields, subject, rdf('type'),
        null, 'type'
      );

      expect(result).toBe(false);
      expect(quads).toHaveLength(0);
    });
  });

  describe('createTypedBlankNode()', () => {
    it('should create blank node with type and link to parent', () => {
      const blankNode = adapter.testCreateTypedBlankNode(
        quads, subject, chrysalis('hasCapability'),
        chrysalis('Tool'), 'tool'
      );

      expect(blankNode.termType).toBe('BlankNode');
      expect(quads).toHaveLength(2);
      
      // First quad: link from parent to blank node
      expect(quads[0].subject.value).toBe(subject.value);
      expect(quads[0].predicate.value).toBe(`${CHRYSALIS_NS}hasCapability`);
      expect(quads[0].object.termType).toBe('BlankNode');
      
      // Second quad: type declaration
      expect(quads[1].subject.termType).toBe('BlankNode');
      expect(quads[1].predicate.value).toContain('type');
      expect(quads[1].object.value).toBe(`${CHRYSALIS_NS}Tool`);
    });

    it('should generate unique blank node IDs', () => {
      const node1 = adapter.testCreateTypedBlankNode(
        quads, subject, chrysalis('hasCapability'),
        chrysalis('Tool'), 'tool'
      );
      const node2 = adapter.testCreateTypedBlankNode(
        quads, subject, chrysalis('hasCapability'),
        chrysalis('Tool'), 'tool'
      );

      expect(node1.value).not.toBe(node2.value);
    });
  });

  describe('createTypedNamedNode()', () => {
    it('should create named node with type and link to parent', () => {
      const namedNode = adapter.testCreateTypedNamedNode(
        quads, subject, chrysalis('hasProtocol'),
        'https://test.dev/protocol/mcp', chrysalis('Protocol')
      );

      expect(namedNode.termType).toBe('NamedNode');
      expect(namedNode.value).toBe('https://test.dev/protocol/mcp');
      expect(quads).toHaveLength(2);
    });
  });

  describe('addLiteralArray()', () => {
    it('should add multiple quads for array values', () => {
      const values = ['tag1', 'tag2', 'tag3'];
      const count = adapter.testAddLiteralArray(
        quads, mappedFields, subject, chrysalis('tag'),
        values, 'metadata.tags'
      );

      expect(count).toBe(3);
      expect(quads).toHaveLength(3);
      expect(mappedFields).toContain('metadata.tags');
      expect(mappedFields).toHaveLength(1); // Single field path for all
    });

    it('should return 0 for empty array', () => {
      const count = adapter.testAddLiteralArray(
        quads, mappedFields, subject, chrysalis('tag'),
        [], 'metadata.tags'
      );

      expect(count).toBe(0);
      expect(quads).toHaveLength(0);
    });

    it('should return 0 for undefined array', () => {
      const count = adapter.testAddLiteralArray(
        quads, mappedFields, subject, chrysalis('tag'),
        undefined, 'metadata.tags'
      );

      expect(count).toBe(0);
    });
  });

  describe('addJsonLiteral()', () => {
    it('should serialize object as JSON literal', () => {
      const config = { maxTokens: 1000, temperature: 0.7 };
      const result = adapter.testAddJsonLiteral(
        quads, mappedFields, subject, chrysalis('config'),
        config, 'execution.config'
      );

      expect(result).toBe(true);
      expect(quads).toHaveLength(1);
      expect(quads[0].object.value).toBe('{"maxTokens":1000,"temperature":0.7}');
    });

    it('should handle nested objects', () => {
      const nested = { a: { b: { c: 1 } } };
      adapter.testAddJsonLiteral(quads, mappedFields, subject, chrysalis('nested'), nested, 'nested');

      expect(JSON.parse(quads[0].object.value)).toEqual(nested);
    });

    it('should NOT add quad for null value', () => {
      const result = adapter.testAddJsonLiteral(
        quads, mappedFields, subject, chrysalis('config'),
        null, 'execution.config'
      );

      expect(result).toBe(false);
      expect(quads).toHaveLength(0);
    });
  });
});

describe('BaseAdapter Extension Restoration Helpers', () => {
  let adapter: TestAdapter;
  let extensions: ExtensionProperty[];

  beforeEach(() => {
    adapter = new TestAdapter();
    extensions = [
      { namespace: 'usa', property: 'personalityTraits', value: '["friendly","helpful"]', sourcePath: 'identity.traits' },
      { namespace: 'usa', property: 'temperature', value: '0.7', sourcePath: 'execution.temperature' },
      { namespace: 'usa', property: 'config', value: '{"maxTokens":1000}', sourcePath: 'execution.config' },
      { namespace: 'lmos', property: 'channelId', value: '"channel-123"', sourcePath: 'channels.id' },
      { namespace: 'usa', property: 'simpleString', value: 'just-a-string', sourcePath: 'simple' }
    ];
  });

  describe('restoreExtension()', () => {
    it('should restore JSON array', () => {
      const traits = adapter.testRestoreExtension<string[]>(extensions, 'usa', 'personalityTraits');
      
      expect(traits).toEqual(['friendly', 'helpful']);
    });

    it('should restore JSON object', () => {
      const config = adapter.testRestoreExtension<{ maxTokens: number }>(extensions, 'usa', 'config');
      
      expect(config).toEqual({ maxTokens: 1000 });
    });

    it('should restore simple value', () => {
      const temp = adapter.testRestoreExtension<number>(extensions, 'usa', 'temperature');
      
      expect(temp).toBe(0.7);
    });

    it('should return default value when not found', () => {
      const result = adapter.testRestoreExtension<string>(extensions, 'usa', 'nonexistent', 'default');
      
      expect(result).toBe('default');
    });

    it('should return undefined when not found and no default', () => {
      const result = adapter.testRestoreExtension(extensions, 'usa', 'nonexistent');
      
      expect(result).toBeUndefined();
    });

    it('should match both namespace and property', () => {
      const lmosChannel = adapter.testRestoreExtension<string>(extensions, 'lmos', 'channelId');
      const usaChannel = adapter.testRestoreExtension<string>(extensions, 'usa', 'channelId');
      
      expect(lmosChannel).toBe('channel-123');
      expect(usaChannel).toBeUndefined();
    });

    it('should return raw string when JSON parse fails', () => {
      const simple = adapter.testRestoreExtension<string>(extensions, 'usa', 'simpleString');
      
      expect(simple).toBe('just-a-string');
    });
  });

  describe('restoreExtensionInto()', () => {
    it('should restore value into object property', () => {
      const target: { traits?: string[] } = {};
      
      adapter.testRestoreExtensionInto(target, 'traits', extensions, 'usa', 'personalityTraits');
      
      expect(target.traits).toEqual(['friendly', 'helpful']);
    });

    it('should not modify object if extension not found', () => {
      const target: { traits?: string[] } = { traits: ['existing'] };
      
      adapter.testRestoreExtensionInto(target, 'traits', extensions, 'usa', 'nonexistent');
      
      expect(target.traits).toEqual(['existing']);
    });
  });

  describe('restoreExtensionIntoPath()', () => {
    it('should restore value into nested path', () => {
      const target: Record<string, unknown> = {};
      
      adapter.testRestoreExtensionIntoPath(target, 'identity.traits', extensions, 'usa', 'personalityTraits');
      
      expect((target as any).identity.traits).toEqual(['friendly', 'helpful']);
    });

    it('should create intermediate objects', () => {
      const target: Record<string, unknown> = {};
      
      adapter.testRestoreExtensionIntoPath(target, 'deeply.nested.path', extensions, 'usa', 'temperature');
      
      expect((target as any).deeply.nested.path).toBe(0.7);
    });
  });

  describe('restoreExtensionsBatch()', () => {
    it('should restore multiple extensions at once', () => {
      const target: Record<string, unknown> = {};
      const mappings: Array<[string, string, string]> = [
        ['identity.traits', 'usa', 'personalityTraits'],
        ['execution.temperature', 'usa', 'temperature'],
        ['execution.config', 'usa', 'config']
      ];
      
      adapter.testRestoreExtensionsBatch(target, extensions, mappings);
      
      expect((target as any).identity.traits).toEqual(['friendly', 'helpful']);
      expect((target as any).execution.temperature).toBe(0.7);
      expect((target as any).execution.config).toEqual({ maxTokens: 1000 });
    });

    it('should skip missing extensions', () => {
      const target: Record<string, unknown> = {};
      const mappings: Array<[string, string, string]> = [
        ['found.value', 'usa', 'temperature'],
        ['missing.value', 'usa', 'nonexistent']
      ];
      
      adapter.testRestoreExtensionsBatch(target, extensions, mappings);
      
      expect((target as any).found.value).toBe(0.7);
      expect((target as any).missing).toBeUndefined();
    });
  });
});

describe('BaseAdapter Integration', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  it('should use helpers in toCanonical()', async () => {
    const native: NativeAgent = {
      data: { name: 'Test' },
      framework: 'usa'
    };

    const canonical = await adapter.toCanonical(native);

    expect(canonical.uri).toMatch(/^https:\/\/chrysalis\.dev\/agent\//);
    expect(canonical.quads).toHaveLength(1);
    expect(canonical.metadata.mappedFields).toContain('type');
  });
});
