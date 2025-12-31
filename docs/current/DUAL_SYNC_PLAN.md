# Dual Sync Plan: Public CRDT (SyncedStore/Yjs) + Private Ledger (Hedera)

## Purpose
Provide two complementary synchronization planes:
- **Public/Shared (CRDT)**: low-friction collaboration and informal sharing using SyncedStore/Yjs over WebSocket; emphasizes availability and mergeability with untrusted participants.
- **Private/Secure (Ledger)**: authenticated, encrypted, auditable exchanges on Hedera subnet/fork (with path to mainnet) for high-value state, contracts, and commitments.

## Architecture (current vs target)
- **Current**: Request/response sync (HTTPS/WebSocket/MCP), embedding-based dedupe, sanitize/rate-limit, voyeur/metrics. No CRDT/gossip/ledger yet.
- **Target**:
  - CRDT plane (SyncedStore/Yjs) for shared docs/memos/interim memories.
  - Ledger plane (Hedera subnet/fork) for signed commits, key rotation, private data hashes, and optional mainnet anchoring.
  - Bridging: anchor hashes across planes (CRDT hash → ledger; ledger tx hash → CRDT) for integrity.

## Transports
- **CRDT plane**: SyncedStore (Yjs) over WebSocket; per-channel documents; CRDT merge; optional snapshots/persistence.
- **Ledger plane**: Hedera SDK client; commit/query/keyrotate ops; payloads encrypted off-ledger, hashes on-ledger; subnet initially, mainnet optional later.

## Trust Tiers
- Tier 1 (human/privileged): Ledger-first; optional CRDT hash broadcast.
- Tier 2 (known agents): Ledger for critical events; CRDT for collaboration; signatures recommended.
- Tier 3 (external/untrusted): CRDT only with strict sanitize/rate-limit; optional encrypted payloads for “friends-only” rooms.

## Data Flow (target)
```mermaid
flowchart TD
  E[Event/Memory] --> San[Sanitize + rate limit]
  San --> Hash[Hash + sign]
  Hash --> CRDT{CRDT enabled?}
  CRDT -->|Yes| Pub[SyncedStore/Yjs update]
  CRDT -->|No| Skip1[Skip CRDT]
  Hash --> SEC{Secure?}
  SEC -->|Yes| Enc[Encrypt payload] --> Led[Hedera commit (hash only on-ledger)]
  SEC -->|No| Skip2[Skip ledger]
  Pub --> Anchor1[Anchor CRDT hash to ledger (optional)]
  Led --> Anchor2[Mirror tx hash to CRDT (optional)]
  Pub --> Obs[Voyeur/metrics (redacted)]
  Led --> Obs
```

## API Sketch (new adapters)
- **CRDT (public)**:
  - `crdt_join(channel_id, role)` → session token
  - `crdt_update(doc_id, payload)` → CRDT merge
  - `crdt_snapshot(doc_id)` → hash + snapshot
- **Ledger (private)**:
  - `ledger_commit(type, hash, metadata)` → tx id
  - `ledger_query(tx_id|hash)` → proof/status
  - `ledger_keyrotate(agent_id, new_pubkey)` → tx id

## Configuration
- `sync.public_crdt`: enable, server URL, channel policy, redact flag, persistence path.
- `sync.ledger`: hedera endpoint, subnet/mainnet toggle, apiKey/creds, encryption key management, anchoring on/off.
- `trust_tiers`: map source → allowed transports, thresholds, rate limits.

## Security & Privacy
- Sanitize + PII stripping (Tier 2/3), strict rate limits on public plane.
- Signatures required on ledger commits; TLS for ledger endpoints.
- Encrypt payloads stored off-ledger; only hashes on-chain.
- Redaction on voyeur/metrics for public plane by default.

## References
- SyncedStore/Yjs: https://syncedstore.org/docs/ (CRDT over WebSocket).
- Hedera gossip-about-gossip + virtual voting: Leemon Baird, “The Swirlds Hashgraph Consensus Algorithm” (2016).
- CRDT theory: Shapiro et al., “A comprehensive study of Convergent and Commutative Replicated Data Types” (2011).
- Gossip efficiency: Malkhi et al., “Byzantine quorum systems” (1998); Birman, “Gossip-based protocols” (1999).
