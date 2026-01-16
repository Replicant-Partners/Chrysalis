/**
 * Embedding Model Versioning
 * 
 * Tracks embedding model versions to enable:
 * - Safe model upgrades without invalidating existing vectors
 * - Automatic re-embedding on model change
 * - Migration path documentation
 * - Compatibility checking between embeddings
 * 
 * @module EmbeddingVersioning
 * @version 1.0.0
 * @status Implemented
 * 
 * HIGH-008: Embedding model versioning now formally tracked.
 */

// =============================================================================
// VERSION SCHEMA
// =============================================================================

/**
 * Semantic version components
 */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Complete embedding model metadata
 */
export interface EmbeddingModelInfo {
  /** Model identifier (e.g., 'Xenova/all-MiniLM-L6-v2') */
  modelId: string;
  
  /** Semantic version of this model */
  version: SemanticVersion;
  
  /** Output dimension count */
  dimensions: number;
  
  /** Human-readable model family */
  family: 'sentence-transformers' | 'openai' | 'cohere' | 'custom';
  
  /** Hash of model weights (for exact version tracking) */
  weightsHash?: string;
  
  /** Model release date */
  releaseDate?: string;
  
  /** Whether this model produces normalized vectors */
  normalized: boolean;
  
  /** Pooling strategy used */
  pooling: 'mean' | 'max' | 'cls';
  
  /** Maximum sequence length supported */
  maxSequenceLength: number;
}

/**
 * Versioned embedding with full provenance
 */
export interface VersionedEmbedding {
  /** The embedding vector */
  vector: number[];
  
  /** Model that created this embedding */
  modelInfo: EmbeddingModelInfo;
  
  /** Timestamp when embedding was created */
  createdAt: string;
  
  /** Original text hash (for re-embedding detection) */
  sourceHash: string;
  
  /** Whether this embedding is still valid for current model */
  isStale: boolean;
}

// =============================================================================
// KNOWN MODEL REGISTRY
// =============================================================================

/**
 * Registry of known embedding models with their metadata
 */
export const MODEL_REGISTRY: Record<string, EmbeddingModelInfo> = {
  'Xenova/all-MiniLM-L6-v2': {
    modelId: 'Xenova/all-MiniLM-L6-v2',
    version: { major: 1, minor: 0, patch: 0 },
    dimensions: 384,
    family: 'sentence-transformers',
    normalized: true,
    pooling: 'mean',
    maxSequenceLength: 256,
    releaseDate: '2022-06-15'
  },
  'Xenova/all-mpnet-base-v2': {
    modelId: 'Xenova/all-mpnet-base-v2',
    version: { major: 1, minor: 0, patch: 0 },
    dimensions: 768,
    family: 'sentence-transformers',
    normalized: true,
    pooling: 'mean',
    maxSequenceLength: 384,
    releaseDate: '2022-06-15'
  },
  'text-embedding-3-small': {
    modelId: 'text-embedding-3-small',
    version: { major: 3, minor: 0, patch: 0 },
    dimensions: 1536,
    family: 'openai',
    normalized: true,
    pooling: 'mean',
    maxSequenceLength: 8192,
    releaseDate: '2024-01-25'
  },
  'text-embedding-3-large': {
    modelId: 'text-embedding-3-large',
    version: { major: 3, minor: 0, patch: 0 },
    dimensions: 3072,
    family: 'openai',
    normalized: true,
    pooling: 'mean',
    maxSequenceLength: 8192,
    releaseDate: '2024-01-25'
  }
};

// =============================================================================
// COMPATIBILITY MATRIX
// =============================================================================

/**
 * Model migration paths - which models can vectors be compared across
 * 
 * Key: source model ID
 * Value: array of target model IDs that are directly comparable
 */
export const COMPATIBILITY_MATRIX: Record<string, string[]> = {
  // Same model is always compatible with itself
  'Xenova/all-MiniLM-L6-v2': ['Xenova/all-MiniLM-L6-v2'],
  'Xenova/all-mpnet-base-v2': ['Xenova/all-mpnet-base-v2'],
  'text-embedding-3-small': ['text-embedding-3-small'],
  'text-embedding-3-large': ['text-embedding-3-large']
};

// =============================================================================
// VERSION UTILITIES
// =============================================================================

/**
 * Parse a version string into semantic version components
 */
export function parseVersion(versionStr: string): SemanticVersion {
  const parts = versionStr.split('.').map(p => parseInt(p, 10));
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

/**
 * Format semantic version to string
 */
export function formatVersion(version: SemanticVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Compare two semantic versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: SemanticVersion, b: SemanticVersion): -1 | 0 | 1 {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

/**
 * Check if two models are compatible for similarity comparison
 */
export function areModelsCompatible(modelA: string, modelB: string): boolean {
  // Same model is always compatible
  if (modelA === modelB) return true;
  
  // Check compatibility matrix
  const compatibleWithA = COMPATIBILITY_MATRIX[modelA] || [];
  return compatibleWithA.includes(modelB);
}

/**
 * Get model info from registry or create unknown entry
 */
export function getModelInfo(modelId: string): EmbeddingModelInfo {
  if (MODEL_REGISTRY[modelId]) {
    return MODEL_REGISTRY[modelId];
  }
  
  // Unknown model - create generic entry
  return {
    modelId,
    version: { major: 0, minor: 0, patch: 0 },
    dimensions: 0, // Unknown
    family: 'custom',
    normalized: true,
    pooling: 'mean',
    maxSequenceLength: 512
  };
}

// =============================================================================
// VERSIONED EMBEDDING MANAGER
// =============================================================================

/**
 * Manages versioned embeddings with migration support
 */
export class EmbeddingVersionManager {
  private currentModel: EmbeddingModelInfo;
  private onMigrationNeeded?: (staleEmbeddings: VersionedEmbedding[]) => Promise<void>;
  
  constructor(
    modelId: string,
    options?: {
      onMigrationNeeded?: (staleEmbeddings: VersionedEmbedding[]) => Promise<void>;
    }
  ) {
    this.currentModel = getModelInfo(modelId);
    this.onMigrationNeeded = options?.onMigrationNeeded;
  }
  
  /**
   * Current model information
   */
  get model(): EmbeddingModelInfo {
    return this.currentModel;
  }
  
  /**
   * Create a versioned embedding
   */
  createVersionedEmbedding(
    vector: number[],
    sourceText: string
  ): VersionedEmbedding {
    return {
      vector,
      modelInfo: { ...this.currentModel },
      createdAt: new Date().toISOString(),
      sourceHash: this.hashText(sourceText),
      isStale: false
    };
  }
  
  /**
   * Check if an embedding is stale (from different/older model)
   */
  isEmbeddingStale(embedding: VersionedEmbedding): boolean {
    // Different model family = stale
    if (embedding.modelInfo.modelId !== this.currentModel.modelId) {
      return true;
    }
    
    // Same model, check version
    const versionComparison = compareVersions(
      embedding.modelInfo.version,
      this.currentModel.version
    );
    
    // Older version = stale
    return versionComparison < 0;
  }
  
  /**
   * Check if two embeddings can be compared
   */
  canCompare(embA: VersionedEmbedding, embB: VersionedEmbedding): boolean {
    return areModelsCompatible(
      embA.modelInfo.modelId,
      embB.modelInfo.modelId
    );
  }
  
  /**
   * Validate and mark stale embeddings in a collection
   */
  validateEmbeddings(embeddings: VersionedEmbedding[]): {
    valid: VersionedEmbedding[];
    stale: VersionedEmbedding[];
    needsReembedding: boolean;
  } {
    const valid: VersionedEmbedding[] = [];
    const stale: VersionedEmbedding[] = [];
    
    for (const emb of embeddings) {
      if (this.isEmbeddingStale(emb)) {
        emb.isStale = true;
        stale.push(emb);
      } else {
        emb.isStale = false;
        valid.push(emb);
      }
    }
    
    return {
      valid,
      stale,
      needsReembedding: stale.length > 0
    };
  }
  
  /**
   * Trigger migration for stale embeddings
   */
  async triggerMigration(staleEmbeddings: VersionedEmbedding[]): Promise<void> {
    if (this.onMigrationNeeded && staleEmbeddings.length > 0) {
      await this.onMigrationNeeded(staleEmbeddings);
    }
  }
  
  /**
   * Generate migration report
   */
  generateMigrationReport(embeddings: VersionedEmbedding[]): MigrationReport {
    const { valid, stale, needsReembedding } = this.validateEmbeddings(embeddings);
    
    const modelBreakdown = new Map<string, number>();
    for (const emb of embeddings) {
      const key = emb.modelInfo.modelId;
      modelBreakdown.set(key, (modelBreakdown.get(key) || 0) + 1);
    }
    
    return {
      totalEmbeddings: embeddings.length,
      validEmbeddings: valid.length,
      staleEmbeddings: stale.length,
      needsReembedding,
      currentModel: this.currentModel.modelId,
      currentVersion: formatVersion(this.currentModel.version),
      modelBreakdown: Object.fromEntries(modelBreakdown),
      estimatedMigrationTime: this.estimateMigrationTime(stale.length),
      recommendations: this.generateRecommendations(stale)
    };
  }
  
  private hashText(text: string): string {
    // Simple hash for change detection
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
  
  private estimateMigrationTime(count: number): string {
    // Rough estimate: ~100ms per embedding for transformer models
    const seconds = Math.ceil(count * 0.1);
    if (seconds < 60) return `~${seconds} seconds`;
    if (seconds < 3600) return `~${Math.ceil(seconds / 60)} minutes`;
    return `~${Math.ceil(seconds / 3600)} hours`;
  }
  
  private generateRecommendations(stale: VersionedEmbedding[]): string[] {
    const recommendations: string[] = [];
    
    if (stale.length === 0) {
      recommendations.push('All embeddings are up-to-date. No action needed.');
      return recommendations;
    }
    
    const hasOldMock = stale.some(e => (e.modelInfo.family as string) === 'mock');
    if (hasOldMock) {
      recommendations.push(
        'CRITICAL: Some embeddings were created with mock model. ' +
        'These provide no semantic similarity. Re-embed immediately with transformer model.'
      );
    }
    
    const uniqueModels = new Set(stale.map(e => e.modelInfo.modelId));
    if (uniqueModels.size > 1) {
      recommendations.push(
        `Multiple source models detected (${uniqueModels.size}). ` +
        'Consider batch re-embedding to unify vectors.'
      );
    }
    
    if (stale.length > 1000) {
      recommendations.push(
        'Large migration required. Consider processing in batches ' +
        'during off-peak hours to avoid service degradation.'
      );
    }
    
    recommendations.push(
      `Re-embed ${stale.length} vectors to upgrade from legacy models ` +
      `to ${this.currentModel.modelId} v${formatVersion(this.currentModel.version)}.`
    );
    
    return recommendations;
  }
}

// =============================================================================
// MIGRATION REPORT
// =============================================================================

/**
 * Report on embedding migration status
 */
export interface MigrationReport {
  totalEmbeddings: number;
  validEmbeddings: number;
  staleEmbeddings: number;
  needsReembedding: boolean;
  currentModel: string;
  currentVersion: string;
  modelBreakdown: Record<string, number>;
  estimatedMigrationTime: string;
  recommendations: string[];
}

// =============================================================================
// SERIALIZATION
// =============================================================================

/**
 * Serialize versioned embedding for storage
 */
export function serializeVersionedEmbedding(emb: VersionedEmbedding): string {
  return JSON.stringify({
    v: emb.vector,
    m: {
      id: emb.modelInfo.modelId,
      ver: formatVersion(emb.modelInfo.version),
      dim: emb.modelInfo.dimensions,
      fam: emb.modelInfo.family
    },
    c: emb.createdAt,
    h: emb.sourceHash,
    s: emb.isStale
  });
}

/**
 * Deserialize versioned embedding from storage
 */
export function deserializeVersionedEmbedding(json: string): VersionedEmbedding {
  const data = JSON.parse(json);
  const version = parseVersion(data.m.ver);
  
  return {
    vector: data.v,
    modelInfo: {
      modelId: data.m.id,
      version,
      dimensions: data.m.dim,
      family: data.m.fam,
      normalized: true,
      pooling: 'mean',
      maxSequenceLength: 512
    },
    createdAt: data.c,
    sourceHash: data.h,
    isStale: data.s
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default EmbeddingVersionManager;
