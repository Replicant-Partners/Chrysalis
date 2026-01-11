/**
 * Agent Metadata Component
 * 
 * Manages version, evolution tracking, and metadata.
 * 
 * Single Responsibility: Metadata and evolution tracking
 */

/**
 * Evolution tracking data
 */
export interface EvolutionData {
  total_deployments: number;
  total_syncs: number;
  total_skills_learned: number;
  total_knowledge_acquired: number;
  total_conversations: number;
  last_evolution: string;
  evolution_rate: number;
}

/**
 * Metadata data structure
 */
export interface AgentMetadataData {
  version: string;
  schema_version: string;
  created: string;
  updated: string;
  author?: string;
  tags?: string[];
  source_framework?: string;
  evolution?: EvolutionData;
}

/**
 * Agent Metadata Manager
 */
export class AgentMetadata {
  private data: AgentMetadataData;

  constructor(data?: Partial<AgentMetadataData>) {
    const now = new Date().toISOString();
    this.data = {
      version: data?.version || '1.0.0',
      schema_version: data?.schema_version || '2.0.0',
      created: data?.created || now,
      updated: data?.updated || now,
      author: data?.author,
      tags: data?.tags || [],
      source_framework: data?.source_framework,
      evolution: data?.evolution || {
        total_deployments: 0,
        total_syncs: 0,
        total_skills_learned: 0,
        total_knowledge_acquired: 0,
        total_conversations: 0,
        last_evolution: now,
        evolution_rate: 0,
      },
    };
  }

  /**
   * Update the updated timestamp
   */
  touch(): void {
    this.data.updated = new Date().toISOString();
  }

  /**
   * Increment version
   */
  incrementVersion(type: 'major' | 'minor' | 'patch' = 'patch'): void {
    const parts = this.data.version.split('.').map(Number);
    
    switch (type) {
      case 'major':
        parts[0]++;
        parts[1] = 0;
        parts[2] = 0;
        break;
      case 'minor':
        parts[1]++;
        parts[2] = 0;
        break;
      case 'patch':
        parts[2]++;
        break;
    }
    
    this.data.version = parts.join('.');
    this.touch();
  }

  /**
   * Add a tag
   */
  addTag(tag: string): void {
    if (!this.data.tags) {
      this.data.tags = [];
    }
    if (!this.data.tags.includes(tag)) {
      this.data.tags.push(tag);
    }
  }

  /**
   * Remove a tag
   */
  removeTag(tag: string): void {
    if (this.data.tags) {
      this.data.tags = this.data.tags.filter(t => t !== tag);
    }
  }

  /**
   * Set author
   */
  setAuthor(author: string): void {
    this.data.author = author;
  }

  /**
   * Set source framework
   */
  setSourceFramework(framework: string): void {
    this.data.source_framework = framework;
  }

  /**
   * Record deployment
   */
  recordDeployment(): void {
    if (!this.data.evolution) {
      this.initializeEvolution();
    }
    this.data.evolution!.total_deployments++;
    this.updateEvolutionRate();
  }

  /**
   * Record sync
   */
  recordSync(): void {
    if (!this.data.evolution) {
      this.initializeEvolution();
    }
    this.data.evolution!.total_syncs++;
    this.updateEvolutionRate();
  }

  /**
   * Record skill learned
   */
  recordSkillLearned(count: number = 1): void {
    if (!this.data.evolution) {
      this.initializeEvolution();
    }
    this.data.evolution!.total_skills_learned += count;
    this.updateEvolutionRate();
  }

  /**
   * Record knowledge acquired
   */
  recordKnowledgeAcquired(count: number = 1): void {
    if (!this.data.evolution) {
      this.initializeEvolution();
    }
    this.data.evolution!.total_knowledge_acquired += count;
    this.updateEvolutionRate();
  }

  /**
   * Record conversation
   */
  recordConversation(): void {
    if (!this.data.evolution) {
      this.initializeEvolution();
    }
    this.data.evolution!.total_conversations++;
    this.updateEvolutionRate();
  }

  /**
   * Get age in days
   */
  getAgeInDays(): number {
    const created = new Date(this.data.created);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get evolution summary
   */
  getEvolutionSummary(): {
    ageInDays: number;
    totalEvents: number;
    evolutionRate: number;
    isActive: boolean;
  } {
    const evolution = this.data.evolution;
    const totalEvents = evolution
      ? evolution.total_deployments + 
        evolution.total_syncs + 
        evolution.total_skills_learned + 
        evolution.total_knowledge_acquired + 
        evolution.total_conversations
      : 0;

    const lastEvolution = evolution?.last_evolution 
      ? new Date(evolution.last_evolution)
      : new Date(this.data.created);
    
    const daysSinceEvolution = Math.floor(
      (Date.now() - lastEvolution.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      ageInDays: this.getAgeInDays(),
      totalEvents,
      evolutionRate: evolution?.evolution_rate || 0,
      isActive: daysSinceEvolution < 7,
    };
  }

  private initializeEvolution(): void {
    this.data.evolution = {
      total_deployments: 0,
      total_syncs: 0,
      total_skills_learned: 0,
      total_knowledge_acquired: 0,
      total_conversations: 0,
      last_evolution: new Date().toISOString(),
      evolution_rate: 0,
    };
  }

  private updateEvolutionRate(): void {
    if (!this.data.evolution) return;

    const ageInDays = Math.max(1, this.getAgeInDays());
    const totalEvents = 
      this.data.evolution.total_deployments +
      this.data.evolution.total_syncs +
      this.data.evolution.total_skills_learned +
      this.data.evolution.total_knowledge_acquired +
      this.data.evolution.total_conversations;

    this.data.evolution.evolution_rate = totalEvents / ageInDays;
    this.data.evolution.last_evolution = new Date().toISOString();
  }

  // Getters
  get version(): string { return this.data.version; }
  get schemaVersion(): string { return this.data.schema_version; }
  get created(): string { return this.data.created; }
  get updated(): string { return this.data.updated; }
  get author(): string | undefined { return this.data.author; }
  get tags(): readonly string[] { return this.data.tags || []; }
  get sourceFramework(): string | undefined { return this.data.source_framework; }
  get evolution(): Readonly<EvolutionData> | undefined { return this.data.evolution; }

  toData(): AgentMetadataData {
    return { ...this.data };
  }
}

export function validateMetadata(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Metadata must be an object'] };
  }
  const metadata = data as Record<string, unknown>;
  if (!metadata.version) errors.push('Metadata must have version');
  if (!metadata.schema_version) errors.push('Metadata must have schema_version');
  if (!metadata.created) errors.push('Metadata must have created');
  if (!metadata.updated) errors.push('Metadata must have updated');
  return { valid: errors.length === 0, errors };
}
