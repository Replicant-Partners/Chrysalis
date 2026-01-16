# Semantic Agent Rename - Implementation Guide

**Date**: January 16, 2026
**Status**: In Progress
**Rationale**: "Semantic Agent" better captures agents operating in semantic/meaning space

---

## Naming Change

**Old**: UniformSemanticAgent / UniformSemanticAgentV2
**New**: SemanticAgent (with V2 implied in schema version)
**Reason**: More concise, clearer concept - agents operate agentically in semantic space

---

## Changes Made ✅

### Rust Code
- [x] `src/rust/chrysalis-core/src/agent.rs` - Renamed struct to `SemanticAgent`
- [x] `src/rust/chrysalis-core/src/agent.rs` - Added type alias `UniformSemanticAgentV2 = SemanticAgent` for backward compatibility
- [x] `src/rust/chrysalis-core/src/validation.rs` - Updated to use `SemanticAgent`
- [x] `src/rust/chrysalis-ffi/src/lib.rs` - Updated comment to reference `SemanticAgent`
- [x] Tests passing: 5/5 ✅

---

## Changes Needed ⏳

### TypeScript Core (Optional - can keep for compatibility)
- [ ] Consider: `src/core/UniformSemanticAgentV2.ts` → `src/core/SemanticAgent.ts`
- [ ] Or: Keep current name, add export alias `export type SemanticAgent = UniformSemanticAgentV2`

### Documentation (High Priority)
- [ ] `README.md` - Update subtitle "Uniform Semantic Agent Transformation" → "Semantic Agent Transformation"
- [ ] `ARCHITECTURE.md` - Update references
- [ ] `docs/STATUS.md` - Update component names
- [ ] `docs/RUST_MIGRATION_ROADMAP_2026-01-16.md` - Update type names
- [ ] `docs/PHASE_1_IMPLEMENTATION_GUIDE.md` - Update type names
- [ ] `src/rust/README.md` - Update type references
- [ ] `src/rust/PHASE_1_KICKOFF.md` - Update type names

### Migration Plans
- [ ] `.claude/plans/abstract-honking-lovelace.md` - Update type names
- [ ] `docs/PHASE_0_RUST_INFRASTRUCTURE_COMPLETE.md` - Update references

### Comments and Descriptions
- [ ] Search codebase for "Uniform Semantic Agent" in comments
- [ ] Update to "Semantic Agent" where appropriate

---

## Backward Compatibility Strategy

### Rust
**Type alias provided**:
```rust
pub type UniformSemanticAgentV2 = SemanticAgent;
```

This allows existing code to continue working while new code uses `SemanticAgent`.

### TypeScript
**Option 1** (Recommended): Add alias, keep file name
```typescript
export interface SemanticAgent extends UniformSemanticAgentV2 {}
// Or:
export type SemanticAgent = UniformSemanticAgentV2;
```

**Option 2**: Rename file and type, add deprecated alias
```typescript
/** @deprecated Use SemanticAgent instead */
export type UniformSemanticAgentV2 = SemanticAgent;
```

### JSON Schema
**No change needed** - Schema version remains "2.0.0", JSON format unchanged

---

## Migration Path

### Phase 1: Rust (✅ Complete)
- New code uses `SemanticAgent`
- Type alias maintains compatibility
- Tests verify both names work

### Phase 2: Documentation (Next)
- Update all docs to use "Semantic Agent"
- Note compatibility alias where relevant

### Phase 3: TypeScript (Optional)
- Add `SemanticAgent` alias in TypeScript
- Gradually migrate code to use new name
- Keep `UniformSemanticAgentV2` for compatibility

### Phase 4: Deprecation (Future)
- After 2-3 releases, mark old name as deprecated
- Eventually remove (if desired)

---

## Search and Replace Guide

### Safe Replacements (Documentation)

**In markdown files**:
```bash
# Titles and headings
"Uniform Semantic Agent" → "Semantic Agent"

# Type names in docs
"UniformSemanticAgentV2" → "SemanticAgent" (with note about compatibility)

# Descriptions
"uniform semantic agent" → "semantic agent"
```

### Code Replacements (Careful)

**Rust** (already done):
```rust
struct SemanticAgent { ... }
pub type UniformSemanticAgentV2 = SemanticAgent;  // Compatibility
```

**TypeScript** (optional, maintain compatibility):
```typescript
// Keep current:
export interface UniformSemanticAgentV2 { ... }

// Add new:
export type SemanticAgent = UniformSemanticAgentV2;
```

---

## Verification Checklist

After all changes:
- [ ] Rust builds: `cargo build --all`
- [ ] Rust tests pass: `cargo test --all`
- [ ] TypeScript builds: `npm run build`
- [ ] TypeScript tests pass: `npm test`
- [ ] Documentation renders correctly
- [ ] No broken links

---

## Rationale

**Why "Semantic Agent"?**

1. **Clearer Concept**: Agents that operate in semantic/meaning space
2. **More Concise**: Drops redundant "Uniform"
3. **Better Branding**: "Semantic Agent" is memorable and descriptive
4. **Aligns with Vision**: Agents as entities with semantic understanding

**Why Keep Compatibility?**

1. **Gradual Migration**: Don't break existing code
2. **External APIs**: May reference old name
3. **Documentation**: Lots of references to update
4. **Team Familiarity**: Gradual adoption easier

---

## Current Status

### ✅ Rust Code
- Primary type: `SemanticAgent`
- Compatibility: `type UniformSemanticAgentV2 = SemanticAgent`
- Tests: 5/5 passing (including legacy alias test)

### ⏳ Documentation
- Needs updates across ~12 documents
- Can be done incrementally

### ⏳ TypeScript
- No changes required immediately
- Can add alias when convenient

---

**Recommendation**:
- Keep Rust rename ✅
- Update documentation gradually
- Add TypeScript alias (no rush)
- Maintain backward compatibility for 2-3 releases

---

**Last Updated**: January 16, 2026
**Status**: Rust complete, documentation in progress
