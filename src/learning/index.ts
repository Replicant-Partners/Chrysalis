/**
 * Learning Module
 *
 * Provides agent learning pipeline and document processing capabilities.
 * This is a UI-layer module for document learning interactions.
 *
 * @module learning
 */

export interface DocumentInput {
  id: string;
  type: 'text' | 'pdf' | 'markdown' | 'code' | 'json';
  content: string;
  filename?: string;
  metadata?: Record<string, unknown>;
}

export interface LegendEmbeddingFile {
  filename: string;
  content: string;
  embeddings?: number[];
  metadata?: Record<string, unknown>;
}

export interface LearningResult {
  documentId: string;
  success: boolean;
  memoriesCreated: number;
  patternsDiscovered: number;
  error?: string;
}

/**
 * Loads legend embedding files
 */
export class LegendEmbeddingLoader {
  private cache: Map<string, LegendEmbeddingFile> = new Map();

  async load(filename: string): Promise<LegendEmbeddingFile | null> {
    if (this.cache.has(filename)) {
      return this.cache.get(filename)!;
    }

    try {
      const response = await fetch(`/legends/${filename}`);
      if (!response.ok) {
        return null;
      }

      const content = await response.text();
      const file: LegendEmbeddingFile = {
        filename,
        content,
        metadata: { loadedAt: new Date().toISOString() },
      };

      this.cache.set(filename, file);
      return file;
    } catch {
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Agent Learning Pipeline
 *
 * Processes documents and interactions for agent learning.
 */
export class AgentLearningPipeline {
  private agentId: string;
  private memoryApiUrl: string;
  private isProcessing: boolean = false;

  constructor(agentId: string, memoryApiUrl: string = 'http://localhost:8082') {
    this.agentId = agentId;
    this.memoryApiUrl = memoryApiUrl;
  }

  /**
   * Process a document for learning
   */
  async processDocument(document: DocumentInput): Promise<LearningResult> {
    if (this.isProcessing) {
      return {
        documentId: document.id,
        success: false,
        memoriesCreated: 0,
        patternsDiscovered: 0,
        error: 'Pipeline is busy processing another document',
      };
    }

    this.isProcessing = true;

    try {
      // Extract key information from document
      const chunks = this.chunkDocument(document);

      // Store each chunk as a memory
      let memoriesCreated = 0;
      for (const chunk of chunks) {
        try {
          await this.storeMemory(chunk, document.metadata);
          memoriesCreated++;
        } catch {
          // Continue with other chunks
        }
      }

      return {
        documentId: document.id,
        success: true,
        memoriesCreated,
        patternsDiscovered: 0, // Pattern discovery is done by the Rust backend
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check if pipeline is currently processing
   */
  isBusy(): boolean {
    return this.isProcessing;
  }

  /**
   * Chunk a document into smaller pieces for memory storage
   */
  private chunkDocument(document: DocumentInput): string[] {
    const content = document.content;
    const maxChunkSize = 1000; // characters

    if (content.length <= maxChunkSize) {
      return [content];
    }

    // Split by paragraphs first, then by size
    const paragraphs = content.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      if (currentChunk.length + para.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = para;
      } else {
        currentChunk += '\n\n' + para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Store a chunk as a memory
   */
  private async storeMemory(
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await fetch(`${this.memoryApiUrl}/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        agent_id: this.agentId,
        role: 'system',
        importance: 0.6,
        memory_type: 'semantic',
        metadata: {
          ...metadata,
          source: 'learning_pipeline',
          learned_at: new Date().toISOString(),
        },
      }),
    });
  }
}

export default AgentLearningPipeline;
