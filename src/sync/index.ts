/**
 * Sync Module - Experience Synchronization Infrastructure
 * 
 * Provides distributed synchronization capabilities for agent instances:
 * - Streaming sync for real-time updates
 * - Lumped sync for batch processing
 * - Check-in sync for periodic state reconciliation
 * - Gossip protocol for O(log N) propagation
 * - CRDT state management for conflict-free merging
 * 
 * @module sync
 * @version 2.0.0
 */

// Experience Sync Manager
export {
  ExperienceSyncManager,
  SyncStatus,
  MergeResult,
} from './ExperienceSyncManager';

// Sync Protocols
export { StreamingSync } from './StreamingSync';
export { LumpedSync } from './LumpedSync';
export { CheckInSync } from './CheckInSync';

// Experience Transport
export {
  ExperienceTransport,
  TransportPayload,
  createExperienceTransport,
} from './ExperienceTransport';

// Gossip Protocol
export {
  GossipProtocol,
  GossipNetworkManager,
  GossipConfig,
  DEFAULT_GOSSIP_CONFIG,
  GossipPeer,
  GossipMessage,
  GossipMessageType,
  GossipPayload,
  PushPayload,
  PullPayload,
  PushPullPayload,
  AntiEntropyPayload,
  HeartbeatPayload,
  MembershipPayload,
  GossipStats,
  GossipEventType,
} from './GossipProtocol';

// CRDT State Management
export {
  CRDTStateManager,
  GSet,
  ORSet,
  LWWRegister,
  LWWMap,
  VectorClockOps,
  CRDTStateSnapshot,
  CRDTStateStats,
  CRDTPropertyVerifier,
  VectorClock,
  CRDTMetadata,
  CRDTOperation,
} from './CRDTState';
