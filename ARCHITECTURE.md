# Chrysalis Architecture Overview

**Version**: 3.1.0  
**Status**: Current  
**Last Updated**: December 28, 2025

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Fractal Architecture](#fractal-architecture)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [Deployment Models](#deployment-models)
6. [Security Architecture](#security-architecture)

---

## System Overview

Chrysalis is a **Uniform Semantic Agent transformation system** that enables AI agents to:
- Morph between different implementation types
- Maintain persistent, distributed memory
- Evolve through synchronized experiences
- Preserve cryptographic identity across transformations

### Design Philosophy

**Evidence-Based**: All design decisions rooted in distributed systems research  
**Fractal Composition**: Patterns recur at multiple architectural scales  
**Adaptive Integration**: Context-aware selection of implementation strategies  
**Byzantine Resistant**: Tolerates <1/3 malicious or faulty nodes

---

## Fractal Architecture

### The Five Scales

```mermaid
flowchart LR
    subgraph Scale0[Math]
      Z0[Patterns: hash, signature, gossip, DAG, time, CRDT]
    end
    subgraph Scale1[Libs]
      Z1[@noble/hashes, @noble/ed25519, graphlib]
    end
    subgraph Scale2[MCP Fabric]
      Z2[Go gRPC crypto]
      Z2a[MCP servers (crypto, structures)]
    end
    subgraph Scale3[Embedded]
      Z3[TS patterns]
    end
    subgraph Scale4[Agent Ops]
      Z4[Agent morphing, sync, memory]
    end
    Z0 --> Z1 --> Z2 --> Z3 --> Z4
    Z4 -. observability .-> Z5[Voyeur SSE/metrics]
  ```
  
  **References**: HNSW (Malkov & Yashunin 2018) for ANN; Prometheus/OTel for metrics; SSE spec for voyeur stream; Ed25519 (RFC 8032) for signatures.

**Scale 0: Mathematics**  
Universal patterns with proven properties (hash functions, digital signatures, DAGs, gossip, etc.)

**Scale 1: Validated Libraries**  
Audited implementations (@noble/hashes, @noble/curves, graphlib)

**Scale 2: MCP Fabric**  
Network-accessible services exposing primitives via MCP protocol

**Scale 3: Embedded Patterns**  
Agent-specific implementations wrapping libraries with domain logic

**Scale 4: Agent Operations**  
Application-level operations using patterns (fingerprinting, signing, syncing)

---

## Core Components

### 1. Uniform Semantic Agent Schema

```mermaid
classDiagram
    class UniformSemanticAgentV2 {
        +identity: CryptoIdentity
        +memory: MemorySystem
        +capabilities: Capabilities
        +experiences: Experience[]
        +instances: InstanceMetadata[]
    }
    
    class CryptoIdentity {
        +fingerprint: string
        +publicKey: Uint8Array
        +signatureAlgorithm: string
    }
    
    class MemorySystem {
        +episodic: Episode[]
        +semantic: Concept[]
        +type: "vector" | "graph" | "hybrid"
    }
    
    UniformSemanticAgentV2 --> CryptoIdentity
    UniformSemanticAgentV2 --> MemorySystem
```

**Key Features**:
- SHA-384 fingerprint for tamper-evident identity
- Ed25519 signatures for authentication
- Dual-coded memory (episodic + semantic)
- Experience accumulation from instances
- Evolution tracking via DAG

### 2. Pattern Resolver (Adaptive)

```mermaid
flowchart TD
    A[Agent Request] --> B{Pattern Resolver}
    B --> C{Deployment Context?}
    C -->|Distributed + MCP| D[Go gRPC Crypto]
    C -->|Distributed + No MCP| E[MCP Servers]
    C -->|Single-Node| F[Embedded]
    C -->|Perf-Critical| G[Direct Library]
    D --> H[~5ms]
    E --> H
    F --> H
    G --> H
```

**Decision Factors**:
- distributed & mcp_available → Go gRPC crypto + MCP structures
- prefer_reusability, not perf-critical → Go/MCP
- perf-critical → embedded/local
- fallback → direct library

### 3. Memory System

```mermaid
flowchart TD
    In[Memory Input] --> San[Sanitize & hash]
    San --> Sel{Embedding ready?}
    Sel -->|Yes| Emb[Embed]
    Sel -->|No| Jac[Jaccard]
    Emb --> ANN{Vector index?}
    Jac --> ANN
    ANN -->|Yes| Search[ANN search]
    ANN -->|No| Scan[Linear scan]
    Search --> Sim{similarity > threshold?}
    Scan --> Sim
    Sim -->|Yes| Merge[Merge existing]
    Sim -->|No| Add[Add new memory]
    Merge --> Store[Persist + update index]
    Add --> Store
    Store --> Obs[Voyeur events + metrics]
```

**Evolution Path**:
- **v3.0**: Jaccard similarity (lexical), O(N²), <1000 memories
- **v3.1**: Embedding similarity (semantic), O(N²), <5000 memories
- **v3.2**: Vector indexing (HNSW), O(log N), millions of memories

### 4. Experience Sync + OODA Capture

```mermaid
sequenceDiagram
    participant S as Agent
    participant I1 as Instance 1
    participant I2 as Instance 2
    participant I3 as Instance 3
    
    I1->>S: Streaming (real-time)
    I2->>S: Lumped (batch)
    I3->>S: Check-in (periodic)
    S->>S: Merge + OODA record per episode
    S->>S: Update Memory/Skills/Knowledge
```

**Protocols**: streaming, lumped, check-in. OODA interrogatives stored on episodes for audit and learning.

---

## Data Flow

### Agent Morphing Flow

```mermaid
flowchart LR
    A[Uniform Semantic Agent] --> B[Framework Adapter]
    B --> C{Target Type?}
    
    C -->|MCP| D[MCPAdapter]
    C -->|Multi-Agent| E[MultiAgentAdapter]
    C -->|Orchestrated| F[OrchestratedAdapter]
    
    D --> G[MCP Agent + Shadow]
    E --> H[Multi-Agent + Shadow]
    F --> I[Orchestrated Agent + Shadow]
    
    G --> J[Lossless Restoration]
    H --> J
    I --> J
    
    J --> A
```

**Key Property**: **Lossless** - No information lost in transformation

**Shadow Fields**: Encrypted metadata enables perfect restoration

### Experience Accumulation

```mermaid
graph TD
    A[Instance Experiences] --> B[Experience Sync]
    B --> C[MemoryMerger]
    B --> D[SkillAccumulator]
    B --> E[KnowledgeIntegrator]
    
    C --> F[Deduplication]
    F --> G[Similarity Check]
    G --> H[Merge or Add]
    
    D --> I[Proficiency Aggregation]
    I --> J[Learning Curve Update]
    
    E --> K[Confidence Threshold]
    K --> L[Verification Count]
    L --> M[Accept or Reject]
    
    H --> N[Updated Agent State]
    J --> N
    M --> N
```

---

## Deployment Models

### Model A: Embedded (Monolithic)
```
Single Process:
  ├── Agent
  ├── Embedded Patterns
  └── Direct Library Imports
```
Use: CLI, edge, single-user | Latency: ~0.1ms | Complexity: Low

### Model B: Go gRPC + MCP (Distributed)
```
Multiple Processes:
  ├── Agent Process
  ├── Go Crypto gRPC (hash/verify/merkle/Ed25519/BLS/random)
  └── Distributed-Structures MCP
```
Use: Multi-region/shared infra | Latency: ~5ms | Complexity: Medium

### Model C: Adaptive (Hybrid)
```
Agent:
  └── Pattern Resolver
      ├── Prefer Go gRPC when distributed & available
      ├── Else MCP
      └── Else Embedded
```
Use: Gradual migration | Latency: adaptive | Complexity: Medium-High

---

## Security Architecture

### Multi-Layer Defense

```mermaid
graph TB
    subgraph Layer_1[Layer 1: Cryptographic Identity]
        A1[SHA-384 Fingerprint]
        A2[Ed25519 Signatures]
    end
    
    subgraph Layer_2[Layer 2: Byzantine Resistance]
        B1[Threshold Voting >2/3]
        B2[Median Aggregation]
        B3[Trimmed Mean]
    end
    
    subgraph Layer_3[Layer 3: Redundancy]
        C1[Multi-Instance]
        C2[Quorum Operations]
    end
    
    subgraph Layer_4[Layer 4: Causal Consistency]
        D1[Lamport Clocks]
        D2[Vector Clocks]
    end
    
    Layer_1 --> Layer_2
    Layer_2 --> Layer_3
    Layer_3 --> Layer_4
```

**Defends Against**:
- Impersonation (cryptographic identity)
- Malicious instances (<1/3 Byzantine tolerance)
- Single point of failure (redundancy)
- Timing attacks (logical time)

---

## Performance Characteristics

| Operation | Complexity | Latency | Scale |
|-----------|-----------|---------|-------|
| **Hash (embedded)** | O(N) | ~0.1ms | Any |
| **Hash (MCP)** | O(N) | ~5ms | Any |
| **Memory search (Jaccard)** | O(N²) | ~10ms | <1K |
| **Memory search (embedding)** | O(N²) | ~50ms | <5K |
| **Memory search (HNSW)** | O(log N) | ~5ms | Millions |
| **Experience sync (RPC)** | O(N) | ~100ms | <100 instances |
| **Experience sync (gossip)** | O(log N) | ~500ms | Thousands |

---

## Technology Stack

**Language**: TypeScript 5.0+  
**Runtime**: Node.js 18+

**Cryptography**:
- @noble/hashes (hash functions)
- @noble/ed25519 (signatures)
- @noble/curves (BLS)

**Distributed Systems**:
- graphlib (DAG operations)
- simple-statistics (aggregation)

**Future**:
- @xenova/transformers (embeddings)
- hnswlib-node (vector indexing)
- @automerge/automerge (CRDTs)

---

## Related Documentation

- **[Complete Specification](docs/current/UNIFIED_SPEC_V3.1.md)** - Comprehensive technical spec
- **[Implementation Guide](docs/current/IMPLEMENTATION_GUIDE.md)** - How to implement
- **[Research Foundation](docs/research/)** - Deep research and patterns
- **[API Reference](docs/current/API_REFERENCE.md)** - API documentation

---

**Version**: 3.1.0 | **Last Updated**: December 28, 2025

🦋 **Rigorous architecture through evidence-based design** 🦋
