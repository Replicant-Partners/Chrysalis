# Cryptographic Primitives MCP Server

## Overview

Layer 1 MCP server providing foundational cryptographic operations for distributed systems:

- **Hash Functions**: SHA-256, SHA-384, SHA-512, BLAKE3
- **Merkle Trees**: Construction, proof generation, verification
- **Digital Signatures**: Ed25519 (compact, fast)
- **BLS Signatures**: Aggregation and threshold signatures
- **Cryptographic Random**: Secure random generation

## Installation

```bash
cd mcp-servers/cryptographic-primitives
npm install
npm run build
```

## Usage

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "crypto-primitives": {
      "command": "node",
      "args": [
        "/home/mdz-axolotl/Documents/GitClones/CharactersAgents/mcp-servers/cryptographic-primitives/dist/index.js"
      ]
    }
  }
}
```

## Architecture

Based on audited, battle-tested libraries:
- `@noble/hashes` - Audited by Trail of Bits (2022)
- `@noble/ed25519` - Constant-time, side-channel resistant
- `@noble/curves` - BLS12-381 for aggregation

Zero dependencies beyond Noble libraries (supply chain security).

## Tools Provided

### Hash Operations
- `hash` - Compute cryptographic hash
- `verify_hash` - Verify data against hash
- `merkle_root` - Build Merkle tree, return root
- `merkle_proof` - Generate Merkle proof for leaf
- `verify_merkle_proof` - Verify Merkle proof

### Signature Operations
- `ed25519_keygen` - Generate Ed25519 keypair
- `ed25519_sign` - Sign message with Ed25519
- `ed25519_verify` - Verify Ed25519 signature
- `bls_keygen` - Generate BLS12-381 keypair
- `bls_sign` - Sign message with BLS
- `bls_verify` - Verify BLS signature
- `bls_aggregate_signatures` - Aggregate multiple BLS signatures
- `bls_aggregate_publickeys` - Aggregate multiple BLS public keys

### Random Operations
- `random_bytes` - Generate cryptographic random bytes
- `random_int` - Generate random integer in range
- `random_select` - Select random element from array

## Security Properties

### Hash Functions
- **Preimage resistance**: Computationally infeasible to find input from hash
- **Second preimage resistance**: Infeasible to find different input with same hash
- **Collision resistance**: Infeasible to find two inputs with same hash

### Digital Signatures
- **Unforgeability**: Cannot create valid signature without private key (EUF-CMA)
- **Non-repudiation**: Valid signature proves private key holder signed
- **Public verifiability**: Anyone with public key can verify

### Random Generation
- **Unpredictability**: Cannot predict next value from previous values
- **Uniform distribution**: Each value equally probable
- **Independence**: Each output independent

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Library vulnerability | Low | Audited libraries, monitor CVEs |
| Quantum computing | Low | Ed25519 vulnerable in 10-30 years, design supports algorithm agility |
| Side-channel attacks | Low | Constant-time implementations |
| Dependency compromise | Low | Zero deps beyond Noble (verified maintainer) |

## Performance Characteristics

Target performance on commodity hardware:
- Hash operations: >1,000 ops/sec
- Ed25519 signatures: >500 ops/sec
- Ed25519 verification: >1,000 ops/sec
- BLS operations: >100 ops/sec (more expensive)

## Post-Quantum Migration Path

Current: Ed25519 (quantum-vulnerable)
→ Hybrid: Ed25519 + Dilithium
→ Future: Pure Dilithium or FALCON

API designed for algorithm agility.

## Development

```bash
# Build
npm run build

# Development mode (watch)
npm run dev

# Run tests
npm test

# Test with watch
npm test:watch
```

## License

MIT
