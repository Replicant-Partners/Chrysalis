/**
 * Data Resource Connector
 * 
 * Interface for connecting agents to external data resources securely.
 * Credentials and API keys are stored in the encrypted API Key Wallet,
 * not in the open Agent Canvas.
 * 
 * Supported resource types:
 * - Vector databases (Pinecone, Weaviate, Qdrant, etc.)
 * - File storage (S3, GCS, local filesystem)
 * - APIs (REST, GraphQL)
 * - Databases (PostgreSQL, MongoDB, etc.)
 * - Knowledge bases (Notion, Confluence, etc.)
 */

import { DataResourceLink, DataResourceType } from './agent-canvas';

// =============================================================================
// Types
// =============================================================================

/**
 * Resource connection status
 */
export type ResourceConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'rate_limited';

/**
 * Resource health check result
 */
export interface ResourceHealthCheck {
  status: ResourceConnectionStatus;
  latencyMs?: number;
  lastChecked: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Resource query result
 */
export interface ResourceQueryResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    queryTimeMs: number;
    resourceId: string;
    resourceType: DataResourceType;
    resultCount?: number;
    truncated?: boolean;
  };
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  id: string;
  score: number;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}

/**
 * File resource entry
 */
export interface FileResourceEntry {
  path: string;
  name: string;
  size: number;
  mimeType: string;
  lastModified: number;
  isDirectory: boolean;
}

/**
 * API request options
 */
export interface APIRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  queryParams?: Record<string, string>;
  timeout?: number;
}

/**
 * Database query options
 */
export interface DatabaseQueryOptions {
  query: string;
  params?: unknown[];
  timeout?: number;
  maxRows?: number;
}

/**
 * Configuration for different resource types
 */
export interface VectorDBConfig {
  provider: 'pinecone' | 'weaviate' | 'qdrant' | 'chroma' | 'milvus' | 'custom';
  indexName?: string;
  namespace?: string;
  dimension?: number;
  metric?: 'cosine' | 'euclidean' | 'dot_product';
  topK?: number;
}

export interface FileStorageConfig {
  provider: 's3' | 'gcs' | 'azure_blob' | 'local' | 'custom';
  bucket?: string;
  basePath?: string;
  region?: string;
}

export interface APIConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  authType?: 'bearer' | 'basic' | 'api_key' | 'oauth' | 'none';
  rateLimit?: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
  };
}

export interface DatabaseConfig {
  provider: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite' | 'custom';
  database?: string;
  schema?: string;
  poolSize?: number;
}

export interface KnowledgeBaseConfig {
  provider: 'notion' | 'confluence' | 'obsidian' | 'custom';
  workspace?: string;
  rootPageId?: string;
}

/**
 * Union type for all resource configurations
 */
export type ResourceConfig = 
  | { type: 'vector_db'; config: VectorDBConfig }
  | { type: 'file_storage'; config: FileStorageConfig }
  | { type: 'api'; config: APIConfig }
  | { type: 'database'; config: DatabaseConfig }
  | { type: 'knowledge_base'; config: KnowledgeBaseConfig };

/**
 * Resource descriptor for registration
 */
export interface ResourceDescriptor {
  id: string;
  name: string;
  type: DataResourceType;
  description?: string;
  config: ResourceConfig;
  /** Reference to credential in API Key Wallet */
  credentialKeyRef: string;
  /** Optional access control */
  allowedAgents?: string[];
  /** Rate limiting per agent */
  agentRateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute?: number;
  };
  /** Auto-disconnect after idle time (ms) */
  idleTimeout?: number;
}

/**
 * Active resource connection
 */
export interface ActiveResourceConnection {
  descriptor: ResourceDescriptor;
  status: ResourceConnectionStatus;
  connectedAt?: number;
  lastActivity?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Event types for resource connections
 */
export type ResourceEventType =
  | 'resource:registered'
  | 'resource:unregistered'
  | 'resource:connected'
  | 'resource:disconnected'
  | 'resource:error'
  | 'resource:query'
  | 'resource:rate_limited';

/**
 * Resource event
 */
export interface ResourceEvent {
  type: ResourceEventType;
  resourceId: string;
  agentId?: string;
  timestamp: number;
  data?: unknown;
  error?: Error;
}

/**
 * Resource event listener
 */
export type ResourceEventListener = (event: ResourceEvent) => void;

// =============================================================================
// Credential Provider Interface
// =============================================================================

/**
 * Interface for credential provider (API Key Wallet)
 */
export interface ICredentialProvider {
  /**
   * Get credential by key reference
   */
  getCredential(keyRef: string): Promise<string | null>;
  
  /**
   * Check if credential exists
   */
  hasCredential(keyRef: string): Promise<boolean>;
  
  /**
   * Get credential metadata (without value)
   */
  getCredentialMetadata(keyRef: string): Promise<{
    name: string;
    type: string;
    lastUsed?: number;
  } | null>;
}

// =============================================================================
// Resource Provider Interfaces
// =============================================================================

/**
 * Interface for vector database operations
 */
export interface IVectorDBProvider {
  connect(config: VectorDBConfig, credential: string): Promise<void>;
  disconnect(): Promise<void>;
  search(embedding: number[], topK?: number, filter?: Record<string, unknown>): Promise<VectorSearchResult[]>;
  upsert(id: string, embedding: number[], content: string, metadata?: Record<string, unknown>): Promise<void>;
  delete(ids: string[]): Promise<void>;
  healthCheck(): Promise<ResourceHealthCheck>;
}

/**
 * Interface for file storage operations
 */
export interface IFileStorageProvider {
  connect(config: FileStorageConfig, credential: string): Promise<void>;
  disconnect(): Promise<void>;
  list(path: string): Promise<FileResourceEntry[]>;
  read(path: string): Promise<Buffer | string>;
  write(path: string, content: Buffer | string): Promise<void>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  healthCheck(): Promise<ResourceHealthCheck>;
}

/**
 * Interface for API operations
 */
export interface IAPIProvider {
  connect(config: APIConfig, credential: string): Promise<void>;
  disconnect(): Promise<void>;
  request<T = unknown>(options: APIRequestOptions): Promise<ResourceQueryResult<T>>;
  healthCheck(): Promise<ResourceHealthCheck>;
}

/**
 * Interface for database operations
 */
export interface IDatabaseProvider {
  connect(config: DatabaseConfig, credential: string): Promise<void>;
  disconnect(): Promise<void>;
  query<T = unknown>(options: DatabaseQueryOptions): Promise<ResourceQueryResult<T[]>>;
  execute(options: DatabaseQueryOptions): Promise<{ affectedRows: number }>;
  healthCheck(): Promise<ResourceHealthCheck>;
}

/**
 * Interface for knowledge base operations
 */
export interface IKnowledgeBaseProvider {
  connect(config: KnowledgeBaseConfig, credential: string): Promise<void>;
  disconnect(): Promise<void>;
  search(query: string, limit?: number): Promise<Array<{ id: string; title: string; content: string; url?: string }>>;
  getPage(pageId: string): Promise<{ id: string; title: string; content: string; children?: string[] } | null>;
  healthCheck(): Promise<ResourceHealthCheck>;
}

// =============================================================================
// Default Provider Implementations (Stubs)
// =============================================================================

/**
 * Default vector DB provider (stub)
 */
class DefaultVectorDBProvider implements IVectorDBProvider {
  private connected = false;
  
  async connect(config: VectorDBConfig, credential: string): Promise<void> {
    console.log(`[VectorDB] Connecting to ${config.provider}...`);
    this.connected = true;
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  
  async search(embedding: number[], topK = 10): Promise<VectorSearchResult[]> {
    if (!this.connected) throw new Error('Not connected');
    // Stub implementation
    return [];
  }
  
  async upsert(id: string, embedding: number[], content: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.connected) throw new Error('Not connected');
    console.log(`[VectorDB] Upserting ${id}`);
  }
  
  async delete(ids: string[]): Promise<void> {
    if (!this.connected) throw new Error('Not connected');
    console.log(`[VectorDB] Deleting ${ids.length} vectors`);
  }
  
  async healthCheck(): Promise<ResourceHealthCheck> {
    return {
      status: this.connected ? 'connected' : 'disconnected',
      lastChecked: Date.now(),
      latencyMs: 10
    };
  }
}

/**
 * Default file storage provider (stub)
 */
class DefaultFileStorageProvider implements IFileStorageProvider {
  private connected = false;
  
  async connect(config: FileStorageConfig, credential: string): Promise<void> {
    console.log(`[FileStorage] Connecting to ${config.provider}...`);
    this.connected = true;
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  
  async list(path: string): Promise<FileResourceEntry[]> {
    if (!this.connected) throw new Error('Not connected');
    return [];
  }
  
  async read(path: string): Promise<string> {
    if (!this.connected) throw new Error('Not connected');
    return '';
  }
  
  async write(path: string, content: Buffer | string): Promise<void> {
    if (!this.connected) throw new Error('Not connected');
    console.log(`[FileStorage] Writing to ${path}`);
  }
  
  async delete(path: string): Promise<void> {
    if (!this.connected) throw new Error('Not connected');
    console.log(`[FileStorage] Deleting ${path}`);
  }
  
  async exists(path: string): Promise<boolean> {
    if (!this.connected) throw new Error('Not connected');
    return false;
  }
  
  async healthCheck(): Promise<ResourceHealthCheck> {
    return {
      status: this.connected ? 'connected' : 'disconnected',
      lastChecked: Date.now(),
      latencyMs: 5
    };
  }
}

/**
 * Default API provider (stub)
 */
class DefaultAPIProvider implements IAPIProvider {
  private connected = false;
  private config?: APIConfig;
  
  async connect(config: APIConfig, credential: string): Promise<void> {
    console.log(`[API] Connecting to ${config.baseUrl}...`);
    this.config = config;
    this.connected = true;
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
    this.config = undefined;
  }
  
  async request<T = unknown>(options: APIRequestOptions): Promise<ResourceQueryResult<T>> {
    if (!this.connected) throw new Error('Not connected');
    
    const startTime = Date.now();
    // Stub implementation - in real impl, would use fetch
    return {
      success: true,
      data: {} as T,
      metadata: {
        queryTimeMs: Date.now() - startTime,
        resourceId: 'api',
        resourceType: 'api'
      }
    };
  }
  
  async healthCheck(): Promise<ResourceHealthCheck> {
    return {
      status: this.connected ? 'connected' : 'disconnected',
      lastChecked: Date.now(),
      latencyMs: 50
    };
  }
}

/**
 * Default database provider (stub)
 */
class DefaultDatabaseProvider implements IDatabaseProvider {
  private connected = false;
  
  async connect(config: DatabaseConfig, credential: string): Promise<void> {
    console.log(`[Database] Connecting to ${config.provider}...`);
    this.connected = true;
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  
  async query<T = unknown>(options: DatabaseQueryOptions): Promise<ResourceQueryResult<T[]>> {
    if (!this.connected) throw new Error('Not connected');
    
    const startTime = Date.now();
    return {
      success: true,
      data: [] as T[],
      metadata: {
        queryTimeMs: Date.now() - startTime,
        resourceId: 'db',
        resourceType: 'database',
        resultCount: 0
      }
    };
  }
  
  async execute(options: DatabaseQueryOptions): Promise<{ affectedRows: number }> {
    if (!this.connected) throw new Error('Not connected');
    return { affectedRows: 0 };
  }
  
  async healthCheck(): Promise<ResourceHealthCheck> {
    return {
      status: this.connected ? 'connected' : 'disconnected',
      lastChecked: Date.now(),
      latencyMs: 20
    };
  }
}

/**
 * Default knowledge base provider (stub)
 */
class DefaultKnowledgeBaseProvider implements IKnowledgeBaseProvider {
  private connected = false;
  
  async connect(config: KnowledgeBaseConfig, credential: string): Promise<void> {
    console.log(`[KnowledgeBase] Connecting to ${config.provider}...`);
    this.connected = true;
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  
  async search(query: string, limit = 10): Promise<Array<{ id: string; title: string; content: string; url?: string }>> {
    if (!this.connected) throw new Error('Not connected');
    return [];
  }
  
  async getPage(pageId: string): Promise<{ id: string; title: string; content: string; children?: string[] } | null> {
    if (!this.connected) throw new Error('Not connected');
    return null;
  }
  
  async healthCheck(): Promise<ResourceHealthCheck> {
    return {
      status: this.connected ? 'connected' : 'disconnected',
      lastChecked: Date.now(),
      latencyMs: 100
    };
  }
}

// =============================================================================
// Data Resource Connector Class
// =============================================================================

/**
 * Configuration for DataResourceConnector
 */
export interface DataResourceConnectorConfig {
  /** Default connection timeout (ms) */
  connectionTimeout: number;
  /** Health check interval (ms) */
  healthCheckInterval: number;
  /** Auto-reconnect on error */
  autoReconnect: boolean;
  /** Maximum reconnect attempts */
  maxReconnectAttempts: number;
  /** Enable request logging */
  enableLogging: boolean;
}

const DEFAULT_CONFIG: DataResourceConnectorConfig = {
  connectionTimeout: 30000,
  healthCheckInterval: 60000,
  autoReconnect: true,
  maxReconnectAttempts: 3,
  enableLogging: false
};

/**
 * DataResourceConnector manages secure connections to external data resources
 */
export class DataResourceConnector {
  private config: DataResourceConnectorConfig;
  private credentialProvider: ICredentialProvider;
  private resources: Map<string, ResourceDescriptor> = new Map();
  private connections: Map<string, ActiveResourceConnection> = new Map();
  private providers: Map<string, unknown> = new Map();
  private listeners: Map<string, Set<ResourceEventListener>> = new Map();
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private idleTimers: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();

  constructor(
    credentialProvider: ICredentialProvider,
    config: Partial<DataResourceConnectorConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.credentialProvider = credentialProvider;
  }

  // ===========================================================================
  // Resource Registration
  // ===========================================================================

  /**
   * Register a data resource
   */
  registerResource(descriptor: ResourceDescriptor): void {
    if (this.resources.has(descriptor.id)) {
      throw new Error(`Resource ${descriptor.id} already registered`);
    }

    this.resources.set(descriptor.id, descriptor);
    
    this.emit({
      type: 'resource:registered',
      resourceId: descriptor.id,
      timestamp: Date.now()
    });
  }

  /**
   * Unregister a data resource
   */
  async unregisterResource(resourceId: string): Promise<void> {
    // Disconnect if connected
    if (this.connections.has(resourceId)) {
      await this.disconnect(resourceId);
    }

    this.resources.delete(resourceId);
    
    this.emit({
      type: 'resource:unregistered',
      resourceId,
      timestamp: Date.now()
    });
  }

  /**
   * Get all registered resources
   */
  getRegisteredResources(): ResourceDescriptor[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get resource by ID
   */
  getResource(resourceId: string): ResourceDescriptor | undefined {
    return this.resources.get(resourceId);
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  /**
   * Connect to a data resource
   */
  async connect(resourceId: string, agentId?: string): Promise<void> {
    const descriptor = this.resources.get(resourceId);
    if (!descriptor) {
      throw new Error(`Resource ${resourceId} not registered`);
    }

    // Check agent access
    if (descriptor.allowedAgents && agentId) {
      if (!descriptor.allowedAgents.includes(agentId) && !descriptor.allowedAgents.includes('*')) {
        throw new Error(`Agent ${agentId} not allowed to access resource ${resourceId}`);
      }
    }

    // Get credential
    const credential = await this.credentialProvider.getCredential(descriptor.credentialKeyRef);
    if (!credential) {
      throw new Error(`Credential ${descriptor.credentialKeyRef} not found in wallet`);
    }

    // Create provider based on type
    const provider = this.createProvider(descriptor.config.type);
    
    // Connect with timeout
    const connectPromise = this.connectProvider(provider, descriptor, credential);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeout);
    });

    try {
      await Promise.race([connectPromise, timeoutPromise]);
      
      // Store provider and connection
      this.providers.set(resourceId, provider);
      this.connections.set(resourceId, {
        descriptor,
        status: 'connected',
        connectedAt: Date.now(),
        lastActivity: Date.now()
      });

      // Setup health check
      this.setupHealthCheck(resourceId);

      // Setup idle timeout
      if (descriptor.idleTimeout) {
        this.resetIdleTimer(resourceId);
      }

      this.emit({
        type: 'resource:connected',
        resourceId,
        agentId,
        timestamp: Date.now()
      });

    } catch (error) {
      this.connections.set(resourceId, {
        descriptor,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error)
      });

      this.emit({
        type: 'resource:error',
        resourceId,
        agentId,
        timestamp: Date.now(),
        error: error instanceof Error ? error : new Error(String(error))
      });

      throw error;
    }
  }

  /**
   * Disconnect from a data resource
   */
  async disconnect(resourceId: string): Promise<void> {
    const provider = this.providers.get(resourceId);
    const connection = this.connections.get(resourceId);

    // Clear timers
    this.clearHealthCheck(resourceId);
    this.clearIdleTimer(resourceId);

    if (provider) {
      try {
        await this.disconnectProvider(provider, connection?.descriptor.config.type);
      } catch (error) {
        console.error(`Error disconnecting from ${resourceId}:`, error);
      }
    }

    this.providers.delete(resourceId);
    this.connections.delete(resourceId);
    this.reconnectAttempts.delete(resourceId);

    this.emit({
      type: 'resource:disconnected',
      resourceId,
      timestamp: Date.now()
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus(resourceId: string): ActiveResourceConnection | undefined {
    return this.connections.get(resourceId);
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): ActiveResourceConnection[] {
    return Array.from(this.connections.values()).filter(c => c.status === 'connected');
  }

  // ===========================================================================
  // Resource Operations
  // ===========================================================================

  /**
   * Query a vector database
   */
  async vectorSearch(
    resourceId: string,
    embedding: number[],
    options?: { topK?: number; filter?: Record<string, unknown> }
  ): Promise<VectorSearchResult[]> {
    const provider = this.getTypedProvider<IVectorDBProvider>(resourceId, 'vector_db');
    this.updateActivity(resourceId);
    
    const results = await provider.search(embedding, options?.topK, options?.filter);
    
    this.emit({
      type: 'resource:query',
      resourceId,
      timestamp: Date.now(),
      data: { type: 'vector_search', resultCount: results.length }
    });

    return results;
  }

  /**
   * Upsert vectors
   */
  async vectorUpsert(
    resourceId: string,
    id: string,
    embedding: number[],
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const provider = this.getTypedProvider<IVectorDBProvider>(resourceId, 'vector_db');
    this.updateActivity(resourceId);
    
    await provider.upsert(id, embedding, content, metadata);
  }

  /**
   * List files in storage
   */
  async listFiles(resourceId: string, path: string): Promise<FileResourceEntry[]> {
    const provider = this.getTypedProvider<IFileStorageProvider>(resourceId, 'file_storage');
    this.updateActivity(resourceId);
    
    return provider.list(path);
  }

  /**
   * Read file from storage
   */
  async readFile(resourceId: string, path: string): Promise<Buffer | string> {
    const provider = this.getTypedProvider<IFileStorageProvider>(resourceId, 'file_storage');
    this.updateActivity(resourceId);
    
    return provider.read(path);
  }

  /**
   * Write file to storage
   */
  async writeFile(resourceId: string, path: string, content: Buffer | string): Promise<void> {
    const provider = this.getTypedProvider<IFileStorageProvider>(resourceId, 'file_storage');
    this.updateActivity(resourceId);
    
    await provider.write(path, content);
  }

  /**
   * Make API request
   */
  async apiRequest<T = unknown>(resourceId: string, options: APIRequestOptions): Promise<ResourceQueryResult<T>> {
    const provider = this.getTypedProvider<IAPIProvider>(resourceId, 'api');
    this.updateActivity(resourceId);
    
    const result = await provider.request<T>(options);
    
    this.emit({
      type: 'resource:query',
      resourceId,
      timestamp: Date.now(),
      data: { type: 'api_request', method: options.method, path: options.path }
    });

    return result;
  }

  /**
   * Execute database query
   */
  async databaseQuery<T = unknown>(resourceId: string, options: DatabaseQueryOptions): Promise<ResourceQueryResult<T[]>> {
    const provider = this.getTypedProvider<IDatabaseProvider>(resourceId, 'database');
    this.updateActivity(resourceId);
    
    const result = await provider.query<T>(options);
    
    this.emit({
      type: 'resource:query',
      resourceId,
      timestamp: Date.now(),
      data: { type: 'database_query', resultCount: result.metadata.resultCount }
    });

    return result;
  }

  /**
   * Search knowledge base
   */
  async knowledgeSearch(resourceId: string, query: string, limit?: number): Promise<Array<{ id: string; title: string; content: string; url?: string }>> {
    const provider = this.getTypedProvider<IKnowledgeBaseProvider>(resourceId, 'knowledge_base');
    this.updateActivity(resourceId);
    
    const results = await provider.search(query, limit);
    
    this.emit({
      type: 'resource:query',
      resourceId,
      timestamp: Date.now(),
      data: { type: 'knowledge_search', resultCount: results.length }
    });

    return results;
  }

  // ===========================================================================
  // Health Checks
  // ===========================================================================

  /**
   * Perform health check on a resource
   */
  async healthCheck(resourceId: string): Promise<ResourceHealthCheck> {
    const provider = this.providers.get(resourceId);
    const connection = this.connections.get(resourceId);
    
    if (!provider || !connection) {
      return {
        status: 'disconnected',
        lastChecked: Date.now()
      };
    }

    try {
      const health = await this.providerHealthCheck(provider, connection.descriptor.config.type);
      
      // Update connection status
      connection.status = health.status;
      connection.lastActivity = Date.now();
      
      return health;
    } catch (error) {
      connection.status = 'error';
      connection.errorMessage = error instanceof Error ? error.message : String(error);
      
      // Attempt auto-reconnect
      if (this.config.autoReconnect) {
        this.attemptReconnect(resourceId);
      }
      
      return {
        status: 'error',
        lastChecked: Date.now(),
        errorMessage: connection.errorMessage
      };
    }
  }

  /**
   * Setup periodic health check
   */
  private setupHealthCheck(resourceId: string): void {
    if (this.config.healthCheckInterval <= 0) return;
    
    const timer = setInterval(() => {
      this.healthCheck(resourceId).catch(error => {
        console.error(`Health check failed for ${resourceId}:`, error);
      });
    }, this.config.healthCheckInterval);

    this.healthCheckTimers.set(resourceId, timer);
  }

  /**
   * Clear health check timer
   */
  private clearHealthCheck(resourceId: string): void {
    const timer = this.healthCheckTimers.get(resourceId);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(resourceId);
    }
  }

  // ===========================================================================
  // Auto-Reconnect
  // ===========================================================================

  /**
   * Attempt to reconnect to a resource
   */
  private async attemptReconnect(resourceId: string): Promise<void> {
    const attempts = this.reconnectAttempts.get(resourceId) || 0;
    
    if (attempts >= this.config.maxReconnectAttempts) {
      console.error(`Max reconnect attempts reached for ${resourceId}`);
      return;
    }

    this.reconnectAttempts.set(resourceId, attempts + 1);

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
    
    setTimeout(async () => {
      try {
        await this.disconnect(resourceId);
        await this.connect(resourceId);
        this.reconnectAttempts.delete(resourceId);
      } catch (error) {
        console.error(`Reconnect attempt ${attempts + 1} failed for ${resourceId}:`, error);
      }
    }, delay);
  }

  // ===========================================================================
  // Idle Timeout
  // ===========================================================================

  /**
   * Reset idle timer
   */
  private resetIdleTimer(resourceId: string): void {
    this.clearIdleTimer(resourceId);
    
    const descriptor = this.resources.get(resourceId);
    if (!descriptor?.idleTimeout) return;

    const timer = setTimeout(() => {
      console.log(`Disconnecting ${resourceId} due to idle timeout`);
      this.disconnect(resourceId).catch(error => {
        console.error(`Error disconnecting idle resource ${resourceId}:`, error);
      });
    }, descriptor.idleTimeout);

    this.idleTimers.set(resourceId, timer);
  }

  /**
   * Clear idle timer
   */
  private clearIdleTimer(resourceId: string): void {
    const timer = this.idleTimers.get(resourceId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(resourceId);
    }
  }

  /**
   * Update activity timestamp
   */
  private updateActivity(resourceId: string): void {
    const connection = this.connections.get(resourceId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
    
    // Reset idle timer
    const descriptor = this.resources.get(resourceId);
    if (descriptor?.idleTimeout) {
      this.resetIdleTimer(resourceId);
    }
  }

  // ===========================================================================
  // Provider Helpers
  // ===========================================================================

  /**
   * Create provider based on type
   */
  private createProvider(type: DataResourceType): unknown {
    switch (type) {
      case 'vector_db':
        return new DefaultVectorDBProvider();
      case 'file_storage':
        return new DefaultFileStorageProvider();
      case 'api':
        return new DefaultAPIProvider();
      case 'database':
        return new DefaultDatabaseProvider();
      case 'knowledge_base':
        return new DefaultKnowledgeBaseProvider();
      default:
        throw new Error(`Unknown resource type: ${type}`);
    }
  }

  /**
   * Connect provider
   */
  private async connectProvider(provider: unknown, descriptor: ResourceDescriptor, credential: string): Promise<void> {
    const { type, config } = descriptor.config;
    
    switch (type) {
      case 'vector_db':
        await (provider as IVectorDBProvider).connect(config as VectorDBConfig, credential);
        break;
      case 'file_storage':
        await (provider as IFileStorageProvider).connect(config as FileStorageConfig, credential);
        break;
      case 'api':
        await (provider as IAPIProvider).connect(config as APIConfig, credential);
        break;
      case 'database':
        await (provider as IDatabaseProvider).connect(config as DatabaseConfig, credential);
        break;
      case 'knowledge_base':
        await (provider as IKnowledgeBaseProvider).connect(config as KnowledgeBaseConfig, credential);
        break;
    }
  }

  /**
   * Disconnect provider
   */
  private async disconnectProvider(provider: unknown, type?: DataResourceType): Promise<void> {
    if (!type) return;
    
    switch (type) {
      case 'vector_db':
        await (provider as IVectorDBProvider).disconnect();
        break;
      case 'file_storage':
        await (provider as IFileStorageProvider).disconnect();
        break;
      case 'api':
        await (provider as IAPIProvider).disconnect();
        break;
      case 'database':
        await (provider as IDatabaseProvider).disconnect();
        break;
      case 'knowledge_base':
        await (provider as IKnowledgeBaseProvider).disconnect();
        break;
    }
  }

  /**
   * Provider health check
   */
  private async providerHealthCheck(provider: unknown, type: DataResourceType): Promise<ResourceHealthCheck> {
    switch (type) {
      case 'vector_db':
        return (provider as IVectorDBProvider).healthCheck();
      case 'file_storage':
        return (provider as IFileStorageProvider).healthCheck();
      case 'api':
        return (provider as IAPIProvider).healthCheck();
      case 'database':
        return (provider as IDatabaseProvider).healthCheck();
      case 'knowledge_base':
        return (provider as IKnowledgeBaseProvider).healthCheck();
      default:
        return { status: 'disconnected', lastChecked: Date.now() };
    }
  }

  /**
   * Get typed provider
   */
  private getTypedProvider<T>(resourceId: string, expectedType: DataResourceType): T {
    const provider = this.providers.get(resourceId);
    const connection = this.connections.get(resourceId);
    
    if (!provider || !connection) {
      throw new Error(`Resource ${resourceId} not connected`);
    }
    
    if (connection.descriptor.config.type !== expectedType) {
      throw new Error(`Resource ${resourceId} is not a ${expectedType}`);
    }
    
    if (connection.status !== 'connected') {
      throw new Error(`Resource ${resourceId} is not connected (status: ${connection.status})`);
    }
    
    return provider as T;
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to events
   */
  on(eventType: ResourceEventType | '*', listener: ResourceEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Emit event
   */
  private emit(event: ResourceEvent): void {
    this.listeners.get(event.type)?.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error(`Error in resource event listener:`, e);
      }
    });

    this.listeners.get('*')?.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error(`Error in resource wildcard listener:`, e);
      }
    });
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Destroy connector and cleanup all resources
   */
  async destroy(): Promise<void> {
    // Disconnect all resources
    for (const resourceId of this.connections.keys()) {
      await this.disconnect(resourceId).catch(error => {
        console.error(`Error disconnecting ${resourceId} during destroy:`, error);
      });
    }

    // Clear all timers
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();

    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();

    // Clear maps
    this.resources.clear();
    this.connections.clear();
    this.providers.clear();
    this.listeners.clear();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a data resource connector
 */
export function createDataResourceConnector(
  credentialProvider: ICredentialProvider,
  config?: Partial<DataResourceConnectorConfig>
): DataResourceConnector {
  return new DataResourceConnector(credentialProvider, config);
}

/**
 * Create a DataResourceLink from a resource descriptor
 */
export function createDataResourceLink(descriptor: ResourceDescriptor): DataResourceLink {
  return {
    resourceId: descriptor.id,
    resourceType: descriptor.type,
    displayName: descriptor.name,
    status: 'disconnected',
    lastAccessed: undefined
  };
}