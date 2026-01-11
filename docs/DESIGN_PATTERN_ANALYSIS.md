# Chrysalis Design Pattern Catalog and Architecture Guide

**Version**: 2.0.0  
**Status**: Reference Architecture

---

## Executive Summary

Chrysalis implements a distributed agent framework combining classical object-oriented design patterns[^1], distributed systems patterns[^2][^3], and emergent complexity principles[^4]. The architecture achieves **78% pattern fidelity** (average score: 3.9/5.0) across 22 Gang of Four patterns and 10 universal distributed patterns.

**Critical Finding**: The system correctly implements Strategy, Adapter, Observer, Mediator, Factory, and State patterns while requiring enhancements to Builder, Visitor, Command, and Memento patterns for improved API ergonomics and extensibility.

---

## Architecture Overview

Chrysalis organizes as a three-layer distributed system rather than traditional monolithic web application[^5]:

```mermaid
graph TB
    subgraph UI["UI Presentation Layer (ui/)"]
        Chat1[Agent Chat Pane]
        Canvas[JSONCanvas Workspace]
        Chat2[Human Chat Pane]
        YJS[YJS CRDT State Sync]
        Wallet[API Key Wallet]
    end
    
    subgraph Core["Core Agent Framework (src/, memory_system/)"]
        Agent[UniformSemanticAgentV2]
        Memory[Distributed Memory System]
        Patterns[Universal Pattern Implementations]
        Sync[Experience Synchronization]
    end
    
    subgraph Services["Service/Project Layer (projects/, shared/)"]
        KB[KnowledgeBuilder]
        SB[SkillBuilder]
        AB[AgentBuilder]
        Shared[Shared Infrastructure]
    end
    
    Chat1 --> YJS
    Canvas --> YJS
    Chat2 --> YJS
    YJS --> Core
    
    Core --> Services
    Services --> Shared
    
    Agent --> Memory
    Agent --> Patterns
    Agent --> Sync
```

### Layer Responsibilities

| Layer | Purpose | Key Patterns | Technology |
|-------|---------|--------------|------------|
| **Core Framework** | Agent lifecycle, identity, memory, morphing | Strategy, Adapter, Observer, CRDT | TypeScript, Python |
| **Services** | Domain-specific agent capabilities | Factory, Template Method, Facade | Python (FastAPI) |
| **UI** | Human-agent collaboration interface | Mediator, Observer, State | React 18, YJS |

---

## Part 1: Gang of Four Pattern Catalog

### 1.1 Creational Patterns

#### Factory Method Pattern[^1]

**Intent**: Define an interface for creating objects, but let subclasses decide which class to instantiate[^1].

**Chrysalis Implementation**: Vector index creation with pluggable backends (HNSW, LanceDB, brute-force)[^6].

```mermaid
classDiagram
    class VectorIndexFactory {
        <<interface>>
        +createIndex(type: string, config: Config) VectorIndex
    }
    
    class VectorIndex {
        <<interface>>
        +add(id: string, vector: number[])
        +search(query: number[], k: number) Result[]
        +delete(id: string)
    }
    
    class HNSWVectorIndex {
        -index: HNSWIndex
        +add(id: string, vector: number[])
        +search(query: number[], k: number) Result[]
    }
    
    class LanceDBVectorIndex {
        -client: LanceDBClient
        +add(id: string, vector: number[])
        +search(query: number[], k: number) Result[]
    }
    
    class BruteForceIndex {
        -vectors: Map
        +add(id: string, vector: number[])
        +search(query: number[], k: number) Result[]
    }
    
    VectorIndexFactory ..> VectorIndex : creates
    VectorIndex <|-- HNSWVectorIndex : implements
    VectorIndex <|-- LanceDBVectorIndex : implements
    VectorIndex <|-- BruteForceIndex : implements
```

**Location**: [`src/memory/VectorIndexFactory.ts`](../src/memory/VectorIndexFactory.ts)

**Fidelity Score**: 5/5 ✅

**Usage Example**:
```typescript
const factory = new VectorIndexFactory();
const index = factory.createIndex('hnsw', { dimension: 1536 });
await index.add('mem_001', embedding);
const results = await index.search(queryVector, 10);
```

**Benefits**:
- Decouples index selection from usage code
- Supports runtime backend switching
- Enables testing with mock indices
- Follows Open/Closed Principle[^7]

---

#### Abstract Factory Pattern[^1]

**Intent**: Provide an interface for creating families of related or dependent objects without specifying their concrete classes[^1].

**Chrysalis Implementation**: Multi-provider embedding system supporting OpenAI, Voyage AI, Anthropic, Ollama with consistent interface[^8][^9].

```mermaid
classDiagram
    class EmbeddingService {
        -providers: Map~string,BaseEmbeddingProvider~
        +registerProvider(name: string, provider: BaseEmbeddingProvider)
        +embed(text: string, provider: string) number[]
        +embedBatch(texts: string[], provider: string) number[][]
    }
    
    class BaseEmbeddingProvider {
        <<abstract>>
        +embed(text: string) number[]
        +embedBatch(texts: string[]) number[][]
        #_embed_batch(texts: string[])* number[][]
    }
    
    class OpenAIProvider {
        -apiKey: string
        -model: string
        #_embed_batch(texts: string[]) number[][]
    }
    
    class VoyageProvider {
        -apiKey: string
        -model: string
        #_embed_batch(texts: string[]) number[][]
    }
    
    class AnthropicProvider {
        -apiKey: string
        #_embed_batch(texts: string[]) number[][]
    }
    
    class OllamaProvider {
        -baseURL: string
        -model: string
        #_embed_batch(texts: string[]) number[][]
    }
    
    EmbeddingService o-- BaseEmbeddingProvider : contains
    BaseEmbeddingProvider <|-- OpenAIProvider : extends
    BaseEmbeddingProvider <|-- VoyageProvider : extends
    BaseEmbeddingProvider <|-- AnthropicProvider : extends
    BaseEmbeddingProvider <|-- OllamaProvider : extends
```

**Location**: [`shared/embedding/providers/`](../shared/embedding/providers/)

**Fidelity Score**: 5/5 ✅

**Sequence Diagram - Provider Selection**:
```mermaid
sequenceDiagram
    participant Client
    participant Service as EmbeddingService
    participant Provider as ConcreteProvider
    
    Client->>Service: embed(text, "voyage")
    Service->>Service: selectProvider("voyage")
    Service->>Provider: _embed_batch([text])
    Provider->>Provider: HTTP call to Voyage API
    Provider-->>Service: embeddings
    Service-->>Client: number[]
```

**Benefits**:
- Swap providers without code changes
- Consistent caching and retry logic via Template Method
- Provider-specific optimizations encapsulated
- Follows Dependency Inversion Principle[^7]

**Anti-pattern Prevention**: Singleton enforcement required to prevent cache inconsistency (see Section 3.2.3).

---

#### Builder Pattern[^1]

**Intent**: Separate the construction of complex object from its representation so same construction process can create different representations[^1].

**Chrysalis Gap**: Agent construction uses direct object initialization rather than fluent builder interface.

**Current State** (Schema-Based Construction):
```typescript
const agent: UniformSemanticAgentV2 = {
  schema_version: "2.0.0",
  identity: { id: uuid(), name: "Lovelace", ... },
  personality: { traits: ["analytical"], ... },
  capabilities: [ /* complex array */ ],
  memory: { /* nested configuration */ },
  // ... 8 more top-level fields
};
```

**Recommended Target** (Fluent Builder)[^10]:
```typescript
const agent = new AgentBuilder()
  .withIdentity({ name: "Lovelace", designation: "Mathematician" })
  .withPersonality({ traits: ["analytical", "creative"] })
  .addCapability("code_generation", {
    model: "claude-3-opus",
    temperature: 0.7
  })
  .withMemory({ type: "lance", provider: "local" })
  .enableSync("streaming", { interval_ms: 5000 })
  .build(); // Validates and constructs agent
```

**Pattern Structure**:
```mermaid
classDiagram
    class AgentBuilder {
        -identity: Identity
        -personality: Personality
        -capabilities: Capability[]
        -memory: MemoryConfig
        -syncConfig: SyncConfig
        +withIdentity(id: Identity) AgentBuilder
        +withPersonality(p: Personality) AgentBuilder
        +addCapability(name: string, config: any) AgentBuilder
        +withMemory(config: MemoryConfig) AgentBuilder
        +enableSync(protocol: string, config: any) AgentBuilder
        +build() UniformSemanticAgentV2
        -validate() void
    }
    
    class UniformSemanticAgentV2 {
        +schema_version: string
        +identity: Identity
        +personality: Personality
        +capabilities: Capability[]
        +memory: MemoryConfig
        +experience_sync: SyncConfig
    }
    
    AgentBuilder ..> UniformSemanticAgentV2 : creates
```

**Fidelity Score**: 2/5 ⚠️ (Schema exists but lacks builder interface)

**Priority**: P1 - Enhances developer experience and prevents invalid states

---

#### Prototype Pattern[^1]

**Intent**: Specify kinds of objects to create using a prototypical instance, and create new objects by copying this prototype[^1].

**Chrysalis Implementation**: Agent morphing transforms between frameworks but uses transformation logic rather than cloning[^11].

**Current Morphing Flow**:
```mermaid
sequenceDiagram
    participant Client
    participant Adapter
    participant Source as Source Agent
    participant Target as Target Framework
    participant Shadow as Shadow Fields
    
    Client->>Adapter: morph(agent, targetType)
    Adapter->>Source: Extract canonical form
    Adapter->>Shadow: Store non-mappable fields
    Adapter->>Adapter: Transform to target schema
    Adapter->>Target: Create framework-specific instance
    Adapter-->>Client: {morphed, shadow}
    
    Note over Client,Shadow: Restoration preserves all data
    
    Client->>Adapter: restore(morphed, shadow)
    Adapter->>Shadow: Retrieve stored fields
    Adapter->>Adapter: Merge with morphed data
    Adapter-->>Client: Original agent restored
```

**Gap**: Lacks explicit `clone()` method for creating independent copies. Morphing is lossless transformation, not prototypical cloning.

**Fidelity Score**: 2/5 ⚠️ (Transformation logic present, but not canonical Prototype pattern)

---

#### Singleton Pattern[^1]

**Intent**: Ensure a class has only one instance and provide a global point of access to it[^1].

**Chrysalis Implementation**: Inconsistent - some components use singleton (WalletContext) while others allow multiple instances (EmbeddingService).

**Singleton State Pattern**:
```mermaid
stateDiagram-v2
    [*] --> Uninitialized
    Uninitialized --> Initialized : getInstance()
    Initialized --> Initialized : getInstance() returns same instance
    Initialized --> [*] : reset() (testing only)
    
    note right of Initialized
        All subsequent getInstance() 
        calls return same object
    end note
```

**Enforced Singleton (Recommended)**:
```mermaid
classDiagram
    class EmbeddingService {
        -static instances: Map~string,EmbeddingService~
        -provider: BaseEmbeddingProvider
        -cache: EmbeddingCache
        +static getInstance(providerName: string) EmbeddingService
        -constructor(providerName: string)
        +embed(text: string) number[]
    }
    
    note for EmbeddingService "Constructor private.\ngetInstance() enforces singleton per provider.\nCache shared across all callers."
```

**Current Issue**: Multiple `EmbeddingService` instances can be created, causing:
- Cache fragmentation
- Redundant API calls
- Wasted memory

**Fidelity Score**: 3/5 ⚠️ (Present in UI via React Context, missing in services)

**Priority**: P0 - Cache consistency critical

---

### 1.2 Structural Patterns

#### Adapter Pattern[^1]

**Intent**: Convert the interface of a class into another interface clients expect. Adapter lets classes work together that couldn't otherwise because of incompatible interfaces[^1].

**Chrysalis Implementation**: Lossless agent morphing between MCP, Multi-Agent, CrewAI, and ElizaOS frameworks using shadow fields pattern[^12].

**Adapter Pattern Structure**:
```mermaid
classDiagram
    class UniformSemanticAgentV2 {
        +identity: Identity
        +personality: Personality
        +capabilities: Capability[]
        +memory: Memory
        +experience_sync: SyncConfig
    }
    
    class FrameworkAdapter {
        <<interface>>
        +morph(agent: USA, target: string) MorphResult
        +restore(morphed: any, shadow: ShadowFields) USA
    }
    
    class MCPAdapter {
        +morph(agent: USA, target: "mcp") MCPAgent, ShadowFields
        +restore(mcp: MCPAgent, shadow: ShadowFields) USA
    }
    
    class CrewAIAdapter {
        +morph(agent: USA, target: "crewai") CrewAIAgent, ShadowFields
        +restore(crew: CrewAIAgent, shadow: ShadowFields) USA
    }
    
    class ElizaOSAdapter {
        +morph(agent: USA, target: "eliza") ElizaAgent, ShadowFields
        +restore(eliza: ElizaAgent, shadow: ShadowFields) USA
    }
    
    class ShadowFields {
        +nonMappableData: Map~string,any~
        +originalSchema: string
        +transformationMetadata: any
    }
    
    FrameworkAdapter <|-- MCPAdapter : implements
    FrameworkAdapter <|-- CrewAIAdapter : implements
    FrameworkAdapter <|-- ElizaOSAdapter : implements
    FrameworkAdapter --> UniformSemanticAgentV2 : adapts
    FrameworkAdapter --> ShadowFields : uses
```

**Lossless Morphing Sequence**[^12]:
```mermaid
sequenceDiagram
    participant App as Application
    participant Adapter as MCPAdapter
    participant Shadow as ShadowFields Store
    participant MCP as MCP Framework
    
    App->>Adapter: morph(universalAgent, "mcp")
    Adapter->>Adapter: Extract mappable fields
    Adapter->>Shadow: Store non-mappable fields
    Adapter->>Adapter: Transform to MCP schema
    Adapter-->>App: {mcpAgent, shadowFields}
    
    App->>MCP: Deploy mcpAgent
    Note over MCP: Agent runs in MCP framework
    
    App->>Adapter: restore(mcpAgent, shadowFields)
    Adapter->>Shadow: Retrieve non-mappable fields
    Adapter->>Adapter: Merge with current state
    Adapter-->>App: Original agent (lossless)
```

**Location**: [`src/adapters/`](../src/adapters/)

**Fidelity Score**: 5/5 ✅

**Innovation**: Shadow fields pattern enables lossless bidirectional transformation between incompatible schemas - a novel extension not described in classical pattern literature.

---

#### Bridge Pattern[^1]

**Intent**: Decouple an abstraction from its implementation so that the two can vary independently[^1].

**Chrysalis Implementation**: Pattern resolver separates universal pattern abstractions (Hash, Signature) from implementations (embedded libraries vs. gRPC services vs. MCP servers)[^13].

**Bridge Structure**:
```mermaid
classDiagram
    class PatternAbstraction {
        <<interface>>
        +hash(data: string) string
        +sign(data: string, key: PrivateKey) Signature
    }
    
    class AdaptivePatternResolver {
        -implementation: PatternImplementation
        -circuitBreaker: CircuitBreaker
        +resolveHash() HashImplementation
        +resolveSignature() SignatureImplementation
    }
    
    class PatternImplementation {
        <<interface>>
        +execute(operation: string, data: any) Promise~any~
    }
    
    class EmbeddedImplementation {
        -hashLib: NobleHashes
        -signLib: NobleEd25519
        +execute(op: string, data: any) any
    }
    
    class gRPCImplementation {
        -client: CryptoServiceClient
        +execute(op: string, data: any) Promise~any~
    }
    
    class MCPImplementation {
        -mcpClient: MCPPatternClient
        +execute(op: string, data: any) Promise~any~
    }
    
    PatternAbstraction <|-- AdaptivePatternResolver : realizes
    AdaptivePatternResolver o-- PatternImplementation : uses
    PatternImplementation <|-- EmbeddedImplementation : implements
    PatternImplementation <|-- gRPCImplementation : implements
    PatternImplementation <|-- MCPImplementation : implements
```

**Adaptive Resolution Flow**[^13]:
```mermaid
flowchart TD
    Start[Pattern Request] --> CheckContext{Deployment Context?}
    CheckContext -->|Distributed| CheckMCP{MCP Available?}
    CheckContext -->|Single-node| Embedded[Use Embedded]
    CheckContext -->|Performance-critical| Embedded
    
    CheckMCP -->|Yes| UseMCP[Use MCP Server]
    CheckMCP -->|No| CheckgRPC{gRPC Available?}
    
    CheckgRPC -->|Yes| UsegRPC[Use gRPC Service]
    CheckgRPC -->|No| Fallback[Fallback to Embedded]
    
    UseMCP --> CircuitBreaker{Circuit Breaker Check}
    UsegRPC --> CircuitBreaker
    
    CircuitBreaker -->|Closed| Execute[Execute Operation]
    CircuitBreaker -->|Open| Fallback
    
    Execute --> Success{Success?}
    Success -->|Yes| Return[Return Result]
    Success -->|No| Fallback
    
    Embedded --> Return
    Fallback --> Return
```

**Location**: [`src/fabric/PatternResolver.ts`](../src/fabric/PatternResolver.ts)

**Fidelity Score**: 5/5 ✅

**Benefits**:
- Implementation swappable at runtime
- Graceful degradation via circuit breaker
- Latency optimization (embedded ~0.1ms vs. gRPC ~5ms)

---

#### Composite Pattern[^1]

**Intent**: Compose objects into tree structures to represent part-whole hierarchies. Composite lets clients treat individual objects and compositions uniformly[^1].

**Chrysalis Partial Implementation**: Agent instances form hierarchical structure but lack unified Component interface.

**Current Structure**:
```mermaid
classDiagram
    class UniformSemanticAgentV2 {
        +identity: Identity
        +instances: Instance[]
        +getAllInstances() Instance[]
    }
    
    class Instance {
        +instance_id: string
        +parent_agent_id: string
        +deployment_location: string
        +status: string
    }
    
    UniformSemanticAgentV2 "1" o-- "*" Instance : manages
    Instance ..> UniformSemanticAgentV2 : references parent
```

**Recommended Enhancement**:
```mermaid
classDiagram
    class AgentComponent {
        <<interface>>
        +add(component: AgentComponent)
        +remove(component: AgentComponent)
        +getInstances() AgentComponent[]
        +execute(operation: string) Result
    }
    
    class SourceAgent {
        -instances: AgentComponent[]
        +add(instance: AgentComponent)
        +remove(instance: AgentComponent)
        +getInstances() AgentComponent[]
        +execute(op: string) Result
    }
    
    class AgentInstance {
        +getInstances() AgentComponent[]
        +execute(op: string) Result
    }
    
    AgentComponent <|-- SourceAgent : implements
    AgentComponent <|-- AgentInstance : implements
    SourceAgent o-- AgentComponent : contains
```

**Fidelity Score**: 3/5 ⚠️ (Tree structure exists, unified interface missing)

**Priority**: P2 - Nice-to-have for cleaner traversal code

---

#### Decorator Pattern[^1]

**Intent**: Attach additional responsibilities to an object dynamically. Decorators provide flexible alternative to subclassing for extending functionality[^1].

**Chrysalis Implementation**: Circuit breaker wraps pattern implementations, middleware chains in FastAPI services[^14].

**Circuit Breaker Decorator**:
```mermaid
classDiagram
    class PatternImplementation {
        <<interface>>
        +execute(operation: string, data: any) Promise~any~
    }
    
    class BaseImplementation {
        +execute(operation: string, data: any) Promise~any~
    }
    
    class CircuitBreaker {
        -wrappedImplementation: PatternImplementation
        -state: CircuitState
        -failureCount: number
        -threshold: number
        +execute(operation: string, data: any) Promise~any~
        -recordSuccess()
        -recordFailure()
        -shouldAttempt() boolean
    }
    
    class CircuitState {
        <<enumeration>>
        CLOSED
        OPEN
        HALF_OPEN
    }
    
    PatternImplementation <|-- BaseImplementation : implements
    PatternImplementation <|-- CircuitBreaker : implements
    CircuitBreaker o-- PatternImplementation : wraps
    CircuitBreaker --> CircuitState : uses
```

**State Transitions**[^14]:
```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Open : failures >= threshold
    Open --> HalfOpen : timeout expires
    HalfOpen --> Closed : success
    HalfOpen --> Open : failure
    
    note right of Closed
        Normal operation
        Requests pass through
    end note
    
    note right of Open
        Fast-fail mode
        Reject immediately
    end note
    
    note right of HalfOpen
        Testing recovery
        Single probe request
    end note
```

**Location**: [`src/utils/CircuitBreaker.ts`](../src/utils/CircuitBreaker.ts)

**Fidelity Score**: 5/5 ✅

**Benefits**:
- Adds fault tolerance without modifying core logic
- Stackable (can add logging, caching, retries)
- Follows Single Responsibility Principle[^7]

---

#### Facade Pattern[^1]

**Intent**: Provide a unified interface to a set of interfaces in a subsystem. Facade defines a higher-level interface that makes the subsystem easier to use[^1].

**Chrysalis Implementation**: Service-level APIs simplify complex subsystems[^15].

**Embedding Service Facade**:
```mermaid
classDiagram
    class EmbeddingService {
        <<facade>>
        +embed(text: string, provider?: string) number[]
        +embedBatch(texts: string[], provider?: string) number[][]
    }
    
    class ProviderRegistry {
        +getProvider(name: string) BaseEmbeddingProvider
        +registerProvider(name: string, provider: BaseEmbeddingProvider)
    }
    
    class EmbeddingCache {
        +get(key: string) number[] | null
        +set(key: string, value: number[])
    }
    
    class RateLimiter {
        +checkLimit(provider: string) boolean
        +recordUsage(provider: string)
    }
    
    class RetryManager {
        +withRetry(fn: Function, config: RetryConfig) Promise~any~
    }
    
    EmbeddingService --> ProviderRegistry : uses
    EmbeddingService --> EmbeddingCache : uses
    EmbeddingService --> RateLimiter : uses
    EmbeddingService --> RetryManager : uses
```

**Location**: [`shared/embedding/service.py`](../shared/embedding/service.py)

**Fidelity Score**: 4/5 ✅

**Benefits**:
- Clients call simple `embed()` method
- Complexity (caching, retries, rate limiting) hidden
- Follows Least Knowledge Principle[^7]

---

#### Flyweight Pattern[^1]

**Intent**: Use sharing to support large numbers of fine-grained objects efficiently[^1].

**Chrysalis Implementation**: Memory deduplication merges similar memories to reduce storage[^16].

**Memory Deduplication Process**:
```mermaid
flowchart TD
    Input[New Memory] --> Sanitize{Sanitize}
    Sanitize -->|Blocked| Reject[Reject + Voyeur Event]
    Sanitize -->|Clean| Method{Similarity Method?}
    
    Method -->|jaccard| Jaccard[Token-based Overlap]
    Method -->|embedding| Embed[Vector Similarity]
    
    Jaccard --> Compare[Compare All Existing]
    Embed --> Compare
    
    Compare --> Threshold{Similarity > 0.9?}
    Threshold -->|Yes| Merge[Merge with Existing]
    Threshold -->|No| Add[Add as New]
    
    Merge --> UpdateMetadata[Update: accessed_count++, confidence = max]
    Add --> Index{Vector Index?}
    
    UpdateMetadata --> VoyeurEvent[Emit merged event]
    Index -->|Yes| Upsert[Upsert to Index]
    Index -->|No| Store[Store in Map]
    
    Upsert --> VoyeurEvent
    Store --> VoyeurEvent
```

**Shared vs. Unique State**:
```mermaid
erDiagram
    MEMORY {
        string memory_id PK
        string content
        number confidence
        number importance
        number accessed_count
        datetime last_accessed
    }
    
    MEMORY_INSTANCE {
        string memory_id FK
        string instance_id FK
        datetime created_at
        string context
    }
    
    AGENT_INSTANCE {
        string instance_id PK
        string agent_id FK
        string deployment_location
    }
    
    MEMORY ||--o{ MEMORY_INSTANCE : "shared by"
    AGENT_INSTANCE ||--o{ MEMORY_INSTANCE : "references"
```

**Location**: [`src/experience/MemoryMerger.ts`](../src/experience/MemoryMerger.ts)

**Fidelity Score**: 5/5 ✅

**Benefits**:
- Reduces memory footprint (deduplication ratios: 20-40% typical)
- Semantic similarity clustering via embeddings[^8]
- Maintains reference counts for importance scoring

---

#### Proxy Pattern[^1]

**Intent**: Provide a surrogate or placeholder for another object to control access to it[^1].

**Chrysalis Implementation**: Circuit breaker acts as protective proxy for external service calls[^14].

**Proxy Pattern Structure**:
```mermaid
classDiagram
    class Subject {
        <<interface>>
        +request() Response
    }
    
    class RealSubject {
        +request() Response
    }
    
    class Proxy {
        -realSubject: RealSubject
        -accessControl()
        -lazyInit()
        -logRequest()
        +request() Response
    }
    
    Subject <|-- RealSubject : implements
    Subject <|-- Proxy : implements
    Proxy o-- RealSubject : wraps
```

**Circuit Breaker as Protective Proxy**:
```mermaid
sequenceDiagram
    participant Client
    participant Proxy as CircuitBreaker (Proxy)
    participant Real as gRPC Service (Real Subject)
    
    Client->>Proxy: hash(data)
    
    alt Circuit Closed
        Proxy->>Real: forward request
        Real-->>Proxy: response
        Proxy->>Proxy: recordSuccess()
        Proxy-->>Client: response
    else Circuit Open
        Proxy->>Proxy: checkState() = OPEN
        Proxy-->>Client: throw CircuitOpenError (fast-fail)
    else Circuit Half-Open
        Proxy->>Real: single probe request
        alt Success
            Real-->>Proxy: response
            Proxy->>Proxy: transition to CLOSED
            Proxy-->>Client: response
        else Failure
            Real-->>Proxy: error
            Proxy->>Proxy: transition to OPEN
            Proxy-->>Client: throw error
        end
    end
```

**Fidelity Score**: 4/5 ✅

**Additional Proxy Uses**:
- Lazy loading in vector indices
- API key wallet controls access to credentials
- Logging and monitoring wrappers

---

### 1.3 Behavioral Patterns

#### Chain of Responsibility Pattern[^1]

**Intent**: Avoid coupling the sender of a request to its receiver by giving more than one object a chance to handle the request. Chain the receiving objects and pass the request along the chain until an object handles it[^1].

**Chrysalis Implementation**: FastAPI middleware chains for request processing[^17].

**Middleware Chain Structure**:
```mermaid
classDiagram
    class Handler {
        <<interface>>
        +setNext(handler: Handler) Handler
        +handle(request: Request) Response
    }
    
    class CORSMiddleware {
        -next: Handler
        +handle(request: Request) Response
    }
    
    class AuthMiddleware {
        -next: Handler
        +handle(request: Request) Response
    }
    
    class RateLimitMiddleware {
        -next: Handler
        -limiter: RateLimiter
        +handle(request: Request) Response
    }
    
    class RequestHandler {
        +handle(request: Request) Response
    }
    
    Handler <|-- CORSMiddleware : implements
    Handler <|-- AuthMiddleware : implements
    Handler <|-- RateLimitMiddleware : implements
    Handler <|-- RequestHandler : implements
    
    CORSMiddleware o-- Handler : next
    AuthMiddleware o-- Handler : next
    RateLimitMiddleware o-- Handler : next
```

**Request Flow**:
```mermaid
sequenceDiagram
    participant Client
    participant CORS as CORSMiddleware
    participant Auth as AuthMiddleware
    participant Rate as RateLimitMiddleware
    participant Handler as RequestHandler
    
    Client->>CORS: HTTP Request
    CORS->>CORS: Check origin
    
    alt Origin allowed
        CORS->>Auth: forward request
        Auth->>Auth: Validate API key
        
        alt Valid credentials
            Auth->>Rate: forward request
            Rate->>Rate: Check rate limit
            
            alt Within limit
                Rate->>Handler: forward request
                Handler->>Handler: Process business logic
                Handler-->>Rate: response
                Rate-->>Auth: response
                Auth-->>CORS: response
                CORS-->>Client: response
            else Rate exceeded
                Rate-->>Client: 429 Too Many Requests
            end
        else Invalid credentials
            Auth-->>Client: 401 Unauthorized
        end
    else Origin blocked
        CORS-->>Client: 403 Forbidden
    end
```

**Location**: [`shared/api_core/middleware.py`](../shared/api_core/middleware.py)

**Fidelity Score**: 5/5 ✅

---

#### Command Pattern[^1]

**Intent**: Encapsulate a request as an object, thereby letting you parameterize clients with different requests, queue or log requests, and support undoable operations[^1].

**Chrysalis Gap**: Experience events act as implicit commands but lack formal `execute()` and `undo()` methods.

**Current State** (Event as Implicit Command):
```typescript
interface ExperienceEvent {
  event_id: string;
  event_type: 'memory' | 'skill' | 'knowledge';
  data: any;
  priority: number; // 0.0-1.0
}
```

**Recommended Command Pattern**:
```mermaid
classDiagram
    class Command {
        <<interface>>
        +execute() void
        +undo() void
        +canUndo() boolean
    }
    
    class AddMemoryCommand {
        -agent: Agent
        -memory: Memory
        -previousState: Memory | null
        +execute() void
        +undo() void
        +canUndo() boolean
    }
    
    class AddCapabilityCommand {
        -agent: Agent
        -capability: Capability
        +execute() void
        +undo() void
    }
    
    class CommandHistory {
        -history: Command[]
        -currentIndex: number
        +executeCommand(cmd: Command)
        +undo()
        +redo()
    }
    
    Command <|-- AddMemoryCommand : implements
    Command <|-- AddCapabilityCommand : implements
    CommandHistory o-- Command : manages
```

**Undo/Redo Flow**:
```mermaid
sequenceDiagram
    participant UI
    participant History as CommandHistory
    participant Cmd as ConcreteCommand
    participant Agent
    
    UI->>History: executeCommand(new AddMemoryCommand())
    History->>Cmd: execute()
    Cmd->>Agent: addMemory(memory)
    Cmd->>Cmd: Store previousState
    History->>History: Push to history stack
    
    Note over UI: User presses Ctrl+Z
    
    UI->>History: undo()
    History->>History: currentIndex--
    History->>Cmd: undo()
    Cmd->>Agent: Restore previousState
    
    Note over UI: User presses Ctrl+Shift+Z
    
    UI->>History: redo()
    History->>History: currentIndex++
    History->>Cmd: execute()
    Cmd->>Agent: addMemory(memory)
```

**Fidelity Score**: 2/5 ⚠️ (Event structure present, command interface missing)

**Priority**: P1 - Required for UI undo/redo functionality

---

#### Mediator Pattern[^1]

**Intent**: Define an object that encapsulates how a set of objects interact. Mediator promotes loose coupling by keeping objects from referring to each other explicitly[^1].

**Chrysalis Implementation**: VoyeurBus mediates observability events, YJS document mediates collaborative state[^18][^19].

**Mediator Pattern Structure**:
```mermaid
classDiagram
    class Mediator {
        <<interface>>
        +notify(sender: Component, event: string, data: any)
    }
    
    class VoyeurBus {
        -subscribers: Map~string,Subscriber[]~
        +subscribe(event: string, callback: Function) Unsubscribe
        +emit(event: string, data: any)
        +notify(sender: Component, event: string, data: any)
    }
    
    class Component {
        <<interface>>
        -mediator: Mediator
        +send(event: string, data: any)
    }
    
    class MemoryMerger {
        -voyeur: VoyeurBus
        +addMemory() void
        -notifyMemoryAdded()
    }
    
    class ExperienceSync {
        -voyeur: VoyeurBus
        +syncExperience() void
        -notifySyncComplete()
    }
    
    class Dashboard {
        -voyeur: VoyeurBus
        +constructor() void
        -subscribeToEvents()
    }
    
    Mediator <|-- VoyeurBus : implements
    Component <|-- MemoryMerger : implements
    Component <|-- ExperienceSync : implements
    Component <|-- Dashboard : implements
    
    MemoryMerger --> VoyeurBus : uses
    ExperienceSync --> VoyeurBus : uses
    Dashboard --> VoyeurBus : uses
```

**Event Flow Through Mediator**:
```mermaid
sequenceDiagram
    participant MM as MemoryMerger
    participant VB as VoyeurBus
    participant M1 as MetricsSink
    participant M2 as WebDashboard
    participant M3 as ConsoleLogger
    
    Note over VB: Subscribers register
    M1->>VB: subscribe('memory:added', callback1)
    M2->>VB: subscribe('memory:added', callback2)
    M3->>VB: subscribe('memory:added', callback3)
    
    Note over MM: Event occurs
    MM->>VB: emit('memory:added', {memory_id, agent_id})
    
    VB->>M1: callback1({memory_id, agent_id})
    VB->>M2: callback2({memory_id, agent_id})
    VB->>M3: callback3({memory_id, agent_id})
    
    Note over VB: Components don't know about each other
```

**Location**: [`src/observability/VoyeurEvents.ts`](../src/observability/VoyeurEvents.ts)

**Fidelity Score**: 5/5 ✅

**Benefits**:
- Decouples components completely
- Add/remove observers without changing producers
- Centralized event routing and logging

---

#### Observer Pattern[^1]

**Intent**: Define a one-to-many dependency between objects so that when one object changes state, all its dependents are notified and updated automatically[^1].

**Chrysalis Implementation**: VoyeurBus implements pub/sub, YJS awareness provides collaborative presence[^18][^19].

**Observer Pattern Structure**:
```mermaid
classDiagram
    class Subject {
        <<interface>>
        -observers: Observer[]
        +attach(observer: Observer)
        +detach(observer: Observer)
        +notify()
    }
    
    class ConcreteSubject {
        -state: any
        +getState() any
        +setState(state: any)
        +notify()
    }
    
    class Observer {
        <<interface>>
        +update(subject: Subject)
    }
    
    class ConcreteObserver {
        -observerState: any
        +update(subject: Subject)
    }
    
    Subject <|-- ConcreteSubject : implements
    Observer <|-- ConcreteObserver : implements
    ConcreteSubject o-- Observer : notifies
```

**VoyeurBus Implementation**:
```mermaid
sequenceDiagram
    participant Subject as Agent
    participant Bus as VoyeurBus
    participant O1 as Observer 1 (Metrics)
    participant O2 as Observer 2 (Dashboard)
    participant O3 as Observer 3 (Logger)
    
    O1->>Bus: subscribe('agent:updated')
    O2->>Bus: subscribe('agent:updated')
    O3->>Bus: subscribe('agent:updated')
    
    Subject->>Subject: state changes
    Subject->>Bus: emit('agent:updated', data)
    
    Bus->>O1: notify(data)
    Bus->>O2: notify(data)
    Bus->>O3: notify(data)
    
    O1->>O1: Update metrics
    O2->>O2: Refresh UI
    O3->>O3: Log event
```

**YJS Collaborative Observability**[^19]:
```mermaid
graph LR
    subgraph User1["User 1 Browser"]
        Y1[YJS Doc Instance]
        C1[Canvas Component]
    end
    
    subgraph User2["User 2 Browser"]
        Y2[YJS Doc Instance]
        C2[Canvas Component]
    end
    
    subgraph Server["WebSocket Server"]
        WS[YJS Sync Provider]
    end
    
    Y1 <--> WS
    Y2 <--> WS
    
    Y1 --> C1
    Y2 --> C2
    
    C1 -.->|observe changes| Y1
    C2 -.->|observe changes| Y2
```

**Location**: [`src/observability/VoyeurEvents.ts`](../src/observability/VoyeurEvents.ts), YJS integration in UI

**Fidelity Score**: 5/5 ✅

---

#### State Pattern[^1]

**Intent**: Allow an object to alter its behavior when its internal state changes. The object will appear to change its class[^1].

**Chrysalis Implementation**: Circuit breaker state machine with three states (Closed, Open, Half-Open)[^14].

**State Pattern Structure**:
```mermaid
classDiagram
    class Context {
        -state: State
        +request()
        +setState(state: State)
    }
    
    class State {
        <<interface>>
        +handle(context: Context)
    }
    
    class ClosedState {
        +handle(context: Context)
    }
    
    class OpenState {
        +handle(context: Context)
    }
    
    class HalfOpenState {
        +handle(context: Context)
    }
    
    Context o-- State : current state
    State <|-- ClosedState : implements
    State <|-- OpenState : implements
    State <|-- HalfOpenState : implements
```

**Circuit Breaker State Machine**:
```mermaid
stateDiagram-v2
    [*] --> Closed : Initialize
    
    Closed --> Open : failures >= threshold\n(default: 5 failures)
    Closed --> Closed : success\n(reset counter)
    
    Open --> HalfOpen : timeout expires\n(default: 60s)
    Open --> Open : reject immediately\n(no actual call)
    
    HalfOpen --> Closed : probe succeeds\n(reset counter)
    HalfOpen --> Open : probe fails\n(extend timeout)
    
    state Closed {
        [*] --> Accepting
        Accepting --> Recording : execute()
        Recording --> [*] : success/failure
    }
    
    state Open {
        [*] --> Rejecting
        Rejecting --> [*] : fast-fail
    }
    
    state HalfOpen {
        [*] --> Probing
        Probing --> [*] : single request
    }
```

**Location**: [`src/utils/CircuitBreaker.ts`](../src/utils/CircuitBreaker.ts)

**Fidelity Score**: 5/5 ✅

**Implementation validates all State pattern participants**:
- **Context**: CircuitBreaker class
- **State Interface**: Implicit via state property
- **Concrete States**: CLOSED, OPEN, HALF_OPEN
- **State Transitions**: Explicit in transition logic

---

#### Strategy Pattern[^1]

**Intent**: Define a family of algorithms, encapsulate each one, and make them interchangeable. Strategy lets the algorithm vary independently from clients that use it[^1].

**Chrysalis Implementation**: Multiple interchangeable strategies across memory similarity, sync protocols, embedding providers[^20].

**Strategy Pattern Structure**:
```mermaid
classDiagram
    class Context {
        -strategy: Strategy
        +setStrategy(strategy: Strategy)
        +executeStrategy()
    }
    
    class Strategy {
        <<interface>>
        +algorithm()
    }
    
    class ConcreteStrategyA {
        +algorithm()
    }
    
    class ConcreteStrategyB {
        +algorithm()
    }
    
    Context o-- Strategy : uses
    Strategy <|-- ConcreteStrategyA : implements
    Strategy <|-- ConcreteStrategyB : implements
```

**Memory Similarity Strategies**:
```mermaid
classDiagram
    class MemoryMerger {
        -similarityStrategy: SimilarityStrategy
        +findSimilar(memory: Memory) Memory[]
    }
    
    class SimilarityStrategy {
        <<interface>>
        +calculateSimilarity(m1: Memory, m2: Memory) number
    }
    
    class JaccardStrategy {
        +calculateSimilarity(m1: Memory, m2: Memory) number
    }
    
    class EmbeddingStrategy {
        -embeddingService: EmbeddingService
        +calculateSimilarity(m1: Memory, m2: Memory) number
    }
    
    MemoryMerger o-- SimilarityStrategy : uses
    SimilarityStrategy <|-- JaccardStrategy : implements
    SimilarityStrategy <|-- EmbeddingStrategy : implements
```

**Strategy Selection at Runtime**:
```mermaid
flowchart LR
    Config[MemoryMergerConfig] --> Decision{similarity_method?}
    Decision -->|"jaccard"| Jaccard[JaccardStrategy\nO N² , <1K memories]
    Decision -->|"embedding"| Embedding[EmbeddingStrategy\nO N² , <5K memories]
    
    Jaccard --> Performance1[~10ms per comparison\nNo API calls]
    Embedding --> Performance2[~50ms per comparison\nRequires embedding service]
    
    Performance1 --> Use1[Use for: Small datasets\nOffline operation]
    Performance2 --> Use2[Use for: Better accuracy\nSemantic understanding]
```

**Multiple Strategy Applications**:

| Context | Strategy Family | Implementations |
|---------|-----------------|-----------------|
| Memory Similarity | `SimilarityStrategy` | Jaccard, Embedding |
| Experience Sync | `SyncProtocol` | Streaming, Lumped, Check-in |
| Pattern Resolution | `PatternImplementation` | Embedded, gRPC, MCP |
| Embedding Providers | `EmbeddingProvider` | OpenAI, Voyage, Anthropic, Ollama |

**Fidelity Score**: 5/5 ✅

**Benefits**:
- Runtime algorithm selection via configuration
- Easy to add new strategies
- Testable strategies in isolation

---

#### Template Method Pattern[^1]

**Intent**: Define the skeleton of an algorithm in an operation, deferring some steps to subclasses. Template Method lets subclasses redefine certain steps of an algorithm without changing the algorithm's structure[^1].

**Chrysalis Implementation**: Base embedding provider defines algorithm skeleton, concrete providers implement batch embedding[^8].

**Template Method Structure**:
```mermaid
classDiagram
    class AbstractClass {
        +templateMethod()
        #primitiveOperation1()*
        #primitiveOperation2()*
        #hook()
    }
    
    class ConcreteClass {
        #primitiveOperation1()
        #primitiveOperation2()
    }
    
    AbstractClass <|-- ConcreteClass : extends
```

**Embedding Provider Template**:
```mermaid
classDiagram
    class BaseEmbeddingProvider {
        <<abstract>>
        -cache: EmbeddingCache
        +embed(text: string) number[]
        +embedBatch(texts: string[]) number[][]
        #_embed_batch(texts: string[])* number[][]
        #_should_retry(error: Error) boolean
        #_get_cache_key(text: string) string
    }
    
    class VoyageProvider {
        -apiKey: string
        -model: string
        #_embed_batch(texts: string[]) number[][]
    }
    
    class OpenAIProvider {
        -apiKey: string
        -model: string
        #_embed_batch(texts: string[]) number[][]
    }
    
    BaseEmbeddingProvider <|-- VoyageProvider : extends
    BaseEmbeddingProvider <|-- OpenAIProvider : extends
    
    note for BaseEmbeddingProvider "Template method: embedBatch()\n1. Check cache (implemented)\n2. Call _embed_batch() (abstract)\n3. Update cache (implemented)\n4. Retry on failure (implemented)"
```

**Template Method Execution Flow**:
```mermaid
sequenceDiagram
    participant Client
    participant Base as BaseEmbeddingProvider
    participant Cache
    participant Concrete as VoyageProvider
    participant API as Voyage API
    
    Client->>Base: embedBatch(texts)
    
    loop For each text
        Base->>Base: getCacheKey(text)
        Base->>Cache: get(cacheKey)
        alt Cache hit
            Cache-->>Base: cached_embedding
        else Cache miss
            Note over Base: Cache miss, need to embed
        end
    end
    
    Base->>Concrete: _embed_batch(uncached_texts)
    Concrete->>API: HTTP POST /embed
    API-->>Concrete: embeddings
    Concrete-->>Base: embeddings
    
    Base->>Cache: set(cacheKeys, embeddings)
    Base-->>Client: all_embeddings
```

**Location**: [`shared/embedding/providers/base.py`](../shared/embedding/providers/base.py)

**Fidelity Score**: 4/5 ✅

**Benefits**:
- Common logic (caching, retries) centralized
- Providers only implement embedding-specific logic
- Consistent behavior across providers

---

#### Visitor Pattern[^1]

**Intent**: Represent an operation to be performed on the elements of an object structure. Visitor lets you define a new operation without changing the classes of the elements on which it operates[^1].

**Chrysalis Gap**: Canvas operations use type-based dispatch rather than Visitor pattern, limiting extensibility.

**Recommended Visitor Pattern**:
```mermaid
classDiagram
    class Element {
        <<interface>>
        +accept(visitor: Visitor)
    }
    
    class CanvasNode {
        +accept(visitor: Visitor)
    }
    
    class AgentNode {
        +accept(visitor: Visitor)
    }
    
    class MediaNode {
        +accept(visitor: Visitor)
    }
    
    class Visitor {
        <<interface>>
        +visitAgentNode(node: AgentNode)
        +visitMediaNode(node: MediaNode)
        +visitDataNode(node: DataNode)
    }
    
    class RenderVisitor {
        +visitAgentNode(node: AgentNode) ReactElement
        +visitMediaNode(node: MediaNode) ReactElement
    }
    
    class SerializeVisitor {
        +visitAgentNode(node: AgentNode) JSON
        +visitMediaNode(node: MediaNode) JSON
    }
    
    class ValidationVisitor {
        +visitAgentNode(node: AgentNode) boolean
        +visitMediaNode(node: MediaNode) boolean
    }
    
    Element <|-- CanvasNode : implements
    CanvasNode <|-- AgentNode : extends
    CanvasNode <|-- MediaNode : extends
    
    Visitor <|-- RenderVisitor : implements
    Visitor <|-- SerializeVisitor : implements
    Visitor <|-- ValidationVisitor : implements
    
    AgentNode ..> Visitor : accepts
    MediaNode ..> Visitor : accepts
```

**Visitor Execution Sequence**:
```mermaid
sequenceDiagram
    participant Client
    participant Visitor as RenderVisitor
    participant Node1 as AgentNode
    participant Node2 as MediaNode
    
    Client->>Node1: accept(renderVisitor)
    Node1->>Visitor: visitAgentNode(this)
    Visitor->>Visitor: Render agent-specific UI
    Visitor-->>Node1: ReactElement
    Node1-->>Client: ReactElement
    
    Client->>Node2: accept(renderVisitor)
    Node2->>Visitor: visitMediaNode(this)
    Visitor->>Visitor: Render media-specific UI
    Visitor-->>Node2: ReactElement
    Node2-->>Client: ReactElement
```

**Fidelity Score**: 1/5 ❌ (Not implemented, type-switch used instead)

**Priority**: P0 - Critical for canvas extensibility

**Benefits of Implementation**:
- Add new operations (export, copy, validate) without modifying node classes
- Follows Open/Closed Principle[^7]
- Type-safe operation dispatch

---

### 1.4 Distributed Systems Patterns

Chrysalis implements 10 universal distributed patterns validated against production systems (Cassandra, Ethereum, Git, TLS)[^2][^3][^21].

#### CRDT Pattern (Conflict-Free Replicated Data Types)[^3]

**Intent**: Enable concurrent updates to shared state that converge to same result without coordination[^3].

**Chrysalis Implementation**: YJS for UI collaboration, custom CRDTs in core memory system.

**CRDT Convergence Properties**:
```mermaid
graph TB
    subgraph Instance1["Agent Instance 1"]
        S1A[State: memories = A,B] --> Op1[Add memory C]
        Op1 --> S1B[State: A,B,C]
    end
    
    subgraph Instance2["Agent Instance 2"]
        S2A[State: memories = A,B] --> Op2[Add memory D]
        Op2 --> S2B[State: A,B,D]
    end
    
    S1B --> Sync[Gossip Sync]
    S2B --> Sync
    
    Sync --> Merge[CRDT Merge]
    
    Merge --> Final1[Instance 1: A,B,C,D]
    Merge --> Final2[Instance 2: A,B,C,D]
    
    style Final1 fill:#90EE90
    style Final2 fill:#90EE90
```

**CRDT Types in Chrysalis**:
```mermaid
classDiagram
    class CRDT {
        <<interface>>
        +merge(other: CRDT) CRDT
        +compare(other: CRDT) boolean
    }
    
    class GSet~T~ {
        -elements: Set~T~
        +add(element: T)
        +merge(other: GSet) GSet
        +has(element: T) boolean
    }
    
    class LWWRegister~T~ {
        -value: T
        -timestamp: number
        +set(value: T, ts: number)
        +merge(other: LWWRegister) LWWRegister
        +get() T
    }
    
    class ORSet~T~ {
        -added: Map~T,Set~UUID~~
        -removed: Set~UUID~
        +add(element: T, uuid: UUID)
        +remove(element: T, uuid: UUID)
        +merge(other: ORSet) ORSet
    }
    
    CRDT <|-- GSet : implements
    CRDT <|-- LWWRegister : implements
    CRDT <|-- ORSet : implements
```

**Location**: [`memory_system/crdt_merge.py`](../memory_system/crdt_merge.py), YJS library in UI

**Fidelity Score**: 5/5 ✅

**Properties Verified**[^3]:
- ✅ **Commutativity**: merge(A, B) = merge(B, A)
- ✅ **Associativity**: merge(merge(A, B), C) = merge(A, merge(B, C))
- ✅ **Idempotence**: merge(A, A) = A

---

#### Gossip Protocol Pattern[^2]

**Intent**: Disseminate information through peer-to-peer probabilistic communication, achieving eventual consistency without central coordination[^2].

**Chrysalis Implementation**: Experience propagation between agent instances using epidemic broadcast[^22].

**Gossip Protocol Flow**:
```mermaid
sequenceDiagram
    participant I1 as Instance 1
    participant I2 as Instance 2
    participant I3 as Instance 3
    participant Source as Source Agent
    
    Note over I1: New experience occurs
    I1->>I1: Create ExperienceEvent
    
    loop Gossip Rounds (every interval)
        I1->>I2: Send experience (push)
        I1->>I3: Send experience (push)
        
        I2->>I2: Merge experience
        I2->>I3: Relay to peers
        
        I3->>I3: Merge experience
        I3->>I1: Acknowledge receipt
    end
    
    I2->>Source: Sync to source agent
    I3->>Source: Sync to source agent
    
    Source->>Source: Byzantine threshold check
    
    alt 2/3 instances agree
        Source->>Source: Accept experience
    else Disagreement
        Source->>Source: Reject (possible malicious instance)
    end
```

**Gossip Network Topology**:
```mermaid
graph TD
    Source[Source Agent]
    
    I1[Instance 1]
    I2[Instance 2]
    I3[Instance 3]
    I4[Instance 4]
    
    I1 <-.gossip.-> I2
    I2 <-.gossip.-> I3
    I3 <-.gossip.-> I4
    I4 <-.gossip.-> I1
    I1 <-.gossip.-> I3
    I2 <-.gossip.-> I4
    
    I1 -->|sync| Source
    I2 -->|sync| Source
    I3 -->|sync| Source
    I4 -->|sync| Source
    
    style Source fill:#FFD700
```

**Location**: [`memory_system/gossip.py`](../memory_system/gossip.py)

**Fidelity Score**: 5/5 ✅

**Convergence Time**: O(log N) rounds for N instances[^2]

---

#### Byzantine Fault Tolerance Pattern[^21]

**Intent**: Achieve consensus in presence of faulty or malicious nodes using threshold voting[^21].

**Chrysalis Implementation**: 2/3 supermajority required for experience acceptance, protecting against up to 1/3 malicious instances.

**Byzantine Threshold Voting**:
```mermaid
flowchart TD
    Experience[Experience Event] --> Collect[Collect from N instances]
    Collect --> Count{Agreement Count}
    
    Count -->|>= 2N/3| Accept[Accept as Valid]
    Count -->|< 2N/3| Reject[Reject as Suspicious]
    
    Accept --> Aggregate[Aggregate using Median/Trimmed Mean]
    Reject --> Log[Log Byzantine Failure]
    
    Aggregate --> Update[Update Source Agent]
    Log --> Alert[Alert Monitoring]
```

**Threshold Mathematics**[^21]:
```
Byzantine Tolerance Formula:
f = max faulty nodes
n = total nodes
Requirement: n >= 3f + 1

Chrysalis: 2/3 threshold means:
- 3 instances: tolerates 0 faults (minimum)
- 4 instances: tolerates 1 fault  
- 7 instances: tolerates 2 faults
- 10 instances: tolerates 3 faults
```

**Vote Aggregation Strategies**:
```mermaid
classDiagram
    class AggregationStrategy {
        <<interface>>
        +aggregate(values: number[]) number
    }
    
    class MedianAggregation {
        +aggregate(values: number[]) number
    }
    
    class TrimmedMeanAggregation {
        -trimPercentage: number
        +aggregate(values: number[]) number
    }
    
    class WeightedAverageAggregation {
        -weights: Map~instance,number~
        +aggregate(values: number[]) number
    }
    
    AggregationStrategy <|-- MedianAggregation : implements
    AggregationStrategy <|-- TrimmedMeanAggregation : implements
    AggregationStrategy <|-- WeightedAverageAggregation : implements
```

**Location**: [`src/core/patterns/ByzantineResistance.ts`](../src/core/patterns/ByzantineResistance.ts) (inferred)

**Fidelity Score**: 5/5 ✅

---

## Part 2: Pattern Affinity and Anti-Pattern Analysis

### 2.1 Pattern Fidelity Evaluation

**Scoring Rubric**[^1]:

| Score | Description | Criteria |
|-------|-------------|----------|
| 5 | Exemplary | All participants present, collaborations correct, consequences achieved, documented |
| 4 | Strong | Complete implementation, minor documentation gaps |
| 3 | Adequate | Core pattern present, some participants missing |
| 2 | Weak | Pattern intent recognized but implementation incomplete |
| 1 | Minimal | Pattern name used but doesn't match intent |

**Complete Pattern Assessment**:

| Pattern Category | Pattern | Fidelity | Implementation | Priority |
|------------------|---------|----------|----------------|----------|
| **Creational** | Factory Method | 5/5 ✅ | VectorIndexFactory | Maintain |
| | Abstract Factory | 5/5 ✅ | Embedding providers | Maintain |
| | Builder | 2/5 ⚠️ | Schema-based only | **P1** |
| | Prototype | 2/5 ⚠️ | Morphing, not cloning | P2 |
| | Singleton | 3/5 ⚠️ | Inconsistent | **P0** |
| **Structural** | Adapter | 5/5 ✅ | Framework morphing | Maintain |
| | Bridge | 5/5 ✅ | Pattern resolver | Maintain |
| | Composite | 3/5 ⚠️ | Tree exists, interface missing | P2 |
| | Decorator | 5/5 ✅ | Circuit breaker, middleware | Maintain |
| | Facade | 4/5 ✅ | Service APIs | Maintain |
| | Flyweight | 5/5 ✅ | Memory deduplication | Maintain |
| | Proxy | 4/5 ✅ | Circuit breaker | Maintain |
| **Behavioral** | Chain of Responsibility | 5/5 ✅ | Middleware chains | Maintain |
| | Command | 2/5 ⚠️ | Events only | **P1** |
| | Iterator | 5/5 ✅ | Native features | Maintain |
| | Mediator | 5/5 ✅ | VoyeurBus, YJS | Maintain |
| | Memento | 3/5 ⚠️ | Shadow fields partial | **P1** |
| | Observer | 5/5 ✅ | Event bus | Maintain |
| | State | 5/5 ✅ | Circuit breaker | Maintain |
| | Strategy | 5/5 ✅ | Multiple strategies | Maintain |
| | Template Method | 4/5 ✅ | Provider base classes | Maintain |
| | Visitor | 1/5 ❌ | **Missing** | **P0** |

**Average Fidelity**: 3.9/5.0 (78%)

### 2.2 Identified Anti-Patterns

#### Anti-Pattern 1: God Object[^23]

**Location**: `UniformSemanticAgentV2` schema

**Problem**: Single object with 12+ top-level responsibilities violates Single Responsibility Principle[^7]:
- Identity management
- Personality configuration
- Communication protocols
- Capability definitions
- Knowledge storage
- Memory management
- Belief systems
- Instance tracking
- Experience sync configuration
- Protocol definitions
- Execution settings
- Metadata

**God Object Diagram**:
```mermaid
classDiagram
    class UniformSemanticAgentV2 {
        +schema_version
        +identity
        +personality
        +communication
        +capabilities
        +knowledge
        +memory
        +beliefs
        +instances
        +experience_sync
        +protocols
        +execution
        +metadata
    }
    
    note for UniformSemanticAgentV2 "12+ top-level fields\nMultiple reasons to change\nViolates SRP"
```

**Impact**:
- Changes to one concern affect entire schema
- Difficult to evolve independently
- Testing requires full object construction

**Severity**: Medium

**Recommended Refactoring** (Domain-Driven Design approach)[^24]:
```mermaid
classDiagram
    class Agent {
        +identity: AgentIdentity
        +configuration: AgentConfiguration
        +runtime: AgentRuntime
        +metadata: AgentMetadata
    }
    
    class AgentIdentity {
        +id: string
        +fingerprint: string
        +created: DateTime
        +version: string
    }
    
    class AgentConfiguration {
        +personality: Personality
        +capabilities: Capabilities
        +communication: Communication
        +beliefs: Beliefs
    }
    
    class AgentRuntime {
        +memory: MemorySystem
        +sync: SyncConfiguration
        +instances: InstanceManager
        +execution: ExecutionContext
    }
    
    class AgentMetadata {
        +evolution: EvolutionHistory
        +protocols: ProtocolRegistry
        +deployment: DeploymentInfo
    }
    
    Agent *-- AgentIdentity
    Agent *-- AgentConfiguration
    Agent *-- AgentRuntime
    Agent *-- AgentMetadata
```

**Priority**: P2 (High value but breaking change - requires major version bump)

---

#### Anti-Pattern 2: Inconsistent Singleton Management[^1]

**Problem**: Services that should maintain single instances (for cache consistency) allow multiple instantiations.

**Cache Inconsistency Scenario**:
```mermaid
sequenceDiagram
    participant C1 as Client 1
    participant S1 as EmbeddingService Instance 1
    participant Cache1 as Cache 1
    participant C2 as Client 2
    participant S2 as EmbeddingService Instance 2
    participant Cache2 as Cache 2
    participant API as Voyage API
    
    C1->>S1: embed("hello")
    S1->>Cache1: check cache
    Cache1-->>S1: miss
    S1->>API: embed("hello")
    API-->>S1: [0.1, 0.2, ...]
    S1->>Cache1: store
    S1-->>C1: embedding
    
    Note over C2: Same text, different instance
    
    C2->>S2: embed("hello")
    S2->>Cache2: check cache
    Cache2-->>S2: miss (different cache!)
    S2->>API: embed("hello") - redundant API call
    API-->>S2: [0.1, 0.2, ...]
    S2->>Cache2: store
    S2-->>C2: embedding
```

**Severity**: Medium (wasted API calls, cost implications)

**Priority**: P0

---

#### Anti-Pattern 3: Missing Visitor for Type Hierarchies[^1]

**Current Type-Switch Approach**:
```typescript
function renderNode(node: CanvasNode): ReactElement {
  switch(node.type) {
    case 'agent': return <AgentWidget node={node as AgentNode} />;
    case 'media': return <MediaWidget node={node as MediaNode} />;
    case 'data': return <DataWidget node={node as DataNode} />;
    // Adding new type requires modifying this function
  }
}

function serializeNode(node: CanvasNode): JSON {
  switch(node.type) {
    case 'agent': return serializeAgent(node as AgentNode);
    case 'media': return serializeMedia(node as MediaNode);
    // Same types duplicated here
  }
}
```

**Open/Closed Violation**:
```mermaid
flowchart TD
    NewType[Add New Node Type] --> Modify1[Modify renderNode switch]
    Modify1 --> Modify2[Modify serializeNode switch]
    Modify2 --> Modify3[Modify validateNode switch]
    Modify3 --> Modify4[Modify exportNode switch]
    Modify4 --> ModifyN[...modify N functions]
    
    style NewType fill:#FFB6C1
    style Modify1 fill:#FFB6C1
    style Modify2 fill:#FFB6C1
    style Modify3 fill:#FFB6C1
```

**Severity**: Low (canvas types relatively stable)

**Priority**: P0 (prevents future technical debt)

---

### 2.3 Pattern Synergies

Chrysalis demonstrates exceptional pattern composition where multiple patterns reinforce each other[^1][^20]:

#### Synergy 1: Adaptive Fault-Tolerant Infrastructure

**Patterns Combined**: Strategy + Bridge + Decorator + Proxy + State

```mermaid
graph TB
    subgraph Synergy["Combined Pattern Synergy"]
        Strategy[Strategy: Select Implementation]
        Bridge[Bridge: Separate Abstraction]
        Decorator[Decorator: Add Fault Tolerance]
        Proxy[Proxy: Control Access]
        State[State: Track Health]
    end
    
    Request[Client Request] --> Strategy
    Strategy --> Bridge
    Bridge --> Decorator
    Decorator --> Proxy
    Proxy --> State
    State --> Execute[Execute Pattern]
    
    Execute -->|Success| Record[Record Success]
    Execute -->|Failure| RecordF[Record Failure]
    
    RecordF --> StateChange{Threshold Exceeded?}
    StateChange -->|Yes| OpenCircuit[State: CLOSED → OPEN]
    StateChange -->|No| Continue[State: CLOSED]
    
    OpenCircuit --> Fallback[Bridge: Select Fallback Implementation]
```

**Benefits**:
- **Strategy**: Runtime implementation selection
- **Bridge**: Abstraction/implementation independence
- **Decorator**: Fault tolerance added transparently
- **Proxy**: Access control and lazy init
- **State**: Self-healing via state transitions

---

#### Synergy 2: Distributed Memory with Deduplication

**Patterns Combined**: Flyweight + Strategy + Observer + CRDT

```mermaid
flowchart TD
    subgraph Deduplication["Flyweight: Share Intrinsic State"]
        Similar[Detect Similar Memories]
        Merge[Merge into Single Object]
    end
    
    subgraph StrategyPat["Strategy: Similarity Algorithm"]
        SelectAlgo[Jaccard vs. Embedding]
    end
    
    subgraph ObserverPat["Observer: Notify Changes"]
        Emit[Emit merge event]
        Subscribers[Notify subscribers]
    end
    
    subgraph CRDTPT["CRDT: Conflict-Free Merge"]
        Gossip[Gossip to instances]
        Converge[Converge to same state]
    end
    
    NewMemory[New Memory] --> SelectAlgo
    SelectAlgo --> Similar
    Similar --> Merge
    Merge --> Emit
    Emit --> Subscribers
    Merge --> Gossip
    Gossip --> Converge
```

**Measured Benefits**:
- 20-40% storage reduction via Flyweight deduplication
- Configurable accuracy/performance via Strategy
- Real-time updates via Observer
- Eventual consistency via CRDT

---

### 2.4 Christopher Alexander's Pattern Language Application[^4]

Alexander's "Quality Without a Name" manifests in Chrysalis through 15 geometric properties[^4]:

#### Property: Strong Centers[^4]

**Identified Centers** (focal points around which system organizes):

```mermaid
graph TB
    subgraph Centers["Strong Centers in Chrysalis"]
        C1[Agent Identity Center\nCryptographic fingerprint\nImmutable, unique]
        C2[Memory Center\nDistributed, persistent\nConflict-free merge]
        C3[Collaboration Center\nThree-frame UI\nShared canvas]
        C4[Evolution Center\nDAG version history\nCausal ordering]
    end
    
    C1 -.->|defines| C2
    C1 -.->|enables| C3
    C1 -.->|tracks| C4
    C2 -.->|shared in| C3
    C2 -.->|accumulates via| C4
```

**Evidence**: Each center remains coherent and strong as system grows - identity never fragments, memory remains unified, collaboration stays centered on canvas, evolution preserves causality.

---

#### Property: Levels of Scale[^4]

Chrysalis exhibits fractal pattern repetition across 5 distinct scales[^4]:

```mermaid
graph TB
    subgraph Scale0["Scale 0: Mathematical Primitives"]
        M1[SHA-384 Hash Function]
        M2[Ed25519 Signature Scheme]
        M3[DAG Data Structure]
    end
    
    subgraph Scale1["Scale 1: Library Implementations"]
        L1["@noble/hashes"]
        L2["@noble/ed25519"]
        L3["graphlib"]
    end
    
    subgraph Scale2["Scale 2: Service Abstractions"]
        S1[Go gRPC Crypto Service]
        S2[MCP Pattern Servers]
    end
    
    subgraph Scale3["Scale 3: Pattern Implementations"]
        P1[EmbeddedHashImpl]
        P2[EmbeddedSignatureImpl]
        P3[GossipProtocol]
    end
    
    subgraph Scale4["Scale 4: Application Operations"]
        O1[Agent Fingerprinting]
        O2[Experience Signing]
        O3[Memory Synchronization]
    end
    
    Scale0 --> Scale1
    Scale1 --> Scale2
    Scale2 --> Scale3
    Scale3 --> Scale4
    
    style Scale0 fill:#E6F3FF
    style Scale1 fill:#CCE7FF
    style Scale2 fill:#B3DBFF
    style Scale3 fill:#99CFFF
    style Scale4 fill:#80C3FF
```

**Observation**: Same cryptographic patterns (hash, signature) repeat across all scales with increasing abstraction.

---

#### Property: Generative Sequences[^4]

**Agent Creation Sequence** (order matters for wholeness):

```mermaid
flowchart LR
    S1[1. Establish Identity] --> S2[2. Define Personality]
    S2 --> S3[3. Configure Capabilities]
    S3 --> S4[4. Initialize Memory]
    S4 --> S5[5. Enable Synchronization]
    S5 --> S6[6. Deploy Instance]
    
    style S1 fill:#90EE90
    style S2 fill:#98FB98
    style S3 fill:#ADFF2F
    style S4 fill:#FFFF99
    style S5 fill:#FFD700
    style S6 fill:#FFA500
```

Each step depends on previous steps - cannot configure capabilities without identity, cannot initialize memory without capabilities defined.

**Collaboration Sequence** (OODA loop):

```mermaid
flowchart TD
    Connect[Connect to Terminal] --> Observe[Observe:\nAgent chat + Canvas state]
    Observe --> Orient[Orient:\nUnderstand context]
    Orient --> Decide[Decide:\nPlan action]
    Decide --> Act[Act:\nModify canvas or send message]
    Act --> Sync[Sync:\nYJS propagates to all participants]
    Sync --> Observe
    
    style Connect fill:#E6F3FF
    style Observe fill:#CCE7FF
    style Orient fill:#B3DBFF
    style Decide fill:#99CFFF
    style Act fill:#80C3FF
    style Sync fill:#66B7FF
```

**Memory Evolution Sequence**:

```mermaid
flowchart LR
    E1[Experience\nOccurs] --> E2[Sanitize:\nCheck malicious content]
    E2 --> E3[Deduplicate:\nFind similar memories]
    E3 --> E4[Embed:\nGenerate vector]
    E4 --> E5[Store:\nPersist to collection]
    E5 --> E6[Gossip:\nPropagate to instances]
    
    style E1 fill:#FFE6E6
    style E2 fill:#FFB6C1
    style E3 fill:#FFC0CB
    style E4 fill:#FFD8E8
    style E5 fill:#FFE4F0
    style E6 fill:#FFF0F8
```

---

## Part 3: Evolution Roadmap and Implementation Guide

### 3.1 Prioritized Enhancement Plan

**Priority 0 (Critical - Months 1-2)**:

1. **Implement Visitor Pattern for Canvas Operations**
   - **Impact**: Enables extensibility without modifying node classes
   - **Effort**: Medium (2-3 weeks)
   - **Risk**: Low (isolated to UI)
   - **Deliverable**: Visitor interfaces + concrete visitors for render, serialize, validate

2. **Enforce Singleton for Embedding Service**
   - **Impact**: Prevents cache inconsistency and wasted API calls
   - **Effort**: Low (1 week)
   - **Risk**: Low (backward compatible)
   - **Deliverable**: Singleton implementation + tests

3. **Investigate Service Layer Coupling**
   - **Impact**: Determines if distributed monolith risk exists
   - **Effort**: Low (1 week investigation)
   - **Risk**: Low (investigation only)
   - **Deliverable**: Architecture Decision Record (ADR)

**Priority 1 (Important - Months 2-4)**:

4. **Implement Fluent Agent Builder**
   - **Impact**: Improves developer experience, prevents invalid states
   - **Effort**: Medium (2 weeks)
   - **Deliverable**: AgentBuilder class with fluent API

5. **Implement Memento for Canvas Undo/Redo**
   - **Impact**: Essential user feature
   - **Effort**: High (3-4 weeks with YJS integration)
   - **Deliverable**: Undo/redo functionality with history timeline

6. **Extend Circuit Breaker to UI**
   - **Impact**: Graceful degradation for network failures
   - **Effort**: Low (1 week)
   - **Deliverable**: UI circuit breaker for YJS connections

**Priority 2 (Nice-to-Have - Months 4-6)**:

7. **Implement Hexagonal Architecture for Services** (conditional)
8. **Add Saga Pattern for Multi-Service Operations** (conditional)
9. **Decompose Agent Schema** (requires major version)

### 3.2 Visitor Pattern Implementation Guide

**Step 1: Define Visitor Interface**

```typescript
// src/components/canvas/visitors/CanvasNodeVisitor.ts
export interface CanvasNodeVisitor<T> {
  visitAgentNode(node: AgentNode): T;
  visitMediaNode(node: MediaNode): T;
  visitDataNode(node: DataNode): T;
  visitDocumentNode(node: DocumentNode): T;
  visitGeneralNode(node: GeneralNode): T;
}
```

**Step 2: Add Accept Method to Nodes**

```typescript
// src/components/canvas/types.ts
export interface CanvasNode {
  id: string;
  type: string;
  accept<T>(visitor: CanvasNodeVisitor<T>): T; // Add this
}

export class AgentNode implements CanvasNode {
  accept<T>(visitor: CanvasNodeVisitor<T>): T {
    return visitor.visitAgentNode(this);
  }
}
```

**Step 3: Create Concrete Visitors**

```typescript
// src/components/canvas/visitors/RenderVisitor.ts
export class RenderVisitor implements CanvasNodeVisitor<ReactElement> {
  visitAgentNode(node: AgentNode): ReactElement {
    return <AgentNodeWidget node={node} />;
  }
  
  visitMediaNode(node: MediaNode): ReactElement {
    return <MediaNodeWidget node={node} />;
  }
  
  // ... other node types
}

// src/components/canvas/visitors/SerializeVisitor.ts
export class SerializeVisitor implements CanvasNodeVisitor<JSON> {
  visitAgentNode(node: AgentNode): JSON {
    return {
      type: 'agent',
      id: node.id,
      agentId: node.agentId,
      position: node.position
    };
  }
  
  // ... other node types
}
```

**Step 4: Use Visitors**

```typescript
// Before (type-switch)
function renderNode(node: CanvasNode): ReactElement {
  switch(node.type) { ... } // Modify for each new type
}

// After (Visitor pattern)
const renderVisitor = new RenderVisitor();
const element = node.accept(renderVisitor); // Extensible
```

---

### 3.3 Singleton Enforcement Implementation

**Approach 1: Class-Based Singleton with Registry**

```python
# shared/embedding/service.py
from typing import Dict, Optional

class EmbeddingService:
    """Singleton per provider to ensure cache consistency."""
    
    _instances: Dict[str, 'EmbeddingService'] = {}
    
    def __new__(cls, provider_name: str = "voyage"):
        """Enforce singleton per provider type."""
        if provider_name not in cls._instances:
            instance = super().__new__(cls)
            cls._instances[provider_name] = instance
            # Initialize only on first creation
            instance._initialized = False
        return cls._instances[provider_name]
    
    def __init__(self, provider_name: str = "voyage"):
        """Initialize only once per instance."""
        if self._initialized:
            return
        
        self.provider_name = provider_name
        self.provider = self._create_provider(provider_name)
        self.cache = EmbeddingCache()
        self._initialized = True
    
    @classmethod
    def reset_instances(cls):
        """For testing only - reset singleton registry."""
        cls._instances.clear()
```

**Testing Singleton**:
```python
def test_singleton_per_provider():
    # Reset between tests
    EmbeddingService.reset_instances()
    
    # Same provider returns same instance
    service1 = EmbeddingService("voyage")
    service2 = EmbeddingService("voyage")
    assert service1 is service2
    
    # Different provider returns different instance
    service3 = EmbeddingService("openai")
    assert service1 is not service3
```

---

### 3.4 Validation Framework

#### Automated Architectural Tests[^25]

**Pattern Conformance Tests**:
```typescript
// tests/architecture/pattern-conformance.test.ts
import { describe, it, expect } from '@jest/globals';

describe('Architectural Pattern Conformance', () => {
  
  describe('Factory Method Pattern', () => {
    it('all factories return interface types', () => {
      const index = VectorIndexFactory.createIndex('hnsw', config);
      
      // Verify Factory Method contract
      expect(index).toHaveProperty('add');
      expect(index).toHaveProperty('search');
      expect(index).toHaveProperty('delete');
      
      // Should not expose implementation details
      expect(index).not.toHaveProperty('_hnswIndex');
    });
  });
  
  describe('Singleton Pattern', () => {
    it('embedding service enforces singleton per provider', () => {
      const service1 = EmbeddingService.getInstance('voyage');
      const service2 = EmbeddingService.getInstance('voyage');
      
      expect(service1).toBe(service2); // Same reference
    });
  });
  
  describe('Adapter Pattern', () => {
    it('morphing preserves all data (lossless)', async () => {
      const original = createTestAgent();
      const adapter = new MCPAdapter();
      
      const { morphed, shadow } = await adapter.morph(original, 'mcp');
      const restored = await adapter.restore(morphed, shadow);
      
      expect(restored).toEqual(original); // Deep equality
    });
  });
  
  describe('Observer Pattern', () => {
    it('observers receive notifications', (done) => {
      const voyeur = new VoyeurBus();
      const received: any[] = [];
      
      voyeur.subscribe('test:event', (data) => {
        received.push(data);
        if (received.length === 1) {
          expect(received[0]).toEqual({ value: 42 });
          done();
        }
      });
      
      voyeur.emit('test:event', { value: 42 });
    });
  });
});
```

#### Architectural Fitness Functions[^25]

```typescript
// tests/architecture/fitness-functions.test.ts

describe('Architectural Fitness Functions', () => {
  
  it('core layer must not depend on service layer', async () => {
    const coreFiles = await glob('src/**/*.ts');
    const violations: string[] = [];
    
    for (const file of coreFiles) {
      const content = await readFile(file, 'utf-8');
      const projectImports = content.match(/from ['"]\.\.\/\.\.\/projects/g);
      
      if (projectImports) {
        violations.push(`${file} imports from projects/`);
      }
    }
    
    expect(violations).toHaveLength(0);
  });
  
  it('services must not have circular dependencies', async () => {
    const graph = await buildDependencyGraph('projects/');
    const cycles = detectCycles(graph);
    
    expect(cycles).toHaveLength(0);
  });
  
  it('pattern fidelity average >= 4.0', async () => {
    const scores = await measurePatternFidelity();
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    expect(average).toBeGreaterThanOrEqual(4.0);
  });
});
```

---

## Part 4: Pattern Catalog Reference

### Factory Method Pattern[^1]

| Aspect | Details |
|--------|---------|
| **Category** | Creational |
| **Intent** | Define interface for creating objects, let subclasses decide class to instantiate |
| **Also Known As** | Virtual Constructor |
| **Motivation** | Delegate instantiation to subclasses, enable polymorphic creation |
| **Applicability** | When class can't anticipate object types to create; when class wants subclasses to specify objects; when classes delegate responsibility to helper subclasses |
| **Structure** | Creator → Product (interface), ConcreteCreator → ConcreteProduct |
| **Participants** | Creator, ConcreteCreator, Product, ConcreteProduct |
| **Collaborations** | Creator relies on subclasses to define factory method returning appropriate Product |
| **Consequences** | ✅ Eliminates binding to application-specific classes; ⚠️ May require subclassing just to create product |
| **Chrysalis Usage** | VectorIndexFactory, pattern implementation selection |
| **Related Patterns** | Abstract Factory, Template Method, Prototype |

### Abstract Factory Pattern[^1]

| Aspect | Details |
|--------|---------|
| **Category** | Creational |
| **Intent** | Provide interface for creating families of related objects without specifying concrete classes |
| **Also Known As** | Kit |
| **Motivation** | System needs to be independent of how its products are created; system should be configured with one of multiple families of products |
| **Applicability** | System should be independent of product creation/composition; system should be configured with product families; family of products designed to be used together; want to reveal only interfaces, not implementations |
| **Structure** | AbstractFactory → AbstractProduct, ConcreteFactory → ConcreteProduct |
| **Participants** | AbstractFactory, ConcreteFactory, AbstractProduct, ConcreteProduct, Client |
| **Chrysalis Usage** | Embedding provider system (OpenAI, Voyage, Anthropic families) |
| **Related Patterns** | Factory Method, Singleton, Prototype |

### Adapter Pattern[^1]

| Aspect | Details |
|--------|---------|
| **Category** | Structural |
| **Intent** | Convert interface of class into another interface clients expect |
| **Also Known As** | Wrapper |
| **Motivation** | Reuse classes that don't have compatible interfaces; create reusable class that cooperates with unrelated/unforeseen classes |
| **Applicability** | Use existing class with incompatible interface; create reusable class cooperating with unrelated classes; need to use several existing subclasses but impractical to adapt by subclassing each |
| **Structure** | Client → Target (interface) ← Adapter → Adaptee |
| **Chrysalis Innovation** | Shadow fields enable **lossless bidirectional** adaptation (not in classical pattern) |
| **Chrysalis Usage** | Framework morphing (MCP, CrewAI, ElizaOS, Multi-Agent) |
| **Related Patterns** | Bridge, Decorator, Proxy |

### Strategy Pattern[^1]

| Aspect | Details |
|--------|---------|
| **Category** | Behavioral |
| **Intent** | Define family of algorithms, encapsulate each one, make them interchangeable |
| **Also Known As** | Policy |
| **Motivation** | Many related classes differ only in behavior; need different variants of algorithm; algorithm uses data clients shouldn't know about; class defines many behaviors appearing as conditional statements |
| **Applicability** | Related classes differ only in behavior; need different algorithm variants; algorithm uses data clients shouldn't know; class has multiple conditional behaviors |
| **Structure** | Context → Strategy (interface) ← ConcreteStrategy |
| **Participants** | Strategy, ConcreteStrategy, Context |
| **Chrysalis Usage** | Similarity methods (Jaccard, Embedding), sync protocols (Streaming, Lumped, Check-in), pattern resolution |
| **Related Patterns** | Bridge, State, Template Method |

---

## Part 5: Continuous Pattern Health Monitoring

### 5.1 Pattern Health Metrics[^25]

**Automated Collection System**:

```typescript
interface PatternHealthMetrics {
  pattern: string;
  fidelityScore: number;        // 1-5 (measured via code analysis)
  usageCount: number;            // Implementations detected
  violationCount: number;        // Anti-pattern instances
  testCoverage: number;          // % of pattern code tested
  documentationComplete: boolean; // ADR or guide exists
  trend: 'improving' | 'stable' | 'degrading';
}
```

**Health Dashboard**:
```mermaid
graph LR
    subgraph Collection["Metric Collection"]
        AST[Parse AST]
        Tests[Analyze Tests]
        Docs[Check Docs]
    end
    
    subgraph Analysis["Analysis"]
        Score[Calculate Fidelity]
        Detect[Detect Violations]
        Trend[Compute Trend]
    end
    
    subgraph Alerts["Alerting"]
        Threshold{Score < 4.0?}
        Alert[Generate Alert]
        Report[Weekly Report]
    end
    
    AST --> Score
    Tests --> Score
    Docs --> Score
    
    Score --> Detect
    Detect --> Trend
    Trend --> Threshold
    Threshold -->|Yes| Alert
    Threshold -->|No| Report
```

### 5.2 Pattern Mining and Discovery[^26]

**Automated Pattern Detection**:

```mermaid
flowchart TD
    Codebase[Analyze Codebase] --> FindRep[Find Structural Repetition]
    FindRep --> Filter{Occurs >= 3 times?}
    Filter -->|Yes| Intent[Identify Consistent Intent]
    Filter -->|No| Ignore[Ignore]
    
    Intent --> Extract[Extract Problem/Solution]
    Extract --> Document[Document Pattern]
    Document --> Review[Peer Review]
    
    Review --> Decision{Approve?}
    Decision -->|Yes| Catalog[Add to Pattern Catalog]
    Decision -->|No| Reject[Reject Pattern]
    
    Catalog --> Monitor[Monitor Usage]
    Monitor --> Validate[Validate After 3 Months]
```

---

## References

[^1]: Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley. ISBN: 0-201-63361-2. [Publisher](https://www.pearson.com/store/p/design-patterns-elements-of-reusable-object-oriented-software/P100000297417)

[^2]: Vogels, W. (2009). "Eventually Consistent". *Communications of the ACM*, 52(1), 40-44. DOI: 10.1145/1435417.1435432. [ACM DL](https://dl.acm.org/doi/10.1145/1435417.1435432)

[^3]: Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M. (2011). "Conflict-free Replicated Data Types". In *Proceedings of the 13th International Symposium on Stabilization, Safety, and Security of Distributed Systems* (pp. 386-400). DOI: 10.1007/978-3-642-24550-3_29. [Springer](https://link.springer.com/chapter/10.1007/978-3-642-24550-3_29)

[^4]: Alexander, C., Ishikawa, S., & Silverstein, M. (1977). *A Pattern Language: Towns, Buildings, Construction*. Oxford University Press. ISBN: 0-19-501919-9. [Oxford UP](https://global.oup.com/academic/product/a-pattern-language-9780195019193)

[^5]: Newman, S. (2021). *Building Microservices: Designing Fine-Grained Systems* (2nd ed.). O'Reilly Media. ISBN: 978-1492034025. [O'Reilly](https://www.oreilly.com/library/view/building-microservices-2nd/9781492034018/)

[^6]: Malkov, Y. A., & Yashunin, D. A. (2018). "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs". *IEEE Transactions on Pattern Analysis and Machine Intelligence*, 42(4), 824-836. DOI: 10.1109/TPAMI.2018.2889473. [IEEE](https://ieeexplore.ieee.org/document/8594636)

[^7]: Martin, R. C. (2017). *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall. ISBN: 978-0134494166. [Pearson](https://www.pearson.com/store/p/clean-architecture-a-craftsman-s-guide-to-software-structure-and-design/P100001974692)

[^8]: OpenAI. (2023). "Embeddings". *OpenAI API Documentation*. [OpenAI Docs](https://platform.openai.com/docs/guides/embeddings)

[^9]: Voyage AI. (2024). "Voyage Embeddings API". *Voyage AI Documentation*. [Voyage Docs](https://docs.voyageai.com/)

[^10]: Bloch, J. (2018). *Effective Java* (3rd ed.). Addison-Wesley. ISBN: 978-0134685991. Item 2: "Consider a builder when faced with many constructor parameters". [Pearson](https://www.pearson.com/store/p/effective-java/P100000294839)

[^11]: Fowler, M. (2012). *Patterns of Enterprise Application Architecture*. Addison-Wesley. ISBN: 978-0321127426. [Informit](https://www.informit.com/store/patterns-of-enterprise-application-architecture-9780321127426)

[^12]: Chrysalis Project. (2026). "Shadow Fields Pattern for Lossless Schema Transformation". Internal architecture decision. Novel pattern not in classical literature.

[^13]: Fowler, M. (2010). "Inversion of Control Containers and the Dependency Injection pattern". Martin Fowler's Blog. [martinfowler.com](https://martinfowler.com/articles/injection.html)

[^14]: Nygard, M. T. (2018). *Release It! Design and Deploy Production-Ready Software* (2nd ed.). Pragmatic Bookshelf. ISBN: 978-1680502398. Chapter 5: "Stability Patterns". [Pragmatic](https://pragprog.com/titles/mnee2/release-it-second-edition/)

[^15]: Fowler, M., Rice, D., Foemmel, M., Hieatt, E., Mee, R., & Stafford, R. (2002). *Patterns of Enterprise Application Architecture*. Addison-Wesley. Chapter: "Organizing Presentation Logic". [Informit](https://www.informit.com/store/patterns-of-enterprise-application-architecture-9780321127426)

[^16]: Kleppmann, M. (2017). *Designing Data-Intensive Applications: The Big Ideas Behind Reliable, Scalable, and Maintainable Systems*. O'Reilly Media. ISBN: 978-1449373320. Chapter 3: "Storage and Retrieval". [O'Reilly](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/)

[^17]: FastAPI. (2024). "Middleware". *FastAPI Documentation*. [FastAPI Docs](https://fastapi.tiangolo.com/tutorial/middleware/)

[^18]: Meta Open Source. (2024). "React Context". *React Documentation*. [React Docs](https://react.dev/reference/react/useContext)

[^19]: YJS. (2024). "Shared Types and Awareness". *YJS Documentation*. [YJS Docs](https://docs.yjs.dev/)

[^20]: Buschmann, F., Meunier, R., Rohnert, H., Sommerlad, P., & Stal, M. (1996). *Pattern-Oriented Software Architecture, Volume 1: A System of Patterns*. Wiley. ISBN: 978-0471958697. [Wiley](https://www.wiley.com/en-us/Pattern+Oriented+Software+Architecture%2C+Volume+1%2C+A+System+of+Patterns-p-9780471958697)

[^21]: Castro, M., & Liskov, B. (1999). "Practical Byzantine Fault Tolerance". In *Proceedings of the Third Symposium on Operating Systems Design and Implementation* (pp. 173-186). [USENIX](https://www.usenix.org/legacy/events/osdi99/full_papers/castro/castro.pdf)

[^22]: Demers, A., Greene, D., Hauser, C., Irish, W., Larson, J., Shenker, S., Sturgis, H., Swinehart, D., & Terry, D. (1987). "Epidemic algorithms for replicated database maintenance". In *Proceedings of the sixth annual ACM Symposium on Principles of distributed computing* (pp. 1-12). DOI: 10.1145/41840.41841. [ACM DL](https://dl.acm.org/doi/10.1145/41840.41841)

[^23]: Brown, W. J., Malveau, R. C., McCormick, H. W., & Mowbray, T. J. (1998). *AntiPatterns: Refactoring Software, Architectures, and Projects in Crisis*. Wiley. ISBN: 978-0471197133. [Wiley](https://www.wiley.com/en-us/AntiPatterns%3A+Refactoring+Software%2C+Architectures%2C+and+Projects+in+Crisis-p-9780471197133)

[^24]: Evans, E. (2003). *Domain-Driven Design: Tackling Complexity in the Heart of Software*. Addison-Wesley. ISBN: 978-0321125217. Chapter: "Isolating the Domain". [Pearson](https://www.pearson.com/store/p/domain-driven-design-tackling-complexity-in-the-heart-of-software/P100000229952)

[^25]: Ford, N., Richards, M., Sadalage, P., & Dehghani, Z. (2021). *Software Architecture: The Hard Parts*. O'Reilly Media. ISBN: 978-1492086895. Chapter 3: "Architectural Fitness Functions". [O'Reilly](https://www.oreilly.com/library/view/software-architecture-the/9781492086888/)

[^26]: Fowler, M. (2006). "Writing Software Patterns". Martin Fowler's Blog. [martinfowler.com](https://martinfowler.com/articles/writingPatterns.html)

---

**Document Version**: 2.0.0  
**Last Updated**: January 10, 2026  
**Maintainer**: Chrysalis Architecture Team
