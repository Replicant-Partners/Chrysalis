# Chrysalis Target Architecture Standards

> **Version**: 1.0  
> **Status**: Draft for Review  
> **Last Updated**: January 2026

---

## Executive Summary

This document defines the target architecture standards for the Chrysalis codebase modernization initiative. It establishes type safety requirements, language selection criteria, API contract specifications, and quality gates that all new code and refactored modules must meet.

The core principle: **Every type boundary is a contract. Every contract is enforced at compile time where possible, and validated at runtime where necessary.**

---

## Table of Contents

1. [Architecture Principles](#1-architecture-principles)
2. [Type Safety Standards](#2-type-safety-standards)
3. [Language Selection Matrix](#3-language-selection-matrix)
4. [API Contract Standards](#4-api-contract-standards)
5. [Module Boundary Specifications](#5-module-boundary-specifications)
6. [Quality Gates](#6-quality-gates)
7. [Migration Path Requirements](#7-migration-path-requirements)
8. [Appendices](#appendices)

---

## 1. Architecture Principles

### 1.1 Core Principles

| Principle | Description | Enforcement |
|-----------|-------------|-------------|
| **Type Safety First** | All public interfaces must have explicit, validated types | Compiler + Linter |
| **Fail Fast** | Validate inputs at boundaries, crash early on invalid state | Runtime validation |
| **Explicit Over Implicit** | Avoid hidden dependencies, magic values, implicit conversions | Code review |
| **Separation of Concerns** | Each module has one clear responsibility | Architecture review |
| **Dependency Inversion** | High-level modules don't depend on low-level implementation | DI framework |
| **Defense in Depth** | Security at every layer, not just perimeter | Security audit |

### 1.2 Architectural Constraints

```
MUST:
- All cross-language calls go through validated boundaries
- All error states are explicit (Result types, not exceptions)
- All state mutations are traceable (observability)
- All security-critical code is in memory-safe languages (Rust)

MUST NOT:
- Use `any` (TypeScript) or `Any` (Python) in public interfaces
- Ignore type errors or suppress warnings without justification
- Expose internal implementation details across module boundaries
- Store secrets in plain text or heap-allocated strings
```

### 1.3 Architectural Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (CLI, API, WebSocket)                       │
│  - Input validation                                              │
│  - Response serialization                                        │
│  - Authentication/Authorization                                  │
├─────────────────────────────────────────────────────────────────┤
│  APPLICATION LAYER (Services, Orchestrators)                     │
│  - Business logic coordination                                   │
│  - Transaction boundaries                                        │
│  - Cross-cutting concerns (logging, metrics)                     │
├─────────────────────────────────────────────────────────────────┤
│  DOMAIN LAYER (Entities, Value Objects, Domain Services)         │
│  - Core business rules                                           │
│  - Domain invariants                                             │
│  - No external dependencies                                      │
├─────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE LAYER (Repositories, External Services)          │
│  - Database access                                               │
│  - External API integration                                      │
│  - File system operations                                        │
├─────────────────────────────────────────────────────────────────┤
│  NATIVE LAYER (Rust, Go, OCaml)                                  │
│  - Performance-critical operations                               │
│  - Security-critical operations                                  │
│  - System-level primitives                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Type Safety Standards

### 2.1 TypeScript Standards

#### 2.1.1 Compiler Configuration

```json
// tsconfig.json (REQUIRED settings)
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

#### 2.1.2 ESLint Configuration

```json
// .eslintrc.json type rules
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-unsafe-argument": "error",
    "@typescript-eslint/strict-boolean-expressions": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/await-thenable": "error"
  }
}
```

#### 2.1.3 Allowed Type Patterns

```typescript
// ✅ ALLOWED: Explicit generics
function transform<T extends BaseAgent>(agent: T): TransformedAgent<T>

// ✅ ALLOWED: Union types with exhaustive handling
type AgentState = 'idle' | 'processing' | 'complete' | 'error';
function handleState(state: AgentState): void {
    switch (state) {
        case 'idle': /* ... */ break;
        case 'processing': /* ... */ break;
        case 'complete': /* ... */ break;
        case 'error': /* ... */ break;
        default: {
            const _exhaustive: never = state;
            throw new Error(`Unhandled state: ${_exhaustive}`);
        }
    }
}

// ✅ ALLOWED: Branded types for domain concepts
type AgentId = string & { readonly __brand: 'AgentId' };
type UserId = string & { readonly __brand: 'UserId' };

// ✅ ALLOWED: Discriminated unions
type Result<T, E> = 
    | { success: true; value: T }
    | { success: false; error: E };
```

#### 2.1.4 Forbidden Type Patterns

```typescript
// ❌ FORBIDDEN: Explicit any
function process(data: any): any  // Use unknown + type guards

// ❌ FORBIDDEN: Implicit any in catch
try { } catch (error: any) { }  // Use unknown

// ❌ FORBIDDEN: Index signatures without validation
interface Config {
    [key: string]: any;  // Use specific keys or Map<string, T>
}

// ❌ FORBIDDEN: Type assertions without guards
const user = data as User;  // Use type guard function

// ❌ FORBIDDEN: Non-null assertions without proof
const name = user!.name;  // Use explicit checks
```

#### 2.1.5 Exception: `unknown` with Type Guards

```typescript
// ✅ ALLOWED: unknown with type guard
function isUser(value: unknown): value is User {
    return (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        'name' in value &&
        typeof (value as { id: unknown }).id === 'string' &&
        typeof (value as { name: unknown }).name === 'string'
    );
}

// Usage
function processUnknown(data: unknown): User {
    if (isUser(data)) {
        return data;  // Type narrowed to User
    }
    throw new ValidationError('Invalid user data');
}
```

### 2.2 Python Standards

#### 2.2.1 Type Checker Configuration

```toml
# pyproject.toml
[tool.mypy]
python_version = "3.11"
strict = true
warn_unused_ignores = true
warn_redundant_casts = true
warn_return_any = true
disallow_any_unimported = true
disallow_any_expr = false  # Allow in internal implementations
disallow_any_decorated = true
disallow_any_explicit = true  # CRITICAL: No explicit Any
disallow_subclassing_any = true
check_untyped_defs = true
no_implicit_reexport = true

[tool.pyright]
pythonVersion = "3.11"
typeCheckingMode = "strict"
reportUnknownVariableType = "error"
reportUnknownMemberType = "error"
reportUnknownArgumentType = "error"
```

#### 2.2.2 Allowed Type Patterns

```python
from typing import TypedDict, Generic, TypeVar, Protocol, Literal
from dataclasses import dataclass

# ✅ ALLOWED: TypedDict for structured dictionaries
class MemoryEntry(TypedDict):
    id: str
    content: str
    memory_type: Literal["observation", "fact", "skill"]
    timestamp: float
    metadata: "MemoryMetadata"

class MemoryMetadata(TypedDict, total=False):
    source: str
    confidence: float
    tags: list[str]

# ✅ ALLOWED: Dataclasses for domain objects
@dataclass(frozen=True)
class AgentIdentity:
    agent_id: str
    name: str
    capabilities: tuple[str, ...]

# ✅ ALLOWED: Protocols for structural typing
class VectorStore(Protocol):
    def store(self, vectors: list[list[float]], ids: list[str]) -> None: ...
    def query(self, vector: list[float], k: int) -> list[tuple[str, float]]: ...

# ✅ ALLOWED: Generic types with constraints
T = TypeVar("T", bound="Serializable")

class Repository(Generic[T]):
    def get(self, id: str) -> T | None: ...
    def save(self, entity: T) -> None: ...
```

#### 2.2.3 Forbidden Type Patterns

```python
from typing import Any, Dict

# ❌ FORBIDDEN: Dict[str, Any]
def process(data: Dict[str, Any]) -> Dict[str, Any]: ...

# ❌ FORBIDDEN: Any in function signatures
def transform(input: Any) -> Any: ...

# ❌ FORBIDDEN: Untyped collections
def get_items() -> list: ...  # Must be list[Item]

# ❌ FORBIDDEN: type: ignore without explanation
result = unsafe_call()  # type: ignore

# ❌ FORBIDDEN: Implicit None returns
def maybe_get() -> str:  # Should be -> str | None
    if condition:
        return value
    # Implicit None return
```

#### 2.2.4 Exception: Internal Implementations

```python
# ✅ ALLOWED: Any in internal helper (not public API)
def _parse_raw_response(raw: Any) -> ParsedResponse:
    """Internal helper that handles external API responses.
    
    Note: raw comes from external API with no guarantees.
    Validation happens before returning ParsedResponse.
    """
    # Validate and transform...
    return ParsedResponse(...)

# The public API MUST be typed:
def query_external_service(request: QueryRequest) -> ParsedResponse:
    raw = external_api.call(request.to_dict())
    return _parse_raw_response(raw)
```

### 2.3 Rust Standards

#### 2.3.1 Clippy Configuration

```toml
# clippy.toml
cognitive-complexity-threshold = 25
too-many-arguments-threshold = 7

# Cargo.toml [lints]
[lints.rust]
unsafe_code = "forbid"  # Unless explicitly allowed for FFI

[lints.clippy]
all = "warn"
pedantic = "warn"
nursery = "warn"
cargo = "warn"
unwrap_used = "deny"
expect_used = "warn"
panic = "deny"
todo = "deny"
```

#### 2.3.2 Required Patterns

```rust
// ✅ REQUIRED: Result types for fallible operations
pub fn parse_config(path: &Path) -> Result<Config, ConfigError>

// ✅ REQUIRED: Custom error types
#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("Invalid key length: expected {expected}, got {actual}")]
    InvalidKeyLength { expected: usize, actual: usize },
    
    #[error("Encryption failed: {0}")]
    EncryptionFailed(#[from] aes_gcm::Error),
}

// ✅ REQUIRED: Newtype patterns for domain concepts
pub struct AgentId(String);
pub struct Timestamp(u64);

// ✅ REQUIRED: Builder pattern for complex construction
pub struct AgentBuilder {
    id: Option<AgentId>,
    name: Option<String>,
}

impl AgentBuilder {
    pub fn build(self) -> Result<Agent, BuildError> {
        Ok(Agent {
            id: self.id.ok_or(BuildError::MissingId)?,
            name: self.name.ok_or(BuildError::MissingName)?,
        })
    }
}
```

---

## 3. Language Selection Matrix

### 3.1 Decision Framework

```
┌─────────────────────────────────────────────────────────────────┐
│                    LANGUAGE SELECTION FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Is it security-critical?  ─────YES─────> Rust                  │
│           │                                                      │
│          NO                                                      │
│           │                                                      │
│  Is it performance-critical?  ──YES──┬──> Does it need          │
│           │                          │    concurrency?           │
│          NO                          │         │                 │
│           │                          │    YES  │  NO             │
│           │                          │     ↓   │   ↓             │
│           │                          │    Go   │  Rust           │
│           │                          │                           │
│  Does it need ML/Data Science?  ──YES────> Python               │
│           │                                                      │
│          NO                                                      │
│           │                                                      │
│  Is it user-facing/API?  ─────YES────> TypeScript               │
│           │                                                      │
│          NO                                                      │
│           │                                                      │
│  Is it CRDT/formal verification?  ──YES──> OCaml (temporary)    │
│           │                              └──> Migrate to Rust    │
│          NO                                                      │
│           │                                                      │
│           └──────────> TypeScript (default)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Language Assignment by Function

| Function Category | Current | Target | Rationale |
|-------------------|---------|--------|-----------|
| **Cryptographic primitives** | Rust | Rust | Memory safety, constant-time |
| **API key storage** | TypeScript | Rust | Secure memory, zeroization |
| **Embedding service** | Python | Rust | Performance, SIMD |
| **Vector similarity** | Python | Rust | Performance critical |
| **Memory system core** | Python | Python + Rust | Hybrid approach |
| **CRDT operations** | OCaml | Rust | Consolidation |
| **Byzantine consensus** | Go | Go | Goroutines natural fit |
| **HTTP API** | TypeScript | TypeScript | Ecosystem, ergonomics |
| **CLI tools** | TypeScript | TypeScript | Rapid development |
| **Semantic processing** | Python | Python | ML libraries |
| **Agent conversion** | TypeScript | TypeScript | Framework integration |
| **Knowledge graph** | Python | Python | NetworkX, algorithms |

### 3.3 Language Boundary Rules

```
RULE 1: Binary Interface
- Rust ↔ TypeScript: WASM with wasm-bindgen
- Rust ↔ Python: PyO3 with maturin
- Go ↔ TypeScript: gRPC or stdio with JSON

RULE 2: Data Serialization
- Cross-language: Protocol Buffers or JSON Schema validated
- Same language: Native types preferred

RULE 3: Error Propagation
- Each language maps errors to its native pattern
- Rust: Result<T, E>
- TypeScript: Result<T, E> union type
- Python: Result pattern from shared/api_core
- Go: (value, error) tuple

RULE 4: Ownership at Boundaries
- Data crossing boundaries is copied, not referenced
- Large data: Use memory-mapped files or shared memory
- Streaming: Use async iterators/generators
```

---

## 4. API Contract Standards

### 4.1 Schema Definition

All public APIs must have schemas defined in one of:

1. **JSON Schema** (for REST APIs)
2. **Protocol Buffers** (for gRPC/cross-language)
3. **TypeScript types with Zod** (for TypeScript APIs)
4. **Python dataclasses with Pydantic** (for Python APIs)

### 4.2 REST API Standards

```yaml
# OpenAPI 3.1 specification required for all REST endpoints
openapi: "3.1.0"
info:
  title: Chrysalis API
  version: "1.0.0"

paths:
  /api/v1/agents/{agentId}/morph:
    post:
      operationId: morphAgent
      parameters:
        - name: agentId
          in: path
          required: true
          schema:
            type: string
            pattern: "^[a-zA-Z0-9-]+$"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/MorphRequest"
      responses:
        "200":
          description: Agent morphed successfully
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MorphResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "500":
          $ref: "#/components/responses/InternalError"
```

### 4.3 Internal API Standards

```typescript
// Internal TypeScript APIs use Zod for runtime validation
import { z } from 'zod';

// Define schema
export const MorphRequestSchema = z.object({
    agentId: z.string().regex(/^[a-zA-Z0-9-]+$/),
    targetFramework: z.enum(['langchain', 'autogen', 'crewai']),
    preserveShadow: z.boolean().default(true),
    options: z.object({
        validateCapabilities: z.boolean().default(true),
        timeout: z.number().min(1000).max(60000).default(30000),
    }).optional(),
});

// Derive type from schema
export type MorphRequest = z.infer<typeof MorphRequestSchema>;

// Validate at boundary
export function validateMorphRequest(data: unknown): MorphRequest {
    return MorphRequestSchema.parse(data);
}
```

### 4.4 Cross-Language Contracts

```protobuf
// proto/memory.proto - Shared contract
syntax = "proto3";
package chrysalis.memory;

message MemoryEntry {
    string id = 1;
    string content = 2;
    MemoryType type = 3;
    double timestamp = 4;
    Metadata metadata = 5;
    repeated float embedding = 6;
}

enum MemoryType {
    MEMORY_TYPE_UNSPECIFIED = 0;
    MEMORY_TYPE_OBSERVATION = 1;
    MEMORY_TYPE_FACT = 2;
    MEMORY_TYPE_SKILL = 3;
}

message Metadata {
    string source = 1;
    double confidence = 2;
    repeated string tags = 3;
}
```

---

## 5. Module Boundary Specifications

### 5.1 Module Categories

| Category | Visibility | Dependencies | Example |
|----------|------------|--------------|---------|
| **Core** | Internal | None | Domain entities |
| **Service** | Internal | Core | Business logic |
| **Adapter** | Public | Service | Framework integration |
| **Port** | Public interface | None | Abstract interfaces |
| **Infrastructure** | Internal | Ports | Database, external APIs |

### 5.2 Dependency Rules

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY DIRECTIONS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Adapters ──────────────────────────────> Ports                │
│       │                                       ↑                  │
│       │                                       │                  │
│       ↓                                       │                  │
│   Services ──────────────────────────────────┘                  │
│       │                                                          │
│       │                                                          │
│       ↓                                                          │
│   Core (Domain) ←────────────────────── Infrastructure          │
│                                                                  │
│   FORBIDDEN:                                                     │
│   - Core → Adapter                                               │
│   - Core → Infrastructure                                        │
│   - Port → Implementation                                        │
│   - Circular dependencies at any level                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Module Interface Template

```typescript
// src/modules/{module}/index.ts - Public exports only
// All other files are internal implementation

// Types
export type { AgentId, AgentConfig } from './types';

// Interfaces (Ports)
export type { AgentRepository, AgentService } from './ports';

// Factory (Dependency Injection entry point)
export { createAgentModule } from './factory';

// Constants
export { SUPPORTED_FRAMEWORKS } from './constants';

// DO NOT export internal implementations:
// - ./internal/*
// - ./adapters/*  (injected via factory)
// - ./services/*  (injected via factory)
```

---

## 6. Quality Gates

### 6.1 Pre-Commit Gates

```yaml
# All must pass before commit
- Type checking (tsc --noEmit, mypy, cargo check)
- Linting (eslint, ruff, clippy)
- Formatting (prettier, black, rustfmt)
- Unit tests for changed files
```

### 6.2 Pull Request Gates

```yaml
# All must pass before merge
- All pre-commit gates
- Full test suite
- Code coverage >= 80% for new code
- No new type escapes (any/Any)
- Security scan (Snyk, cargo-audit)
- Documentation for public APIs
- Performance regression check (if applicable)
```

### 6.3 Release Gates

```yaml
# All must pass before release
- All PR gates
- Integration tests
- End-to-end tests
- Performance benchmarks
- Security audit sign-off
- Documentation complete
- Changelog updated
```

### 6.4 Metrics Dashboard

| Metric | Target | Current | Trend |
|--------|--------|---------|-------|
| TypeScript `any` count | 0 | 178 | ↓ |
| Python `Any` count | 0 | 177 | ↓ |
| Test coverage | >80% | TBD | - |
| Type coverage | >95% | TBD | - |
| Security vulnerabilities | 0 Critical | TBD | - |
| Build time | <5min | TBD | - |
| Test time | <10min | TBD | - |

---

## 7. Migration Path Requirements

### 7.1 Refactoring Protocol

1. **Create types first**: Define target types before changing code
2. **Maintain dual interface**: Old and new APIs coexist during migration
3. **Incremental migration**: One module at a time, not big bang
4. **Test coverage**: No refactoring without tests
5. **Feature flags**: New code paths behind flags until validated

### 7.2 Breaking Change Protocol

```
1. Announce deprecation (minimum 2 releases ahead)
2. Add migration documentation
3. Provide automated migration tools where possible
4. Support old API in compatibility mode
5. Remove after deprecation period
```

### 7.3 Type Migration Template

```typescript
// Step 1: Define strict type alongside loose type
interface AgentConfig_v1 {
    [key: string]: any;  // Old
}

interface AgentConfig_v2 {
    id: AgentId;
    name: string;
    capabilities: readonly Capability[];
    settings: AgentSettings;
}

// Step 2: Create migration function
function migrateAgentConfig(old: AgentConfig_v1): AgentConfig_v2 {
    return {
        id: validateAgentId(old.id),
        name: validateString(old.name),
        capabilities: validateCapabilities(old.capabilities),
        settings: validateSettings(old.settings),
    };
}

// Step 3: Update callers incrementally
// Step 4: Remove old type and migration code
```

---

## Appendices

### Appendix A: Type Guard Library

Standard type guards for Chrysalis:

```typescript
// src/lib/type-guards.ts

export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

export function isNonEmptyString(value: unknown): value is string {
    return isString(value) && value.length > 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasProperty<K extends string>(
    obj: unknown,
    key: K
): obj is Record<K, unknown> {
    return isRecord(obj) && key in obj;
}

export function isArrayOf<T>(
    value: unknown,
    guard: (item: unknown) => item is T
): value is T[] {
    return Array.isArray(value) && value.every(guard);
}
```

### Appendix B: Result Type Library

```typescript
// src/lib/result.ts

export type Result<T, E = Error> =
    | { ok: true; value: T }
    | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function mapResult<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => U
): Result<U, E> {
    return result.ok ? Ok(fn(result.value)) : result;
}

export function flatMapResult<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
): Result<U, E> {
    return result.ok ? fn(result.value) : result;
}

export async function tryCatch<T>(
    fn: () => Promise<T>
): Promise<Result<T, Error>> {
    try {
        return Ok(await fn());
    } catch (error) {
        return Err(error instanceof Error ? error : new Error(String(error)));
    }
}
```

### Appendix C: Schema Registry Pattern

```typescript
// src/schemas/registry.ts

import { z } from 'zod';

// Central schema registry for cross-module consistency
export const Schemas = {
    AgentId: z.string().regex(/^[a-zA-Z0-9-]+$/).brand<'AgentId'>(),
    Timestamp: z.number().positive().brand<'Timestamp'>(),
    
    MemoryEntry: z.object({
        id: z.string(),
        content: z.string(),
        type: z.enum(['observation', 'fact', 'skill']),
        timestamp: z.number(),
        embedding: z.array(z.number()).optional(),
    }),
    
    // Add more schemas as needed
} as const;

// Type exports
export type AgentId = z.infer<typeof Schemas.AgentId>;
export type Timestamp = z.infer<typeof Schemas.Timestamp>;
export type MemoryEntry = z.infer<typeof Schemas.MemoryEntry>;
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01 | System | Initial draft |

---

*This document is a living standard. Propose changes via pull request with technical justification.*
