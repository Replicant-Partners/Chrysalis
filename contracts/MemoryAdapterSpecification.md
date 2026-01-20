# Memory Adapter Specification

## Overview

The Memory Adapter is designed to provide a standardized interface between external systems and the Chrysalis memory system. It extends the Universal Adapter pattern to maintain consistency with the existing architecture while providing optimized access to the three-tier memory system (Rust core, Python layer, TypeScript layer).

## Architecture Integration

### Current Memory System Structure
- **Rust Core**: Low-level CRDT implementation and storage operations
- **Python Layer**: Business logic, sanitization, and semantic processing
- **TypeScript Layer**: High-level API for agent interactions

### Adapter Position
The Memory Adapter sits between external systems and the TypeScript layer, providing a protocol-agnostic interface that can be accessed through the Universal Adapter framework.

## Interface Specification

### Core Operations

#### CRUD Operations
- `create(memoryObject: MemoryObject): Promise<MemoryObject>`
  - Creates a new memory object in the system
  - Returns the created object with assigned ID and metadata

- `read(id: string): Promise<MemoryObject>`
  - Retrieves a memory object by its unique identifier
  - Throws error if object not found

- `update(id: string, updates: Partial<MemoryObject>): Promise<MemoryObject>`
  - Updates an existing memory object with provided changes
  - Returns the updated object with new metadata

- `delete(id: string): Promise<void>`
  - Removes a memory object from the system
  - Handles cascading deletions and reference cleanup

#### Query Operations
- `query(filter: QueryFilter, options?: QueryOptions): Promise<QueryResult>`
  - Searches for memory objects based on filter criteria
  - Supports pagination, sorting, and field selection

- `search(query: string, options?: SearchOptions): Promise<SearchResult>`
  - Performs full-text search across memory objects
  - Supports fuzzy matching and relevance scoring

#### Batch Operations
- `batchCreate(objects: MemoryObject[]): Promise<BatchResult>`
  - Creates multiple memory objects in a single transaction
  - Provides atomicity guarantees

- `batchUpdate(updates: UpdateOperation[]): Promise<BatchResult>`
  - Updates multiple memory objects in a single transaction
  - Supports different update operations on different objects

- `batchDelete(ids: string[]): Promise<BatchResult>`
  - Deletes multiple memory objects in a single transaction
  - Handles dependencies and constraints

### Memory Object Structure

#### Base Properties
- `id: string` - Unique identifier for the memory object
- `type: string` - Semantic type categorization
- `content: any` - The actual content/data of the memory object
- `metadata: Metadata` - System-level metadata
- `createdAt: Date` - Creation timestamp
- `updatedAt: Date` - Last update timestamp
- `version: number` - Version number for conflict resolution

#### Metadata Structure
- `source: string` - Origin of the memory object
- `tags: string[]` - Categorization tags
- `permissions: Permission[]` - Access control information
- `references: Reference[]` - Links to related memory objects
- `lifecycle: LifecycleInfo` - Lifecycle management data

### Transaction Management

#### Transaction Operations
- `beginTransaction(): Promise<Transaction>`
  - Starts a new transaction context
  - Returns transaction identifier for subsequent operations

- `commitTransaction(transactionId: string): Promise<void>`
  - Commits all operations in the transaction
  - Handles conflict resolution and data consistency

- `rollbackTransaction(transactionId: string): Promise<void>`
  - Rolls back all operations in the transaction
  - Restores system to pre-transaction state

### Subscription and Real-time Updates

#### Event Subscription
- `subscribe(filter: SubscriptionFilter, callback: EventHandler): Promise<Subscription>`
  - Registers for real-time updates matching the filter
  - Returns subscription identifier for management

- `unsubscribe(subscriptionId: string): Promise<void>`
  - Cancels an existing subscription
  - Cleans up associated resources

#### Event Types
- `MEMORY_CREATED` - A new memory object was created
- `MEMORY_UPDATED` - An existing memory object was updated
- `MEMORY_DELETED` - A memory object was deleted
- `MEMORY_MERGED` - Multiple memory objects were merged

### Conflict Resolution

#### CRDT Operations
- `resolveConflicts(objectId: string): Promise<ResolutionResult>`
  - Resolves conflicts for a specific memory object
  - Applies configured conflict resolution strategy

- `merge(objects: MemoryObject[]): Promise<MergeResult>`
  - Merges multiple versions of memory objects
  - Handles vector clock synchronization

### Security and Access Control

#### Authentication
- `authenticate(credentials: Credentials): Promise<AuthToken>`
  - Authenticates user/agent with the memory system
  - Returns token for subsequent authorized operations

#### Authorization
- `authorize(token: AuthToken, operation: string, objectId?: string): Promise<boolean>`
  - Checks if the authenticated entity is authorized for an operation
  - Supports object-level and system-level permissions

### Performance Optimization Features

#### Caching
- `enableCaching(options: CacheOptions): Promise<void>`
  - Enables caching for specified object types or queries
  - Configures cache expiration and invalidation policies

- `invalidateCache(pattern: string): Promise<void>`
  - Invalidates cached entries matching the pattern
  - Supports selective and bulk cache invalidation

#### Indexing
- `createIndex(fields: string[], options?: IndexOptions): Promise<void>`
  - Creates indexes to optimize query performance
  - Supports composite and full-text indexes

- `dropIndex(name: string): Promise<void>`
  - Removes an existing index
  - Handles index rebuilding if necessary

## Protocol Integration

### Universal Adapter Compatibility
- Implements the standard Universal Adapter interface
- Registers with the protocol registry using semantic categories
- Provides protocol-specific hints for optimization
- Supports dynamic protocol negotiation

### Semantic Categories
- `memory:storage` - Basic storage operations
- `memory:query` - Advanced querying capabilities
- `memory:realtime` - Real-time update subscriptions
- `memory:conflict` - Conflict resolution operations

### Protocol Hints
- `batching_supported: boolean` - Indicates if batch operations are optimized
- `transactional: boolean` - Indicates if ACID transactions are supported
- `caching_available: boolean` - Indicates if caching layer is available
- `realtime_updates: boolean` - Indicates if real-time updates are supported

## Error Handling

### Standard Error Types
- `MemoryObjectNotFoundError` - Requested object does not exist
- `ConflictError` - Update conflict detected
- `PermissionError` - Insufficient permissions for operation
- `ValidationError` - Invalid data format or constraints
- `TransactionError` - Transaction failed or aborted

### Error Metadata
- Error codes for programmatic handling
- Contextual information for debugging
- Suggested recovery actions
- Request tracking identifiers

## Performance Considerations

### Latency Targets
- Simple CRUD operations: < 10ms
- Complex queries: < 100ms
- Batch operations: < 1ms per object
- Conflict resolution: < 50ms

### Throughput Requirements
- Concurrent operations: 1000+ per second
- Batch operation size: Up to 1000 objects
- Subscription scalability: 10000+ concurrent subscriptions

### Resource Management
- Connection pooling for database operations
- Memory-efficient serialization/deserialization
- Streaming for large object transfers
- Automatic cleanup of stale resources

## Implementation Strategy

### Phase 1: Core Interface
- Implement basic CRUD operations
- Integrate with existing TypeScript memory adapter
- Add protocol registry integration
- Create comprehensive test suite

### Phase 2: Advanced Features
- Implement query and search operations
- Add transaction management
- Implement subscription system
- Add conflict resolution capabilities

### Phase 3: Optimization
- Implement caching layer
- Add indexing support
- Optimize batch operations
- Add performance monitoring

### Phase 4: Security
- Implement authentication and authorization
- Add audit logging
- Implement data encryption
- Add secure communication channels

## Testing Requirements

### Unit Tests
- Individual operation testing
- Error condition verification
- Edge case handling
- Performance benchmarks

### Integration Tests
- End-to-end workflow testing
- Cross-adapter interaction
- Protocol compatibility verification
- Security boundary testing

### Load Testing
- Concurrent operation testing
- Stress testing under high load
- Memory leak detection
- Resource consumption monitoring

## Monitoring and Observability

### Metrics Collection
- Operation latency and throughput
- Error rates and types
- Resource utilization
- Cache hit/miss ratios

### Logging
- Operation audit trails
- Performance profiling data
- Error and exception logging
- Debug information for troubleshooting

### Alerting
- Performance degradation alerts
- Error rate threshold alerts
- Resource exhaustion warnings
- Security incident notifications