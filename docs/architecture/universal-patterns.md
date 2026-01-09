# Universal Patterns

> **Source:** [`src/core/patterns/index.ts`](../../src/core/patterns/index.ts)  
> **Status:** ✅ All 10 Patterns Implemented

## Overview

Chrysalis is built on **10 mathematically-proven universal patterns** from distributed systems research. These patterns provide the foundational primitives for:

- **Identity verification** (Hash, Signature)
- **Security** (Encryption)
- **Distributed consensus** (Byzantine, Threshold)
- **Coordination** (Time, Gossip, Random)
- **Data structures** (DAG, CRDT)
- **Convergence** (Fixed-point attractors)

Each pattern can be resolved at multiple scales through the [`AdaptivePatternResolver`](../../src/fabric/PatternResolver.ts).

---

## Pattern Resolution

The [`AdaptivePatternResolver`](../../src/fabric/PatternResolver.ts:300) automatically selects the appropriate implementation based on deployment context:

```typescript
// From src/fabric/PatternResolver.ts
export type ResolutionSource = 'mcp' | 'embedded' | 'library' | 'go';

export interface DeploymentContext {
  distributed: boolean;           // Multi-node deployment?
  mcp_available: boolean;         // MCP servers accessible?
  performance_critical: boolean;  // Latency < 1ms required?
  prefer_reusability: boolean;    // Favor shared services?
}
```

| Context | Resolution | Latency |
|---------|------------|---------|
| Single-node, performance-critical | **Embedded** | ~0.1ms |
| Distributed, MCP available | **MCP/Go** | ~5ms |
| Adaptive | Automatic selection | Variable |

---

## Pattern #1: Hash Functions

> **Source:** [`src/core/patterns/Hashing.ts`](../../src/core/patterns/Hashing.ts)

### Purpose
One-way transformation for identity and integrity verification.

### Mathematical Foundation
```
H: M → D where |D| << |M|
∀m ∈ M: H(m) is deterministic
Finding m' where H(m') = H(m) is computationally infeasible
```

### Interface

```typescript
// From src/fabric/PatternResolver.ts:70
export interface HashImplementation {
  hash(data: string | Uint8Array, algorithm: string): Promise<string>;
  verify(data: string | Uint8Array, expectedHash: string): Promise<boolean>;
  generateFingerprint(identity: any): Promise<string>;
}
```

### Usage

```typescript
const resolver = createPatternResolver('embedded');
const hashImpl = await resolver.resolveHash();

// Generate agent fingerprint
const fingerprint = await hashImpl.implementation.generateFingerprint({
  name: 'Agent Smith',
  designation: 'Security Analyst',
  created: new Date().toISOString()
});

// Verify integrity
const isValid = await hashImpl.implementation.verify(data, expectedHash);
```

### Algorithms Supported
- SHA-256 (64 chars)
- SHA-384 (96 chars) - **Default**
- SHA-512 (128 chars)

---

## Pattern #2: Digital Signatures

> **Source:** [`src/core/patterns/DigitalSignatures.ts`](../../src/core/patterns/DigitalSignatures.ts)

### Purpose
Unforgeable identity verification and message authentication.

### Mathematical Foundation
```
KeyGen() → (sk, pk)
Sign(sk, m) → σ
Verify(pk, m, σ) → {true, false}
```

### Interface

```typescript
// From src/fabric/PatternResolver.ts:79
export interface SignatureImplementation {
  generateKeypair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }>;
  sign(message: string | Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>;
  verify(message: string | Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>;
}
```

### Usage

```typescript
const resolver = createPatternResolver('embedded');
const sigImpl = await resolver.resolveSignature();

// Generate keypair
const { privateKey, publicKey } = await sigImpl.implementation.generateKeypair();

// Sign message
const signature = await sigImpl.implementation.sign('Hello, World!', privateKey);

// Verify signature
const isValid = await sigImpl.implementation.verify('Hello, World!', signature, publicKey);
```

### Algorithm
- **Ed25519** (EdDSA over Curve25519)

---

## Pattern #3: Encryption

> **Source:** [`src/core/patterns/Encryption.ts`](../../src/core/patterns/Encryption.ts)

### Purpose
One-way functions with trapdoor for secure data exchange.

### Mathematical Foundation
```
Encrypt(pk, m) → c
Decrypt(sk, c) → m
```

### Usage
Used for **shadow embedding** - storing encrypted agent metadata in framework-specific formats that can be recovered during morphing.

---

## Pattern #4: Byzantine Agreement

> **Source:** [`src/core/patterns/ByzantineResistance.ts`](../../src/core/patterns/ByzantineResistance.ts)

### Purpose
Consensus under adversarial conditions where up to 1/3 of participants may be faulty.

### Mathematical Foundation
```
Byzantine fault tolerance: n ≥ 3f + 1
Where n = total nodes, f = faulty nodes
```

### Interface

```typescript
// From src/fabric/PatternResolver.ts:112
export interface ThresholdImplementation {
  trimmedMean(values: number[], trimPercent?: number): number;
  median(values: number[]): number;
  hasSupermajority(yes: number, total: number, threshold?: number): boolean;
  byzantineAgreement<T>(values: T[]): T | null;
}
```

### Usage

```typescript
const resolver = createPatternResolver('embedded');
const thresholdImpl = await resolver.resolveThreshold();

// Check for supermajority (default 2/3)
const hasConsensus = thresholdImpl.implementation.hasSupermajority(7, 10);

// Byzantine agreement on values
const agreedValue = thresholdImpl.implementation.byzantineAgreement([
  'action_A', 'action_A', 'action_A', 'action_B'
]); // Returns 'action_A' if supermajority
```

---

## Pattern #5: Logical Time

> **Source:** [`src/core/patterns/LogicalTime.ts`](../../src/core/patterns/LogicalTime.ts)

### Purpose
Causal ordering of events in distributed systems without relying on synchronized physical clocks.

### Mathematical Foundation
```
Lamport: e1 → e2 implies C(e1) < C(e2)
Vector: V[i] ← max(V[i], V'[i]) for all i
```

### Interface

```typescript
// From src/fabric/PatternResolver.ts:99
export interface TimeImplementation {
  createLamportClock(nodeId: string): any;
  createVectorClock(nodeId: string, numNodes: number, mapping: Map<string, number>): any;
  consensusTimestamp(timestamps: number[]): number;
}
```

### Clock Types

| Type | Use Case | Overhead |
|------|----------|----------|
| **Lamport Clock** | Total ordering | O(1) |
| **Vector Clock** | Causal ordering | O(n) |

### Usage

```typescript
const resolver = createPatternResolver('embedded');
const timeImpl = await resolver.resolveTime();

// Create Lamport clock
const clock = timeImpl.implementation.createLamportClock('agent-1');
clock.tick(); // Increment on local event
clock.update(receivedTimestamp); // Update on receive

// Consensus timestamp from multiple sources
const agreed = timeImpl.implementation.consensusTimestamp([1704067200, 1704067205, 1704067203]);
```

---

## Pattern #6: CRDTs

> **Source:** [`src/core/patterns/CRDTs.ts`](../../src/core/patterns/CRDTs.ts)

### Purpose
Conflict-free Replicated Data Types for automatic merge without coordination.

### Mathematical Foundation
```
State-based: merge(s1, s2) = s1 ⊔ s2 (join semilattice)
Operation-based: ops are commutative, associative, idempotent
```

### Types Implemented

| CRDT | Type | Use Case |
|------|------|----------|
| G-Counter | Grow-only counter | Event counting |
| PN-Counter | Positive-negative counter | Bidirectional counting |
| G-Set | Grow-only set | Membership tracking |
| OR-Set | Observed-remove set | Dynamic membership |
| LWW-Register | Last-writer-wins | Single value storage |

### Integration with Yjs

Chrysalis uses **Yjs** for document-level CRDTs:

```typescript
// From package.json dependencies
"y-websocket": "^3.0.0",
"yjs": "^13.6.29"
```

---

## Pattern #7: Gossip Protocol

> **Source:** [`src/core/patterns/Gossip.ts`](../../src/core/patterns/Gossip.ts)

### Purpose
Epidemic information dissemination across distributed nodes.

### Mathematical Foundation
```
P(all_informed, round_r) approaches 1 as r → log(n) + c*log(log(n))
```

### Properties
- **Scalable**: O(log n) rounds to full dissemination
- **Resilient**: Tolerates node failures
- **Decentralized**: No coordinator required

---

## Pattern #8: DAG

> **Source:** [`src/core/patterns/DAG.ts`](../../src/core/patterns/DAG.ts)

### Purpose
Directed Acyclic Graph structure for dependency management and causal ordering.

### Interface

```typescript
// From src/fabric/PatternResolver.ts:88
export interface DAGImplementation {
  createGraph(): any;
  addNode(graph: any, nodeId: string, data?: any): void;
  addEdge(graph: any, from: string, to: string): void;
  topologicalSort(graph: any): string[];
  ancestors(graph: any, nodeId: string): Set<string>;
}
```

### Usage

```typescript
// Task dependency resolution
const dag = dagImpl.createGraph();
dagImpl.addNode(dag, 'task-1');
dagImpl.addNode(dag, 'task-2');
dagImpl.addEdge(dag, 'task-1', 'task-2'); // task-2 depends on task-1

const order = dagImpl.topologicalSort(dag); // ['task-1', 'task-2']
```

### Library
Uses **graphlib** for DAG operations.

---

## Pattern #9: Convergence

> **Source:** [`src/core/patterns/Convergence.ts`](../../src/core/patterns/Convergence.ts)

### Purpose
Fixed-point attractors for skill proficiency and belief conviction.

### Mathematical Foundation
```
f: X → X where ∃x* such that f(x*) = x*
Convergence: lim_{n→∞} f^n(x_0) = x*
```

### Applications in Chrysalis

| Domain | Convergence Use |
|--------|----------------|
| Skill proficiency | Approaches mastery asymptote |
| Belief conviction | Stabilizes with evidence |
| Memory importance | Decays/reinforces over time |

---

## Pattern #10: Random Selection

> **Source:** [`src/core/patterns/Random.ts`](../../src/core/patterns/Random.ts)

### Purpose
Distributed coordination through randomness for leader election and load balancing.

### Mathematical Foundation
```
CSPRNG: Cryptographically Secure Pseudo-Random Number Generator
Uniformity: P(x ∈ [a,b]) = (b-a)/range
```

### Usage
- Leader election among peer agents
- Random backoff for retry policies
- Probabilistic sampling for memory retrieval

---

## Pattern Resolution Factory

```typescript
// From src/fabric/PatternResolver.ts:487
export function createPatternResolver(
  deploymentModel: 'embedded' | 'distributed' | 'adaptive',
  mcpClient?: MCPPatternClient
): AdaptivePatternResolver;
```

| Model | Context |
|-------|---------|
| `embedded` | Local execution, performance-critical |
| `distributed` | Multi-node with MCP servers |
| `adaptive` | Runtime detection |

---

## Circuit Breaker Protection

External service calls (MCP, Go gRPC) are protected by circuit breakers:

```typescript
// From src/fabric/PatternResolver.ts:303
private hashCircuitBreaker: CircuitBreaker<PatternResolution<HashImplementation>>;
private signatureCircuitBreaker: CircuitBreaker<PatternResolution<SignatureImplementation>>;
```

When external services fail, the resolver automatically falls back to embedded implementations.

---

## Related Documentation

- [Architecture Overview](./overview.md)
- [Experience Sync](./experience-sync.md) - Uses patterns for distributed sync
- [Memory System](./memory-system.md) - Uses patterns for deduplication