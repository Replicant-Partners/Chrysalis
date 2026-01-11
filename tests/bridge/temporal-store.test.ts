/**
 * Temporal RDF Store Tests
 * 
 * Tests for the temporal RDF storage infrastructure including
 * quad storage, named graphs, temporal versioning, and queries.
 */

import {
  TemporalRDFStore,
  DataFactory,
  CHRYSALIS_NS,
  RDF_NS,
  serializeNTriples,
  parseNTriples,
  chrysalis,
  rdf
} from '../../src/rdf/temporal-store';

describe('TemporalRDFStore', () => {
  let store: TemporalRDFStore;

  beforeEach(() => {
    store = new TemporalRDFStore();
  });

  afterEach(async () => {
    await store.clear();
  });

  describe('DataFactory', () => {
    it('should create named nodes', () => {
      const node = DataFactory.namedNode('https://example.org/agent');
      expect(node.termType).toBe('NamedNode');
      expect(node.value).toBe('https://example.org/agent');
    });

    it('should create blank nodes', () => {
      const node = DataFactory.blankNode('b1');
      expect(node.termType).toBe('BlankNode');
      expect(node.value).toBe('b1');
    });

    it('should create blank nodes with auto-generated IDs', () => {
      const node = DataFactory.blankNode();
      expect(node.termType).toBe('BlankNode');
      expect(node.value).toMatch(/^b\d+_/);
    });

    it('should create string literals', () => {
      const lit = DataFactory.literal('hello');
      expect(lit.termType).toBe('Literal');
      expect(lit.value).toBe('hello');
      expect(lit.language).toBe('');
    });

    it('should create language-tagged literals', () => {
      const lit = DataFactory.literal('hello', 'en');
      expect(lit.termType).toBe('Literal');
      expect(lit.value).toBe('hello');
      expect(lit.language).toBe('en');
    });

    it('should create typed literals', () => {
      const intType = DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer');
      const lit = DataFactory.literal('42', intType);
      expect(lit.termType).toBe('Literal');
      expect(lit.value).toBe('42');
      expect(lit.datatype.value).toBe('http://www.w3.org/2001/XMLSchema#integer');
    });

    it('should create quads', () => {
      const s = DataFactory.namedNode('https://example.org/agent');
      const p = DataFactory.namedNode(`${RDF_NS}type`);
      const o = DataFactory.namedNode(`${CHRYSALIS_NS}Agent`);
      const quad = DataFactory.quad(s, p, o);

      expect(quad.subject.value).toBe('https://example.org/agent');
      expect(quad.predicate.value).toBe(`${RDF_NS}type`);
      expect(quad.object.value).toBe(`${CHRYSALIS_NS}Agent`);
      expect(quad.graph.termType).toBe('DefaultGraph');
    });

    it('should compare terms for equality', () => {
      const node1 = DataFactory.namedNode('https://example.org/agent');
      const node2 = DataFactory.namedNode('https://example.org/agent');
      const node3 = DataFactory.namedNode('https://example.org/other');

      expect(node1.equals(node2)).toBe(true);
      expect(node1.equals(node3)).toBe(false);
      expect(node1.equals(null)).toBe(false);
    });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot with quads', async () => {
      const quads = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent'),
          rdf('type'),
          chrysalis('Agent')
        ),
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent'),
          chrysalis('name'),
          DataFactory.literal('Test Agent')
        )
      ];

      const snapshot = await store.createSnapshot('test-agent', quads);

      expect(snapshot.agentId).toBe('test-agent');
      expect(snapshot.version).toBe(1);
      expect(snapshot.validTo).toBeNull();
      expect(snapshot.quads.length).toBe(2);
    });

    it('should increment version on subsequent snapshots', async () => {
      const quads1 = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent'),
          chrysalis('name'),
          DataFactory.literal('Version 1')
        )
      ];

      const quads2 = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent'),
          chrysalis('name'),
          DataFactory.literal('Version 2')
        )
      ];

      const snapshot1 = await store.createSnapshot('test-agent', quads1);
      const snapshot2 = await store.createSnapshot('test-agent', quads2);

      expect(snapshot1.version).toBe(1);
      expect(snapshot2.version).toBe(2);
    });

    it('should mark previous version as superseded', async () => {
      const quads = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent'),
          chrysalis('name'),
          DataFactory.literal('Test')
        )
      ];

      await store.createSnapshot('test-agent', quads);
      await store.createSnapshot('test-agent', quads);

      const history = await store.getAgentHistory('test-agent');
      expect(history[0].validTo).not.toBeNull();
      expect(history[1].validTo).toBeNull();
    });

    it('should accept optional metadata', async () => {
      const quads = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent'),
          chrysalis('name'),
          DataFactory.literal('Test')
        )
      ];

      const snapshot = await store.createSnapshot('test-agent', quads, {
        sourceFormat: 'usa',
        fidelityScore: 0.95
      });

      expect(snapshot.sourceFormat).toBe('usa');
      expect(snapshot.fidelityScore).toBe(0.95);
    });
  });

  describe('getSnapshot', () => {
    beforeEach(async () => {
      // Create multiple versions
      for (let i = 1; i <= 3; i++) {
        const quads = [
          DataFactory.quad(
            DataFactory.namedNode('https://example.org/agent'),
            chrysalis('name'),
            DataFactory.literal(`Version ${i}`)
          )
        ];
        await store.createSnapshot('test-agent', quads);
      }
    });

    it('should return latest version by default', async () => {
      const snapshot = await store.getSnapshot('test-agent');
      expect(snapshot).not.toBeNull();
      expect(snapshot!.version).toBe(3);
    });

    it('should return specific version', async () => {
      const snapshot = await store.getSnapshot('test-agent', { version: 2 });
      expect(snapshot).not.toBeNull();
      expect(snapshot!.version).toBe(2);
    });

    it('should return null for non-existent agent', async () => {
      const snapshot = await store.getSnapshot('non-existent');
      expect(snapshot).toBeNull();
    });

    it('should support point-in-time queries', async () => {
      // Clear existing and create with explicit timestamps
      await store.clear();
      
      const baseTime = new Date('2024-01-01T00:00:00Z');
      const v1Time = new Date(baseTime.getTime());
      const v2Time = new Date(baseTime.getTime() + 10000); // +10 seconds
      const v3Time = new Date(baseTime.getTime() + 20000); // +20 seconds
      
      // Create versions with explicit validFrom times
      await store.createSnapshot('test-agent', [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent'),
          chrysalis('name'),
          DataFactory.literal('Version 1')
        )
      ], { validFrom: v1Time });
      
      await store.createSnapshot('test-agent', [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent'),
          chrysalis('name'),
          DataFactory.literal('Version 2')
        )
      ], { validFrom: v2Time });
      
      await store.createSnapshot('test-agent', [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent'),
          chrysalis('name'),
          DataFactory.literal('Version 3')
        )
      ], { validFrom: v3Time });
      
      // Query at midpoint between v1 and v2
      const midPoint = new Date(baseTime.getTime() + 5000); // +5 seconds
      const snapshot = await store.getSnapshot('test-agent', { asOf: midPoint });
      expect(snapshot).not.toBeNull();
      expect(snapshot!.version).toBe(1);
    });
  });

  describe('getAgentHistory', () => {
    it('should return all versions in order', async () => {
      for (let i = 1; i <= 3; i++) {
        await store.createSnapshot('test-agent', [
          DataFactory.quad(
            DataFactory.namedNode('https://example.org/agent'),
            chrysalis('version'),
            DataFactory.literal(String(i))
          )
        ]);
      }

      const history = await store.getAgentHistory('test-agent');
      expect(history.length).toBe(3);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
      expect(history[2].version).toBe(3);
    });

    it('should return empty array for non-existent agent', async () => {
      const history = await store.getAgentHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      const quads = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent1'),
          rdf('type'),
          chrysalis('Agent')
        ),
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent1'),
          chrysalis('name'),
          DataFactory.literal('Agent One')
        ),
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/tool1'),
          rdf('type'),
          chrysalis('Tool')
        ),
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/tool1'),
          chrysalis('toolName'),
          DataFactory.literal('web_search')
        )
      ];
      await store.createSnapshot('agent1', quads);
    });

    it('should query by subject', async () => {
      const results = await store.query({
        subject: 'https://example.org/agent1'
      });
      expect(results.length).toBe(2);
    });

    it('should query by predicate', async () => {
      const results = await store.query({
        predicate: `${RDF_NS}type`
      });
      expect(results.length).toBe(2);
    });

    it('should query by object', async () => {
      const results = await store.query({
        object: `${CHRYSALIS_NS}Agent`
      });
      expect(results.length).toBe(1);
    });

    it('should query with multiple constraints', async () => {
      const results = await store.query({
        subject: 'https://example.org/agent1',
        predicate: `${CHRYSALIS_NS}name`
      });
      expect(results.length).toBe(1);
      expect(results[0].object.value).toBe('Agent One');
    });
  });

  describe('select', () => {
    beforeEach(async () => {
      const quads = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent1'),
          rdf('type'),
          chrysalis('Agent')
        ),
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent1'),
          chrysalis('name'),
          DataFactory.literal('Agent One')
        )
      ];
      await store.createSnapshot('agent1', quads);
    });

    it('should return bindings for variables', async () => {
      const result = await store.select([
        {
          subject: { variable: 's' },
          predicate: `${CHRYSALIS_NS}name`,
          object: { variable: 'name' }
        }
      ]);

      expect(result.variables).toContain('s');
      expect(result.variables).toContain('name');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0]['name'].value).toBe('Agent One');
    });
  });

  describe('discoverAgents', () => {
    beforeEach(async () => {
      // Create agent 1 with web_search tool
      const agent1Quads = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent1'),
          rdf('type'),
          chrysalis('Agent')
        ),
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent1'),
          chrysalis('name'),
          DataFactory.literal('Search Agent')
        ),
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/tool1'),
          chrysalis('toolName'),
          DataFactory.literal('web_search')
        )
      ];
      await store.createSnapshot('agent1', agent1Quads);

      // Create agent 2 with file_ops tool
      const agent2Quads = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent2'),
          rdf('type'),
          chrysalis('Agent')
        ),
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent2'),
          chrysalis('name'),
          DataFactory.literal('File Agent')
        ),
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/tool2'),
          chrysalis('toolName'),
          DataFactory.literal('file_ops')
        )
      ];
      await store.createSnapshot('agent2', agent2Quads);
    });

    it('should discover by name', async () => {
      const results = await store.discoverAgents({ nameContains: 'Search' });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Search Agent');
    });

    it('should discover by capability', async () => {
      const results = await store.discoverAgents({ hasCapability: ['web_search'] });
      expect(results.length).toBe(1);
      expect(results[0].agentId).toBe('agent1');
    });

    it('should return all agents with empty criteria', async () => {
      const results = await store.discoverAgents({});
      expect(results.length).toBe(2);
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent and all versions', async () => {
      await store.createSnapshot('test-agent', [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent'),
          chrysalis('name'),
          DataFactory.literal('Test')
        )
      ]);
      await store.createSnapshot('test-agent', [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent'),
          chrysalis('name'),
          DataFactory.literal('Test v2')
        )
      ]);

      const deleted = await store.deleteAgent('test-agent');
      expect(deleted).toBe(true);

      const snapshot = await store.getSnapshot('test-agent');
      expect(snapshot).toBeNull();
    });

    it('should return false for non-existent agent', async () => {
      const deleted = await store.deleteAgent('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return store statistics', async () => {
      await store.createSnapshot('agent1', [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent1'),
          chrysalis('name'),
          DataFactory.literal('Agent 1')
        )
      ]);
      await store.createSnapshot('agent2', [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/agent2'),
          chrysalis('name'),
          DataFactory.literal('Agent 2')
        )
      ]);

      const stats = await store.getStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.totalSnapshots).toBe(2);
      expect(stats.totalQuads).toBeGreaterThan(0);
    });
  });
});

describe('Serialization', () => {
  describe('serializeNTriples', () => {
    it('should serialize quads to N-Triples format', () => {
      const quads = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/s'),
          DataFactory.namedNode('https://example.org/p'),
          DataFactory.namedNode('https://example.org/o')
        ),
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/s'),
          DataFactory.namedNode('https://example.org/label'),
          DataFactory.literal('Hello')
        )
      ];

      const ntriples = serializeNTriples(quads);
      expect(ntriples).toContain('<https://example.org/s>');
      expect(ntriples).toContain('<https://example.org/p>');
      expect(ntriples).toContain('"Hello"');
    });

    it('should handle typed literals', () => {
      const quads = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/s'),
          DataFactory.namedNode('https://example.org/count'),
          DataFactory.literal('42', DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer'))
        )
      ];

      const ntriples = serializeNTriples(quads);
      expect(ntriples).toContain('^^<http://www.w3.org/2001/XMLSchema#integer>');
    });

    it('should handle language-tagged literals', () => {
      const quads = [
        DataFactory.quad(
          DataFactory.namedNode('https://example.org/s'),
          DataFactory.namedNode('https://example.org/name'),
          DataFactory.literal('Bonjour', 'fr')
        )
      ];

      const ntriples = serializeNTriples(quads);
      expect(ntriples).toContain('@fr');
    });
  });

  describe('parseNTriples', () => {
    it('should parse N-Triples to quads', () => {
      const ntriples = `
        <https://example.org/s> <https://example.org/p> <https://example.org/o> .
        <https://example.org/s> <https://example.org/label> "Hello" .
      `;

      const quads = parseNTriples(ntriples);
      expect(quads.length).toBe(2);
      expect(quads[0].subject.value).toBe('https://example.org/s');
      expect(quads[1].object.value).toBe('Hello');
    });

    it('should handle comments and blank lines', () => {
      const ntriples = `
        # This is a comment
        <https://example.org/s> <https://example.org/p> <https://example.org/o> .
        
        # Another comment
      `;

      const quads = parseNTriples(ntriples);
      expect(quads.length).toBe(1);
    });
  });
});
