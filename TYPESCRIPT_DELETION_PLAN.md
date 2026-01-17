# TypeScript Deletion Plan

**Rationale**: TypeScript replaced by superior Rust implementations. TypeScript is messy, lacks proper abstraction, nightmare to maintain.

---

## Files to Delete (Replaced by Rust)

### Core Types (Replaced by chrysalis-core)
- [x] src/core/UniformSemanticAgent.ts → Rust SemanticAgent
- [x] src/core/UniformSemanticAgentV2.ts → Rust SemanticAgent
- [x] src/core/agent-components/* (14 files) → Rust component_types.rs

### Cryptography (Replaced by chrysalis-security/crypto.rs)
- [x] src/security/crypto.ts → Rust crypto.rs (scrypt, AES-GCM, secure wiping)
- [x] src/core/Encryption.ts → Rust crypto.rs
- [x] src/core/patterns/Encryption.ts → Rust crypto.rs

### Patterns (Replaced by chrysalis-core + native/rust-crypto)
- [x] src/core/patterns/Hashing.ts → native/rust-crypto (already Rust)
- [x] src/core/patterns/DigitalSignatures.ts → native/rust-crypto (already Rust)
- [ ] src/core/patterns/CRDTs.ts → Phase 4 (chrysalis-sync)
- [ ] src/core/patterns/Gossip.ts → Phase 4 (chrysalis-sync)
- [ ] src/core/patterns/DAG.ts → Phase 4
- [ ] src/core/patterns/ByzantineResistance.ts → Phase 4
- [ ] src/core/patterns/LogicalTime.ts → Phase 4
- [ ] src/core/patterns/Convergence.ts → Phase 4
- [ ] src/core/patterns/Random.ts → Phase 4

### Security (Phase 2 - in progress)
- [ ] src/security/ApiKeyWallet.ts → Rust wallet.rs (after complete implementation)
- [ ] src/security/ApiKeyRegistry.ts → Rust (after wallet complete)

### Utils (Phase 2)
- [ ] src/utils/CostControl.ts → Rust cost_control.rs (enhance current)

---

## Deletion Commands

```bash
# Core types - READY TO DELETE NOW
rm src/core/UniformSemanticAgent.ts
rm src/core/UniformSemanticAgentV2.ts
rm -rf src/core/agent-components/

# Crypto - READY TO DELETE NOW
rm src/security/crypto.ts
rm src/core/Encryption.ts
rm src/core/patterns/Encryption.ts

# Patterns already in Rust
rm src/core/patterns/Hashing.ts
rm src/core/patterns/DigitalSignatures.ts
```

---

## Rust Status Check

**SemanticAgent**: ✅ Complete standalone implementation, no TS dependencies
**Crypto**: ✅ Complete standalone implementation, no TS dependencies
**Validation**: ✅ Logic ported, not wrapped
**FFI**: ✅ Direct Rust→JS, not TS→Rust→JS

All Rust code is clean, proper implementations - not wrappers.

---

**Action**: Delete TypeScript files now that Rust replacements are verified.
