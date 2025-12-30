/**
 * Chrysalis Universal Patterns Export
 * 
 * All 10 mathematically-proven universal patterns from distributed systems research
 * Each pattern implements lossless transformation between MCP, Multi-Agent, and Orchestrated types
 */

// Pattern #1: Hash Functions (One-Way Transformation)
export * from './Hashing';

// Pattern #2: Digital Signatures (Unforgeable Identity) 
export * from './DigitalSignatures';

// Pattern #3: Encryption (One-Way Functions with Trapdoor)
export * from './Encryption';

// Pattern #4: Byzantine Agreement (Consensus under Adversarial Conditions)
export * from './ByzantineResistance';

// Pattern #5: Logical Time (Causal Ordering)
export * from './LogicalTime';

// Pattern #6: CRDTs (Conflict-free Replicated Data Types)
export * from './CRDTs';

// Pattern #7: Gossip Protocol (Information Dissemination)
export * from './Gossip';

// Pattern #8: DAG (Directed Acyclic Graph Structure)
export * from './DAG';

// Pattern #9: Convergence (Attractors and Fixed Points)
export * from './Convergence';

// Pattern #10: Random Selection (Distributed Coordination)
export * from './Random';