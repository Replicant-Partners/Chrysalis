import { MemoryMerger } from '../src/experience/MemoryMerger';
import { MockEmbeddingService } from '../src/memory/EmbeddingService';
import type { UniformSemanticAgentV2 } from '../src/core/UniformSemanticAgentV2';

function makeAgent(): UniformSemanticAgentV2 {
  return {
    schema_version: '2.0.0',
    identity: {
      id: 'agent-1',
      name: 'test',
      designation: 'test',
      bio: 'test agent',
      fingerprint: 'fp',
      created: new Date().toISOString(),
      version: '1.0.0'
    },
    personality: { core_traits: [], values: [], quirks: [] },
    communication: { style: { all: [] }, signature_phrases: [] },
    capabilities: { primary: [], secondary: [], domains: [], tools: [], learned_skills: [] },
    knowledge: { facts: [], topics: [], expertise: [], accumulated_knowledge: [] },
    memory: { type: 'vector', provider: 'local', settings: {}, collections: {} },
    beliefs: { who: [], what: [], why: [], how: [] },
    training: { accumulated_examples: [] },
    instances: { active: [], terminated: [] },
    experience_sync: {
      enabled: false,
      default_protocol: 'streaming',
      transport: { type: 'https', https: { endpoint: '' } },
      merge_strategy: {
        conflict_resolution: 'latest_wins',
        memory_deduplication: true,
        skill_aggregation: 'max',
        knowledge_verification_threshold: 0.7
      }
    },
    protocols: {},
    execution: { llm: { provider: 'none', model: 'none', temperature: 0, max_tokens: 0, parameters: {} }, runtime: { timeout: 0, max_iterations: 0, error_handling: 'graceful' } },
    deployment: { preferred_contexts: [], environment: {} },
    metadata: {
      version: '1.0.0',
      schema_version: '2.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      source_framework: 'test',
      evolution: {
        total_deployments: 0,
        total_syncs: 0,
        total_skills_learned: 0,
        total_knowledge_acquired: 0,
        total_conversations: 0,
        last_evolution: new Date().toISOString(),
        evolution_rate: 0
      }
    }
  };
}

describe('MemoryMerger with vector index', () => {
  test('deduplicates similar memories using vector index', async () => {
    const embeddingService = new MockEmbeddingService({ dimensions: 8 });
    const merger = new MemoryMerger({
      similarity_method: 'embedding',
      similarity_threshold: 0.8,
      embedding_service: embeddingService,
      use_vector_index: true
    });
    await merger.initialize();

    const agent = makeAgent();

    const batch = [
      { content: 'Hello world, this is memory one.' },
      { content: 'Hello world, this is memory one.' } // identical to force high cosine
    ];

    const result = await merger.mergeBatch(agent, batch, 'inst-1');

    expect(result.added).toBe(1);
    expect(result.deduplicated).toBe(1);
    expect(result.updated + result.conflicts).toBe(0);
  });
});
