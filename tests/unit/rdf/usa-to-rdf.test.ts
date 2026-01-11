/**
 * Tests for USA to RDF Conversion
 * 
 * Validates the canonical RDF representation of UniformSemanticAgentV2.
 */

import {
  usaToRdf,
  rdfToUsa,
  DataFactory,
  serializeNTriples,
  CHRYSALIS_NS,
  RDF_NS,
  FOAF_NS,
  DCTERMS_NS,
} from '../../../src/rdf';

import type { UniformSemanticAgentV2 } from '../../../src/core/UniformSemanticAgentV2';

describe('USA to RDF Conversion', () => {
  // Create a minimal test agent
  const createTestAgent = (): UniformSemanticAgentV2 => ({
    schema_version: '2.0.0',
    identity: {
      id: 'test-agent-123',
      name: 'Test Agent',
      designation: 'Test Designation',
      bio: 'A test agent for unit testing',
      fingerprint: 'abc123fingerprint',
      created: '2026-01-01T00:00:00Z',
      version: '1.0.0',
    },
    personality: {
      core_traits: ['analytical', 'helpful'],
      values: ['accuracy', 'efficiency'],
      quirks: ['uses metaphors'],
      fears: ['being wrong'],
      aspirations: ['continuous learning'],
    },
    communication: {
      style: {
        all: ['Be concise', 'Use examples'],
        technical: ['Include code samples'],
      },
      signature_phrases: ['Let me analyze that'],
    },
    capabilities: {
      primary: ['code_generation', 'analysis'],
      secondary: ['documentation'],
      domains: ['software', 'data'],
      tools: [
        {
          name: 'python',
          protocol: 'native',
          config: {},
          usage_stats: {
            total_invocations: 100,
            success_rate: 0.95,
            average_latency_ms: 50,
            last_used: '2026-01-01T00:00:00Z',
            preferred_contexts: ['development'],
          },
        },
      ],
      learned_skills: [
        {
          skill_id: 'skill-1',
          name: 'Python Programming',
          category: 'programming',
          proficiency: 0.9,
          acquired: '2025-01-01T00:00:00Z',
          source_instances: ['instance-1'],
          learning_curve: [],
          usage: {
            total_invocations: 50,
            success_rate: 0.92,
            contexts: ['development'],
            last_used: '2026-01-01T00:00:00Z',
          },
          prerequisites: [],
          enables: [],
          synergies: [],
        },
      ],
    },
    knowledge: {
      facts: ['Python is a programming language'],
      topics: ['programming', 'AI'],
      expertise: ['machine learning'],
      accumulated_knowledge: [
        {
          knowledge_id: 'k-1',
          content: 'Test knowledge',
          confidence: 0.85,
          source_instance: 'instance-1',
          acquired: '2026-01-01T00:00:00Z',
          verification_count: 3,
        },
      ],
    },
    memory: {
      type: 'vector',
      provider: 'local',
      settings: {},
      collections: {
        episodic: [
          {
            episode_id: 'ep-1',
            timestamp: '2026-01-01T00:00:00Z',
            source_instance: 'instance-1',
            duration: 5000,
            context: {},
            interactions: [],
            outcome: 'success',
            lessons_learned: ['Test lesson'],
            skills_practiced: ['python'],
            effectiveness_rating: 0.9,
          },
        ],
        semantic: [
          {
            concept_id: 'c-1',
            name: 'Test Concept',
            definition: 'A concept for testing',
            related_concepts: ['related-1'],
            confidence: 0.8,
            sources: ['test'],
            usage_count: 10,
            last_used: '2026-01-01T00:00:00Z',
          },
        ],
      },
    },
    beliefs: {
      who: [
        {
          content: 'I am a test agent',
          conviction: 0.9,
          privacy: 'PUBLIC',
          source: 'training',
          tags: ['identity'],
        },
      ],
      what: [
        {
          content: 'Testing is important',
          conviction: 0.95,
          privacy: 'PUBLIC',
          source: 'experience',
        },
      ],
      why: [],
      how: [],
    },
    instances: {
      active: [
        {
          instance_id: 'instance-1',
          type: 'mcp',
          framework: 'chrysalis',
          deployment_context: 'test',
          created: '2026-01-01T00:00:00Z',
          last_sync: '2026-01-01T00:00:00Z',
          status: 'running',
          sync_protocol: 'streaming',
          endpoint: 'http://localhost:3000',
          health: {
            status: 'healthy',
            last_heartbeat: '2026-01-01T00:00:00Z',
            error_rate: 0.01,
            sync_lag: 100,
          },
          statistics: {
            total_syncs: 10,
            memories_contributed: 5,
            skills_learned: 2,
            knowledge_acquired: 3,
            conversations_handled: 20,
          },
        },
      ],
      terminated: [],
    },
    experience_sync: {
      enabled: true,
      default_protocol: 'streaming',
      merge_strategy: {
        conflict_resolution: 'latest_wins',
        memory_deduplication: true,
        skill_aggregation: 'max',
        knowledge_verification_threshold: 0.7,
      },
    },
    protocols: {
      mcp: {
        enabled: true,
        role: 'client',
        servers: [],
        tools: ['python', 'search'],
      },
    },
    execution: {
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        temperature: 0.7,
        max_tokens: 4096,
      },
      runtime: {
        timeout: 300,
        max_iterations: 20,
        error_handling: 'graceful_degradation',
      },
    },
    metadata: {
      version: '1.0.0',
      schema_version: '2.0.0',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T00:00:00Z',
      author: 'Test Author',
      tags: ['test', 'unit-test'],
      source_framework: 'chrysalis',
      evolution: {
        total_deployments: 5,
        total_syncs: 100,
        total_skills_learned: 10,
        total_knowledge_acquired: 50,
        total_conversations: 200,
        last_evolution: '2026-01-01T00:00:00Z',
        evolution_rate: 0.05,
      },
    },
  });

  describe('usaToRdf', () => {
    it('should convert agent identity to RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);

      // Check agent type
      const typeQuads = quads.filter(
        q => q.predicate.value === `${RDF_NS}type` && 
             q.object.value === `${CHRYSALIS_NS}Agent`
      );
      expect(typeQuads.length).toBe(1);

      // Check name
      const nameQuads = quads.filter(
        q => q.predicate.value === `${FOAF_NS}name`
      );
      expect(nameQuads.length).toBe(1);
      expect(nameQuads[0].object.value).toBe('Test Agent');

      // Check identifier
      const idQuads = quads.filter(
        q => q.predicate.value === `${DCTERMS_NS}identifier`
      );
      expect(idQuads.some(q => q.object.value === 'test-agent-123')).toBe(true);
    });

    it('should convert personality traits to RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);

      const traitQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}coreTrait`
      );
      expect(traitQuads.length).toBe(2);
      expect(traitQuads.map(q => q.object.value)).toContain('analytical');
      expect(traitQuads.map(q => q.object.value)).toContain('helpful');
    });

    it('should convert capabilities to RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);

      const primaryCapQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}primaryCapability`
      );
      expect(primaryCapQuads.length).toBe(2);
      expect(primaryCapQuads.map(q => q.object.value)).toContain('code_generation');

      const toolQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}hasTool`
      );
      expect(toolQuads.length).toBe(1);
    });

    it('should convert knowledge to RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);

      const factQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}fact`
      );
      expect(factQuads.length).toBe(1);
      expect(factQuads[0].object.value).toBe('Python is a programming language');

      const topicQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}topic`
      );
      expect(topicQuads.length).toBe(2);
    });

    it('should convert beliefs to RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);

      const beliefQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}hasBelief`
      );
      expect(beliefQuads.length).toBe(2); // who + what

      const convictionQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}conviction`
      );
      expect(convictionQuads.length).toBeGreaterThan(0);
    });

    it('should convert instances to RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);

      const instanceQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}hasActiveInstance`
      );
      expect(instanceQuads.length).toBe(1);

      const statusQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}status`
      );
      expect(statusQuads.some(q => q.object.value === 'running')).toBe(true);
    });

    it('should convert protocols to RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);

      const protocolQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}supportsProtocol`
      );
      expect(protocolQuads.length).toBe(1);

      const mcpTypeQuads = quads.filter(
        q => q.predicate.value === `${RDF_NS}type` &&
             q.object.value === `${CHRYSALIS_NS}MCPProtocolBinding`
      );
      expect(mcpTypeQuads.length).toBe(1);
    });

    it('should convert execution config to RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);

      const providerQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}llmProvider`
      );
      expect(providerQuads.length).toBe(1);
      expect(providerQuads[0].object.value).toBe('anthropic');

      const modelQuads = quads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}llmModel`
      );
      expect(modelQuads.length).toBe(1);
      expect(modelQuads[0].object.value).toBe('claude-3-5-sonnet');
    });

    it('should serialize to valid N-Triples', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);
      const ntriples = serializeNTriples(quads);

      expect(ntriples).toContain('<https://chrysalis.dev/agent/test-agent-123>');
      expect(ntriples).toContain(`<${RDF_NS}type>`);
      expect(ntriples).toContain(`<${CHRYSALIS_NS}Agent>`);
    });

    it('should respect options to exclude sections', () => {
      const agent = createTestAgent();
      
      const fullQuads = usaToRdf(agent);
      const minimalQuads = usaToRdf(agent, {
        includeInstances: false,
        includeEpisodes: false,
        includeConcepts: false,
        includeProtocols: false,
        includeExecution: false,
      });

      expect(minimalQuads.length).toBeLessThan(fullQuads.length);

      // Should not have instance quads
      const instanceQuads = minimalQuads.filter(
        q => q.predicate.value === `${CHRYSALIS_NS}hasActiveInstance`
      );
      expect(instanceQuads.length).toBe(0);
    });
  });

  describe('rdfToUsa', () => {
    it('should extract basic identity from RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);
      const agentUri = 'https://chrysalis.dev/agent/test-agent-123';

      const extracted = rdfToUsa(quads, agentUri);

      expect(extracted.identity?.id).toBe('test-agent-123');
      expect(extracted.identity?.name).toBe('Test Agent');
      expect(extracted.identity?.designation).toBe('Test Designation');
    });

    it('should extract capabilities from RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);
      const agentUri = 'https://chrysalis.dev/agent/test-agent-123';

      const extracted = rdfToUsa(quads, agentUri);

      expect(extracted.capabilities?.primary).toContain('code_generation');
      expect(extracted.capabilities?.primary).toContain('analysis');
      expect(extracted.capabilities?.domains).toContain('software');
    });

    it('should extract knowledge from RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);
      const agentUri = 'https://chrysalis.dev/agent/test-agent-123';

      const extracted = rdfToUsa(quads, agentUri);

      expect(extracted.knowledge?.facts).toContain('Python is a programming language');
      expect(extracted.knowledge?.topics).toContain('programming');
      expect(extracted.knowledge?.expertise).toContain('machine learning');
    });

    it('should extract personality from RDF', () => {
      const agent = createTestAgent();
      const quads = usaToRdf(agent);
      const agentUri = 'https://chrysalis.dev/agent/test-agent-123';

      const extracted = rdfToUsa(quads, agentUri);

      expect(extracted.personality?.core_traits).toContain('analytical');
      expect(extracted.personality?.values).toContain('accuracy');
      expect(extracted.personality?.quirks).toContain('uses metaphors');
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve core identity through round-trip', () => {
      const original = createTestAgent();
      const quads = usaToRdf(original);
      const agentUri = 'https://chrysalis.dev/agent/test-agent-123';
      const extracted = rdfToUsa(quads, agentUri);

      expect(extracted.identity?.id).toBe(original.identity.id);
      expect(extracted.identity?.name).toBe(original.identity.name);
      expect(extracted.identity?.designation).toBe(original.identity.designation);
    });

    it('should preserve capabilities through round-trip', () => {
      const original = createTestAgent();
      const quads = usaToRdf(original);
      const agentUri = 'https://chrysalis.dev/agent/test-agent-123';
      const extracted = rdfToUsa(quads, agentUri);

      expect(extracted.capabilities?.primary).toEqual(
        expect.arrayContaining(original.capabilities.primary)
      );
      expect(extracted.capabilities?.domains).toEqual(
        expect.arrayContaining(original.capabilities.domains)
      );
    });
  });
});
