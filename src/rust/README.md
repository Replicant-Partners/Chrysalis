# Chrysalis Rust Workspace

**Version**: 3.1.1
**Created**: January 16, 2026
**Status**: Phase 0 - Infrastructure Setup

---

## Overview

This workspace contains Rust implementations of Chrysalis core components, providing performance-critical operations with memory safety guarantees.

### Architecture

```
src/rust/
├── Cargo.toml                  # Workspace configuration
├── chrysalis-core/             # Core agent types and schemas
├── chrysalis-adapters/         # Protocol adapters (MCP, A2A, ACP)
├── chrysalis-sync/             # Experience sync and CRDT
├── chrysalis-security/         # API Key Wallet, Cost Control
├── chrysalis-ffi/              # Node.js bindings (napi-rs)
└── chrysalis-wasm/             # Browser bindings (wasm-bindgen)
```

---

## Crates

### chrysalis-core

Core agent types and validation logic.

**Key Types**:
- `UniformSemanticAgentV2` - Canonical agent representation
- `Identity`, `Personality`, `Capabilities` - Agent components
- `Episode`, `Concept`, `Belief`, `Skill` - Memory and knowledge types

**Dependencies**: `serde`, `uuid`, `chrono`

**Build**:
```bash
cd chrysalis-core
cargo build
cargo test
```

---

### chrysalis-adapters

Protocol adapters for agent frameworks.

**Protocols**:
- MCP (Model Context Protocol)
- A2A (Agent-to-Agent, Google)
- ACP (Agent Client Protocol)
- Agent Protocol (AI Engineer Foundation)

**Dependencies**: `tokio`, `reqwest`, `async-trait`

**Features**: `mcp`, `a2a`, `acp`, `agent-protocol`

**Build**:
```bash
cd chrysalis-adapters
cargo build --features mcp,a2a
cargo test --all-features
```

---

### chrysalis-sync

Experience synchronization and distributed state management.

**Key Components**:
- CRDT State (via `yrs` - Yjs Rust port)
- Gossip Protocol (tokio-based broadcast)
- Experience Transport (HTTP, WebSocket, MCP)
- Instance Manager

**Dependencies**: `tokio`, `yrs`, `reqwest`, `tokio-tungstenite`

**Features**: `crdt`, `gossip`, `transport`

**Build**:
```bash
cd chrysalis-sync
cargo build --all-features
cargo test
```

---

### chrysalis-security

Security-critical components.

**Key Components**:
- **API Key Wallet**:
  - AES-256-GCM encryption
  - Argon2id key derivation
  - Secure memory wiping (`zeroize`)
  - Auto-expiring cache

- **Cost Control**:
  - Token counting (SIMD-optimized)
  - Budget tracking
  - Rate limiting

**Dependencies**: `aes-gcm`, `argon2`, `zeroize`, `ring`

**Security Features**:
- Constant-time operations
- Memory wiping on drop
- No unsafe code (except in audited crypto crates)

**Build**:
```bash
cd chrysalis-security
cargo build
cargo test
cargo bench  # Performance benchmarks
```

---

### chrysalis-ffi

Node.js FFI bindings via napi-rs.

**Exposed Functions**:
- Core: `parse_agent_json()`, `validate_agent()`, `serialize_agent()`
- Security: `unlock_wallet()`, `get_key()`, `estimate_tokens()`
- Adapters: `translate_message()`, `validate_protocol()`
- Sync: `merge_crdt()`, `broadcast_gossip()`

**Dependencies**: `napi`, `napi-derive`

**Build**:
```bash
cd chrysalis-ffi
npm run build  # Runs napi build + generates TypeScript declarations
```

**Usage from TypeScript**:
```typescript
import { helloWorld, parseAgentJson } from '../rust-ffi';

const greeting = helloWorld();  // "Hello from Rust via napi-rs!"
const agent = await parseAgentJson(jsonString);
```

---

### chrysalis-wasm

Browser WASM bindings via wasm-bindgen.

**Exposed Functions**:
- Agent parsing and validation
- Cryptographic operations
- Canvas utilities

**Dependencies**: `wasm-bindgen`, `js-sys`

**Build**:
```bash
cd chrysalis-wasm
wasm-pack build --target web
```

**Usage from Browser**:
```javascript
import init, { greet, parseAgentJson } from './pkg/chrysalis_wasm.js';

await init();
const greeting = greet("Browser");
const agent = parseAgentJson(jsonString);
```

---

## Building the Workspace

### Prerequisites

- Rust 1.70+ (`rustup install stable`)
- Node.js 18+ (for napi-rs builds)
- wasm-pack (for WASM builds): `cargo install wasm-pack`

### Build All Crates

```bash
# From src/rust/
cargo build --all
cargo test --all
cargo clippy --all -- -D warnings
cargo audit
```

### Build FFI Bindings

```bash
cd chrysalis-ffi
npm install
npm run build
```

### Build WASM

```bash
cd chrysalis-wasm
wasm-pack build --target web --out-dir pkg
```

---

## Development Workflow

### Running Tests

```bash
# Unit tests
cargo test --all

# Property-based tests
cargo test --package chrysalis-core -- --test-threads=1

# Integration tests (requires TypeScript)
npm run test:integration:rust
```

### Benchmarking

```bash
# Run all benchmarks
cargo bench --all

# Specific benchmark
cargo bench --package chrysalis-security -- token_counting
```

### Code Quality

```bash
# Format code
cargo fmt --all

# Lint
cargo clippy --all -- -D warnings

# Security audit
cargo audit
```

---

## Migration Status

### Phase 0: Infrastructure ✅ IN PROGRESS
- [x] Workspace structure created
- [ ] CI/CD pipeline configured
- [ ] FFI Hello World working
- [ ] TypeScript integration tested

### Phase 1: Core Types (Pending)
- [ ] UniformSemanticAgentV2 implemented
- [ ] Component types implemented
- [ ] Validation logic complete
- [ ] Property tests passing

### Phase 2: Security (Pending)
- [ ] API Key Wallet with Argon2
- [ ] Cost Control optimized
- [ ] Security audit passed

### Phase 3: Adapters (Pending)
- [ ] Base traits defined
- [ ] MCP adapter implemented
- [ ] A2A adapter implemented
- [ ] ACP adapter implemented

### Phase 4: Sync (Pending)
- [ ] CRDT state management
- [ ] Gossip protocol
- [ ] Experience transport

### Phase 5: Bridge (Optional)
- [ ] Translation orchestrator
- [ ] RDF temporal store

---

## Performance Targets

| Operation | TypeScript | Rust Target | Status |
|-----------|-----------|-------------|--------|
| Agent parsing | baseline | 5-10x faster | Pending |
| Token counting | baseline | 10-20x faster | Pending |
| CRDT merge | 100ms | <10ms (10x) | Pending |
| Gossip broadcast | 500ms | <50ms (10x) | Pending |
| Protocol parsing | baseline | 2-5x faster | Pending |

---

## Contributing

See the main Chrysalis [CONTRIBUTING.md](../../CONTRIBUTING.md) for general guidelines.

### Rust-Specific Guidelines

1. **Code Style**: Run `cargo fmt` before committing
2. **Linting**: Ensure `cargo clippy` passes with zero warnings
3. **Testing**: Add tests for all new functionality
4. **Documentation**: Document public APIs with `///` doc comments
5. **Performance**: Benchmark performance-critical paths
6. **Security**: Avoid `unsafe` unless absolutely necessary (document why)

---

## References

- [Rust Migration Plan](../../plans/abstract-honking-lovelace.md) - Full migration roadmap
- [TypeScript Source](../core/) - Original implementations
- [Refactoring Plan](../../plans/REFACTORING_AND_CONSOLIDATION_PLAN.md) - Alignment context

---

**Status**: Infrastructure phase in progress
**Next**: Implement core agent types
**Owner**: Platform team
**Last Updated**: January 16, 2026
