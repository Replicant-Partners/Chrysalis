# Chrysalis Design Patterns Guide

This document defines the canonical design patterns, naming conventions, and style guidelines for the Chrysalis codebase. All contributors should follow these patterns for consistency.

---

## Table of Contents

1. [Core Patterns](#core-patterns)
2. [Naming Conventions](#naming-conventions)
3. [Error Handling](#error-handling)
4. [Async Patterns](#async-patterns)
5. [Logging Standards](#logging-standards)
6. [Language-Specific Guidelines](#language-specific-guidelines)

---

## Core Patterns

### 1. Factory Pattern

**Use for:** Creating instances of services, adapters, or providers based on configuration.

**Naming:** `*Factory` classes, `create_*` functions

**Python Example:**
```python
class AgentMemoryFactory:
    """Factory for creating memory system instances from agent specifications."""
    
    async def create_from_spec(self, spec: AgentSpec) -> AgentMemoryServices:
        """Create memory services from specification."""
        ...
    
    async def create_from_config(self, config: AgentMemoryConfig) -> AgentMemoryServices:
        """Create memory services from parsed configuration."""
        ...
```

**Rust Example:**
```rust
pub fn create_memory_adapter(base_url: Option<&str>) -> Box<dyn AgentMemoryAdapter> {
    match check_memory_api_available(base_url) {
        true => Box::new(HttpMemoryClient::new(base_url.unwrap())),
        false => Box::new(InMemoryAdapter::new()),
    }
}
```

**Files using this pattern:**
- `memory_system/agent_adapter.py` - `AgentMemoryFactory`
- `src/universal_adapter/engine/llm_client.py` - `LLMClient._create_provider()`
- `projects/SkillBuilder/skill_builder/pipeline/search.py` - `create_search_backend()`

---

### 2. Strategy Pattern

**Use for:** Interchangeable algorithms or behaviors with a common interface.

**Naming:** `*Strategy` classes, `*Provider` classes with shared Protocol/ABC

**Python Example:**
```python
class DecompositionStrategy(ABC):
    """Base strategy for semantic decomposition."""
    
    @property
    @abstractmethod
    def name(self) -> str: ...
    
    @property
    @abstractmethod
    def priority(self) -> int: ...
    
    @abstractmethod
    def is_available(self) -> bool: ...
    
    @abstractmethod
    async def decompose(self, text: str) -> SemanticFrame: ...


class OllamaStrategy(DecompositionStrategy):
    """LLM-based decomposition using Ollama."""
    name = "ollama"
    priority = 100  # Highest priority
    ...


class HeuristicStrategy(DecompositionStrategy):
    """Fallback keyword/regex-based decomposition."""
    name = "heuristic"
    priority = 10  # Lowest priority (fallback)
    ...
```

**Files using this pattern:**
- `memory_system/semantic/strategies/` - Decomposition strategies
- `src/universal_adapter/engine/llm_client.py` - `LLMProvider` implementations
- `projects/SkillBuilder/skill_builder/pipeline/search.py` - `SearchProvider` protocol

---

### 3. Circuit Breaker Pattern

**Use for:** Preventing cascading failures when external services are unavailable.

**Naming:** `CircuitBreaker`, `CircuitState`, `CircuitBreakerConfig`

**States:**
- `CLOSED` - Normal operation, failures counted
- `OPEN` - Fast-fail, no calls allowed
- `HALF_OPEN` - Testing if service recovered

**Python Example:**
```python
from shared.api_core.circuit_breaker import CircuitBreaker, CircuitBreakerConfig

breaker = CircuitBreaker(
    name="zep-api",
    config=CircuitBreakerConfig(
        failure_threshold=5,
        success_threshold=2,
        timeout_seconds=60.0
    )
)

if await breaker.can_execute():
    try:
        result = await external_api_call()
        await breaker.record_success()
    except Exception:
        await breaker.record_failure()
        raise
```

**Files using this pattern:**
- `memory_system/resilience/circuit_breaker.py` - Core implementation
- `shared/api_core/circuit_breaker.py` - Re-exports and decorators

---

### 4. Adapter Pattern

**Use for:** Converting between different interfaces or protocols.

**Naming:** `*Adapter` classes

**Python Example:**
```python
class FireproofMemoryAdapter:
    """Adapts FireproofService to AgentMemoryPort interface."""
    
    def __init__(self, fireproof: FireproofService):
        self._fireproof = fireproof
    
    async def store_knowledge(self, batch: KnowledgeArtifactBatch) -> None:
        # Convert to Fireproof document format
        for artifact in batch.artifacts:
            doc = self._to_fireproof_doc(artifact)
            await self._fireproof.put(doc)
```

**Files using this pattern:**
- `memory_system/ports/fireproof_memory_adapter.py`
- `src/adapters/` - Protocol adapters (CrewAI, ElizaOS, MCP)
- `src/native/rust-system-agents/src/memory_adapter.rs`

---

### 5. Port/Protocol Pattern (Hexagonal Architecture)

**Use for:** Defining contracts between layers without implementation coupling.

**Naming:** `*Port` protocols, `*Adapter` implementations

**Python Example:**
```python
class AgentMemoryPort(Protocol):
    """Port abstraction for memory operations."""
    
    async def store_knowledge(self, batch: KnowledgeArtifactBatch) -> None: ...
    async def store_skills(self, batch: SkillArtifactBatch) -> None: ...
    async def fetch_artifacts(self, query: ArtifactQuery) -> List[Dict]: ...
    async def close(self) -> None: ...
```

**Files using this pattern:**
- `memory_system/ports/agent_memory_port.py` - Port definitions
- `memory_system/ports/fireproof_memory_adapter.py` - Adapter implementation

---

### 6. Observer Pattern

**Use for:** Event notification and subscription systems.

**Naming:** `subscribe()`, `on_*()` methods, `*Callback` types

**Python Example:**
```python
class FireproofService:
    def subscribe(self, doc_type: str, callback: Callable) -> Callable[[], None]:
        """Subscribe to document changes. Returns unsubscribe function."""
        self._subscriptions[doc_type].append(callback)
        return lambda: self._subscriptions[doc_type].remove(callback)
```

**Rust Example:**
```rust
pub fn on_message(&self, callback: EventCallback) {
    let mut listeners = write_lock(&self.listeners);
    listeners.push(callback);
}
```

---

### 7. Retry with Exponential Backoff

**Use for:** Handling transient failures in network operations.

**Naming:** `retry()` decorator, `RetryConfig`, `retry_call()` function

**Python Example:**
```python
from shared.api_core.retry import retry, RetryConfig

@retry(max_retries=3, base_delay=1.0)
async def fetch_data():
    return await http_client.get(url)
```

**Files using this pattern:**
- `shared/api_core/retry.py` - Core implementation
- `src/native/rust-system-agents/src/gateway.rs` - Rust implementation

---

### 8. Byzantine Fault Tolerance

**Use for:** Distributed consensus with potentially malicious nodes.

**Naming:** `ByzantineMemoryValidator`, `validate_*`, `threshold`

**Key Principles:**
- Require >2/3 honest nodes for consensus
- Use trimmed mean to remove outliers
- Median is Byzantine-resistant

**Files using this pattern:**
- `memory_system/byzantine.py`

---

## Naming Conventions

### Python

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `AgentMemoryFactory`, `CircuitBreaker` |
| Functions | snake_case | `create_from_spec`, `record_failure` |
| Constants | UPPER_SNAKE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Private | Leading underscore | `_internal_method`, `_cache` |
| Protocols | PascalCase + Protocol suffix | `AgentMemoryPort`, `SearchProvider` |
| Config classes | PascalCase + Config suffix | `CircuitBreakerConfig`, `FireproofConfig` |
| Error classes | PascalCase + Error suffix | `LLMError`, `CircuitBreakerOpenError` |
| Metrics classes | PascalCase + Metrics suffix | `CircuitBreakerMetrics` |

### Rust

| Type | Convention | Example |
|------|------------|---------|
| Structs | PascalCase | `AgentManager`, `GatewayClient` |
| Traits | PascalCase | `AgentMemoryAdapter` |
| Functions | snake_case | `create_memory_adapter`, `record_turn` |
| Constants | UPPER_SNAKE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Modules | snake_case | `memory_adapter`, `knowledge_graph` |
| Enums | PascalCase | `CircuitState`, `GatewayError` |
| Enum variants | PascalCase | `CircuitState::HalfOpen` |

### TypeScript

| Type | Convention | Example |
|------|------------|---------|
| Interfaces | PascalCase + I prefix (optional) | `SemanticAgent`, `AgentIdentity` |
| Classes | PascalCase | `CanvasChatBridge` |
| Functions | camelCase | `createAgent`, `validateConfig` |
| Constants | UPPER_SNAKE or camelCase | `DEFAULT_TIMEOUT` |
| Types | PascalCase | `MessageRole`, `BridgeMessage` |

### Method Naming Patterns

| Operation | Sync | Async |
|-----------|------|-------|
| Create | `create_*()` | `create_*()` (async def) |
| Read | `get_*()`, `fetch_*()` | `get_*()`, `fetch_*()` |
| Update | `update_*()`, `set_*()` | `update_*()`, `set_*()` |
| Delete | `delete_*()`, `remove_*()` | `delete_*()`, `remove_*()` |
| Check | `is_*()`, `has_*()`, `can_*()` | `is_*()`, `has_*()`, `can_*()` |
| Validate | `validate_*()` | `validate_*()` |
| Convert | `to_*()`, `from_*()` | `to_*()`, `from_*()` |

**Avoid:** Mixed naming like `retrieve_async()` - prefer `async def retrieve()`.

---

## Error Handling

### Python

```python
# Custom exception hierarchy
class MemoryError(Exception):
    """Base error for memory operations."""
    pass

class MemoryConnectionError(MemoryError):
    """Connection to memory service failed."""
    pass

class MemoryValidationError(MemoryError):
    """Validation of memory data failed."""
    pass

# Usage with specific exceptions
try:
    result = await memory.store(data)
except MemoryConnectionError:
    logger.warning("Connection failed, using fallback")
    result = await fallback.store(data)
except MemoryValidationError as e:
    logger.error(f"Validation failed: {e}")
    raise
```

### Rust

```rust
// Use thiserror for error types
#[derive(Error, Debug)]
pub enum GatewayError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    
    #[error("Authentication failed")]
    Unauthorized,
    
    #[error("Rate limit exceeded")]
    RateLimited,
    
    #[error("API error: {message}")]
    Api { message: String, status: u16 },
}

// Use Result<T, E> instead of unwrap()/expect()
pub fn process(data: &str) -> Result<Output, ProcessError> {
    let parsed = serde_json::from_str(data)
        .map_err(|e| ProcessError::Parse(e.to_string()))?;
    Ok(transform(parsed))
}

// For locks, use poison recovery
let cache = match self.cache.lock() {
    Ok(guard) => guard,
    Err(poisoned) => {
        log::warn!("Lock was poisoned, recovering");
        poisoned.into_inner()
    }
};
```

---

## Async Patterns

### Python

```python
# Prefer native async/await
async def fetch_data(self, query: str) -> List[Result]:
    async with self._client as session:
        response = await session.get(self._url, params={"q": query})
        return await response.json()

# Use asynccontextmanager for resource cleanup
@asynccontextmanager
async def create_context(self, spec: AgentSpec) -> AsyncIterator[Services]:
    services = await self.create_from_spec(spec)
    try:
        yield services
    finally:
        await services.close()

# For mixed sync/async, use helper
from memory_system.fireproof.async_utils import run_async_safely

def sync_method(self):
    return run_async_safely(self._async_implementation())
```

### Rust

```rust
// Use async fn with explicit lifetimes when needed
pub async fn chat_completion(&self, request: &ChatCompletionRequest) -> Result<Response, Error> {
    self.chat_completion_with_retries(request, 3).await
}

// Use tokio::spawn for background tasks
tokio::spawn(async move {
    if let Err(e) = background_sync().await {
        log::error!("Background sync failed: {}", e);
    }
});
```

---

## Logging Standards

### Python

```python
import logging

logger = logging.getLogger("central_logger")  # Use central_logger for unified output

# Structured logging with extra dict
logger.info(
    "operation.completed",
    extra={
        "agent_id": agent_id,
        "duration_ms": duration,
        "result_count": len(results),
    }
)

# Log levels
# DEBUG: Detailed diagnostic information
# INFO: Normal operation milestones
# WARNING: Recoverable issues
# ERROR: Failures requiring attention
```

### Rust

```rust
use log::{debug, info, warn, error};
use tracing::{instrument, span, Level};

// Simple logging
info!("Processing request for agent: {}", agent_id);

// Structured logging with tracing
#[instrument(skip(self), fields(agent_id = %agent_id))]
pub async fn process(&self, agent_id: &str) -> Result<(), Error> {
    let span = span!(Level::INFO, "process_request");
    let _enter = span.enter();
    // ...
}
```

---

## Language-Specific Guidelines

### Python

1. **Imports:** Group into stdlib, third-party, local. Use `from __future__ import annotations`.
2. **Type hints:** Use throughout. Use `Optional[T]` for nullable, `List[T]` for lists.
3. **Dataclasses:** Prefer `@dataclass` for data containers, `@dataclass(frozen=True)` for immutables.
4. **Protocols:** Use `typing.Protocol` for structural subtyping (duck typing with type safety).

### Rust

1. **Error handling:** Use `Result<T, E>`, avoid `unwrap()` in production code.
2. **Ownership:** Prefer borrowing (`&T`, `&mut T`) over cloning.
3. **Async:** Use `tokio` runtime, `async fn`, `.await`.
4. **Derive:** Use `#[derive(Debug, Clone, Serialize, Deserialize)]` where appropriate.

### TypeScript

1. **Interfaces:** Define clear interfaces for all public APIs.
2. **Null safety:** Use strict null checks, prefer `undefined` over `null`.
3. **Enums:** Use string enums for better debugging.
4. **Async:** Use `async/await`, avoid raw Promises where possible.

---

## Anti-Patterns to Avoid

### ❌ Inconsistent Async Naming
```python
# Bad: Mixed patterns
def retrieve_async(self, query): ...  # Confusing name
async def retrieve_sync(self, query): ...  # Wrong!

# Good: Consistent async def
async def retrieve(self, query): ...
```

### ❌ Broad Exception Catching
```python
# Bad: Swallows all errors
try:
    result = process(data)
except Exception:
    pass

# Good: Specific handling
try:
    result = process(data)
except ValidationError as e:
    logger.warning(f"Validation failed: {e}")
    result = default_value
except ConnectionError:
    raise  # Re-raise critical errors
```

### ❌ Rust Panics in Production
```rust
// Bad: Will crash on failure
let config = load_config().unwrap();

// Good: Proper error handling
let config = load_config().map_err(|e| {
    log::error!("Config load failed: {}", e);
    ConfigError::LoadFailed(e)
})?;
```

### ❌ God Classes
```python
# Bad: Too many responsibilities
class MemoryManager:
    def store(self): ...
    def retrieve(self): ...
    def embed(self): ...
    def sync_remote(self): ...
    def validate(self): ...
    def compress(self): ...

# Good: Single responsibility
class MemoryStore: ...
class MemoryRetriever: ...
class EmbeddingService: ...
class RemoteSyncService: ...
```

---

## Pattern Decision Matrix

| Scenario | Pattern | Example |
|----------|---------|---------|
| Create objects from config | Factory | `AgentMemoryFactory` |
| Multiple implementations of same interface | Strategy | `LLMProvider` implementations |
| Prevent cascading failures | Circuit Breaker | `CircuitBreaker` |
| Convert between interfaces | Adapter | `FireproofMemoryAdapter` |
| Define layer contracts | Port/Protocol | `AgentMemoryPort` |
| Notify subscribers of changes | Observer | `FireproofService.subscribe()` |
| Handle transient failures | Retry | `@retry()` decorator |
| Distributed consensus | Byzantine Fault Tolerance | `ByzantineMemoryValidator` |

---

## References

- Michael Nygard, "Release It!" - Circuit Breaker pattern
- Martin Fowler - Patterns of Enterprise Application Architecture
- Hexagonal Architecture (Ports and Adapters) - Alistair Cockburn
- Azure Architecture Patterns - Retry, Circuit Breaker
- Gang of Four - Design Patterns
