# Chrysalis C4 Architecture Diagrams

**Version**: 1.0.0  
**Date**: 2026-01-11  
**Status**: Current

---

## Table of Contents

1. [Overview](#overview)
2. [Level 1: System Context](#level-1-system-context)
3. [Level 2: Container Diagram](#level-2-container-diagram)
4. [Level 3: Component Diagrams](#level-3-component-diagrams)
5. [Level 4: Code Diagrams](#level-4-code-diagrams)
6. [Deployment Diagrams](#deployment-diagrams)
7. [Sequence Diagrams](#sequence-diagrams)

---

## Overview

This document provides C4 architecture diagrams for the Chrysalis system following the [C4 model](https://c4model.com/) by Simon Brown. The C4 model provides a hierarchical set of software architecture diagrams for different audiences:

- **Level 1 (Context)**: System context and external dependencies
- **Level 2 (Containers)**: High-level technology choices and communication
- **Level 3 (Components)**: Components within containers
- **Level 4 (Code)**: Implementation details (optional)

### Diagram Legend

```mermaid
graph LR
    Person[Person/Actor]:::person
    System[Software System]:::system
    Container[Container]:::container
    Component[Component]:::component
    External[External System]:::external
    
    classDef person fill:#08427b,stroke:#052e56,color:#fff
    classDef system fill:#1168bd,stroke:#0b4884,color:#fff
    classDef container fill:#438dd5,stroke:#2e6295,color:#fff
    classDef component fill:#85bbf0,stroke:#5d82a8,color:#000
    classDef external fill:#999,stroke:#666,color:#fff
```

---

## Level 1: System Context

### System Context Diagram

Shows how Chrysalis fits into the world around it - who uses it and what systems it integrates with.

```mermaid
graph TB
    Developer[Developer]:::person
    AIAgent[AI Agent Instance]:::person
    Admin[System Administrator]:::person
    
    Chrysalis[Chrysalis Platform<br/>AI Agent Lifecycle Management]:::system
    
    LLMProviders[LLM Providers<br/>OpenAI, Anthropic, etc.]:::external
    VectorDB[Vector Databases<br/>LanceDB, HNSW]:::external
    EmbeddingAPI[Embedding Services<br/>Voyage AI, OpenAI]:::external
    Monitoring[Monitoring Systems<br/>Prometheus, OpenTelemetry]:::external
    MCPServers[MCP Servers<br/>External Tools]:::external
    
    Developer -->|Creates & manages agents| Chrysalis
    AIAgent -->|Syncs experiences| Chrysalis
    Admin -->|Monitors & configures| Chrysalis
    
    Chrysalis -->|Generates embeddings| EmbeddingAPI
    Chrysalis -->|Stores vectors| VectorDB
    Chrysalis -->|Calls LLMs| LLMProviders
    Chrysalis -->|Exports metrics| Monitoring
    Chrysalis -->|Invokes tools| MCPServers
    
    classDef person fill:#08427b,stroke:#052e56,color:#fff
    classDef system fill:#1168bd,stroke:#0b4884,color:#fff
    classDef external fill:#999,stroke:#666,color:#fff
```

### Key Relationships

| Actor/System | Relationship | Description |
|--------------|--------------|-------------|
| **Developer** | Creates agents | Defines agent schemas, skills, knowledge, and personality |
| **AI Agent Instance** | Syncs experiences | Deployed instances send back learned experiences |
| **System Administrator** | Monitors system | Tracks health, performance, and resource usage |
| **LLM Providers** | Provides intelligence | OpenAI, Anthropic for reasoning and generation |
| **Embedding Services** | Generates vectors | Voyage AI, OpenAI for semantic embeddings |
| **Vector Databases** | Stores memories | LanceDB, HNSW for similarity search |
| **Monitoring Systems** | Collects telemetry | Prometheus, OpenTelemetry for observability |
| **MCP Servers** | Extends capabilities | External tools and services via MCP protocol |

---

## Level 2: Container Diagram

### Container Overview

Shows the high-level technology choices and how containers communicate.

```mermaid
graph TB
    subgraph "Chrysalis Platform"
        subgraph "Core Services"
            AgentBuilder[AgentBuilder Service<br/>Flask/Python<br/>Port 5000]:::container
            SkillBuilder[SkillBuilder Service<br/>Flask/Python<br/>Port 5001]:::container
            KnowledgeBuilder[KnowledgeBuilder Service<br/>Flask/Python<br/>Port 5002]:::container
        end
        
        subgraph "Agent Runtime"
            AgentCore[Agent Core<br/>TypeScript/Node.js]:::container
            MemorySystem[Memory System<br/>Python]:::container
            SyncManager[Experience Sync Manager<br/>TypeScript]:::container
        end
        
        subgraph "Shared Infrastructure"
            APICore[Shared API Core<br/>Python]:::container
            EmbeddingService[Embedding Service<br/>Python]:::container
            PatternResolver[Pattern Resolver<br/>TypeScript]:::container
        end
        
        subgraph "Observability"
            VoyeurBus[Voyeur Event Bus<br/>TypeScript]:::container
            MetricsSink[Metrics Sink<br/>TypeScript]:::container
        end
        
        subgraph "External Services"
            CryptoService[Crypto Service<br/>Go gRPC]:::container
        end
    end
    
    subgraph "Data Storage"
        VectorStore[(Vector Store<br/>LanceDB)]:::database
        MemoryCache[(Memory Cache<br/>In-Memory)]:::database
    end
    
    subgraph "External Systems"
        VoyageAPI[Voyage AI API]:::external
        OpenAIAPI[OpenAI API]:::external
        AnthropicAPI[Anthropic API]:::external
        PrometheusDB[(Prometheus)]:::external
    end
    
    AgentBuilder -->|Orchestrates| SkillBuilder
    AgentBuilder -->|Orchestrates| KnowledgeBuilder
    AgentBuilder -->|Uses| APICore
    SkillBuilder -->|Uses| APICore
    KnowledgeBuilder -->|Uses| APICore
    
    AgentCore -->|Manages| MemorySystem
    AgentCore -->|Uses| SyncManager
    AgentCore -->|Resolves patterns| PatternResolver
    
    MemorySystem -->|Generates embeddings| EmbeddingService
    MemorySystem -->|Stores vectors| VectorStore
    MemorySystem -->|Caches| MemoryCache
    
    SyncManager -->|Emits events| VoyeurBus
    VoyeurBus -->|Publishes metrics| MetricsSink
    MetricsSink -->|Exports| PrometheusDB
    
    PatternResolver -->|Calls| CryptoService
    
    EmbeddingService -->|HTTP/REST| VoyageAPI
    EmbeddingService -->|HTTP/REST| OpenAIAPI
    SkillBuilder -->|HTTP/REST| AnthropicAPI
    KnowledgeBuilder -->|HTTP/REST| OpenAIAPI
    
    classDef container fill:#438dd5,stroke:#2e6295,color:#fff
    classDef database fill:#85bbf0,stroke:#5d82a8,color:#000
    classDef external fill:#999,stroke:#666,color:#fff
```

### Container Responsibilities

| Container | Technology | Port | Responsibility |
|-----------|-----------|------|----------------|
| **AgentBuilder** | Flask/Python | 5000 | Orchestrates agent creation, coordinates KnowledgeBuilder and SkillBuilder |
| **SkillBuilder** | Flask/Python | 5001 | Generates agent skills from occupation and corpus text |
| **KnowledgeBuilder** | Flask/Python | 5002 | Collects and structures knowledge about entities |
| **Agent Core** | TypeScript/Node.js | - | Agent schema, validation, morphing between frameworks |
| **Memory System** | Python | - | Episodic and semantic memory with deduplication |
| **Experience Sync Manager** | TypeScript | - | Synchronizes experiences from deployed instances |
| **Shared API Core** | Python | - | Unified API patterns, auth, validation, error handling |
| **Embedding Service** | Python | - | Abstraction over embedding providers (Voyage, OpenAI) |
| **Pattern Resolver** | TypeScript | - | Adaptive pattern implementation selection |
| **Voyeur Event Bus** | TypeScript | - | Observability event streaming |
| **Metrics Sink** | TypeScript | - | Metrics collection and export |
| **Crypto Service** | Go gRPC | 50051 | Cryptographic operations (hashing, signatures) |

### Communication Protocols

| From | To | Protocol | Purpose |
|------|-----|----------|---------|
| AgentBuilder | SkillBuilder | HTTP/REST | Request skill generation |
| AgentBuilder | KnowledgeBuilder | HTTP/REST | Request knowledge collection |
| All Services | Shared API Core | Library Import | Unified API patterns |
| Memory System | Embedding Service | Function Call | Generate embeddings |
| Memory System | Vector Store | Native API | Store/query vectors |
| Pattern Resolver | Crypto Service | gRPC | Cryptographic operations |
| All Components | Voyeur Bus | Event Emission | Observability events |
| Metrics Sink | Prometheus | HTTP/Metrics | Export metrics |
| Embedding Service | Voyage/OpenAI | HTTP/REST | Generate embeddings |

---

## Level 3: Component Diagrams

### AgentBuilder Service Components

```mermaid
graph TB
    subgraph "AgentBuilder Service"
        API[REST API Layer]:::component
        Orchestrator[Agent Orchestrator]:::component
        Validator[Schema Validator]:::component
        Storage[Agent Storage]:::component
        
        API --> Orchestrator
        API --> Validator
        Orchestrator --> Storage
        Orchestrator -->|HTTP| KBClient[KnowledgeBuilder Client]:::component
        Orchestrator -->|HTTP| SBClient[SkillBuilder Client]:::component
    end
    
    subgraph "Shared API Core"
        Auth[Authentication]:::component
        RateLimit[Rate Limiting]:::component
        ErrorHandler[Error Handling]:::component
        Middleware[Middleware Stack]:::component
    end
    
    API --> Auth
    API --> RateLimit
    API --> ErrorHandler
    API --> Middleware
    
    classDef component fill:#85bbf0,stroke:#5d82a8,color:#000
```

**Key Components**:
- **REST API Layer**: Flask routes, request/response handling
- **Agent Orchestrator**: Coordinates knowledge and skill generation
- **Schema Validator**: Validates agent schemas against USA v2 spec
- **Agent Storage**: In-memory storage with persistence hooks
- **KnowledgeBuilder Client**: HTTP client for knowledge service
- **SkillBuilder Client**: HTTP client for skill service

### Memory System Components

```mermaid
graph TB
    subgraph "Memory System"
        MemoryMerger[Memory Merger]:::component
        Deduplicator[Deduplicator]:::component
        Sanitizer[Memory Sanitizer]:::component
        VectorIndex[Vector Index Factory]:::component
        EmbeddingBridge[Embedding Bridge]:::component
        
        MemoryMerger --> Deduplicator
        MemoryMerger --> Sanitizer
        MemoryMerger --> VectorIndex
        MemoryMerger --> EmbeddingBridge
        
        VectorIndex --> HNSW[HNSW Index]:::component
        VectorIndex --> Lance[LanceDB Index]:::component
        VectorIndex --> Brute[Brute Force Index]:::component
        
        EmbeddingBridge --> VoyageProvider[Voyage Provider]:::component
        EmbeddingBridge --> OpenAIProvider[OpenAI Provider]:::component
        EmbeddingBridge --> DeterministicProvider[Deterministic Provider]:::component
    end
    
    classDef component fill:#85bbf0,stroke:#5d82a8,color:#000
```

**Key Components**:
- **Memory Merger**: Orchestrates memory deduplication and merging
- **Deduplicator**: Finds similar memories using Jaccard or embeddings
- **Memory Sanitizer**: Filters malicious content, rate limiting
- **Vector Index Factory**: Selects appropriate vector index backend
- **Embedding Bridge**: Abstracts embedding provider selection
- **HNSW/Lance/Brute**: Vector index implementations
- **Provider Implementations**: Voyage AI, OpenAI, Deterministic

### Experience Sync Components

```mermaid
graph TB
    subgraph "Experience Sync Manager"
        SyncCoordinator[Sync Coordinator]:::component
        StreamingSync[Streaming Sync]:::component
        LumpedSync[Lumped Sync]:::component
        CheckInSync[Check-in Sync]:::component
        Transport[Experience Transport]:::component
        
        SyncCoordinator --> StreamingSync
        SyncCoordinator --> LumpedSync
        SyncCoordinator --> CheckInSync
        SyncCoordinator --> Transport
        
        StreamingSync --> MemoryMerger[Memory Merger]:::component
        LumpedSync --> SkillAccumulator[Skill Accumulator]:::component
        LumpedSync --> KnowledgeIntegrator[Knowledge Integrator]:::component
        CheckInSync --> StateReconciler[State Reconciler]:::component
    end
    
    classDef component fill:#85bbf0,stroke:#5d82a8,color:#000
```

**Key Components**:
- **Sync Coordinator**: Manages sync protocol selection and lifecycle
- **Streaming Sync**: Real-time experience streaming
- **Lumped Sync**: Batch experience synchronization
- **Check-in Sync**: Periodic full state synchronization
- **Experience Transport**: Network transport abstraction
- **Memory Merger**: Integrates experiences into agent memory
- **Skill Accumulator**: Aggregates learned skills
- **Knowledge Integrator**: Merges new knowledge
- **State Reconciler**: Resolves state conflicts

### Shared API Core Components

```mermaid
graph TB
    subgraph "Shared API Core"
        Models[Data Models]:::component
        Result[Result Type]:::component
        Auth[Authentication]:::component
        Validation[Validation]:::component
        Middleware[Middleware]:::component
        RateLimit[Rate Limiting]:::component
        Monitoring[Monitoring]:::component
        Security[Security Headers]:::component
        ListHelpers[List Helpers]:::component
        Filtering[Filtering]:::component
        OpenAPI[OpenAPI Generator]:::component
        Swagger[Swagger UI]:::component
        
        Models --> Result
        Auth --> Validation
        Middleware --> RateLimit
        Middleware --> Security
        Middleware --> Monitoring
        ListHelpers --> Filtering
    end
    
    classDef component fill:#85bbf0,stroke:#5d82a8,color:#000
```

**Key Components**:
- **Data Models**: APIResponse, APIError, ErrorCode, Pagination
- **Result Type**: Monadic error handling (Success/Failure)
- **Authentication**: JWT and API key validation, RBAC
- **Validation**: Request validation with Result pattern
- **Middleware**: Request ID, CORS, error handling, audit logging
- **Rate Limiting**: Token bucket algorithm
- **Monitoring**: Health checks, metrics collection
- **Security Headers**: OWASP security headers
- **List Helpers**: Pagination, filtering, sorting
- **Filtering**: Query parameter parsing
- **OpenAPI Generator**: Automatic spec generation
- **Swagger UI**: Interactive API documentation

---

## Level 4: Code Diagrams

### Memory Merger Class Diagram

```mermaid
classDiagram
    class MemoryMerger {
        -config: MemoryMergerConfig
        -embedding_service: EmbeddingService
        -vector_index: VectorIndex
        -voyeur: VoyeurSink
        -sanitizer: MemorySanitizer
        +initialize() Promise~void~
        +addMemory(agent, memoryData, source) Promise~void~
        +mergeBatch(agent, memories, source) Promise~MemoryMergeResult~
        -findSimilarMemory(content, embedding) Promise~Memory~
        -mergeMemories(existing, new) Memory
        -calculateSimilarity(mem1, mem2) number
    }
    
    class EmbeddingService {
        -provider: EmbeddingProvider
        -cache: EmbeddingCache
        +embed(text) Promise~number[]~
        +embedBatch(texts) Promise~number[][]~
    }
    
    class VectorIndex {
        <<interface>>
        +add(id, vector) Promise~void~
        +search(vector, k) Promise~SearchResult[]~
        +delete(id) Promise~void~
    }
    
    class HNSWIndex {
        -index: HNSWLib
        -dimension: number
        +add(id, vector) Promise~void~
        +search(vector, k) Promise~SearchResult[]~
    }
    
    class LanceDBIndex {
        -db: LanceDB
        -table: string
        +add(id, vector) Promise~void~
        +search(vector, k) Promise~SearchResult[]~
    }
    
    class MemorySanitizer {
        -blocklist: Set~string~
        -rate_limiter: RateLimiter
        +sanitize(content, source) SanitizeResult
        +checkRateLimit(source) boolean
    }
    
    MemoryMerger --> EmbeddingService
    MemoryMerger --> VectorIndex
    MemoryMerger --> MemorySanitizer
    VectorIndex <|-- HNSWIndex
    VectorIndex <|-- LanceDBIndex
```

### Result Type Pattern

```mermaid
classDiagram
    class Result~T~ {
        <<abstract>>
        +isSuccess() boolean
        +isFailure() boolean
        +map(fn) Result~U~
        +flatMap(fn) Result~U~
        +fold(onSuccess, onFailure) U
        +getOrElse(default) T
        +getOrThrow() T
    }
    
    class Success~T~ {
        -value: T
        +isSuccess() boolean
        +isFailure() boolean
        +getValue() T
    }
    
    class Failure~T~ {
        -error: APIError
        +isSuccess() boolean
        +isFailure() boolean
        +getError() APIError
    }
    
    class APIError {
        +code: string
        +message: string
        +category: ErrorCategory
        +details: ErrorDetail[]
        +request_id: string
        +timestamp: string
        +suggestions: string[]
    }
    
    Result <|-- Success
    Result <|-- Failure
    Failure --> APIError
```

### Pattern Resolver Sequence

```mermaid
sequenceDiagram
    participant Client
    participant Resolver as PatternResolver
    participant CB as CircuitBreaker
    participant MCP as MCPClient
    participant Embedded as EmbeddedPattern
    
    Client->>Resolver: resolveHash()
    Resolver->>Resolver: check deployment model
    
    alt Distributed + MCP Available
        Resolver->>CB: execute(mcpCall)
        CB->>MCP: callHashPattern()
        alt Success
            MCP-->>CB: result
            CB-->>Resolver: result
        else Failure
            CB->>CB: record failure
            CB-->>Resolver: CircuitOpenError
            Resolver->>Embedded: fallback to embedded
            Embedded-->>Resolver: result
        end
    else Embedded Mode
        Resolver->>Embedded: use embedded pattern
        Embedded-->>Resolver: result
    end
    
    Resolver-->>Client: PatternResolution
```

---

## Deployment Diagrams

### Production Deployment (Distributed Model)

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Nginx/HAProxy]:::infra
    end
    
    subgraph "Application Tier"
        AB1[AgentBuilder<br/>Instance 1]:::container
        AB2[AgentBuilder<br/>Instance 2]:::container
        SB1[SkillBuilder<br/>Instance 1]:::container
        SB2[SkillBuilder<br/>Instance 2]:::container
        KB1[KnowledgeBuilder<br/>Instance 1]:::container
        KB2[KnowledgeBuilder<br/>Instance 2]:::container
    end
    
    subgraph "Service Tier"
        Crypto[Crypto Service<br/>gRPC]:::container
        MCP[MCP Servers]:::container
    end
    
    subgraph "Data Tier"
        VectorDB[(LanceDB<br/>Cluster)]:::database
        Redis[(Redis<br/>Cache)]:::database
    end
    
    subgraph "Observability"
        Prom[(Prometheus)]:::infra
        Grafana[Grafana]:::infra
        Jaeger[Jaeger]:::infra
    end
    
    LB --> AB1
    LB --> AB2
    LB --> SB1
    LB --> SB2
    LB --> KB1
    LB --> KB2
    
    AB1 --> Crypto
    AB2 --> Crypto
    AB1 --> MCP
    AB2 --> MCP
    
    SB1 --> VectorDB
    SB2 --> VectorDB
    KB1 --> VectorDB
    KB2 --> VectorDB
    
    AB1 --> Redis
    AB2 --> Redis
    SB1 --> Redis
    SB2 --> Redis
    KB1 --> Redis
    KB2 --> Redis
    
    AB1 -.->|metrics| Prom
    AB2 -.->|metrics| Prom
    SB1 -.->|metrics| Prom
    SB2 -.->|metrics| Prom
    KB1 -.->|metrics| Prom
    KB2 -.->|metrics| Prom
    
    Prom --> Grafana
    AB1 -.->|traces| Jaeger
    AB2 -.->|traces| Jaeger
    
    classDef container fill:#438dd5,stroke:#2e6295,color:#fff
    classDef database fill:#85bbf0,stroke:#5d82a8,color:#000
    classDef infra fill:#999,stroke:#666,color:#fff
```

### Development Deployment (Embedded Model)

```mermaid
graph TB
    subgraph "Developer Machine"
        subgraph "Single Process"
            AB[AgentBuilder]:::container
            SB[SkillBuilder]:::container
            KB[KnowledgeBuilder]:::container
            Embedded[Embedded Patterns]:::component
            LocalCache[Local Cache]:::database
        end
        
        AB --> Embedded
        SB --> Embedded
        KB --> Embedded
        AB --> LocalCache
        SB --> LocalCache
        KB --> LocalCache
    end
    
    subgraph "External Services"
        VoyageAPI[Voyage AI]:::external
        OpenAIAPI[OpenAI]:::external
    end
    
    AB --> VoyageAPI
    SB --> OpenAIAPI
    KB --> OpenAIAPI
    
    classDef container fill:#438dd5,stroke:#2e6295,color:#fff
    classDef component fill:#85bbf0,stroke:#5d82a8,color:#000
    classDef database fill:#85bbf0,stroke:#5d82a8,color:#000
    classDef external fill:#999,stroke:#666,color:#fff
```

---

## Sequence Diagrams

### Agent Creation Flow

```mermaid
sequenceDiagram
    participant Client
    participant AB as AgentBuilder
    participant KB as KnowledgeBuilder
    participant SB as SkillBuilder
    participant Storage
    
    Client->>AB: POST /api/v1/agents
    AB->>AB: Validate request
    AB->>AB: Generate agent ID
    
    par Knowledge Generation
        AB->>KB: POST /api/v1/knowledge
        KB->>KB: Run knowledge pipeline
        KB->>KB: Collect facts
        KB->>KB: Apply deepening cycles
        KB-->>AB: Knowledge cloud
    and Skill Generation
        AB->>SB: POST /api/v1/skills
        SB->>SB: Run skill pipeline
        SB->>SB: Generate skills
        SB->>SB: Create embeddings
        SB-->>AB: Skill set
    end
    
    AB->>AB: Aggregate capabilities
    AB->>AB: Create agent schema
    AB->>Storage: Store agent
    AB-->>Client: 201 Created + Agent
```

### Memory Merge Flow

```mermaid
sequenceDiagram
    participant Instance as Agent Instance
    participant Sync as SyncManager
    participant Merger as MemoryMerger
    participant Sanitizer
    participant Embedding as EmbeddingService
    participant Index as VectorIndex
    participant Agent as Source Agent
    
    Instance->>Sync: Send experience
    Sync->>Merger: addMemory()
    
    Merger->>Sanitizer: sanitize(content)
    alt Blocked Content
        Sanitizer-->>Merger: Blocked
        Merger-->>Sync: Rejected
    else OK
        Sanitizer-->>Merger: OK
        
        Merger->>Embedding: embed(content)
        Embedding-->>Merger: vector
        
        Merger->>Index: search(vector, k=1)
        Index-->>Merger: similar memories
        
        alt Similar Found (>threshold)
            Merger->>Merger: mergeMemories()
            Merger->>Agent: updateMemory()
        else New Memory
            Merger->>Agent: addMemory()
            Merger->>Index: add(id, vector)
        end
        
        Merger-->>Sync: Success
    end
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API as API Endpoint
    participant Auth as AuthMiddleware
    participant KeyStore as APIKeyStore
    participant Handler as Request Handler
    
    Client->>API: Request + Bearer Token
    API->>Auth: validate_request()
    
    Auth->>Auth: Extract token
    alt JWT Token
        Auth->>Auth: Verify JWT signature
        Auth->>Auth: Check expiration
        Auth-->>API: AuthContext
    else API Key
        Auth->>Auth: Parse keyId.secret
        Auth->>KeyStore: validate(keyId, secret)
        KeyStore-->>Auth: Valid/Invalid
        alt Valid
            Auth->>KeyStore: get permissions
            KeyStore-->>Auth: Permissions
            Auth-->>API: AuthContext
        else Invalid
            Auth-->>API: 401 Unauthorized
        end
    end
    
    API->>Handler: process(request, context)
    Handler-->>API: Response
    API-->>Client: Response
```

---

## Architecture Decision Records

### ADR-001: Service Layer Independence

**Status**: Accepted  
**Date**: 2026-01-11

**Context**: Need to ensure services can evolve independently while maintaining consistency.

**Decision**: Implement shared API core as a library, not a service.

**Consequences**:
- ✅ Services remain independent
- ✅ No network overhead for shared functionality
- ✅ Consistent patterns across all services
- ⚠️ Requires version management for shared library

### ADR-002: Adaptive Pattern Resolution

**Status**: Accepted  
**Date**: 2026-01-11

**Context**: Need to support multiple deployment models (embedded, distributed, hybrid).

**Decision**: Implement PatternResolver with runtime selection based on deployment context.

**Consequences**:
- ✅ Supports gradual migration
- ✅ Optimizes for deployment context
- ✅ Graceful degradation on service failure
- ⚠️ Increased complexity in pattern implementation

### ADR-003: Result Type for Error Handling

**Status**: Accepted  
**Date**: 2026-01-11

**Context**: Need type-safe error handling without exceptions.

**Decision**: Implement Result<T> monad pattern for all API operations.

**Consequences**:
- ✅ Type-safe error handling
- ✅ Explicit error propagation
- ✅ Composable operations
- ⚠️ Learning curve for developers

---

## Related Documentation

- [Architecture Specification](../../ARCHITECTURE.md)
- [API Reference Index](../api/API_REFERENCE_INDEX.md)
- [Shared API Core Documentation](../api/SHARED_API_CORE.md)
- [AgentBuilder API Spec](../api/services/AGENTBUILDER_COMPLETE_SPEC.md)
- [SkillBuilder API Spec](../api/services/SKILLBUILDER_API_SPEC.md)
- [KnowledgeBuilder API Spec](../api/services/KNOWLEDGEBUILDER_API_SPEC.md)

---

## Diagram Tools

These diagrams are created using [Mermaid](https://mermaid.js.org/), which is supported by:

- **GitHub**: Native rendering in Markdown
- **GitLab**: Native rendering in Markdown
- **VS Code**: Mermaid Preview extension
- **IntelliJ**: Mermaid plugin
- **Confluence**: Mermaid macro
- **Online**: https://mermaid.live/

### Rendering Diagrams

**In VS Code**:
```bash
# Install Mermaid Preview extension
code --install-extension bierner.markdown-mermaid

# Open this file and use preview (Ctrl+Shift+V)
```

**Export to PNG/SVG**:
```bash
# Install mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Export diagram
mmdc -i C4_ARCHITECTURE_DIAGRAMS.md -o diagrams/
```

**Online Editor**:
1. Go to https://mermaid.live/
2. Copy diagram code
3. Edit and export

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-11  
**Maintained By**: Chrysalis Architecture Team  
**Next Review**: 2026-02-11
