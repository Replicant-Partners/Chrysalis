# Chrysalis Rust Migration Roadmap

> **Strategic Plan for Language Evolution**  
> **Created**: January 2026  
> **Goal**: Systematically migrate security-critical, performance-sensitive, and concurrency-heavy components from TypeScript/Python to Rust

---

## Executive Summary

Chrysalis currently implements a **polyglot architecture** with:
- **TypeScript**: Application layer, adapters, agents, orchestration (~70% of codebase)
- **Python**: Memory system, embedding services, semantic processing (~20%)
- **Rust**: Cryptographic primitives (WASM) - limited current scope
- **Go**: Consensus, gossip, rate limiting
- **OCaml**: CRDT implementations
- **Datalog**: Access control, flow graphs

This document outlines a **phased migration strategy** to move security-critical and performance-sensitive components to Rust, improving:
1. **Memory safety**: Eliminate runtime crashes and security vulnerabilities
2. **Concurrency safety**: Prevent data races at compile time
3. **Performance**: Achieve C-level performance for hot paths
4. **Type safety**: Stronger guarantees than TypeScript's structural typing
5. **Community alignment**: Position Chrysalis for serious infrastructure adoption

---

## Current Architecture Analysis

### Identified Migration Candidates

| Component | Current Language | Priority | Rationale |
|-----------|-----------------|----------|-----------|
| **Cryptographic primitives** | Rust (WASM) | ✅ Done | Already implemented |
| **Embedding service** | Python | **P0** | Performance-critical, 725 LOC, high API call volume |
| **CRDT implementations** | OCaml | **P1** | OCaml → Rust maintains FP patterns, gains WASM |
| **Memory system core** | Python | **P1** | Data integrity critical, ~15 files |
| **Consensus/gossip** | Go | **P2** | Already safe, but Rust enables single-binary deployment |
| **Security module** | TypeScript | **P0** | Security-critical code should not be in TypeScript |
| **Semantic processing** | Python | **P2** | CPU-intensive NLP operations |
| **Agent bridges** | TypeScript | **P3** | Protocol handling, medium criticality |

### Critical TypeScript Problems

1. **`src/security/`** - 1 file exporting crypto operations
   - Relies on Node.js crypto or Rust WASM bindings
   - TypeScript provides no memory safety guarantees
   - API key handling in memory vulnerable to inspection

2. **`src/adapters/universal/adapter-v2.ts`** - 1010 lines
   - Complex semantic mapping logic
   - Protocol translation with security implications
   - Would benefit from Rust's exhaustive match

3. **`src/agents/system/`** - Agent orchestration
   - Message passing between untrusted components
   - TypeScript's `any` escapes compromise safety

### Critical Python Problems

1. **`shared/embedding/service.py`** - 725 lines
   - Performance-critical embedding generation
   - Complex fallback logic with 3 provider types
   - GIL limitations for concurrent requests

2. **`memory_system/`** - ~15 core files
   - Byzantine fault tolerance (`byzantine.py`)
   - CRDT merging (`crdt_merge.py`)
   - Gossip protocols (`gossip.py`)
   - Data integrity depends on Python's runtime behavior

---

## Dependency Mapping and Migration Ordering

### Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHRYSALIS DEPENDENCY GRAPH                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐                                                        │
│  │   CLI / Demo     │ ────────────────────────────────────────────────────┐  │
│  └────────┬─────────┘                                                     │  │
│           │                                                                │  │
│           ▼                                                                │  │
│  ┌──────────────────┐     ┌──────────────────┐                            │  │
│  │   API Layer      │────>│   Adapters       │                            │  │
│  └────────┬─────────┘     └────────┬─────────┘                            │  │
│           │                         │                                      │  │
│           │       ┌─────────────────┤                                      │  │
│           │       │                 │                                      │  │
│           ▼       ▼                 ▼                                      │  │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │  │
│  │   Converter      │────>│   Experience     │────>│   Security       │◀──┘  │
│  └────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘      │
│           │                         │                         │              │
│           │       ┌─────────────────┼─────────────────────────┤              │
│           │       │                 │                         │              │
│           ▼       ▼                 ▼                         ▼              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         NATIVE LAYER                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ rust-crypto │  │ go-consensus│  │ ocaml-crdt  │  │   bindings  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         MEMORY LAYER (Python)                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   beads     │  │   fusion    │  │   gossip    │  │  embedding  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Dependency Matrix

| Module | Depends On | Depended By | Migration Blockers |
|--------|-----------|-------------|-------------------|
| `rust-crypto` | (none) | security, embedding, memory | ✅ Ready |
| `security` | rust-crypto | adapters, api, converter | rust-crypto done |
| `embedding` | rust-crypto, security | memory_system, fusion | security migration |
| `crdt` (ocaml) | (none) | sync, experience | ✅ Ready |
| `go-consensus` | (none) | gossip, memory | ✅ Ready |
| `memory_system` | embedding, crdt, consensus | beads, fusion, retrieval | embedding, crdt |
| `converter` | adapters, security | api, cli | security migration |
| `experience` | crdt, memory_system | adapters | memory_system |

### Migration Sequence (Topological Order)

```
Phase 0: Security (No dependencies to migrate)
┌─────────────────────────────────────────────────────────────┐
│  rust-crypto ──expand──> rust-security                       │
│       │                        │                             │
│       ▼                        ▼                             │
│  [WASM bindings]          [TypeScript bindings]             │
└─────────────────────────────────────────────────────────────┘

Phase 1: Embedding (Depends on Phase 0)
┌─────────────────────────────────────────────────────────────┐
│  rust-security                                               │
│       │                                                      │
│       ▼                                                      │
│  rust-embedding ─────────────────────────────────────────>   │
│       │                                                      │
│       ▼                                                      │
│  [WASM bindings] + [PyO3 bindings for memory_system]        │
└─────────────────────────────────────────────────────────────┘

Phase 2: CRDT (Independent, can parallel Phase 1)
┌─────────────────────────────────────────────────────────────┐
│  ocaml-crdt ──migrate──> rust-crdt                          │
│       │                        │                             │
│       ▼                        ▼                             │
│  [Remove OCaml deps]      [WASM + PyO3 bindings]            │
└─────────────────────────────────────────────────────────────┘

Phase 3: Memory Core (Depends on Phases 1 & 2)
┌─────────────────────────────────────────────────────────────┐
│  rust-embedding + rust-crdt                                  │
│       │                                                      │
│       ▼                                                      │
│  rust-memory (hybrid Python/Rust)                           │
│       │                                                      │
│       ▼                                                      │
│  [PyO3 bindings, gradual Python replacement]                │
└─────────────────────────────────────────────────────────────┘

Phase 4: Consensus (Independent, can parallel Phase 3)
┌─────────────────────────────────────────────────────────────┐
│  go-consensus ──migrate──> rust-consensus                   │
│       │                        │                             │
│       ▼                        ▼                             │
│  [Remove Go deps]         [Unified Rust workspace]          │
└─────────────────────────────────────────────────────────────┘
```

### Critical Path Analysis

```
CRITICAL PATH (longest migration chain):
rust-crypto → security → embedding → memory_system → full native

Timeline estimate: 20-28 weeks total

PARALLELIZABLE WORK:
- Phase 2 (CRDT) can run parallel to Phase 1 (Embedding)
- Phase 4 (Consensus) can run parallel to Phase 3 (Memory)

TOTAL PARALLELIZED: 14-20 weeks
```

### Module Migration Dependency Table

| Target Module | Source Files | LOC | Dependencies to Migrate First | Estimated Weeks |
|--------------|--------------|-----|------------------------------|-----------------|
| **rust-security** | `src/security/` | ~200 | rust-crypto (done) | 2-3 |
| **rust-embedding** | `shared/embedding/service.py`, `memory_system/embeddings.py` | 810 | rust-security | 4-6 |
| **rust-crdt** | `src/native/ocaml-crdt/` | ~800 | None | 6-8 |
| **rust-memory** | `memory_system/core.py`, `byzantine.py`, `gossip.py`, `beads.py`, `fusion.py` | ~2000 | rust-embedding, rust-crdt | 8-12 |
| **rust-consensus** | `src/native/go-consensus/`, `go-services/` | ~1500 | None (optional rust-memory) | 4-6 |

### Breaking Change Risk Assessment

| Phase | Breaking Changes | Mitigation Strategy |
|-------|-----------------|---------------------|
| Phase 0 | TypeScript security API | Feature flag, dual implementation |
| Phase 1 | Python embedding imports | PyO3 bridge, same Python API |
| Phase 2 | OCaml CRDT removal | WASM drop-in replacement |
| Phase 3 | Memory system internals | Python facade over Rust core |
| Phase 4 | Go binary removal | Rust binary, same CLI interface |

### File-Level Migration Checklist

**Phase 0: Security**
- [ ] `src/security/index.ts` → `src/native/rust-security/src/lib.rs`
- [ ] `src/security/crypto.ts` → (merge into rust-crypto)
- [ ] `src/security/ApiKeyWallet.ts` → `rust-security/src/api_keys.rs`
- [ ] Create `src/native/bindings/security.ts`

**Phase 1: Embedding**
- [ ] `shared/embedding/service.py` → `rust-embedding/src/service.rs`
- [ ] `shared/embedding/__init__.py` → Python stub calling Rust
- [ ] `memory_system/embeddings.py` → (merge into rust-embedding)
- [ ] Create `rust-embedding/src/providers/{openai,nomic,local}.rs`
- [ ] Create Python bindings with PyO3

**Phase 2: CRDT**
- [ ] `src/native/ocaml-crdt/gcounter.ml` → `rust-crdt/src/counters.rs`
- [ ] `src/native/ocaml-crdt/pncounter.ml` → `rust-crdt/src/counters.rs`
- [ ] `src/native/ocaml-crdt/orset.ml` → `rust-crdt/src/sets.rs`
- [ ] `src/native/ocaml-crdt/lwwregister.ml` → `rust-crdt/src/registers.rs`
- [ ] `src/native/ocaml-crdt/mvregister.ml` → `rust-crdt/src/registers.rs`
- [ ] `src/native/ocaml-crdt/merkle_dag.ml` → `rust-crdt/src/dag.rs`
- [ ] `src/native/bindings/conflict-resolver.ts` → WASM bindings

**Phase 3: Memory Core**
- [ ] `memory_system/core.py` → `rust-memory/src/core.rs` + Python bindings
- [ ] `memory_system/byzantine.py` → `rust-memory/src/byzantine.rs`
- [ ] `memory_system/gossip.py` → `rust-memory/src/gossip.rs`
- [ ] `memory_system/beads.py` → `rust-memory/src/beads.rs`
- [ ] `memory_system/fusion.py` → `rust-memory/src/fusion.rs`
- [ ] `memory_system/identity.py` → `rust-memory/src/identity.rs`
- [ ] `memory_system/threshold.py` → `rust-memory/src/threshold.rs`

**Phase 4: Consensus**
- [ ] `src/native/go-consensus/` → `rust-consensus/src/`
- [ ] `go-services/consensus/` → (merge into rust-consensus)
- [ ] Remove Go toolchain dependency
- [ ] Unified Rust workspace build

---

## Phase 0: Immediate Security Hardening (2-4 weeks)

### 0.1 Expand rust-crypto Module

**Current state**: `src/native/rust-crypto/src/lib.rs` (630 lines)
- SHA2/SHA3/BLAKE3 hashing
- Ed25519 signatures
- AES-GCM encryption
- Scrypt key derivation

**Expansion targets**:
```rust
// Add to rust-crypto
pub mod secure_memory {
    // Zeroizing memory wrappers
    pub struct SecureBuffer(zeroize::Zeroizing<Vec<u8>>);
    
    // Constant-time comparison
    pub fn secure_compare(a: &[u8], b: &[u8]) -> bool;
    
    // Memory-locked secret storage
    pub struct LockedSecret<T>(secrecy::Secret<T>);
}

pub mod api_keys {
    // Secure API key handling with automatic zeroization
    pub struct ApiKey(SecureBuffer);
    
    pub fn validate_key_format(key: &ApiKey) -> Result<KeyType, ValidationError>;
    pub fn redact_for_logging(key: &ApiKey) -> String; // Returns "sk-...xxxx"
}

pub mod tls {
    // TLS certificate validation
    pub fn validate_cert_chain(chain: &[Certificate]) -> Result<(), CertError>;
}
```

**Files to create**:
- `src/native/rust-crypto/src/secure_memory.rs`
- `src/native/rust-crypto/src/api_keys.rs`
- `src/native/rust-crypto/src/tls.rs`

### 0.2 Security Module Migration

**Migrate**: `src/security/index.ts` → Rust WASM

```rust
// src/native/rust-security/src/lib.rs
#[wasm_bindgen]
pub struct SecurityContext {
    key_store: ApiKeyStore,
    session_keys: HashMap<String, SessionKey>,
}

#[wasm_bindgen]
impl SecurityContext {
    pub fn new() -> Self;
    
    pub fn store_api_key(&mut self, provider: &str, key: &str) -> Result<(), JsValue>;
    pub fn get_api_key(&self, provider: &str) -> Result<String, JsValue>;
    pub fn rotate_session_key(&mut self, session_id: &str) -> Result<(), JsValue>;
    
    // Secure encryption with automatic key management
    pub fn encrypt_for_storage(&self, plaintext: &[u8]) -> Result<Vec<u8>, JsValue>;
    pub fn decrypt_from_storage(&self, ciphertext: &[u8]) -> Result<Vec<u8>, JsValue>;
}
```

---

## Phase 1: Embedding Service (4-6 weeks)

### 1.1 Create rust-embedding Module

**Replace**: `shared/embedding/service.py` (725 lines) + `memory_system/embeddings.py` (85 lines)

```rust
// src/native/rust-embedding/src/lib.rs
use reqwest::Client;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct EmbeddingService {
    openai_client: Option<OpenAIClient>,
    nomic_client: Option<NomicClient>,
    local_model: Option<OrtModel>,  // ONNX Runtime for local inference
    config: EmbeddingConfig,
    telemetry: TelemetryCollector,
}

impl EmbeddingService {
    /// Create embedding with automatic provider fallback
    pub async fn embed(&self, text: &str) -> Result<Embedding, EmbeddingError> {
        // Type system ensures dimension consistency
        self.embed_with_provider(text, self.select_provider()?).await
    }
    
    /// Batch embedding with parallel execution
    pub async fn embed_batch(&self, texts: &[&str]) -> Result<Vec<Embedding>, EmbeddingError> {
        // Rust async handles concurrency without GIL
        let futures: Vec<_> = texts.iter().map(|t| self.embed(t)).collect();
        futures::future::try_join_all(futures).await
    }
}

// Compile-time dimension safety
#[derive(Debug, Clone)]
pub struct Embedding<const N: usize> {
    vector: [f32; N],
    model: ModelIdentifier,
}

// Provider implementations with trait bounds
pub trait EmbeddingProvider: Send + Sync {
    type Dimensions: DimensionSpec;
    
    async fn embed(&self, text: &str) -> Result<Embedding<{Self::Dimensions::VALUE}>, Error>;
    fn estimate_cost(&self, text: &str) -> f64;
}
```

### 1.2 TypeScript Bindings

```typescript
// src/native/bindings/embedding.ts
import init, { EmbeddingService } from '../rust-embedding/pkg';

export class RustEmbeddingService {
  private service: EmbeddingService;
  
  static async create(config: EmbeddingConfig): Promise<RustEmbeddingService> {
    await init();
    return new RustEmbeddingService(config);
  }
  
  async embed(text: string): Promise<Float32Array> {
    return this.service.embed(text);
  }
  
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return this.service.embed_batch(texts);
  }
}
```

### 1.3 Performance Targets

| Metric | Python Current | Rust Target | Improvement |
|--------|---------------|-------------|-------------|
| Single embed latency | ~50ms | ~30ms | 40% |
| Batch throughput (100) | 2s | 500ms | 4x |
| Memory per request | ~10MB | ~1MB | 10x |
| Concurrent requests | GIL-limited | Unlimited | ∞ |

---

## Phase 2: CRDT Migration (6-8 weeks)

### 2.1 Rust CRDT Library

**Replace**: `src/native/ocaml-crdt/` (7 files, ~800 lines)

OCaml → Rust preserves functional patterns while gaining:
- WASM compilation (browser support)
- Better TypeScript interop
- Unified toolchain with other Rust modules

```rust
// src/native/rust-crdt/src/lib.rs

/// Conflict-free Replicated Data Types with type-safe operations
pub mod counters {
    /// Grow-only counter
    #[derive(Clone, Debug)]
    pub struct GCounter {
        counts: HashMap<NodeId, u64>,
    }
    
    impl GCounter {
        pub fn increment(&mut self, node: NodeId) { ... }
        pub fn value(&self) -> u64 { ... }
        pub fn merge(&mut self, other: &GCounter) { ... }
    }
    
    /// Positive-Negative counter
    #[derive(Clone, Debug)]  
    pub struct PNCounter {
        positive: GCounter,
        negative: GCounter,
    }
}

pub mod sets {
    /// Observed-Remove Set (strong eventual consistency)
    pub struct ORSet<T: Ord + Clone> {
        elements: HashMap<T, HashSet<UniqueTag>>,
        tombstones: HashMap<T, HashSet<UniqueTag>>,
    }
    
    impl<T: Ord + Clone> ORSet<T> {
        pub fn add(&mut self, element: T, tag: UniqueTag) { ... }
        pub fn remove(&mut self, element: &T) { ... }
        pub fn contains(&self, element: &T) -> bool { ... }
        pub fn merge(&mut self, other: &ORSet<T>) { ... }
    }
}

pub mod registers {
    /// Last-Writer-Wins Register with vector clocks
    pub struct LWWRegister<T: Clone> {
        value: T,
        timestamp: VectorClock,
        node_id: NodeId,
    }
    
    /// Multi-Value Register (preserves concurrent writes)
    pub struct MVRegister<T: Clone + Eq> {
        values: HashSet<(T, VectorClock)>,
    }
}

pub mod experience {
    /// Agent skill accumulator (domain-specific CRDT)
    pub struct SkillAccumulator {
        skills: HashMap<SkillId, (Level, VectorClock)>,
    }
    
    /// Episode memory with causal ordering
    pub struct EpisodeMemory {
        episodes: Vec<Episode>,
        causal_links: HashMap<EpisodeId, HashSet<EpisodeId>>,
    }
}
```

### 2.2 Conflict Resolver

**Replace**: `src/native/bindings/conflict-resolver.ts` + OCaml conflict_resolver.ml

```rust
// src/native/rust-crdt/src/conflict_resolver.rs

pub enum ConflictType {
    DirectContradiction,
    CausalOrdering,
    SemanticInconsistency,
    MergeFailure,
}

pub enum ResolutionStrategy {
    LastWriterWins,
    FirstWriterWins,
    MajorityVote,
    SemanticMerge,
    ManualReview,
}

pub struct ConflictResolver {
    thresholds: Thresholds,
    strategy_map: HashMap<ConflictType, ResolutionStrategy>,
}

impl ConflictResolver {
    pub fn detect_conflicts<T: CRDTValue>(
        &self,
        values: &[T],
    ) -> Vec<Conflict<T>> { ... }
    
    pub fn resolve<T: CRDTValue>(
        &self,
        conflicts: Vec<Conflict<T>>,
    ) -> Result<Resolution<T>, ResolutionError> { ... }
}
```

---

## Phase 3: Memory System Core (8-12 weeks)

### 3.1 Architecture

**Replace critical paths in**: `memory_system/` (~15 Python files)

```
memory_system/
├── core.py         → rust-memory/src/core.rs
├── byzantine.py    → rust-memory/src/byzantine.rs
├── crdt_merge.py   → rust-crdt/src/merge.rs (Phase 2)
├── gossip.py       → rust-memory/src/gossip.rs
├── identity.py     → rust-memory/src/identity.rs
├── beads.py        → rust-memory/src/beads.rs
├── fusion.py       → rust-memory/src/fusion.rs
└── threshold.py    → rust-memory/src/threshold.rs
```

### 3.2 Byzantine Fault Tolerance in Rust

```rust
// src/native/rust-memory/src/byzantine.rs

/// Byzantine consensus with type-safe message passing
pub struct ByzantineConsensus<T: Serialize + Clone> {
    node_id: NodeId,
    nodes: HashSet<NodeId>,
    f: usize,  // Maximum faulty nodes: n >= 3f + 1
    round: u64,
    state: ConsensusState<T>,
}

impl<T: Serialize + Clone> ByzantineConsensus<T> {
    /// Propose a value (leader only)
    pub fn propose(&mut self, value: T) -> Result<PrePrepare<T>, ConsensusError>;
    
    /// Handle incoming message with authentication
    pub fn handle_message(
        &mut self,
        msg: SignedMessage<ConsensusMessage<T>>,
    ) -> Result<Option<ConsensusMessage<T>>, ConsensusError>;
    
    /// Check if consensus reached
    pub fn is_decided(&self) -> Option<&T>;
}

/// Message authentication with Ed25519
pub struct SignedMessage<T> {
    payload: T,
    signature: ed25519::Signature,
    sender: NodeId,
}
```

### 3.3 Python FFI Bridge

For gradual migration, expose Rust to Python:

```python
# memory_system/rust_bridge.py
from memory_system._rust import (
    RustByzantineConsensus,
    RustGossipProtocol,
    RustBeadStore,
)

class HybridMemorySystem:
    """Gradual migration: Python orchestration, Rust critical paths."""
    
    def __init__(self):
        # Rust handles consensus
        self._consensus = RustByzantineConsensus()
        # Rust handles gossip
        self._gossip = RustGossipProtocol()
        # Python handles high-level logic (for now)
        self._retrieval = PythonRetrieval()
```

---

## Phase 4: Full Native Layer (12-16 weeks)

### 4.1 Unified Rust Workspace

```toml
# src/native/Cargo.toml (workspace root)
[workspace]
members = [
    "rust-crypto",
    "rust-security", 
    "rust-embedding",
    "rust-crdt",
    "rust-memory",
    "rust-consensus",  # Migrate from Go
    "rust-bindings",   # Unified WASM/FFI layer
]

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
wasm-bindgen = "0.2"
pyo3 = { version = "0.20", features = ["extension-module"] }
```

### 4.2 Go → Rust Consensus Migration

**Replace**: `src/native/go-consensus/` → `rust-consensus`

Go provides goroutines and channels, but Rust's async/await with tokio achieves the same concurrency patterns with:
- Memory safety guarantees
- Single deployment artifact
- Unified error handling
- Better WASM support

```rust
// src/native/rust-consensus/src/gossip.rs

pub struct GossipProtocol<T: GossipPayload> {
    peers: Arc<RwLock<HashMap<PeerId, PeerState>>>,
    outbox: mpsc::Sender<GossipMessage<T>>,
    inbox: mpsc::Receiver<GossipMessage<T>>,
}

impl<T: GossipPayload> GossipProtocol<T> {
    pub async fn broadcast(&self, payload: T) -> Result<(), GossipError>;
    pub async fn run(&mut self) -> ! {
        loop {
            tokio::select! {
                msg = self.inbox.recv() => self.handle_message(msg).await,
                _ = tokio::time::sleep(self.heartbeat_interval) => self.heartbeat().await,
            }
        }
    }
}
```

---

## Implementation Guidelines

### Build Integration

```makefile
# src/native/Makefile additions

.PHONY: build-rust
build-rust:
	cd rust-crypto && wasm-pack build --target web --release
	cd rust-security && wasm-pack build --target web --release
	cd rust-embedding && wasm-pack build --target web --release
	cd rust-crdt && wasm-pack build --target web --release
	cd rust-memory && maturin build --release  # Python FFI

.PHONY: test-rust
test-rust:
	cargo test --workspace
	cargo clippy --workspace -- -D warnings
	cargo fmt --check

.PHONY: bench-rust
bench-rust:
	cargo bench --workspace
```

### CI/CD Requirements

```yaml
# .github/workflows/rust.yml
jobs:
  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt
          targets: wasm32-unknown-unknown
      
      - name: Cache cargo
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src/native
      
      - name: Check
        run: cargo check --workspace
        working-directory: src/native
      
      - name: Clippy
        run: cargo clippy --workspace -- -D warnings
        working-directory: src/native
      
      - name: Test
        run: cargo test --workspace
        working-directory: src/native
      
      - name: Build WASM
        run: |
          wasm-pack build rust-crypto --target web
          wasm-pack build rust-security --target web
        working-directory: src/native
```

### TypeScript Integration Pattern

```typescript
// src/native/bindings/unified.ts
import { ChrysalisCrypto, initCrypto } from './crypto';
import { SecurityContext, initSecurity } from './security';
import { EmbeddingService, initEmbedding } from './embedding';
import { CRDTEngine, initCRDT } from './crdt';

export interface ChrysalisRustNative {
  crypto: ChrysalisCrypto;
  security: SecurityContext;
  embedding: EmbeddingService;
  crdt: CRDTEngine;
}

export async function initializeRustNative(): Promise<ChrysalisRustNative> {
  // Parallel initialization of all Rust WASM modules
  const [crypto, security, embedding, crdt] = await Promise.all([
    initCrypto(),
    initSecurity(),
    initEmbedding(),
    initCRDT(),
  ]);
  
  return { crypto, security, embedding, crdt };
}
```

---

## Success Metrics

### Technical Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Security vulnerabilities from memory bugs | Unknown | 0 | Static analysis, fuzzing |
| Embedding latency p99 | ~200ms | <50ms | Production telemetry |
| CRDT merge throughput | ~1000/s | >10000/s | Benchmarks |
| Test coverage (Rust modules) | N/A | >80% | cargo-tarpaulin |
| Build time (Rust) | N/A | <2min | CI metrics |

### Strategic Metrics

| Metric | Current | Target | Timeframe |
|--------|---------|--------|-----------|
| TypeScript in security-critical paths | 100% | 0% | Phase 0 |
| Python in performance-critical paths | 100% | <20% | Phase 1 |
| Unified native binary | No | Yes | Phase 4 |
| Production Rust coverage | <5% | >40% | 12 months |

---

## Risk Mitigation

### Technical Risks

1. **WASM performance**: Some operations slower than native
   - *Mitigation*: Profile early, use native FFI for hot paths

2. **Build complexity**: Multi-language builds are harder
   - *Mitigation*: Invest in Makefile/CI infrastructure upfront

3. **Team expertise**: Rust learning curve
   - *Mitigation*: Start with isolated modules, pair programming

### Organizational Risks

1. **Migration disruption**: Breaking changes during transition
   - *Mitigation*: Feature flags, parallel implementations

2. **Scope creep**: Trying to migrate too much too fast
   - *Mitigation*: Strict phase boundaries, clear success criteria

---

## Immediate Next Steps

### Week 1-2
- [ ] Expand `rust-crypto` with secure memory primitives
- [ ] Create `rust-security` module skeleton
- [ ] Set up Rust CI pipeline

### Week 3-4
- [ ] Migrate API key handling to Rust
- [ ] Create TypeScript bindings for security module
- [ ] Benchmark against current implementation

### Month 2
- [ ] Begin Phase 1: Embedding service design
- [ ] Prototype Rust embedding provider
- [ ] Performance comparison vs Python

---

## Appendix: Why Not Keep TypeScript/Python?

### TypeScript Limitations for Infrastructure

1. **No memory safety**: `undefined` access, prototype pollution
2. **Runtime typing**: Types erased at compile time
3. **No exhaustive matching**: `switch` doesn't enforce coverage
4. **Concurrency model**: Single-threaded event loop

### Python Limitations for Infrastructure

1. **GIL**: Global Interpreter Lock prevents true parallelism
2. **Dynamic typing**: Errors discovered at runtime
3. **Memory management**: GC pauses unpredictable
4. **Performance ceiling**: 10-100x slower than native code

### Rust Advantages

1. **Compile-time safety**: Memory + thread safety guaranteed
2. **Zero-cost abstractions**: High-level code, native performance
3. **Exhaustive matching**: Compiler enforces complete handling
4. **Fearless concurrency**: Data races impossible

---

*This roadmap represents a strategic investment in code quality and system reliability. Each phase delivers incremental value while building toward a unified, secure, high-performance native layer.*
