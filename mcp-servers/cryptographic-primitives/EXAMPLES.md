# Cryptographic Primitives MCP Server - Usage Examples

## Hash Operations

### Computing a hash

```javascript
// Request
{
  "tool": "hash",
  "arguments": {
    "data": "hello world",
    "algorithm": "SHA-256",
    "encoding": "utf8"
  }
}

// Response
{
  "hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  "algorithm": "SHA-256"
}
```

### Verifying a hash

```javascript
{
  "tool": "verify_hash",
  "arguments": {
    "data": "hello world",
    "expectedHash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    "algorithm": "SHA-256"
  }
}

// Response: { "valid": true }
```

## Merkle Tree Operations

### Building a Merkle tree

```javascript
{
  "tool": "merkle_root",
  "arguments": {
    "leaves": ["data1", "data2", "data3", "data4"],
    "algorithm": "SHA-256",
    "encoding": "utf8"
  }
}

// Response
{
  "root": "...",
  "algorithm": "SHA-256",
  "leafCount": 4
}
```

### Generating a Merkle proof

```javascript
{
  "tool": "merkle_proof",
  "arguments": {
    "leaves": ["data1", "data2", "data3", "data4"],
    "leafIndex": 2,
    "algorithm": "SHA-256"
  }
}

// Response
{
  "leaf": "...",
  "leafIndex": 2,
  "siblings": ["...", "..."],
  "root": "...",
  "treeSize": 4
}
```

### Verifying a Merkle proof

```javascript
{
  "tool": "verify_merkle_proof",
  "arguments": {
    "proof": {
      "leaf": "...",
      "leafIndex": 2,
      "siblings": ["...", "..."],
      "root": "...",
      "treeSize": 4
    },
    "algorithm": "SHA-256"
  }
}

// Response: { "valid": true }
```

## Ed25519 Signatures

### Generating a keypair

```javascript
{
  "tool": "ed25519_keygen",
  "arguments": {}
}

// Response
{
  "privateKey": "...",  // 64 hex chars (32 bytes)
  "publicKey": "...",   // 64 hex chars (32 bytes)
  "algorithm": "Ed25519"
}
```

### Signing a message

```javascript
{
  "tool": "ed25519_sign",
  "arguments": {
    "message": "Hello, World!",
    "privateKey": "...",
    "encoding": "utf8"
  }
}

// Response
{
  "signature": "..."  // 128 hex chars (64 bytes)
}
```

### Verifying a signature

```javascript
{
  "tool": "ed25519_verify",
  "arguments": {
    "message": "Hello, World!",
    "signature": "...",
    "publicKey": "...",
    "encoding": "utf8"
  }
}

// Response: { "valid": true }
```

## BLS Signatures

### Generating a BLS keypair

```javascript
{
  "tool": "bls_keygen",
  "arguments": {}
}

// Response
{
  "privateKey": "...",  // 64 hex chars (32 bytes)
  "publicKey": "...",   // 96 hex chars (48 bytes, G1)
  "algorithm": "BLS12-381"
}
```

### Signing with BLS

```javascript
{
  "tool": "bls_sign",
  "arguments": {
    "message": "Important message",
    "privateKey": "...",
    "encoding": "utf8"
  }
}

// Response
{
  "signature": "..."  // 192 hex chars (96 bytes, G2)
}
```

### Aggregating signatures

```javascript
// Sign same message with 3 different keys
const sig1 = bls_sign(message, privateKey1);
const sig2 = bls_sign(message, privateKey2);
const sig3 = bls_sign(message, privateKey3);

// Aggregate signatures
{
  "tool": "bls_aggregate_signatures",
  "arguments": {
    "signatures": [sig1, sig2, sig3]
  }
}

// Response
{
  "aggregated": "...",  // Single signature
  "count": 3
}

// Aggregate public keys
{
  "tool": "bls_aggregate_publickeys",
  "arguments": {
    "publicKeys": [publicKey1, publicKey2, publicKey3]
  }
}

// Response
{
  "aggregated": "...",  // Single public key
  "count": 3
}

// Verify aggregated signature with aggregated public key
{
  "tool": "bls_verify",
  "arguments": {
    "message": "Important message",
    "signature": "<aggregated_signature>",
    "publicKey": "<aggregated_publickey>"
  }
}

// Response: { "valid": true }
```

## Cryptographic Random

### Generate random bytes

```javascript
{
  "tool": "random_bytes",
  "arguments": {
    "length": 32
  }
}

// Response
{
  "bytes": "...",  // 64 hex chars (32 bytes)
  "length": 32
}
```

### Generate random integer

```javascript
{
  "tool": "random_int",
  "arguments": {
    "max": 100
  }
}

// Response
{
  "value": 42,
  "range": "[0, 100)"
}
```

### Random selection

```javascript
{
  "tool": "random_select",
  "arguments": {
    "array": ["Alice", "Bob", "Charlie", "Diana"]
  }
}

// Response
{
  "selected": "Bob",
  "arrayLength": 4
}
```

### Random sampling (without replacement)

```javascript
{
  "tool": "random_sample",
  "arguments": {
    "array": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "k": 3
  }
}

// Response
{
  "sample": [3, 7, 1],
  "sampleSize": 3,
  "arrayLength": 10
}
```

### Generate UUID

```javascript
{
  "tool": "random_uuid",
  "arguments": {}
}

// Response
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Use Cases

### 1. Content Integrity

```javascript
// Store hash of document
const doc = "Important contract...";
const hash = await hash(doc, "SHA-256");
// Store hash separately

// Later, verify document hasn't changed
const valid = await verify_hash(doc, storedHash, "SHA-256");
```

### 2. Multi-Party Signing

```javascript
// Committee of 5 members signs decision
const message = "Approved: Budget 2024";
const signatures = [];

for (const member of committee) {
  const sig = await bls_sign(message, member.privateKey);
  signatures.push(sig);
}

// Aggregate into single signature
const aggregated = await bls_aggregate_signatures(signatures);

// Anyone can verify with aggregated public key
const allPublicKeys = committee.map(m => m.publicKey);
const aggPubKey = await bls_aggregate_publickeys(allPublicKeys);
const valid = await bls_verify(message, aggregated, aggPubKey);
```

### 3. Merkle Proof of Membership

```javascript
// Build tree from transaction list
const transactions = [...];  // 1000 transactions
const root = await merkle_root(transactions);

// Store root in blockchain/header

// Prove transaction #523 is in the set
const proof = await merkle_proof(transactions, 523);

// Lightweight verification (only needs root + proof)
const valid = await verify_merkle_proof(proof);
// No need to download all 1000 transactions!
```

### 4. Secure Random Selection

```javascript
// Fair lottery selection
const participants = ["Alice", "Bob", "Charlie", ...];  // 1000 people
const winners = await random_sample(participants, 10);

// Each selection uses cryptographically secure randomness
// No possibility of bias or prediction
```

### 5. Distributed Consensus Voting

```javascript
// Round 1: Nodes sign their votes
const vote = { round: 1, value: "A" };
const signature = await ed25519_sign(JSON.stringify(vote), nodePrivateKey);

// Round 2: Collect votes and verify
for (const [nodeId, vote, sig] of receivedVotes) {
  const valid = await ed25519_verify(
    JSON.stringify(vote),
    sig,
    nodePublicKeys[nodeId]
  );
  
  if (!valid) {
    console.log("Invalid signature from", nodeId);
    continue;
  }
  
  // Process valid vote...
}
```

## Performance Notes

All operations are synchronous except Ed25519 operations (which are async).

Typical performance on commodity hardware:
- Hash: >10,000 ops/sec
- Merkle operations: ~1,000-5,000 ops/sec  
- Ed25519 sign: ~500-1,000 ops/sec
- Ed25519 verify: ~1,000-2,000 ops/sec
- BLS operations: ~100-500 ops/sec (more expensive)
- Random: >100,000 ops/sec

## Security Notes

1. **Hash algorithms**: All supported algorithms (SHA-2 family, BLAKE3) are currently secure
2. **Signatures**: Ed25519 and BLS are quantum-vulnerable (10-30 year timeline)
3. **Random**: Uses OS entropy, quality depends on platform
4. **Side-channels**: Ed25519 implementation is constant-time
5. **Dependencies**: Zero external dependencies beyond Noble libraries (audited)

## Algorithm Selection Guide

**Hashing:**
- SHA-256: Most compatible, widely used (Bitcoin, TLS)
- SHA-384/512: Higher security margin, slower
- BLAKE3: Fastest, modern, good for large data

**Signatures:**
- Ed25519: Compact (64-byte sigs), fast, deterministic
- BLS: Enables aggregation, threshold signatures, slower

**Random:**
- Always use crypto random for security-sensitive operations
- Rejection sampling ensures unbiased selection
