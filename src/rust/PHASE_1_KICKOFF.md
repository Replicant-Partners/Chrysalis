# Phase 1 Kickoff - Core Types Migration

**Status**: Ready to Begin
**Timeline**: 4 weeks (Weeks 3-6)
**Team**: Core Platform (3 engineers)
**Prerequisites**: ✅ Phase 0 complete

---

## Objective

Migrate UniformSemanticAgentV2 and all supporting types from TypeScript to Rust, establishing the foundation for all subsequent migration phases.

---

## Quick Start

### 1. Verify Phase 0

```bash
cd src/rust
cargo build --all  # Should succeed
cargo test --all   # Should show 11 passing
```

### 2. Review TypeScript Source

**Primary file**: `src/core/UniformSemanticAgentV2.ts` (577 lines)
- 14 top-level fields
- 30+ supporting types
- Validation function
- Export interfaces

### 3. Implementation Files

**To implement** (in order):
1. `chrysalis-core/src/agent.rs` - All type definitions (~800 lines)
2. `chrysalis-core/src/components.rs` - Default implementations (~200 lines)
3. `chrysalis-core/src/validation.rs` - Validation logic (~200 lines)
4. `chrysalis-ffi/src/core.rs` - FFI bindings (~150 lines)
5. `chrysalis-core/tests/proptest.rs` - Property tests (~300 lines)
6. `chrysalis-core/benches/agent.rs` - Benchmarks (~100 lines)

**Total**: ~1,750 lines of Rust

---

## Type Mapping Reference

### TypeScript → Rust Quick Reference

| TypeScript | Rust | Notes |
|------------|------|-------|
| `string` | `String` | Owned string |
| `number` | `f64` or `u64` | Float or unsigned int |
| `boolean` | `bool` | Built-in |
| `string[]` | `Vec<String>` | Vector of strings |
| `string \| string[]` | `enum Bio { Single(String), Multiple(Vec<String>) }` | Union type |
| `Record<string, any>` | `HashMap<String, serde_json::Value>` | Dynamic object |
| `optional?` | `Option<T>` | Optional field |
| `'literal' \| 'types'` | `enum` with `#[serde(rename_all = "snake_case")]` | String literals |

### Serde Attributes Needed

```rust
// For enums matching TypeScript string literals
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncProtocol {
    Streaming,  // Serializes as "streaming"
    Lumped,     // Serializes as "lumped"
    CheckIn,    // Serializes as "check_in"
}

// For fields named "type" (Rust keyword)
#[derive(Serialize, Deserialize)]
pub struct Memory {
    #[serde(rename = "type")]
    pub memory_type: MemoryType,
}

// For optional fields (omit if None)
#[derive(Serialize, Deserialize)]
pub struct Agent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub optional_field: Option<String>,
}
```

---

## Implementation Checklist

### Step 1: Type Definitions (2 days)

**File**: `chrysalis-core/src/agent.rs`

Implement all types:
- [ ] 15 enum types (AgentImplementationType, SyncProtocol, EventType, etc.)
- [ ] 30+ struct types (Episode, Concept, Belief, Skill, etc.)
- [ ] Main UniformSemanticAgentV2 struct with all 14 fields
- [ ] Proper serde attributes for JSON compatibility

**Reference**: Lines 1-468 of TypeScript source

**Key Types** (priority order):
1. Enums (15 types) - Lines 13-23, 52, 54-56, 84, 127, etc.
2. OODA types - Lines 54-62
3. Episode & Interaction - Lines 67-89
4. Concept - Lines 94-103
5. Belief - Lines 108-120
6. Tool & Skill - Lines 124-168
7. Instance types - Lines 173-201
8. Transport config - Lines 25-47
9. Sync config - Lines 206-237
10. Protocols - Lines 242-286
11. Main Agent struct - Lines 291-468

### Step 2: Implementation Methods (1 day)

Add to UniformSemanticAgentV2:
- [ ] `new(id, name, designation)` - Constructor
- [ ] `from_json(json: &str)` - Deserialize
- [ ] `to_json(&self)` - Serialize
- [ ] `to_json_pretty(&self)` - Pretty print
- [ ] `validate(&self)` - Validation

**Reference**: TypeScript doesn't have these (they're standalone), but we need them in Rust

### Step 3: Default Implementations (1 day)

**File**: `chrysalis-core/src/components.rs`

Implement Default for:
- [ ] Identity (with UUID generation)
- [ ] Personality
- [ ] Communication
- [ ] Capabilities
- [ ] Knowledge
- [ ] Memory
- [ ] Beliefs
- [ ] Instances
- [ ] Execution (with sensible LLM defaults)
- [ ] Metadata (with timestamps)
- [ ] ExperienceSyncConfig
- [ ] Protocols

### Step 4: Validation Logic (2 days)

**File**: `chrysalis-core/src/validation.rs`

Port from TypeScript `validateUniformSemanticAgentV2()` (lines 540-577):

```rust
pub fn validate_agent(agent: &UniformSemanticAgentV2) -> ValidationReport {
    let mut report = ValidationReport::new();

    // Required: schema_version
    if agent.schema_version.is_empty() {
        report.add_error("Missing schema_version".to_string());
    } else if agent.schema_version != SCHEMA_VERSION {
        report.add_warning(format!(
            "Schema version {} != {}",
            agent.schema_version, SCHEMA_VERSION
        ));
    }

    // Required: identity
    if agent.identity.id.is_empty() {
        report.add_error("Missing identity.id".to_string());
    }

    // Required: instances
    // (TypeScript checks instances.active exists)

    // Required: experience_sync
    // (TypeScript just checks it exists)

    // Required: protocols
    // At least one protocol must be enabled
    let has_protocol = agent.protocols.mcp.as_ref().map(|p| p.enabled).unwrap_or(false)
        || agent.protocols.a2a.as_ref().map(|p| p.enabled).unwrap_or(false)
        || agent.protocols.agent_protocol.as_ref().map(|p| p.enabled).unwrap_or(false);

    if !has_protocol {
        report.add_warning(
            "No protocols enabled - agent may not be functional".to_string()
        );
    }

    report
}
```

### Step 5: FFI Bindings (2 days)

**File**: `chrysalis-ffi/src/core.rs`

Create module and implement:

```rust
use napi_derive::napi;
use chrysalis_core::UniformSemanticAgentV2;

#[napi(object)]
pub struct JsValidationReport {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[napi]
pub fn parse_agent_json(json: String) -> napi::Result<String> {
    let agent = UniformSemanticAgentV2::from_json(&json)
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // For now, serialize back (full JS object conversion in next iteration)
    agent.to_json()
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

#[napi]
pub fn validate_agent_json(json: String) -> napi::Result<JsValidationReport> {
    let agent = UniformSemanticAgentV2::from_json(&json)
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let report = agent.validate();

    Ok(JsValidationReport {
        valid: report.valid,
        errors: report.errors,
        warnings: report.warnings,
    })
}

#[napi]
pub fn create_agent(id: String, name: String, designation: String) -> napi::Result<String> {
    let agent = UniformSemanticAgentV2::new(id, name, designation);
    agent.to_json()
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}
```

**Also add** to `chrysalis-ffi/src/lib.rs`:
```rust
pub mod core;
pub use core::*;
```

### Step 6: Property Tests (2 days)

**File**: `chrysalis-core/tests/proptest.rs`

Create property-based test strategies:

```rust
use proptest::prelude::*;
use chrysalis_core::UniformSemanticAgentV2;

// Strategy: Generate valid agent IDs
fn arb_agent_id() -> impl Strategy<Value = String> {
    "[a-z0-9-]{8,36}".prop_map(|s| s.to_string())
}

// Strategy: Generate agent names
fn arb_agent_name() -> impl Strategy<Value = String> {
    "[A-Za-z ]{3,50}".prop_map(|s| s.to_string())
}

// Strategy: Generate complete agents
prop_compose! {
    fn arb_agent()
        (id in arb_agent_id(),
         name in arb_agent_name(),
         designation in arb_agent_name())
        -> UniformSemanticAgentV2
    {
        UniformSemanticAgentV2::new(id, name, designation)
    }
}

proptest! {
    #[test]
    fn agent_json_roundtrip(agent in arb_agent()) {
        let json = agent.to_json().unwrap();
        let parsed = UniformSemanticAgentV2::from_json(&json).unwrap();
        prop_assert_eq!(agent.identity.id, parsed.identity.id);
    }

    #[test]
    fn valid_agent_validates(agent in arb_agent()) {
        let report = agent.validate();
        prop_assert!(report.valid || !report.errors.is_empty());
    }
}
```

**Run**: `cargo test --package chrysalis-core -- --nocapture`

### Step 7: Benchmarks (1 day)

**File**: `chrysalis-core/benches/agent.rs`

Create criterion benchmarks:

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use chrysalis_core::UniformSemanticAgentV2;

fn bench_parse(c: &mut Criterion) {
    let json = include_str!("../tests/fixtures/sample_agent.json");

    c.bench_function("parse_agent", |b| {
        b.iter(|| {
            UniformSemanticAgentV2::from_json(black_box(json))
        })
    });
}

fn bench_serialize(c: &mut Criterion) {
    let agent = UniformSemanticAgentV2::default();

    c.bench_function("serialize_agent", |b| {
        b.iter(|| {
            agent.to_json()
        })
    });
}

fn bench_validate(c: &mut Criterion) {
    let agent = UniformSemanticAgentV2::default();

    c.bench_function("validate_agent", |b| {
        b.iter(|| {
            agent.validate()
        })
    });
}

criterion_group!(benches, bench_parse, bench_serialize, bench_validate);
criterion_main!(benches);
```

**Also create**: `tests/fixtures/sample_agent.json` with realistic agent data

**Run**: `cargo bench --package chrysalis-core`

---

## Testing Strategy

### Unit Tests (Continuous)
```bash
cargo test --package chrysalis-core
```

### Property Tests (Before PR)
```bash
cargo test --package chrysalis-core -- proptest --nocapture
```

### Benchmarks (Weekly)
```bash
cargo bench --package chrysalis-core
```

### Integration (After FFI complete)
```bash
npm run test:integration:rust
```

---

## Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Parse agent JSON | 5-10x faster than TS | criterion bench |
| Validate agent | 5x faster | criterion bench |
| Serialize agent | 5x faster | criterion bench |
| Full roundtrip | 5x faster | integration test |

---

## Acceptance Criteria

Phase 1 complete when:
- [ ] All 30+ types implemented in Rust
- [ ] JSON serialization matches TypeScript exactly
- [ ] All validation rules ported
- [ ] FFI bindings working (TypeScript can call Rust)
- [ ] Property tests passing (1,000+ cases)
- [ ] Performance targets met (5-10x improvement)
- [ ] TypeScript tests pass with Rust backend
- [ ] Zero regressions

---

## Common Pitfalls

### 1. TypeScript `any` Types
**Issue**: `Record<string, any>` in TypeScript
**Solution**: `HashMap<String, serde_json::Value>` in Rust

### 2. Union Types
**Issue**: `string | string[]`
**Solution**:
```rust
#[derive(Serialize, Deserialize)]
#[serde(untagged)]
pub enum Bio {
    Single(String),
    Multiple(Vec<String>),
}
```

### 3. Reserved Keywords
**Issue**: `type` is a Rust keyword
**Solution**: `#[serde(rename = "type")]` + rename field to `memory_type`

### 4. Optional Fields
**Issue**: Don't serialize null/undefined
**Solution**: `#[serde(skip_serializing_if = "Option::is_none")]`

---

## Current Progress

### ✅ Complete
- Workspace structure
- Cargo.toml configurations
- Module stubs
- FFI Hello World
- Dependencies added (uuid, chrono)

### ⏳ In Progress
- Type definitions (started, needs full implementation)

### ⏳ Not Started
- Validation logic (full implementation)
- FFI bindings (beyond Hello World)
- Property tests
- Benchmarks

---

## Next Actions

**Immediately** (Week 3, Day 1):
1. Implement all enum types in agent.rs
2. Implement all struct types
3. Verify compilation: `cargo check --package chrysalis-core`

**Week 3, Days 2-3**:
4. Add Default implementations
5. Implement validation logic
6. Add unit tests

**Week 3-4**:
7. Create FFI bindings
8. Test TypeScript integration
9. Property tests

**Week 5-6**:
10. Benchmarking
11. Performance optimization
12. Documentation
13. Gate 1 review

---

## Resources

**Reference Files**:
- TypeScript source: `src/core/UniformSemanticAgentV2.ts`
- Migration plan: `.claude/plans/abstract-honking-lovelace.md`
- Phase 1 guide: `docs/PHASE_1_IMPLEMENTATION_GUIDE.md`

**Rust Documentation**:
- Serde guide: https://serde.rs/
- napi-rs guide: https://napi.rs/
- Proptest book: https://proptest-rs.github.io/proptest/

**Support**:
- Rust questions: Platform team
- TypeScript questions: Original implementers
- Architecture questions: Architecture team

---

**Status**: Ready to implement
**Blocker**: None
**Go**: Yes - proceed with implementation

---

**Last Updated**: January 16, 2026
**Document Owner**: Core Platform Team
