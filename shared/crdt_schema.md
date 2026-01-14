# CRDT Schema Specification

**Version**: 1.0.0  
**Purpose**: Define unified CRDT semantics for cross-language interoperability

## Overview

This document specifies the CRDT data structures and merge semantics used across
TypeScript and Python implementations in Chrysalis. Both implementations MUST
conform to these specifications to enable "lossless morphing".

---

## Core CRDT Types

### 1. G-Set (Grow-only Set)

**Semantics**: Elements can only be added, never removed.

```
Merge: GSet<T> × GSet<T> → GSet<T>
merge(A, B) = A ∪ B
```

**Properties**:
- Commutative: `merge(A, B) = merge(B, A)`
- Associative: `merge(merge(A, B), C) = merge(A, merge(B, C))`
- Idempotent: `merge(A, A) = A`

**Implementation Alignment**:

| Aspect | TypeScript | Python | Status |
|--------|------------|--------|--------|
| Element type | Generic `T` | Generic `T` | ✅ Aligned |
| Element identity | JSON.stringify for objects | Element itself | ⚠️ Divergent |
| Metadata | Per-element (Lamport, writer) | None | ⚠️ Divergent |

**Interop Contract**:
- When serializing for cross-language exchange, use a canonical JSON representation
- Element identity should be based on a stable ID field, not object equality

### 2. OR-Set (Observed-Remove Set)

**Semantics**: Elements can be added and removed. Add wins over concurrent remove.

```
Add: ORSet<T> × T × Tag → ORSet<T>
Remove: ORSet<T> × T × Set<Tag> → ORSet<T>
Merge: ORSet<T> × ORSet<T> → ORSet<T>
```

**Properties**:
- Add-wins: If add(x) and remove(x) are concurrent, x is in the result
- Remove only affects observed adds

### 3. LWW-Register (Last-Writer-Wins Register)

**Semantics**: Single value with timestamp. Highest timestamp wins.

```
Set: LWWRegister<T> × T × Timestamp × Writer → LWWRegister<T>
Merge: LWWRegister<T> × LWWRegister<T> → LWWRegister<T>
merge(A, B) = A if A.timestamp > B.timestamp else B
```

**Tie-breaking**: Use writer ID lexicographically when timestamps equal.

---

## Memory CRDT Operations

### Memory Entry Schema (Canonical Form)

```json
{
  "memory_id": "string (UUID)",
  "content": "string",
  "embedding": "number[] | null",
  "confidence": "number (0.0-1.0)",
  "source_instances": ["string"],
  "created": "ISO8601 timestamp",
  "accessed_count": "number",
  "last_accessed": "ISO8601 timestamp",
  "tags": ["string"],
  "importance": "number (0.0-1.0)"
}
```

### Memory Merge Rules

1. **Identity**: Memories are identified by `memory_id`
2. **Duplicate detection**: Use configurable similarity (Jaccard or embedding)
3. **Merge on duplicate**:
   - Confidence: Weighted average (new data weighted 0.7)
   - source_instances: Union (G-Set semantics)
   - accessed_count: Increment
   - last_accessed: LWW semantics (most recent)
4. **No deletion**: Memories are never deleted (G-Set semantics)

---

## Cross-Language Exchange Format

When transferring CRDT state between TypeScript and Python:

### Serialization Format

```json
{
  "version": "1.0.0",
  "source_language": "typescript | python",
  "crdt_type": "g_set | or_set | lww_register | lww_map",
  "lamport_clock": 12345,
  "vector_clock": {"instance_a": 10, "instance_b": 8},
  "data": {
    // Type-specific data
  }
}
```

### G-Set Serialization

```json
{
  "crdt_type": "g_set",
  "data": {
    "elements": [
      { "id": "mem_123", "value": { /* Memory entry */ } }
    ]
  }
}
```

---

## Implementation Notes

### TypeScript (CRDTState.ts)

- Uses string IDs with separate metadata maps
- Includes Lamport and vector clocks per operation
- Optimized for distributed sync with transport efficiency

### Python (crdt_merge.py)

- Operates on full domain objects
- Includes rich metadata in merged objects (gossip, causality, validation)
- Optimized for semantic operations and analysis

### Bridging Strategy

When morphing between implementations:

1. **TS → Python**: Expand IDs to full objects by lookup
2. **Python → TS**: Extract IDs and store objects in separate store
3. **Preserve metadata**: Map TS metadata to Python domain fields

---

## Validation

Both implementations should pass the CRDT property tests:

```
// Commutative
assert(merge(A, B).equals(merge(B, A)))

// Associative  
assert(merge(merge(A, B), C).equals(merge(A, merge(B, C))))

// Idempotent
assert(merge(A, A).equals(A))
```

---

**Maintainers**: Chrysalis Team  
**Last Updated**: 2026-01-13
