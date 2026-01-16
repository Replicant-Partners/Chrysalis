/**
 * Chrysalis Native Module Bindings
 *
 * Unified exports for all native language modules:
 * - Rust WASM: Cryptographic operations
 * - OCaml: CRDT implementations
 * - Go: Consensus and gossip protocols
 * - Datalog: Flow graph execution
 */

// ============================================================================
// Crypto (Rust WASM)
// ============================================================================

export {
  HashAlgorithm,
  ChrysalisCrypto,
  initCrypto,
  getCrypto,
  type CryptoModule,
  type Ed25519KeyPairInstance,
  type IncrementalHasherInstance,
} from './crypto';

// ============================================================================
// CRDT (OCaml)
// ============================================================================

export {
  // Vector Clock
  VectorClock,
  type VectorClockComparison,
  type VectorClockData,

  // Counters
  GCounter,
  PNCounter,

  // Sets
  GSet,
  TwoPhaseSet,
  LWWElementSet,
  ORSet,

  // Registers
  LWWRegister,
  MVRegister,

  // Experience types
  SkillAccumulator,
  EpisodeMemory,
  AgentState,
  type Skill,
  type Episode,
  type Belief,
} from './crdt';

// ============================================================================
// Consensus (Go)
// ============================================================================

export {
  // Clients
  GossipClient,
  ByzantineConsensusClient,
  SyncCoordinatorClient,

  // Utilities
  MedianAggregator,
  createConsensusClient,

  // Types
  type MessageType,
  type SyncProtocol,
  type MergeStrategy,
  type GossipMessage,
  type Peer,
  type Vote,
  type ConsensusResult,
  type SyncEvent,
  type SyncConfig,
  type ConsensusConfig,
} from './consensus';

// ============================================================================
// Datalog Flow
// ============================================================================

export {
  DatalogFlowEngine,
  FlowExecutor,
  type NodeType,
  type FlowNode,
  type FlowEdge,
  type ExecutionState,
  type ValidationResult,
  type FlowDefinition,
  type NodeHandler,
} from './datalog';

// ============================================================================
// Convenience Factory
// ============================================================================

import { ChrysalisCrypto, initCrypto } from './crypto';
import { AgentState, VectorClock } from './crdt';
import { createConsensusClient, SyncCoordinatorClient } from './consensus';
import { DatalogFlowEngine, FlowExecutor } from './datalog';

export interface ChrysalisNativeConfig {
  agentId: string;
  instanceId: string;
  consensusUrl?: string;
}

export interface ChrysalisNative {
  crypto: ChrysalisCrypto;
  agentState: AgentState;
  vectorClock: VectorClock;
  sync: SyncCoordinatorClient | null;
  flow: DatalogFlowEngine;
  executor: FlowExecutor;
}

/**
 * Create a fully configured Chrysalis native module instance.
 */
export async function createChrysalisNative(
  config: ChrysalisNativeConfig
): Promise<ChrysalisNative> {
  // Initialize crypto
  const crypto = await ChrysalisCrypto.create();

  // Create agent state
  const agentState = AgentState.create(config.agentId);
  const vectorClock = VectorClock.singleton(config.instanceId);

  // Create sync client if URL provided
  let sync: SyncCoordinatorClient | null = null;
  if (config.consensusUrl) {
    const clients = createConsensusClient({
      baseUrl: config.consensusUrl,
      agentId: config.agentId,
      instanceId: config.instanceId,
    });
    sync = clients.sync;
  }

  // Create flow engine
  const flow = new DatalogFlowEngine();
  const executor = new FlowExecutor(flow);

  return {
    crypto,
    agentState,
    vectorClock,
    sync,
    flow,
    executor,
  };
}

// Default export
export default {
  createChrysalisNative,
};