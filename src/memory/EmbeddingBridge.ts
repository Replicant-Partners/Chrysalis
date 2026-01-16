/**
 * Embedding Bridge
 * 
 * Bridges TypeScript memory system to the Python embedding services.
 * Supports multiple embedding providers: OpenAI, Ollama, Local.
 * 
 * @module memory/EmbeddingBridge
 */

import axios from 'axios';

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
  readonly provider: string;
}

/**
 * OpenAI embedding provider
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  readonly provider = 'openai';
  private apiKey: string;
  private model: string;
  
  constructor(options?: {
    apiKey?: string;
    model?: string;
    dimensions?: number;
  }) {
    this.apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.model = options?.model ?? 'text-embedding-3-small';
    this.dimensions = options?.dimensions ?? 1536;
    
    if (!this.apiKey) {
      console.warn('OpenAI API key not configured for embeddings');
    }
  }
  
  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key required for embeddings');
    }
    
    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model: this.model,
        input: text
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.data[0].embedding;
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key required for embeddings');
    }
    
    const batchSize = 100;
    const embeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model: this.model,
          input: batch
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      embeddings.push(...response.data.data.map((d: { embedding: number[] }) => d.embedding));
    }
    
    return embeddings;
  }
}

/**
 * Ollama embedding provider (local)
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  readonly provider = 'ollama';
  private baseUrl: string;
  private model: string;
  
  constructor(options?: {
    baseUrl?: string;
    model?: string;
    dimensions?: number;
  }) {
    this.baseUrl = options?.baseUrl ?? 'http://localhost:11434';
    this.model = options?.model ?? 'nomic-embed-text';
    this.dimensions = options?.dimensions ?? 768;
  }
  
  async embed(text: string): Promise<number[]> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/embeddings`,
        {
          model: this.model,
          prompt: text
        }
      );
      
      return response.data.embedding;
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        throw new Error('Ollama is not running. Start it with: ollama serve');
      }
      throw error;
    }
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    // Ollama doesn't have native batch support, so we process sequentially
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.embed(text));
    }
    return embeddings;
  }
}

/**
 * Python bridge embedding provider
 * Calls the Python memory_system embedding service via subprocess or HTTP
 */
export class PythonEmbeddingBridge implements EmbeddingProvider {
  readonly dimensions: number;
  readonly provider = 'python-bridge';
  private serverUrl?: string;
  private fallback?: EmbeddingProvider;
  
  constructor(options?: {
    serverUrl?: string;
    fallbackProvider?: EmbeddingProvider;
    dimensions?: number;
  }) {
    this.serverUrl = options?.serverUrl;
    this.dimensions = options?.dimensions ?? 768;
    this.fallback = options?.fallbackProvider;
  }
  
  async embed(text: string): Promise<number[]> {
    if (!this.serverUrl) {
      if (!this.fallback) {
        throw new Error('No embedding server configured and no fallback provider');
      }
      return this.fallback.embed(text);
    }
    
    try {
      const response = await axios.post(
        `${this.serverUrl}/embed`,
        { text },
        { timeout: 5000 }
      );
      return response.data.embedding;
    } catch {
      if (!this.fallback) {
        throw new Error('No embedding server configured and no fallback provider');
      }
      console.warn('Python embedding bridge unavailable, using fallback');
      return this.fallback.embed(text);
    }
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.serverUrl) {
      if (!this.fallback) {
        throw new Error('No embedding server configured and no fallback provider');
      }
      return this.fallback.embedBatch(texts);
    }
    
    try {
      const response = await axios.post(
        `${this.serverUrl}/embed-batch`,
        { texts },
        { timeout: 30000 }
      );
      return response.data.embeddings;
    } catch {
      if (!this.fallback) {
        throw new Error('No embedding server configured and no fallback provider');
      }
      console.warn('Python embedding bridge unavailable, using fallback');
      return this.fallback.embedBatch(texts);
    }
  }
}

/**
 * Factory to create embedding provider based on configuration
 */
export function createEmbeddingProvider(
  providerType: 'openai' | 'ollama' | 'python-bridge',
  options?: Record<string, unknown>
): EmbeddingProvider {
  switch (providerType) {
    case 'openai':
      return new OpenAIEmbeddingProvider(options as {
        apiKey?: string;
        model?: string;
        dimensions?: number;
      });
      
    case 'ollama':
      return new OllamaEmbeddingProvider(options as {
        baseUrl?: string;
        model?: string;
        dimensions?: number;
      });
      
    case 'python-bridge':
      return new PythonEmbeddingBridge(options as {
        serverUrl?: string;
        dimensions?: number;
      });
      
    default:
      throw new Error(`Unknown embedding provider type: ${providerType}`);
  }
}