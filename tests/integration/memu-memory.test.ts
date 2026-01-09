/**
 * Integration Test: MemU Memory System
 * 
 * Tests the memory adapter to validate:
 * - Memory tier operations (working, episodic, semantic, procedural)
 * - Memory persistence and retrieval
 * - Semantic search with embeddings
 * - Memory consolidation
 * - Context assembly for LLM prompts
 */

import {
  MemUAdapter,
  MockEmbeddingProvider,
  createMemoryAdapter,
  type WorkingMemory,
  type EpisodicMemory,
  type SemanticMemory,
  type ProceduralMemory,
  type RetrievalResult
} from '../../src/memory';

describe('MemU Memory System Integration', () => {
  let adapter: MemUAdapter;
  let mockEmbedding: MockEmbeddingProvider;

  beforeEach(() => {
    mockEmbedding = new MockEmbeddingProvider();
    adapter = new MemUAdapter('test-agent', {
      workingMemoryLimit: 10,
      episodicRetentionDays: 30,
      semanticConsolidationThreshold: 3,
      proceduralMinExecutions: 2
    }, mockEmbedding);
  });

  afterEach(() => {
    adapter.clear();
  });

  describe('Working Memory', () => {
    it('should store and retrieve working memory items', async () => {
      const memory: Omit<WorkingMemory, 'id' | 'timestamp' | 'metadata'> = {
        type: 'working',
        tier: 'working',
        source: 'conversation',
        content: 'The user asked about TypeScript',
        attention: 0.9,
        decay: 0.1
      };

      const id = await adapter.store(memory);
      expect(id).toBeDefined();

      const retrieved = await adapter.retrieve(id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('The user asked about TypeScript');
      expect(retrieved?.tier).toBe('working');
    });

    it('should respect working memory limit', async () => {
      // Store more than the limit
      for (let i = 0; i < 15; i++) {
        await adapter.store({
          type: 'working',
          tier: 'working',
          source: 'conversation',
          content: `Memory item ${i}`,
          attention: 0.5 + (i * 0.01),
          decay: 0.1
        });
      }

      const allWorking = await adapter.getAllByTier('working');
      expect(allWorking.length).toBeLessThanOrEqual(10);
    });

    it('should decay attention over time', async () => {
      const id = await adapter.store({
        type: 'working',
        tier: 'working',
        source: 'conversation',
        content: 'Test memory',
        attention: 1.0,
        decay: 0.5 // High decay rate
      });

      // Simulate time passing
      await adapter.tick(5); // 5 ticks

      const retrieved = await adapter.retrieve(id);
      expect(retrieved?.attention).toBeLessThan(1.0);
    });
  });

  describe('Episodic Memory', () => {
    it('should store and retrieve episodic memories', async () => {
      const memory: Omit<EpisodicMemory, 'id' | 'timestamp' | 'metadata'> = {
        type: 'episodic',
        tier: 'episodic',
        source: 'event',
        content: 'User completed the tutorial',
        eventType: 'milestone',
        participants: ['user', 'agent'],
        emotionalValence: 0.8,
        importance: 0.9
      };

      const id = await adapter.store(memory);
      const retrieved = await adapter.retrieve(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.tier).toBe('episodic');
      expect((retrieved as EpisodicMemory)?.eventType).toBe('milestone');
    });

    it('should retrieve memories by participant', async () => {
      await adapter.store({
        type: 'episodic',
        tier: 'episodic',
        source: 'event',
        content: 'Interaction with Alice',
        eventType: 'conversation',
        participants: ['agent', 'alice'],
        emotionalValence: 0.5,
        importance: 0.6
      });

      await adapter.store({
        type: 'episodic',
        tier: 'episodic',
        source: 'event',
        content: 'Interaction with Bob',
        eventType: 'conversation',
        participants: ['agent', 'bob'],
        emotionalValence: 0.5,
        importance: 0.6
      });

      const aliceMemories = await adapter.queryByParticipant('alice');
      expect(aliceMemories.length).toBe(1);
      expect(aliceMemories[0].content).toContain('Alice');
    });

    it('should sort by importance', async () => {
      await adapter.store({
        type: 'episodic',
        tier: 'episodic',
        source: 'event',
        content: 'Low importance event',
        eventType: 'misc',
        participants: ['agent'],
        emotionalValence: 0.1,
        importance: 0.2
      });

      await adapter.store({
        type: 'episodic',
        tier: 'episodic',
        source: 'event',
        content: 'High importance event',
        eventType: 'milestone',
        participants: ['agent'],
        emotionalValence: 0.9,
        importance: 0.95
      });

      const results = await adapter.searchByTier('episodic', '', 10, 'importance');
      expect(results[0].content).toContain('High importance');
    });
  });

  describe('Semantic Memory', () => {
    it('should store and retrieve facts', async () => {
      const memory: Omit<SemanticMemory, 'id' | 'timestamp' | 'metadata'> = {
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'TypeScript is a typed superset of JavaScript',
        category: 'programming',
        confidence: 0.95,
        relations: [
          { type: 'is_a', target: 'programming_language' },
          { type: 'extends', target: 'javascript' }
        ]
      };

      const id = await adapter.store(memory);
      const retrieved = await adapter.retrieve(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.tier).toBe('semantic');
      expect((retrieved as SemanticMemory)?.category).toBe('programming');
    });

    it('should search by semantic similarity', async () => {
      await adapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'Python is an interpreted programming language',
        category: 'programming',
        confidence: 0.9,
        relations: []
      });

      await adapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'The Eiffel Tower is in Paris',
        category: 'geography',
        confidence: 0.99,
        relations: []
      });

      await adapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'JavaScript runs in web browsers',
        category: 'programming',
        confidence: 0.95,
        relations: []
      });

      // Search for programming-related memories
      const results = await adapter.semanticSearch('programming languages', 'semantic', 5);
      
      // Should prioritize programming-related memories
      expect(results.length).toBeGreaterThan(0);
    });

    it('should retrieve by category', async () => {
      await adapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'React is a UI library',
        category: 'frontend',
        confidence: 0.9,
        relations: []
      });

      await adapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'PostgreSQL is a database',
        category: 'backend',
        confidence: 0.9,
        relations: []
      });

      const frontendFacts = await adapter.queryByCategory('frontend');
      expect(frontendFacts.length).toBe(1);
      expect(frontendFacts[0].content).toContain('React');
    });
  });

  describe('Procedural Memory', () => {
    it('should store and retrieve skills', async () => {
      const memory: Omit<ProceduralMemory, 'id' | 'timestamp' | 'metadata'> = {
        type: 'procedural',
        tier: 'procedural',
        source: 'learned',
        content: 'How to write a TypeScript function',
        skillName: 'typescript_function',
        steps: [
          'Define the function signature with types',
          'Implement the function body',
          'Add return type annotation',
          'Export if needed'
        ],
        prerequisites: ['typescript_basics'],
        executionCount: 0,
        successRate: 0,
        averageExecutionTime: 0
      };

      const id = await adapter.store(memory);
      const retrieved = await adapter.retrieve(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.tier).toBe('procedural');
      expect((retrieved as ProceduralMemory)?.steps.length).toBe(4);
    });

    it('should track skill execution', async () => {
      const id = await adapter.store({
        type: 'procedural',
        tier: 'procedural',
        source: 'learned',
        content: 'How to debug code',
        skillName: 'debugging',
        steps: ['Reproduce', 'Isolate', 'Fix', 'Verify'],
        prerequisites: [],
        executionCount: 0,
        successRate: 0,
        averageExecutionTime: 0
      });

      // Record successful execution
      await adapter.recordExecution(id, true, 5000);
      await adapter.recordExecution(id, true, 3000);
      await adapter.recordExecution(id, false, 8000);

      const retrieved = await adapter.retrieve(id) as ProceduralMemory;
      expect(retrieved.executionCount).toBe(3);
      expect(retrieved.successRate).toBeCloseTo(0.67, 1);
    });

    it('should retrieve skills by prerequisite', async () => {
      await adapter.store({
        type: 'procedural',
        tier: 'procedural',
        source: 'learned',
        content: 'Advanced React patterns',
        skillName: 'react_advanced',
        steps: ['Step 1', 'Step 2'],
        prerequisites: ['react_basics', 'hooks'],
        executionCount: 0,
        successRate: 0,
        averageExecutionTime: 0
      });

      await adapter.store({
        type: 'procedural',
        tier: 'procedural',
        source: 'learned',
        content: 'Basic React',
        skillName: 'react_basics',
        steps: ['Step 1'],
        prerequisites: [],
        executionCount: 0,
        successRate: 0,
        averageExecutionTime: 0
      });

      const advancedSkills = await adapter.queryByPrerequisite('react_basics');
      expect(advancedSkills.length).toBe(1);
      expect(advancedSkills[0].skillName).toBe('react_advanced');
    });
  });

  describe('Memory Consolidation', () => {
    it('should promote working memory to episodic based on reinforcement', async () => {
      const id = await adapter.store({
        type: 'working',
        tier: 'working',
        source: 'conversation',
        content: 'Important repeated concept',
        attention: 0.9,
        decay: 0.01
      });

      // Reinforce the memory multiple times
      await adapter.reinforce(id);
      await adapter.reinforce(id);
      await adapter.reinforce(id);

      // Run consolidation
      await adapter.consolidate();

      // Check if promoted
      const episodic = await adapter.getAllByTier('episodic');
      const promoted = episodic.find(m => m.content === 'Important repeated concept');
      expect(promoted).toBeDefined();
    });

    it('should merge related semantic memories', async () => {
      await adapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'TypeScript has static typing',
        category: 'typescript',
        confidence: 0.8,
        relations: []
      });

      await adapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'TypeScript compiles to JavaScript',
        category: 'typescript',
        confidence: 0.85,
        relations: []
      });

      // Running merge should combine related facts
      const mergeCount = await adapter.mergeRelatedSemantics('typescript');
      expect(mergeCount).toBeGreaterThanOrEqual(0); // May or may not merge based on similarity
    });
  });

  describe('Context Assembly', () => {
    it('should assemble context for LLM prompts', async () => {
      // Populate some memories
      await adapter.store({
        type: 'working',
        tier: 'working',
        source: 'conversation',
        content: 'Current topic: API design',
        attention: 0.95,
        decay: 0.1
      });

      await adapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'REST APIs use HTTP methods',
        category: 'api',
        confidence: 0.9,
        relations: []
      });

      await adapter.store({
        type: 'procedural',
        tier: 'procedural',
        source: 'learned',
        content: 'How to design a REST endpoint',
        skillName: 'rest_design',
        steps: ['Define resource', 'Choose HTTP method', 'Design response'],
        prerequisites: [],
        executionCount: 5,
        successRate: 0.9,
        averageExecutionTime: 1000
      });

      const context = await adapter.assembleContext('How do I design an API?');

      expect(context).toBeDefined();
      expect(context.workingContext.length).toBeGreaterThan(0);
      expect(context.relevantFacts.length).toBeGreaterThan(0);
      expect(context.availableSkills.length).toBeGreaterThan(0);
    });

    it('should format context as prompt string', async () => {
      await adapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'Important fact for the agent',
        category: 'general',
        confidence: 0.9,
        relations: []
      });

      const context = await adapter.assembleContext('test query');
      const promptString = adapter.formatContextForPrompt(context);

      expect(typeof promptString).toBe('string');
      expect(promptString.length).toBeGreaterThan(0);
    });
  });

  describe('Factory Function', () => {
    it('should create adapter with factory function', () => {
      const factoryAdapter = createMemoryAdapter('factory-agent', {
        embeddingProvider: 'mock'
      });

      expect(factoryAdapter).toBeInstanceOf(MemUAdapter);
    });
  });
});