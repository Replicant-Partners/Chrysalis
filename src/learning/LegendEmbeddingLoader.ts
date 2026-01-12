/**
 * LegendEmbeddingLoader
 *
 * Loads pre-computed legend embeddings from the Builder pipelines
 * (KnowledgeBuilder + SkillBuilder) into the MemU memory system.
 *
 * This bridges the offline builder process with the runtime chat agents,
 * enabling agents to recall and discuss their learned knowledge.
 *
 * @module learning/LegendEmbeddingLoader
 */

import { MemUAdapter } from '../memory/MemUAdapter';
import { SemanticMemory, ProceduralMemory } from '../memory/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Knowledge builder embedding from harness
 */
export interface KnowledgeEmbedding {
  run: number;
  dimensions: number;
  embedding: number[];
  has_collected_knowledge: boolean;
  descriptor_strategy: 'focused' | 'diverse' | 'hybrid';
  descriptors: string[];
  duration_sec: number;
  error: string | null;
}

/**
 * Skill builder embedding from harness
 */
export interface SkillEmbedding {
  run: number;
  dimensions: number;
  embedding: number[];
  skill_count: number;
  salts_used: string[];
  descriptor_strategy: 'focused' | 'diverse' | 'hybrid';
  descriptors: string[];
  duration_sec: number;
  error: string | null;
}

/**
 * Parsed legend embedding file structure
 */
export interface LegendEmbeddingFile {
  name: string;
  source_file: string;
  processed_at: string;
  run_count: number;
  strategy: string;
  knowledge_builder: {
    runs: number;
    embeddings: KnowledgeEmbedding[];
  };
  skill_builder: {
    runs: number;
    embeddings: SkillEmbedding[];
  };
}

/**
 * Loading options
 */
export interface LoadingOptions {
  /** Use the most recent run (highest run number) */
  useLatestRun?: boolean;
  /** Specific run number to load (1-indexed) */
  runNumber?: number;
  /** Load knowledge embeddings into semantic memory */
  loadKnowledge?: boolean;
  /** Load skill embeddings into procedural memory */
  loadSkills?: boolean;
  /** Base confidence for loaded memories */
  baseConfidence?: number;
}

/**
 * Loading result
 */
export interface LoadingResult {
  legendName: string;
  knowledgeLoaded: number;
  skillsLoaded: number;
  totalDescriptors: number;
  errors: string[];
}

/**
 * Aggregate loading statistics
 */
export interface LoadingStats {
  legendsLoaded: number;
  totalKnowledge: number;
  totalSkills: number;
  totalDescriptors: number;
  errors: string[];
  duration_ms: number;
}

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_LOADING_OPTIONS: Required<LoadingOptions> = {
  useLatestRun: true,
  runNumber: 3,
  loadKnowledge: true,
  loadSkills: true,
  baseConfidence: 0.85,
};

// =============================================================================
// Main Class
// =============================================================================

/**
 * LegendEmbeddingLoader
 *
 * Loads builder-generated embeddings into the MemU memory system.
 */
export class LegendEmbeddingLoader {
  private memory: MemUAdapter;
  private agentId: string;
  private loadedLegends: Set<string> = new Set();

  constructor(memory: MemUAdapter, agentId: string) {
    this.memory = memory;
    this.agentId = agentId;
  }

  // ===========================================================================
  // Main Loading Methods
  // ===========================================================================

  /**
   * Load embeddings from a parsed embedding file
   */
  async loadFromParsedFile(
    data: LegendEmbeddingFile,
    options?: LoadingOptions
  ): Promise<LoadingResult> {
    const opts = { ...DEFAULT_LOADING_OPTIONS, ...options };
    const result: LoadingResult = {
      legendName: data.name,
      knowledgeLoaded: 0,
      skillsLoaded: 0,
      totalDescriptors: 0,
      errors: [],
    };

    try {
      // Determine which run to use
      const runIndex = opts.useLatestRun
        ? data.knowledge_builder.embeddings.length - 1
        : (opts.runNumber ?? 3) - 1;

      // Load knowledge embeddings
      if (opts.loadKnowledge && data.knowledge_builder.embeddings.length > runIndex) {
        const knowledgeRun = data.knowledge_builder.embeddings[runIndex];
        const loaded = await this.loadKnowledgeEmbedding(
          data.name,
          knowledgeRun,
          opts.baseConfidence
        );
        result.knowledgeLoaded = loaded;
        result.totalDescriptors += knowledgeRun.descriptors.length;
      }

      // Load skill embeddings
      if (opts.loadSkills && data.skill_builder.embeddings.length > runIndex) {
        const skillRun = data.skill_builder.embeddings[runIndex];
        const loaded = await this.loadSkillEmbedding(
          data.name,
          skillRun,
          opts.baseConfidence
        );
        result.skillsLoaded = loaded;
        result.totalDescriptors += skillRun.descriptors.length;
      }

      this.loadedLegends.add(data.name);
    } catch (error) {
      result.errors.push(`Error loading ${data.name}: ${error}`);
    }

    return result;
  }

  /**
   * Load embeddings from JSON string
   */
  async loadFromJSON(json: string, options?: LoadingOptions): Promise<LoadingResult> {
    const data = JSON.parse(json) as LegendEmbeddingFile;
    return this.loadFromParsedFile(data, options);
  }

  /**
   * Load multiple legends and aggregate results
   */
  async loadMultiple(
    files: LegendEmbeddingFile[],
    options?: LoadingOptions
  ): Promise<LoadingStats> {
    const startTime = Date.now();
    const stats: LoadingStats = {
      legendsLoaded: 0,
      totalKnowledge: 0,
      totalSkills: 0,
      totalDescriptors: 0,
      errors: [],
      duration_ms: 0,
    };

    for (const file of files) {
      const result = await this.loadFromParsedFile(file, options);
      
      if (result.errors.length === 0) {
        stats.legendsLoaded++;
      }
      stats.totalKnowledge += result.knowledgeLoaded;
      stats.totalSkills += result.skillsLoaded;
      stats.totalDescriptors += result.totalDescriptors;
      stats.errors.push(...result.errors);
    }

    stats.duration_ms = Date.now() - startTime;
    return stats;
  }

  // ===========================================================================
  // Private Loading Methods
  // ===========================================================================

  /**
   * Load a knowledge embedding as semantic memory
   */
  private async loadKnowledgeEmbedding(
    legendName: string,
    embedding: KnowledgeEmbedding,
    confidence: number
  ): Promise<number> {
    let loaded = 0;

    // Create semantic memories for each descriptor
    for (const descriptor of embedding.descriptors) {
      const fact = `${legendName}: ${descriptor}`;
      
      await this.memory.addSemanticMemory(fact, {
        alternatePhrasings: [`${descriptor} (${legendName})`, `The trait "${descriptor}" belongs to ${legendName}`],
        evidence: [`builder:knowledge_builder:run${embedding.run}`, `legend:${legendName}`],
        confidence: confidence * (embedding.descriptor_strategy === 'focused' ? 1.0 : 0.9),
      });
      
      loaded++;
    }

    // Create a summary semantic memory with the actual embedding
    const summaryFact = `${legendName} is characterized by: ${embedding.descriptors.slice(0, 5).join(', ')}`;
    const summaryMemory = await this.memory.addSemanticMemory(summaryFact, {
      evidence: [`builder:knowledge_builder:run${embedding.run}`, `strategy:${embedding.descriptor_strategy}`],
      confidence,
    });

    // Note: The embedding vector from the builder is stored implicitly
    // through the MemUAdapter's embedding generation. In a production system,
    // we might want to directly inject the pre-computed embedding.

    return loaded + 1;
  }

  /**
   * Load a skill embedding as procedural memory
   */
  private async loadSkillEmbedding(
    legendName: string,
    embedding: SkillEmbedding,
    confidence: number
  ): Promise<number> {
    let loaded = 0;

    // Create a skill for the legend's core capabilities
    const skillName = `${legendName.toLowerCase().replace(/\s+/g, '_')}_capability`;
    
    // Generate skill steps from descriptors
    const steps = embedding.descriptors.slice(0, 5).map(
      (desc, i) => `Step ${i + 1}: Apply ${desc} perspective`
    );

    await this.memory.learnSkill(skillName, {
      description: `Embody the characteristics of ${legendName}: ${embedding.descriptors.slice(0, 3).join(', ')}`,
      steps,
      preconditions: [`Context requires ${legendName}'s perspective`],
      postconditions: [`Response reflects ${legendName}'s characteristics`],
      parameters: {
        salts_used: { type: 'array', description: 'Salt values used for embedding', required: false, default: embedding.salts_used },
        skill_count: { type: 'number', description: 'Number of skills', required: false, default: embedding.skill_count },
        strategy: { type: 'string', description: 'Descriptor strategy', required: false, default: embedding.descriptor_strategy },
      },
      examples: [
        {
          input: { query: `How would ${legendName} approach this problem?` },
          output: `Drawing on ${embedding.descriptors[0]} and ${embedding.descriptors[1]}...`,
          context: 'Persona embodiment',
        },
      ],
    });

    loaded++;

    // Create individual capability skills for prominent descriptors
    for (const descriptor of embedding.descriptors.slice(0, 3)) {
      const capabilityName = `${legendName.toLowerCase().replace(/\s+/g, '_')}_${descriptor.toLowerCase().replace(/\s+/g, '_')}`;
      
      await this.memory.learnSkill(capabilityName, {
        description: `${legendName}'s ${descriptor} capability`,
        steps: [
          `Recognize when ${descriptor} applies`,
          `Apply ${legendName}'s approach to ${descriptor}`,
          `Synthesize insights using ${descriptor} lens`,
        ],
        preconditions: [`Situation requires ${descriptor}`],
        postconditions: [`Applied ${descriptor} from ${legendName}'s perspective`],
      });
      
      loaded++;
    }

    return loaded;
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Check if a legend's embeddings have been loaded
   */
  isLegendLoaded(legendName: string): boolean {
    return this.loadedLegends.has(legendName);
  }

  /**
   * Get list of loaded legends
   */
  getLoadedLegends(): string[] {
    return Array.from(this.loadedLegends);
  }

  /**
   * Generate a learning report for chat
   */
  generateLearningReport(): string {
    const stats = this.memory.getStats();
    const legends = this.getLoadedLegends();
    
    const lines: string[] = [
      `📚 **Learning Report for ${this.agentId}**`,
      '',
      `**Loaded Legends:** ${legends.length}`,
      legends.length > 0 ? `  - ${legends.slice(0, 5).join(', ')}${legends.length > 5 ? ` ... and ${legends.length - 5} more` : ''}` : '',
      '',
      `**Memory Statistics:**`,
      `  - Working Memory: ${stats.working} items`,
      `  - Episodic Memory: ${stats.episodic} items`,
      `  - Semantic Memory: ${stats.semantic} facts`,
      `  - Procedural Memory: ${stats.procedural} skills`,
      `  - Total Memories: ${stats.total}`,
      '',
      `**Lamport Clock:** ${stats.lamportClock}`,
    ];
    
    return lines.filter(l => l !== '').join('\n');
  }

  /**
   * Search for knowledge about a specific legend
   */
  async searchLegendKnowledge(legendName: string, query: string): Promise<string[]> {
    const searchQuery = `${legendName} ${query}`;
    const results = await this.memory.searchSemantic(searchQuery, 5);
    
    return results.memories.map(m => {
      const semantic = m as SemanticMemory;
      return semantic.fact || m.content;
    });
  }

  /**
   * Get skills for a specific legend
   */
  async getLegendSkills(legendName: string): Promise<Array<{
    name: string;
    description: string;
  }>> {
    const searchQuery = `${legendName.toLowerCase().replace(/\s+/g, '_')}`;
    const results = await this.memory.searchSkills(searchQuery, 10);
    
    return results.memories.map(m => {
      const skill = m as ProceduralMemory;
      return {
        name: skill.skillName,
        description: skill.description,
      };
    });
  }
}

export default LegendEmbeddingLoader;