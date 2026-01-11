# Bi-Temporal RDF Store Specification

## Executive Summary

This specification defines the bi-temporal data modeling requirements for the Chrysalis Universal Agent Bridge's RDF-based persistence layer. Bi-temporal modeling distinguishes two independent temporal dimensions: **transaction time** (when facts were recorded) and **valid time** (when facts were true in reality). This enables point-in-time queries answering "what was known at time T₁ about facts valid at time T₂."

### Status Assessment

**Current Implementation**: Partial bi-temporal support with gaps  
**Required Changes**: Moderate architectural modifications  
**Impact**: Query API extensions, storage schema changes, migration needed

---

## 1. Bi-Temporal Data Modeling Theory

### 1.1 Theoretical Foundation

Bi-temporal data modeling originates from the work of Richard Snodgrass and Christian Jensen (TSQL2 temporal query language, 1995) and is formalized in the SQL:2011 temporal standard. The model recognizes two orthogonal temporal dimensions:

```
                    Transaction Time (System-Managed)
                    ─────────────────────────────────►
                    │
                    │     ┌─────────────────────────┐
                    │     │   What we believed      │
                    │     │   at T_trans about      │
                    │     │   facts valid at T_valid│
    Valid Time      │     │                         │
    (User-Provided) │     │      [Bi-Temporal       │
          │         │     │        Cell]            │
          │         │     │                         │
          ▼         │     └─────────────────────────┘
```

**Transaction Time (TT)**:
- System-controlled timestamp of when a fact was recorded
- Immutable - once recorded, transaction time cannot be changed
- Monotonically increasing within the database
- Used for audit, compliance, and "as-of-system" queries

**Valid Time (VT)**:
- User/event-provided timestamp of when a fact was true in reality
- Can be in the past (late-arriving data), present, or future (scheduled facts)
- May be updated through corrections
- Used for "as-of-business" queries

### 1.2 W3C Temporal RDF Recommendations

The W3C has explored temporal RDF through several working groups:

**RDF 1.1 Concepts**: Named graphs provide the mechanism for statement grouping that enables temporal annotation:

```turtle
GRAPH <http://example.org/temporal/agent123/v1> {
    :agent123 :hasCapability :tool_use .
}
```

**OWL-Time Ontology** (W3C Recommendation): Provides vocabulary for temporal entities:

```turtle
@prefix time: <http://www.w3.org/2006/time#> .

:interval_2024 a time:ProperInterval ;
    time:hasBeginning :instant_2024_01_01 ;
    time:hasEnd :instant_2024_12_31 .
```

**Temporal RDF Approaches**:

1. **Named Graph Versioning**: Each temporal state stored in a separate named graph
2. **Reification**: Temporal metadata attached to reified statements
3. **N-ary Relations**: Temporal properties as first-class relations
4. **RDF-star**: Nested triples with temporal annotation (emerging standard)

For Chrysalis, **Named Graph Versioning** is the recommended approach as it:
- Aligns with existing quad store architecture
- Enables efficient temporal partitioning
- Supports standard SPARQL queries

### 1.3 Snodgrass/Jensen Temporal Relations

The canonical bi-temporal relation schema:

```
R(key, value, VT_start, VT_end, TT_start, TT_end)
```

For RDF quads, this translates to:

```
TemporalQuad(subject, predicate, object, graph, VT_start, VT_end, TT_start, TT_end)
```

**Temporal State Transitions**:

| Operation | VT_start | VT_end | TT_start | TT_end |
|-----------|----------|--------|----------|--------|
| Insert current fact | now | ∞ | now | ∞ |
| Insert historical fact | past | ∞ or past | now | ∞ |
| Logical delete | - | now | - | now |
| Update (delete + insert) | varies | varies | now | ∞ |

---

## 2. Current Implementation Analysis

### 2.1 Existing Structure Review

The current [`TemporalRDFStore`](src/rdf/temporal-store.ts) implementation:

```typescript
interface TemporalMetadata {
  validFrom: Date;        // VT_start
  validTo: Date | null;   // VT_end (null = ∞)
  transactionTime: Date;  // TT_start only
  version: number;        // Sequence number
}

interface TemporalQueryOptions {
  asOf?: Date;           // VT point query
  asRecorded?: Date;     // TT point query
  currentOnly?: boolean;
  version?: number;
}
```

### 2.2 Gap Analysis

| Requirement | Current Status | Gap |
|------------|---------------|-----|
| Valid Time Interval | ✅ `validFrom`, `validTo` | None |
| Transaction Time Start | ✅ `transactionTime` | None |
| Transaction Time End | ❌ Missing | Critical - no TT_end |
| TT Immutability | ❌ Violated (line 385-388) | Critical - mutates previous |
| Combined Bi-Temporal Query | ⚠️ Partial | Needs explicit API |
| Late-Arriving Data | ❌ Not supported | Moderate |
| Retroactive Corrections | ❌ Not supported | Critical |
| Append-Only TT Records | ❌ Not enforced | Critical |

### 2.3 Current Temporal Query Implementation

```typescript
// From temporal-store.ts:850-870
private isTemporallyValid(metadata: TemporalMetadata, options: TemporalQueryOptions): boolean {
  if (options.asOf) {
    const asOf = options.asOf;
    if (metadata.validFrom > asOf) return false;
    if (metadata.validTo && metadata.validTo <= asOf) return false;
  }

  if (options.asRecorded) {
    if (metadata.transactionTime > options.asRecorded) return false;
  }
  // ... missing TT_end check
}
```

**Issue**: The `asRecorded` check only verifies `TT_start <= asRecorded`, but cannot exclude records that were logically deleted before `asRecorded` because `TT_end` is not tracked.

---

## 3. Proposed Bi-Temporal Architecture

### 3.1 Enhanced Temporal Metadata

```typescript
/**
 * Full bi-temporal metadata with interval semantics
 * Following Snodgrass/Jensen BCDM (Bitemporal Conceptual Data Model)
 */
export interface BiTemporalMetadata {
  // Valid Time Interval (user-controlled)
  validFrom: Date;
  validTo: Date | null;  // null represents "until changed" (UC)

  // Transaction Time Interval (system-controlled)
  transactionFrom: Date;  // When this version was inserted
  transactionTo: Date | null;  // When this version was superseded (null = current)

  // Lineage tracking
  version: number;
  supersedes?: string;  // URI of superseded graph
  supersededBy?: string;  // URI of superseding graph
  
  // Correction metadata
  correctionType?: 'insert' | 'update' | 'delete' | 'late_arriving';
  originalTransactionTime?: Date;  // For corrections, when was original recorded
}
```

### 3.2 Append-Only Transaction Time Model

```
Timeline:
T1 ──────────────────────────────────────────────────────────────► Transaction Time
    │
    │  [Graph A v1]           [Graph A v2]
    │  VT: [2024-01-01, ∞)    VT: [2024-01-01, 2024-06-01)  [Graph A v3]
    │  TT: [T1, ∞)            TT: [T2, ∞)                   VT: [2024-06-01, ∞)
    │       │                      │                        TT: [T2, ∞)
    │       │                      │
    │       │  At T2, we learn    │
    │       │  capability ended   │
    │       │  on 2024-06-01     │
    │       ▼                     ▼
    │  On supersede:
    │  Graph A v1 gets TT: [T1, T2)  ◄── TT_end set, never modified again
```

**Key Invariant**: Once `transactionTo` is set, it is never modified. This ensures that querying "as of transaction time T2" always returns the same result.

### 3.3 Quad-Level vs Graph-Level Temporality

The specification supports two granularity levels:

**Graph-Level Temporality** (Current Approach):
- All quads in a named graph share the same temporal metadata
- Simpler storage, efficient for agent snapshots
- Coarse granularity - entire agent state versioned together

**Quad-Level Temporality** (Future Enhancement):
- Each quad has independent temporal intervals
- Fine-grained versioning of individual facts
- Higher storage overhead but maximum flexibility

For Chrysalis Agent Bridge, **Graph-Level Temporality** is recommended because:
1. Agent definitions change atomically (entire definition updates)
2. Reduces storage overhead
3. Simpler implementation and queries

### 3.4 Storage Schema

```typescript
/**
 * Bi-temporal graph storage structure
 */
interface BiTemporalGraph {
  uri: string;
  metadata: BiTemporalMetadata;
  quads: Quad[];
}

/**
 * Indexes for efficient bi-temporal queries
 */
interface BiTemporalIndexes {
  // Primary index: graphUri -> BiTemporalGraph
  graphs: Map<string, BiTemporalGraph>;
  
  // Agent lineage: agentId -> ordered graph URIs by version
  agentLineage: Map<string, string[]>;
  
  // Valid-time index: VT_start -> Set<graphUri>
  validTimeIndex: IntervalTree<string>;
  
  // Transaction-time index: TT_start -> Set<graphUri>
  transactionTimeIndex: IntervalTree<string>;
  
  // Current state index: agentId -> current graphUri (TT_end = null)
  currentStateIndex: Map<string, string>;
}
```

---

## 4. Query Semantics and API Contracts

### 4.1 Bi-Temporal Query Types

**Type 1: Current State Query**
```typescript
// What is the current state of agent X?
// VT = now, TT = now
await store.getSnapshot(agentId);
// Equivalent to: getSnapshot(agentId, { asOf: now, asRecorded: now })
```

**Type 2: Valid-Time As-Of Query**
```typescript
// What was agent X's state on 2024-06-15?
// VT = 2024-06-15, TT = now
await store.getSnapshot(agentId, { asOf: new Date('2024-06-15') });
```

**Type 3: Transaction-Time As-Of Query**
```typescript
// What did we believe about agent X on 2024-03-01?
// VT = now (as of what we knew then), TT = 2024-03-01
await store.getSnapshot(agentId, { asRecorded: new Date('2024-03-01') });
```

**Type 4: Combined Bi-Temporal Query** (New)
```typescript
// What did we believe on 2024-03-01 about agent X's state on 2024-01-15?
// VT = 2024-01-15, TT = 2024-03-01
await store.getSnapshot(agentId, {
  asOf: new Date('2024-01-15'),      // Valid time coordinate
  asRecorded: new Date('2024-03-01')  // Transaction time coordinate
});
```

**Type 5: Sequenced Query** (History)
```typescript
// Give me all versions of agent X with their temporal coordinates
await store.getAgentHistory(agentId, { includeTemporal: true });
```

**Type 6: Non-Sequenced Query** (Cross-Time Analysis)
```typescript
// Find all points where agent X's capabilities changed
await store.getTemporalChanges(agentId, {
  property: 'hasCapability',
  from: new Date('2024-01-01'),
  to: new Date('2024-12-31')
});
```

### 4.2 Enhanced Query Options Interface

```typescript
/**
 * Bi-temporal query options
 */
export interface BiTemporalQueryOptions {
  // Valid-time coordinate
  validAt?: Date;           // Point query: VT_start <= validAt < VT_end
  validFrom?: Date;         // Range query: VT overlaps [validFrom, validTo]
  validTo?: Date;
  
  // Transaction-time coordinate
  recordedAt?: Date;        // Point query: TT_start <= recordedAt < TT_end
  recordedFrom?: Date;      // Range query: TT overlaps [recordedFrom, recordedTo]
  recordedTo?: Date;
  
  // Convenience flags
  currentOnly?: boolean;    // Only TT_end = null (current transaction state)
  validNow?: boolean;       // Only records valid at current time
  
  // Result options
  includeSuperseded?: boolean;  // Include superseded versions
  version?: number;             // Specific version number
}
```

### 4.3 API Method Signatures

```typescript
interface BiTemporalStore {
  // ============================================
  // Write Operations
  // ============================================
  
  /**
   * Create a new agent snapshot (append-only)
   * @param validFrom When the fact became true (default: now)
   * @param validTo When the fact ceases to be true (default: null/forever)
   */
  createSnapshot(
    agentId: string,
    quads: Quad[],
    options?: {
      validFrom?: Date;
      validTo?: Date;
      sourceFormat?: string;
      fidelityScore?: number;
    }
  ): Promise<AgentSnapshot>;

  /**
   * Record a correction (creates new version, supersedes old)
   * Preserves transaction-time history
   */
  recordCorrection(
    agentId: string,
    quads: Quad[],
    options: {
      correctionType: 'update' | 'delete';
      validFrom?: Date;
      validTo?: Date;
      reason?: string;
    }
  ): Promise<CorrectionResult>;

  /**
   * Insert late-arriving data
   * Creates a version with valid-time in the past
   */
  insertLateArriving(
    agentId: string,
    quads: Quad[],
    options: {
      validFrom: Date;  // Required: when the fact was actually true
      validTo?: Date;
      discoveredAt?: Date;  // When we learned about this fact
    }
  ): Promise<LateArrivingResult>;

  // ============================================
  // Read Operations
  // ============================================

  /**
   * Get snapshot at bi-temporal coordinates
   */
  getSnapshot(
    agentId: string,
    options?: BiTemporalQueryOptions
  ): Promise<AgentSnapshot | null>;

  /**
   * Get complete temporal history
   */
  getAgentHistory(
    agentId: string,
    options?: {
      includeTemporal?: boolean;
      from?: Date;
      to?: Date;
    }
  ): Promise<TemporalHistory>;

  /**
   * Query across temporal dimensions
   */
  queryBiTemporal(
    pattern: QuadPattern,
    temporal: BiTemporalQueryOptions
  ): Promise<Quad[]>;

  /**
   * Get what-changed-when timeline
   */
  getTemporalChanges(
    agentId: string,
    options?: {
      property?: string;
      from?: Date;
      to?: Date;
    }
  ): Promise<TemporalChange[]>;

  // ============================================
  // Administrative Operations  
  // ============================================

  /**
   * Compact old transaction-time records
   * Only affects records where TT_end < retentionCutoff
   */
  compactHistory(options: {
    retentionPeriod: Duration;
    keepSnapshots?: number;  // Keep at least N snapshots per agent
  }): Promise<CompactionResult>;

  /**
   * Verify temporal consistency
   */
  validateTemporalIntegrity(): Promise<ValidationResult>;
}
```

### 4.4 Return Types

```typescript
interface TemporalHistory {
  agentId: string;
  versions: Array<{
    version: number;
    graphUri: string;
    validInterval: { from: Date; to: Date | null };
    transactionInterval: { from: Date; to: Date | null };
    isCurrentState: boolean;
    supersedes?: string;
    supersededBy?: string;
  }>;
  timeline: TemporalTimeline;
}

interface TemporalTimeline {
  validTimeEvents: Array<{
    time: Date;
    type: 'start' | 'end';
    version: number;
  }>;
  transactionTimeEvents: Array<{
    time: Date;
    type: 'recorded' | 'superseded';
    version: number;
  }>;
}

interface TemporalChange {
  changedAt: Date;  // Valid time
  recordedAt: Date; // Transaction time
  changeType: 'added' | 'removed' | 'modified';
  property: string;
  oldValue?: Term;
  newValue?: Term;
  fromVersion: number;
  toVersion: number;
}

interface CorrectionResult {
  success: boolean;
  supersededGraphUri: string;
  newGraphUri: string;
  transactionTime: Date;
  correctionType: string;
}

interface LateArrivingResult {
  success: boolean;
  graphUri: string;
  transactionTime: Date;
  validInterval: { from: Date; to: Date | null };
  affectedVersions: string[];  // Versions whose valid-time ranges were affected
}
```

---

## 5. Data Correction and Late-Arriving Information

### 5.1 Correction Scenarios

**Scenario A: Current State Correction**
```
T1: Record agent with capability A, B
    VT: [T1, ∞), TT: [T1, ∞)
    
T2: Realize capability B was wrong, should be C
    Action: recordCorrection()
    
    Old record: VT: [T1, ∞), TT: [T1, T2)  ← TT_end set
    New record: VT: [T1, ∞), TT: [T2, ∞)  ← Corrected state
    
    Query at T1.5 (before correction): Returns A, B
    Query at T2.5 (after correction): Returns A, C
```

**Scenario B: Historical Valid-Time Correction**
```
T1: Record agent valid from 2024-01-01
T2: Learn that agent actually started 2023-12-01

Action: insertLateArriving(validFrom: 2023-12-01)

Creates new graph with:
    VT: [2023-12-01, ∞), TT: [T2, ∞)
    
Supersedes old:
    VT: [2024-01-01, ∞), TT: [T1, T2)
```

**Scenario C: Retroactive Capability Change**
```
T1: Agent has capabilities A, B from 2024-01-01
T3: Learn that capability B was added on 2024-03-01

Must create two records:
    Graph v2: VT: [2024-01-01, 2024-03-01), TT: [T3, ∞)  ← Only A
    Graph v3: VT: [2024-03-01, ∞), TT: [T3, ∞)          ← A and B
    
Original: VT: [2024-01-01, ∞), TT: [T1, T3)  ← Superseded
```

### 5.2 Correction Implementation

```typescript
async recordCorrection(
  agentId: string,
  quads: Quad[],
  options: {
    correctionType: 'update' | 'delete';
    validFrom?: Date;
    validTo?: Date;
    reason?: string;
  }
): Promise<CorrectionResult> {
  const now = new Date();
  
  // 1. Find current transaction-time state
  const current = await this.getCurrentState(agentId);
  if (!current) {
    throw new Error(`Agent ${agentId} not found`);
  }
  
  // 2. Set TT_end on current version (supersede it)
  //    This is an APPEND to the supersession record, not mutation
  await this.recordSupersession(current.graphUri, now);
  
  // 3. Create new version with corrected data
  const newVersion = current.metadata.version + 1;
  const graphUri = `https://chrysalis.dev/snapshot/${agentId}/v${newVersion}`;
  
  const metadata: BiTemporalMetadata = {
    validFrom: options.validFrom ?? current.metadata.validFrom,
    validTo: options.validTo ?? (options.correctionType === 'delete' ? now : null),
    transactionFrom: now,
    transactionTo: null,
    version: newVersion,
    supersedes: current.graphUri,
    correctionType: options.correctionType,
    originalTransactionTime: current.metadata.transactionFrom
  };
  
  // 4. Store new version
  await this.storeGraph(graphUri, quads, metadata);
  
  // 5. Update supersededBy on old version's metadata record
  await this.updateSupersededBy(current.graphUri, graphUri);
  
  return {
    success: true,
    supersededGraphUri: current.graphUri,
    newGraphUri: graphUri,
    transactionTime: now,
    correctionType: options.correctionType
  };
}
```

### 5.3 Late-Arriving Data Handling

```typescript
async insertLateArriving(
  agentId: string,
  quads: Quad[],
  options: {
    validFrom: Date;
    validTo?: Date;
    discoveredAt?: Date;
  }
): Promise<LateArrivingResult> {
  const now = options.discoveredAt ?? new Date();
  
  // 1. Validate: validFrom must be in the past
  if (options.validFrom > now) {
    throw new Error('Late-arriving data must have validFrom in the past');
  }
  
  // 2. Find overlapping versions (by valid-time)
  const overlapping = await this.findOverlappingVersions(
    agentId,
    options.validFrom,
    options.validTo ?? null
  );
  
  // 3. Determine if this is an insertion or split
  const newVersion = await this.getNextVersion(agentId);
  const graphUri = `https://chrysalis.dev/snapshot/${agentId}/v${newVersion}`;
  
  const metadata: BiTemporalMetadata = {
    validFrom: options.validFrom,
    validTo: options.validTo ?? null,
    transactionFrom: now,
    transactionTo: null,
    version: newVersion,
    correctionType: 'late_arriving'
  };
  
  // 4. Store the late-arriving data
  await this.storeGraph(graphUri, quads, metadata);
  
  // 5. Supersede affected versions
  const affectedVersions: string[] = [];
  for (const overlap of overlapping) {
    await this.recordSupersession(overlap.graphUri, now);
    affectedVersions.push(overlap.graphUri);
  }
  
  // 6. Potentially split existing valid-time intervals
  await this.splitValidTimeIntervals(agentId, options.validFrom, graphUri);
  
  return {
    success: true,
    graphUri,
    transactionTime: now,
    validInterval: { from: options.validFrom, to: options.validTo ?? null },
    affectedVersions
  };
}
```

### 5.4 Invariants and Constraints

**Transaction Time Invariants**:
1. `transactionFrom` is set exactly once at insertion time
2. `transactionTo` is set exactly once when superseded, never modified
3. `transactionFrom < transactionTo` (when transactionTo is set)
4. No two current versions (transactionTo = null) for the same agent

**Valid Time Invariants**:
1. `validFrom <= validTo` (when validTo is set)
2. Valid-time can be set to any value (past, present, future)
3. Overlapping valid-time intervals are allowed (represent corrections)

**Lineage Invariants**:
1. `supersedes` points to a valid graph that has `transactionTo` set
2. `supersededBy` is set when another graph's `supersedes` points here
3. Version numbers are monotonically increasing per agent

---

## 6. Implementation Modifications

### 6.1 Required Changes to temporal-store.ts

**Change 1: Add `transactionTo` field**
```typescript
// Before
interface TemporalMetadata {
  validFrom: Date;
  validTo: Date | null;
  transactionTime: Date;
  version: number;
}

// After
interface BiTemporalMetadata {
  validFrom: Date;
  validTo: Date | null;
  transactionFrom: Date;
  transactionTo: Date | null;
  version: number;
  supersedes?: string;
  supersededBy?: string;
  correctionType?: 'insert' | 'update' | 'delete' | 'late_arriving';
}
```

**Change 2: Remove mutation in createSnapshot**
```typescript
// Before (line 385-388): MUTATES previous version
if (existingVersions.length > 0) {
  const prevGraphUri = existingVersions[existingVersions.length - 1];
  const prevSnapshot = this.metadataGraph.get(prevGraphUri);
  if (prevSnapshot && !prevSnapshot.validTo) {
    prevSnapshot.validTo = now;  // ← MUTATION!
  }
}

// After: Create supersession record (append-only)
if (existingVersions.length > 0) {
  const prevGraphUri = existingVersions[existingVersions.length - 1];
  await this.recordSupersession(prevGraphUri, now);
}
```

**Change 3: Update isTemporallyValid**
```typescript
// After: Full bi-temporal check
private isTemporallyValid(
  metadata: BiTemporalMetadata, 
  options: BiTemporalQueryOptions
): boolean {
  // Valid-time check
  if (options.validAt) {
    if (metadata.validFrom > options.validAt) return false;
    if (metadata.validTo && metadata.validTo <= options.validAt) return false;
  }

  // Transaction-time check (NOW COMPLETE)
  if (options.recordedAt) {
    if (metadata.transactionFrom > options.recordedAt) return false;
    if (metadata.transactionTo && metadata.transactionTo <= options.recordedAt) return false;
  }

  // Current-only: no TT_end
  if (options.currentOnly && metadata.transactionTo !== null) {
    return false;
  }

  return true;
}
```

**Change 4: Add supersession tracking**
```typescript
// New separate store for supersession records (append-only log)
private supersessionLog: Array<{
  graphUri: string;
  supersededAt: Date;
  supersededBy: string;
}> = [];

async recordSupersession(graphUri: string, at: Date): Promise<void> {
  const graph = this.graphs.get(graphUri);
  if (!graph) return;
  
  // Append to log (immutable)
  this.supersessionLog.push({
    graphUri,
    supersededAt: at,
    supersededBy: ''  // Filled in by subsequent insert
  });
  
  // Update the metadata (transactionTo only set once)
  if (graph.metadata.transactionTo === null) {
    graph.metadata.transactionTo = at;
    this.emit('graphSuperseded', { graphUri, at });
  }
}
```

### 6.2 New Index Structures

```typescript
// Interval tree for efficient temporal range queries
import { IntervalTree } from './interval-tree';

class BiTemporalRDFStore extends EventEmitter {
  // Existing indexes
  private graphs: Map<string, BiTemporalGraph> = new Map();
  private agentIndex: Map<string, string[]> = new Map();
  
  // New temporal indexes
  private validTimeIndex: IntervalTree<string>;    // VT intervals -> graphUris
  private transactionTimeIndex: IntervalTree<string>; // TT intervals -> graphUris
  
  // Current state fast lookup (TT_end = null)
  private currentStateIndex: Map<string, string> = new Map(); // agentId -> graphUri
  
  // Supersession log (append-only)
  private supersessionLog: SupersessionEntry[] = [];
}
```

### 6.3 Migration Path

1. **Phase 1: Schema Update**
   - Add `transactionTo` field (default: null)
   - Add lineage fields (`supersedes`, `supersededBy`)
   - Rename `transactionTime` to `transactionFrom`

2. **Phase 2: Index Build**
   - Build `transactionTimeIndex` from existing data
   - Populate `currentStateIndex`
   - Initialize supersession log

3. **Phase 3: API Extension**
   - Add new query options
   - Implement correction methods
   - Add late-arriving data support

4. **Phase 4: Remove Mutations**
   - Replace mutation pattern with append-only supersession

---

## 7. Example Queries

### 7.1 Current State
```typescript
// What capabilities does agent-123 have right now?
const snapshot = await store.getSnapshot('agent-123');
// Internally: validAt=now, recordedAt=now
```

### 7.2 Historical Valid State
```typescript
// What capabilities did agent-123 have on 2024-06-15?
const snapshot = await store.getSnapshot('agent-123', {
  validAt: new Date('2024-06-15T00:00:00Z')
});
// Returns: state valid on that date, as we currently know it
```

### 7.3 What We Believed Then
```typescript
// What did we think agent-123's capabilities were on 2024-03-01?
const snapshot = await store.getSnapshot('agent-123', {
  recordedAt: new Date('2024-03-01T00:00:00Z')
});
// Returns: state as recorded on that transaction date
```

### 7.4 Full Bi-Temporal Query
```typescript
// On 2024-03-01, what did we believe agent-123's state was on 2024-01-15?
const snapshot = await store.getSnapshot('agent-123', {
  validAt: new Date('2024-01-15T00:00:00Z'),
  recordedAt: new Date('2024-03-01T00:00:00Z')
});
// Returns: the view that existed on 2024-03-01 of the 2024-01-15 state
```

### 7.5 Audit Trail
```typescript
// Show me all changes to agent-123's record
const history = await store.getAgentHistory('agent-123', {
  includeTemporal: true
});

// history.versions contains:
// [
//   { version: 1, VT: [2024-01-01, ∞), TT: [2024-01-01, 2024-03-15) },
//   { version: 2, VT: [2024-01-01, ∞), TT: [2024-03-15, ∞), supersedes: v1 }
// ]
```

---

## 8. References

1. **Snodgrass, R.T. (2000)**. *Developing Time-Oriented Database Applications in SQL*. Morgan Kaufmann.

2. **Jensen, C.S. & Snodgrass, R.T. (1999)**. "Temporal Data Management." *IEEE Transactions on Knowledge and Data Engineering*, 11(1), 36-44.

3. **SQL:2011 Temporal Standard**. ISO/IEC 9075-2:2011, Section 11.

4. **W3C OWL-Time Ontology**. https://www.w3.org/TR/owl-time/

5. **RDF-star and SPARQL-star**. W3C Community Group. https://w3c.github.io/rdf-star/

6. **Gutierrez, C., Hurtado, C.A., & Vaisman, A. (2007)**. "Introducing Time into RDF." *IEEE Transactions on Knowledge and Data Engineering*, 19(2), 207-218.

---

*Specification Version: 1.0.0*  
*Last Updated: 2026-01-11*  
*Status: Draft - Pending Implementation*
