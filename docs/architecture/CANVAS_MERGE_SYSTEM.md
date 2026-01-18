# Canvas Merge System

## Purpose
Define a clean, minimal collaboration model for canvas scatter/gather that:
- Executes merges via the Universal Adapter.
- Requires distributed handshake agreement before merge execution.
- Minimizes user interaction to merge initiation and method approval.
- Preserves user sovereignty (any collaborator can liberate their local canvas).

## Core principles
- **No owners, only originators**: originator is metadata only; no permission authority.
- **User sovereignty**: any collaborator can liberate their local copy at any time.
- **Reciprocity**: if your local saved state diverged, you must contribute to catch up.
- **Low cognitive load**: users only initiate a merge and approve its method.
- **Locked method**: merge method is fixed for active collaboration; change requires liberation.

## Social contract framing
This merge system is a social contract applied to agentic compute and CRDT collaboration.
The handshake is the consent event; the adapter is the contract executor.

Contract principles:
- **Consent**: collaboration exists only with explicit agreement (handshake window).
- **Reciprocity**: contributions and catch-up are paired (give and take).
- **Non-domination**: no owners; anyone can liberate their local canvas.
- **Procedural justice**: clear, minimal steps (initiate + approve).
- **Due process**: roster changes are visible; pruning is time-boxed and notified.
- **Transparency**: audit records are produced for every merge execution.

## Contract terms (minimal)
The merge prompt executed by the adapter encodes the contract:
- Roster: active + invited/offline collaborators.
- Window: 30 days; invalidated on roster change (except non-response pruning).
- Reciprocity: diverged state requires contribution before catch-up.
- Streaming: only two states (streaming or DND).
- Method lock: method cannot change while collaboration is active.

## Canonical states
- **Group-linked canvas**: participates in shared merges.
- **Liberated canvas**: severed lineage, no automatic merge back.

## Saved state model
We operate on saved state only.
- **Current saved state**: the locally persisted canvas snapshot.
- **Last shared state**: the most recent shared snapshot acknowledged by the group.
- **Unshared work**: current saved state differs from last shared state.

Autosave rules:
- **Continuous**: lazy autosave as updates arrive (best-effort, may lag).
- **Nightly / on-open**: autosave at the start of the sync cycle to capture current saved state.

## Sync cadence (per-user preference)
Each collaborator sets a local cadence:
- **Continuous**: lazy, best-effort near real time when idle.
- **Nightly**: scheduled merge window.
- **On-open**: merge occurs when the canvas is opened.

## Contribute + catch-up (reciprocity rule)
- If **unshared work exists**, you must contribute before catching up.
- If **no unshared work**, you can catch up immediately.

## Tokens vs handshake
- **Session token**: single-use, 8-hour TTL; governs read / read-write / execute.
- **Handshake window**: 30-day collaboration approval for merges (separate from tokens).

## Distributed handshake protocol
**Roster**: active + invited/offline collaborators.

Steps:
1. **Propose**: adapter builds a MergePlan and asks for approval.
2. **Collect**: all roster participants approve the merge method.
3. **Execute**: adapter runs merge after approvals are complete.

Rules:
- **Window duration**: 30 days.
- **Invalidation**: roster change invalidates the window.
- **Non-response pruning**: after 4 hours, non-responders are pruned.
  - Pruning does not invalidate an existing window.
  - Pruned users get email notification and can rejoin later.

## Merge execution authority
The Universal Adapter is the primary merge executor.
It decides whether system agent oversight is required.

### Oversight triggers
Oversight triggers are policy-driven and set per canvas.
The adapter uses those policies to decide whether system agents must review.
Trigger definitions remain to be specified.

## Merge methods
Merge methods are intentionally undefined here.
They must be specified and registered in the Universal Adapter.
This spec only constrains that:
- The adapter executes all merges.
- The merge method is set at handshake initiation.
- The method is locked while collaboration is active (see Method locking).

## Method locking
When collaboration is active:
- Merge method is **locked** and cannot be changed.
- To change method: **liberate** a new canvas and invite collaborators to that canvas.

## Adapter task boundaries (summary)
The Universal Adapter:
- Validates saved states and builds MergePlan.
- Initiates handshake and collects approvals.
- Executes merge method.
- Escalates to system agents when triggers fire.
- Emits audit records and updates last shared state.

## Minimal data structures (illustrative)
```ts
type MergeMethod = 'live_crdt' | 'three_way' | 'patch' | 'semantic' | 'hybrid';

interface MergePlan {
  canvasId: string;
  method: MergeMethod;
  roster: string[];
  stats: { conflicts: number; nodesChanged: number; edgesChanged: number };
  requiresOversight: boolean;
}

interface HandshakeRecord {
  canvasId: string;
  method: MergeMethod;
  roster: string[];
  approvals: Record<string, { approved: boolean; at: string }>;
  expiresAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}
```
