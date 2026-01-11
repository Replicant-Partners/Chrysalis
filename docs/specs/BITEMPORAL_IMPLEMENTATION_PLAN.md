# Chrysalis Bi-Temporal Store Implementation Plan

## Executive Summary

This document extends the BITEMPORAL_STORE_SPECIFICATION.md with academic foundations, industrial reference patterns, architectural integration design, and a phased implementation roadmap. The bi-temporal RDF store serves as the foundational persistence layer for the Chrysalis Universal Agent Bridge, enabling point-in-time queries, audit compliance, and retroactive corrections.

**Document Status**: Implementation Plan  
**Prerequisite**: BITEMPORAL_STORE_SPECIFICATION.md  
**Version**: 1.0.0  
**Last Updated**: 2026-01-11

---

## Table of Contents

1. [Six-Component Architecture Assessment](#1-six-component-architecture-assessment)
2. [Academic Foundations and Citations](#2-academic-foundations-and-citations)
3. [Industrial Reference Implementations](#3-industrial-reference-implementations)
4. [Integration Architecture Design](#4-integration-architecture-design)
5. [Bi-Temporal Query Algebra](#5-bi-temporal-query-algebra)
6. [Conflict Resolution and Temporal Consistency](#6-conflict-resolution-and-temporal-consistency)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. Six-Component Architecture Assessment

### 1.1 Component Overview

The bi-temporal store architecture comprises six core components that work together to provide complete temporal data management:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Chrysalis Bi-Temporal RDF Store                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │ 1. Temporal      │  │ 2. BiTemporal    │  │ 3. Temporal      │         │
│  │    Coordinates   │  │    Quad          │  │    Index         │         │
│  │                  │  │                  │  │                  │         │
│  │  validFrom       │  │  subject         │  │  IntervalTree    │         │
│  │  validTo         │  │  predicate       │  │  for VT ranges   │         │
│  │  transactionFrom │  │  object          │  │  IntervalTree    │         │
│  │  transactionTo   │  │  graph           │  │  for TT ranges   │         │
│  │                  │  │  coordinates     │  │  B-tree indexes  │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │ 4. Query         │  │ 5. Conflict      │  │ 6. Migration     │         │
│  │    Engine        │  │    Resolver      │  │    Manager       │         │
│  │                  │  │                  │  │                  │         │
│  │  AS_OF           │  │  Concurrent      │  │  Schema          │         │
│  │  VALID_AT        │  │  Modifications   │  │  Evolution       │         │
│  │  BETWEEN_AND     │  │  Late-Arriving   │  │  Data Migration  │         │
│  │  COALESCE        │  │  Corrections     │  │  Version Compat  │         │
│  │  SEQUENCED       │  │  Constraints     │  │  Rollback        │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Current Implementation Gap Analysis

| Component | Current Status | Gap Assessment | Priority |
|-----------|---------------|----------------|----------|
| **TemporalCoordinates** | Partial | Missing `transactionTo`; no interval semantics | Critical |
| **BiTemporalQuad** | Partial | Metadata at graph-level only; missing lineage | High |
| **TemporalIndex** | Missing | No interval trees; linear scans | High |
| **QueryEngine** | Partial | No combined bi-temporal queries; limited operators | Critical |
| **ConflictResolver** | Missing | No concurrent modification handling | Medium |
| **MigrationManager** | Missing | No schema evolution support | Medium |

### 1.3 Component Specifications

#### 1.3.1 TemporalCoordinates

```typescript
/**
 * Temporal coordinate system representing bi-temporal position
 * 
 * Based on Snodgrass BCDM (Bitemporal Conceptual Data Model)
 */
export interface TemporalCoordinates {
  /**
   * Valid Time Interval
   * When the fact was/is/will be true in the modeled reality
   */
  validTime: {
    from: Date;           // VT_start: inclusive lower bound
    to: Date | null;      // VT_end: exclusive upper bound (null = until changed)
    granularity: TemporalGranularity;
  };
  
  /**
   * Transaction Time Interval
   * When the fact was recorded in the database
   */
  transactionTime: {
    from: Date;           // TT_start: when recorded (immutable)
    to: Date | null;      // TT_end: when superseded (null = current)
    granularity: TemporalGranularity;
  };
}

/**
 * Temporal granularity for interval operations
 */
export type TemporalGranularity = 
  | 'microsecond'
  | 'millisecond'
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'month'
  | 'year';

/**
 * Interval relationship types (Allen's Interval Algebra)
 */
export type IntervalRelation =
  | 'before' | 'after'
  | 'meets' | 'met_by'
  | 'overlaps' | 'overlapped_by'
  | 'starts' | 'started_by'
  | 'during' | 'contains'
  | 'finishes' | 'finished_by'
  | 'equals';
```

#### 1.3.2 BiTemporalQuad

```typescript
/**
 * A quad with full bi-temporal metadata
 */
export interface BiTemporalQuad {
  // RDF Quad components
  subject: Subject;
  predicate: Predicate;
  object: QuadObject;
  graph: Graph;
  
  // Bi-temporal coordinates
  coordinates: TemporalCoordinates;
  
  // Lineage tracking
  lineage: {
    version: number;
    supersedes?: string;      // URI of superseded graph
    supersededBy?: string;    // URI of superseding graph
    correctionType?: CorrectionType;
  };
  
  // Provenance
  provenance: {
    source: string;           // Origin system/adapter
    recordedBy?: string;      // User/agent that recorded
    reason?: string;          // Why this version was created
  };
}

export type CorrectionType = 
  | 'insert'         // New fact
  | 'update'         // Correction of existing fact
  | 'delete'         // Logical deletion
  | 'late_arriving'  // Late-arriving historical data
  | 'restatement';   // Business-driven restatement
```

#### 1.3.3 TemporalIndex

```typescript
/**
 * Index structures for efficient bi-temporal queries
 */
export interface TemporalIndex<T> {
  /**
   * Insert an entry with temporal bounds
   */
  insert(key: T, validInterval: Interval, transactionInterval: Interval): void;
  
  /**
   * Find all entries containing a valid-time point
   */
  findValidAt(point: Date): T[];
  
  /**
   * Find all entries containing a transaction-time point
   */
  findRecordedAt(point: Date): T[];
  
  /**
   * Find entries overlapping a valid-time range
   */
  findValidOverlapping(interval: Interval): T[];
  
  /**
   * Find entries overlapping a transaction-time range
   */
  findTransactionOverlapping(interval: Interval): T[];
  
  /**
   * Combined bi-temporal search
   */
  findBiTemporal(validPoint: Date, transactionPoint: Date): T[];
  
  /**
   * Remove entry from index (for compaction)
   */
  remove(key: T): boolean;
}

export interface Interval {
  from: Date;
  to: Date | null;
}
```

#### 1.3.4 QueryEngine

```typescript
/**
 * Bi-temporal query engine with TSQL2-inspired operators
 */
export interface BiTemporalQueryEngine {
  /**
   * Execute a bi-temporal query
   */
  execute(query: BiTemporalQuery): Promise<QueryResult>;
  
  /**
   * Plan a query without execution (for optimization)
   */
  plan(query: BiTemporalQuery): QueryPlan;
  
  /**
   * Register a custom temporal operator
   */
  registerOperator(name: string, operator: TemporalOperator): void;
}

export interface BiTemporalQuery {
  // Base pattern matching
  patterns: QuadPattern[];
  
  // Temporal dimensions
  temporal: {
    validTime?: TemporalConstraint;
    transactionTime?: TemporalConstraint;
  };
  
  // Temporal operators to apply
  operators?: TemporalOperator[];
  
  // Result modifiers
  projection?: string[];
  ordering?: OrderSpec[];
  limit?: number;
  offset?: number;
}

export type TemporalConstraint = 
  | { type: 'point'; at: Date }
  | { type: 'range'; from: Date; to: Date }
  | { type: 'current' }
  | { type: 'all' };
```

#### 1.3.5 ConflictResolver

```typescript
/**
 * Resolves conflicts in temporal data operations
 */
export interface ConflictResolver {
  /**
   * Resolve conflicts when inserting overlapping temporal data
   */
  resolveOverlap(
    existing: BiTemporalQuad[],
    incoming: BiTemporalQuad,
    strategy: ConflictStrategy
  ): Resolution;
  
  /**
   * Validate temporal constraints
   */
  validateConstraints(
    quad: BiTemporalQuad,
    constraints: TemporalConstraint[]
  ): ValidationResult;
  
  /**
   * Handle concurrent modifications (optimistic locking)
   */
  resolveConcurrent(
    base: BiTemporalQuad,
    modifications: BiTemporalQuad[]
  ): Resolution;
}

export type ConflictStrategy =
  | 'latest_wins'           // Most recent transaction time wins
  | 'valid_time_priority'   // More specific valid time wins
  | 'merge'                 // Attempt to merge non-conflicting changes
  | 'reject'                // Reject conflicting operations
  | 'manual';               // Queue for manual resolution

export interface Resolution {
  resolved: BiTemporalQuad[];
  superseded: BiTemporalQuad[];
  conflicts?: ConflictRecord[];
}
```

#### 1.3.6 MigrationManager

```typescript
/**
 * Manages schema evolution and data migration
 */
export interface MigrationManager {
  /**
   * Apply a migration to the store
   */
  migrate(migration: Migration): Promise<MigrationResult>;
  
  /**
   * Rollback a migration
   */
  rollback(migrationId: string): Promise<RollbackResult>;
  
  /**
   * Get migration history
   */
  getHistory(): Promise<MigrationRecord[]>;
  
  /**
   * Validate migration compatibility
   */
  validateMigration(migration: Migration): ValidationResult;
}

export interface Migration {
  id: string;
  version: string;
  description: string;
  
  // Schema changes
  schemaChanges?: SchemaChange[];
  
  // Data transformations
  dataTransforms?: DataTransform[];
  
  // Temporal index rebuilds
  indexRebuilds?: IndexRebuild[];
  
  // Rollback instructions
  rollback: RollbackInstructions;
}
```

---

## 2. Academic Foundations and Citations

### 2.1 Foundational Works

#### 2.1.1 Snodgrass - Temporal Database Theory

**Primary Citation**:
> Snodgrass, R.T. (2000). *Developing Time-Oriented Database Applications in SQL*. Morgan Kaufmann Publishers. ISBN: 1-55860-436-7.

**Key Contributions**:
- Defined the Bitemporal Conceptual Data Model (BCDM)
- Established valid time and transaction time as orthogonal dimensions
- Introduced temporal coalescing and normalization
- Developed TSQL2 temporal query language

**Relevant Excerpts for Chrysalis**:
1. **BCDM Definition** (Chapter 10): "A bitemporal relation has both valid-time and transaction-time support, recording when facts were valid in reality and when they were stored in the database."

2. **Temporal Coalescing** (Chapter 8): "Value-equivalent tuples with adjacent or overlapping time periods can be merged (coalesced) into a single tuple with a combined time period."

3. **Now-Relative Timestamps** (Chapter 3): "The special timestamp 'now' is a variable that changes as time passes, representing the current instant. In storage, 'until changed' (UC) represents an open-ended future."

#### 2.1.2 Jensen - Consensus Glossary

**Primary Citation**:
> Jensen, C.S., Clifford, J., et al. (1998). "The Consensus Glossary of Temporal Database Concepts - February 1998 Version." In *Temporal Databases: Research and Practice*, LNCS 1399, Springer, pp. 367-405.

**Key Definitions Adopted**:

| Term | Definition |
|------|------------|
| **Valid Time** | The time when a fact is true in the modeled reality |
| **Transaction Time** | The time when a fact is stored in the database |
| **Bitemporal** | Having both valid time and transaction time |
| **Current** | A tuple whose transaction-time interval includes "now" |
| **Sequenced** | Valid-time semantics applying to each point in time separately |
| **Non-Sequenced** | Treating valid-time timestamps as ordinary attributes |

#### 2.1.3 Clifford - Historical Database Formalism

**Primary Citation**:
> Clifford, J., & Croker, A. (1987). "The Historical Relational Data Model (HRDM) and Algebra Based on Lifespans." *Proceedings of the International Conference on Data Engineering*, pp. 528-537.

**Contributions to Chrysalis Design**:
- Lifespan concept (interval of existence)
- Historical algebra operations
- Temporal homogeneity requirements

#### 2.1.4 Date - Temporal Data and the Relational Model

**Primary Citation**:
> Date, C.J., Darwen, H., & Lorentzos, N.A. (2002). *Temporal Data and the Relational Model*. Morgan Kaufmann Publishers. ISBN: 1-55860-855-9.

**Key Principles Incorporated**:
1. **Interval Types**: "Intervals should be first-class citizens in the data model."
2. **PACK/UNPACK Operators**: For temporal coalescing and expansion
3. **Allen's Interval Algebra**: 13 fundamental interval relationships

#### 2.1.5 Allen - Interval Algebra

**Primary Citation**:
> Allen, J.F. (1983). "Maintaining Knowledge about Temporal Intervals." *Communications of the ACM*, 26(11), 832-843.

**13 Interval Relations Used in Query Engine**:
```
X before Y:        XXXX
                         YYYY

X meets Y:         XXXX
                       YYYY

X overlaps Y:      XXXX
                     YYYY

X starts Y:        XXX
                   YYYYYY

X during Y:          XXX
                   YYYYYY

X finishes Y:         XXX
                   YYYYYY

X equals Y:        XXXX
                   YYYY
```

### 2.2 RDF and Knowledge Graph Temporality

#### 2.2.1 Temporal RDF Research

**Primary Citation**:
> Gutierrez, C., Hurtado, C.A., & Vaisman, A. (2007). "Introducing Time into RDF." *IEEE Transactions on Knowledge and Data Engineering*, 19(2), 207-218.

**Relevance**: Formal semantics for temporal RDF, including:
- Temporal graphs and graph validity
- Temporal entailment
- Query evaluation complexity

#### 2.2.2 Named Graphs for Temporality

**Primary Citation**:
> Carroll, J.J., Bizer, C., Hayes, P., & Stickler, P. (2005). "Named Graphs, Provenance and Trust." *Proceedings of the 14th International World Wide Web Conference*, pp. 613-622.

**Design Justification**: Named graphs provide the mechanism for grouping statements that share temporal metadata, enabling:
- Graph-level temporal annotation
- Efficient version management
- Standard SPARQL compatibility

### 2.3 Event Sourcing Theory

#### 2.3.1 Event Sourcing Pattern

**Primary Citation**:
> Fowler, M. (2005). "Event Sourcing." *martinfowler.com*. Retrieved from https://martinfowler.com/eaaDev/EventSourcing.html

**Pattern Application**:
- Append-only event log as source of truth
- Temporal reconstruction from events
- Complete audit trail preservation

#### 2.3.2 CQRS Integration

**Primary Citation**:
> Young, G. (2010). "CQRS Documents." *cqrs.files.wordpress.com*.

**Design Influence**:
- Separation of write model (event store) from read model (query projections)
- Eventual consistency patterns
- Temporal projections for different query patterns

### 2.4 Citation Index

| # | Author(s) | Year | Title | Relevance |
|---|-----------|------|-------|-----------|
| 1 | Snodgrass | 2000 | Developing Time-Oriented Database Applications | Core bi-temporal theory |
| 2 | Jensen et al. | 1998 | Consensus Glossary of Temporal Database Concepts | Terminology standard |
| 3 | Clifford & Croker | 1987 | Historical Relational Data Model | Lifespan formalism |
| 4 | Date et al. | 2002 | Temporal Data and the Relational Model | Relational foundations |
| 5 | Allen | 1983 | Maintaining Knowledge about Temporal Intervals | Interval algebra |
| 6 | Gutierrez et al. | 2007 | Introducing Time into RDF | RDF temporality |
| 7 | Carroll et al. | 2005 | Named Graphs, Provenance and Trust | Graph versioning |
| 8 | Fowler | 2005 | Event Sourcing | Append-only patterns |
| 9 | SQL:2011 | 2011 | ISO/IEC 9075-2:2011 Section 11 | Temporal SQL standard |

---

## 3. Industrial Reference Implementations

### 3.1 Datomic

#### 3.1.1 Overview

**Type**: Immutable database with transaction time  
**Creator**: Rich Hickey / Cognitect  
**License**: Proprietary (with free tier)  
**First Release**: 2012

**Architecture Principles**:
- Immutable facts stored as datoms: `[entity, attribute, value, transaction, added?]`
- Separation of reads, writes, and storage
- Log-structured storage with accumulating indexes
- Database-as-value semantics

#### 3.1.2 Temporal Model

```clojure
;; Datomic datom structure
[entity-id attribute value transaction-id added?]

;; Example: Recording a capability
[:agent/123 :agent/capability "tool_use" 1000 true]

;; Later removing the capability (not deletion, but retraction)
[:agent/123 :agent/capability "tool_use" 2000 false]

;; Querying as-of transaction 1500 shows capability
;; Querying as-of transaction 2500 shows no capability
```

**Key Design Patterns for Chrysalis**:

1. **Accumulate-Only**: Never delete; only add facts and retractions
2. **Database Values**: Query against an immutable snapshot
3. **Log-Based**: Transaction log is source of truth

#### 3.1.3 Lessons Learned

| Strength | Weakness | Chrysalis Adaptation |
|----------|----------|---------------------|
| True immutability | Single transaction-time only | Add valid-time dimension |
| Efficient as-of queries | Complex schema definition | Simplify with RDF flexibility |
| Built-in audit trail | Expensive for high write volume | Batch writes, compaction |

### 3.2 XTDB (formerly Crux)

#### 3.2.1 Overview

**Type**: Bi-temporal document database  
**Creator**: JUXT Ltd  
**License**: MIT (Open Source)  
**First Release**: 2019

**Architecture Principles**:
- True bi-temporal: valid time + transaction time
- Unbundled architecture (separate storage backends)
- Content-addressable storage for documents
- Datalog query language

#### 3.2.2 Bi-Temporal Model

```clojure
;; XTDB put with valid time
(xt/submit-tx node [[::xt/put
                     {:xt/id :agent/123
                      :agent/name "Ada"
                      :agent/capabilities ["reasoning" "tool_use"]}
                     #inst "2024-01-01"]])  ;; valid-from

;; Query at bi-temporal coordinates
(xt/q (xt/db node 
             #inst "2024-06-15"      ;; valid-time
             #inst "2024-03-01")     ;; transaction-time
      '{:find [?name]
        :where [[?e :agent/name ?name]]})
```

**Key Design Patterns for Chrysalis**:

1. **Explicit Valid Time**: Every write can specify when the fact was true
2. **Point-in-Time Queries**: Database function returns snapshot at coordinates
3. **History API**: Retrieve complete entity history

#### 3.2.3 Architectural Comparison

```
XTDB Architecture:
┌─────────────────────────────────────────────────────┐
│                     Query Engine                     │
├─────────────────────────────────────────────────────┤
│  Document Store  │  Index Store  │  Transaction Log │
├─────────────────────────────────────────────────────┤
│          Pluggable Storage (RocksDB, LMDB, etc.)    │
└─────────────────────────────────────────────────────┘

Chrysalis Adaptation:
┌─────────────────────────────────────────────────────┐
│            BiTemporal Query Engine                   │
├─────────────────────────────────────────────────────┤
│   RDF Quad Store  │  Temporal Index  │  Event Log   │
├─────────────────────────────────────────────────────┤
│          In-Memory / Pluggable Backend              │
└─────────────────────────────────────────────────────┘
```

### 3.3 TerminusDB

#### 3.3.1 Overview

**Type**: Graph database with versioning  
**Creator**: TerminusDB Ltd  
**License**: Apache 2.0 (Open Source)  
**First Release**: 2019

**Architecture Principles**:
- Git-like version control for data
- Delta storage (store changes, not full copies)
- Schema-enforced graph structure
- Time-travel queries

#### 3.3.2 Versioning Model

```json
// TerminusDB commit structure
{
  "commit_id": "abc123",
  "parent": "def456",
  "timestamp": "2024-03-15T10:30:00Z",
  "author": "agent-bridge",
  "message": "Update agent capabilities",
  "delta": {
    "additions": [
      {"@type": "Capability", "@id": "cap/789", "name": "tool_use"}
    ],
    "deletions": []
  }
}
```

**Key Design Patterns for Chrysalis**:

1. **Delta Storage**: Store only changes between versions
2. **Commit History**: Full audit trail with authorship
3. **Branch/Merge**: Support for parallel development (future)

#### 3.3.3 Applicable Patterns

| TerminusDB Feature | Chrysalis Application |
|-------------------|----------------------|
| Delta encoding | Efficient version storage |
| Schema validation | SHACL constraint checking |
| Time travel | Bi-temporal queries |
| Commit messages | Correction reasons |

### 3.4 Apache Kafka - Event Sourcing

#### 3.4.1 Overview

**Type**: Distributed event streaming platform  
**Creator**: LinkedIn / Apache Foundation  
**License**: Apache 2.0 (Open Source)  
**First Release**: 2011

**Architecture Principles**:
- Append-only partitioned log
- Consumer offset tracking
- Compaction policies
- Exactly-once semantics

#### 3.4.2 Event Sourcing Patterns

```java
// Kafka event structure for temporal facts
{
  "eventType": "AgentCapabilityAdded",
  "eventTime": "2024-01-15T00:00:00Z",    // Valid time
  "recordTime": "2024-03-01T10:30:00Z",   // Transaction time
  "agentId": "agent-123",
  "payload": {
    "capability": "tool_use",
    "parameters": { "maxTools": 10 }
  },
  "metadata": {
    "correlationId": "req-456",
    "source": "bridge-service"
  }
}
```

**Key Design Patterns for Chrysalis**:

1. **Event Log**: Immutable append-only record of all changes
2. **Compaction**: Remove superseded events based on retention policy
3. **Replay**: Rebuild state from event history
4. **Partitioning**: Scale by agent ID for parallel processing

#### 3.4.3 Integration Architecture

```
Kafka-Inspired Event Flow:
                                    
  ┌──────────┐    ┌──────────┐    ┌──────────────────┐
  │ Adapter  │───►│ Event    │───►│ Temporal Store   │
  │ Layer    │    │ Log      │    │ (Materialized)   │
  └──────────┘    └──────────┘    └──────────────────┘
                       │                   ▲
                       │    Replay/        │
                       └───────────────────┘
                           Rebuild
```

### 3.5 Reference Implementation Comparison Matrix

| Feature | Datomic | XTDB | TerminusDB | Kafka |
|---------|---------|------|------------|-------|
| **Transaction Time** | ✅ Native | ✅ Native | ✅ Native | ✅ Event time |
| **Valid Time** | ❌ Manual | ✅ Native | ✅ Via commits | ✅ Event payload |
| **Bi-Temporal Query** | ⚠️ Limited | ✅ Full | ⚠️ Via history | ❌ Consumer logic |
| **Immutability** | ✅ Core | ✅ Core | ✅ Delta-based | ✅ Log |
| **Graph Support** | ⚠️ Entity refs | ✅ Documents | ✅ Native graph | ❌ None |
| **RDF Compatible** | ❌ | ❌ | ⚠️ JSON-LD | ❌ |
| **Open Source** | ❌ | ✅ MIT | ✅ Apache 2.0 | ✅ Apache 2.0 |
| **Scalability** | High | Medium | Medium | Very High |

### 3.6 Design Patterns Extracted

From the industrial implementations, the following patterns are adopted for Chrysalis:

1. **Immutable Append-Only Log** (from Datomic, Kafka)
   - All writes are appends to transaction log
   - Supersession creates new record, marks old with TT_end

2. **Bi-Temporal Coordinates as First-Class** (from XTDB)
   - Every operation accepts explicit valid-time
   - Query API requires temporal coordinates

3. **Delta Optimization** (from TerminusDB)
   - For large agent definitions, consider delta encoding
   - Full snapshots at intervals, deltas between

4. **Event Sourcing with Projection** (from Kafka)
   - Event log as source of truth
   - Materialized views for query performance

5. **Content-Addressable Storage** (from XTDB, TerminusDB)
   - Hash-based deduplication of identical states
   - Efficient storage of repeated patterns

---

## 4. Integration Architecture Design

### 4.1 Deployment Modes

The bi-temporal store supports two deployment modes:

#### 4.1.1 Embedded Mode

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrysalis Bridge Service                      │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Adapter    │  │   Bridge     │  │  Embedded BiTemporal │  │
│  │   Layer      │──│ Orchestrator │──│  Store               │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Use Cases**:
- Development and testing
- Single-instance deployments
- Low-latency requirements

**Configuration**:
```typescript
const store = new BiTemporalRDFStore({
  mode: 'embedded',
  storage: {
    type: 'memory',  // or 'file', 'lmdb'
    path: './data/temporal-store'
  },
  compaction: {
    enabled: true,
    retentionDays: 90,
    minVersions: 3
  }
});
```

#### 4.1.2 Service Mode

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Chrysalis Platform                              │
│                                                                         │
│  ┌─────────────────┐         ┌─────────────────────────────────────┐  │
│  │ Bridge Service  │────────►│         BiTemporal Store            │  │
│  └─────────────────┘         │           (Service)                 │  │
│                              │  ┌─────────────────────────────┐    │  │
│  ┌─────────────────┐         │  │      Query Engine           │    │  │
│  │ Knowledge       │────────►│  ├─────────────────────────────┤    │  │
│  │ Builder         │         │  │      Temporal Index         │    │  │
│  └─────────────────┘         │  ├─────────────────────────────┤    │  │
│                              │  │      Event Log              │    │  │
│  ┌─────────────────┐         │  ├─────────────────────────────┤    │  │
│  │ Skill Builder   │────────►│  │      Conflict Resolver      │    │  │
│  └─────────────────┘         │  └─────────────────────────────┘    │  │
│                              └─────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

**Use Cases**:
- Multi-service architectures
- High availability requirements
- Centralized temporal data management

**Interface**:
```typescript
interface BiTemporalStoreService {
  // gRPC service definition
  service BiTemporalStore {
    // Write operations
    rpc CreateSnapshot(CreateSnapshotRequest) returns (Snapshot);
    rpc RecordCorrection(CorrectionRequest) returns (CorrectionResult);
    rpc InsertLateArriving(LateArrivingRequest) returns (LateArrivingResult);
    
    // Read operations
    rpc GetSnapshot(GetSnapshotRequest) returns (Snapshot);
    rpc GetHistory(GetHistoryRequest) returns (stream HistoryEntry);
    rpc Query(QueryRequest) returns (QueryResult);
    
    // Streaming
    rpc WatchChanges(WatchRequest) returns (stream ChangeEvent);
  }
}
```

### 4.2 Dependency Injection Design

```typescript
/**
 * Store factory for dependency injection
 */
export interface BiTemporalStoreFactory {
  create(config: StoreConfig): BiTemporalStore;
}

/**
 * Store configuration
 */
export interface StoreConfig {
  mode: 'embedded' | 'service';
  
  // Embedded mode options
  embedded?: {
    storage: StorageBackend;
    indexType: 'memory' | 'persistent';
  };
  
  // Service mode options
  service?: {
    endpoint: string;
    credentials?: Credentials;
    timeout: number;
    retryPolicy: RetryPolicy;
  };
  
  // Common options
  compaction: CompactionConfig;
  queryCache: CacheConfig;
}

/**
 * Abstract store interface for polymorphic usage
 */
export abstract class BiTemporalStore {
  abstract createSnapshot(agentId: string, quads: Quad[], options?: SnapshotOptions): Promise<Snapshot>;
  abstract getSnapshot(agentId: string, options?: QueryOptions): Promise<Snapshot | null>;
  abstract recordCorrection(agentId: string, quads: Quad[], options: CorrectionOptions): Promise<CorrectionResult>;
  abstract insertLateArriving(agentId: string, quads: Quad[], options: LateArrivingOptions): Promise<LateArrivingResult>;
  abstract getHistory(agentId: string): Promise<TemporalHistory>;
  abstract query(pattern: QuadPattern, temporal: TemporalQueryOptions): Promise<Quad[]>;
  abstract close(): Promise<void>;
}
```

### 4.3 Service Boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      BiTemporal Store Service Boundary                   │
│                                                                          │
│  External Interface (API)                                               │
│  ├── REST: /api/v1/temporal/*                                          │
│  ├── gRPC: BiTemporalStore service                                     │
│  └── Events: temporal.snapshot.*, temporal.correction.*                 │
│                                                                          │
│  Internal Components                                                     │
│  ├── TemporalCoordinates: Validates and normalizes temporal inputs     │
│  ├── BiTemporalQuad: Manages quad + temporal metadata                  │
│  ├── TemporalIndex: Interval trees for efficient queries               │
│  ├── QueryEngine: Executes bi-temporal queries                         │
│  ├── ConflictResolver: Handles concurrent modifications                │
│  └── MigrationManager: Schema/data evolution                           │
│                                                                          │
│  Storage Abstraction                                                     │
│  ├── InMemoryBackend: For testing and embedded mode                    │
│  ├── FileBackend: Persistent local storage                             │
│  └── DistributedBackend: For service mode (future)                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Integration with Bridge Components

```typescript
/**
 * Bridge Orchestrator integration
 */
class BridgeOrchestrator {
  constructor(
    private readonly adapters: Map<string, ProtocolAdapter>,
    private readonly store: BiTemporalStore,  // Injected dependency
    private readonly eventBus: EventBus
  ) {}
  
  async importAgent(
    agentId: string,
    native: NativeAgent,
    sourceFormat: string
  ): Promise<TranslationResult> {
    const adapter = this.adapters.get(sourceFormat);
    const canonical = await adapter.toCanonical(native);
    const quads = adapter.toQuads(canonical);
    
    // Store with bi-temporal semantics
    const snapshot = await this.store.createSnapshot(agentId, quads, {
      sourceFormat,
      fidelityScore: canonical.fidelityScore
    });
    
    this.eventBus.emit('agent.imported', { agentId, snapshot });
    return { agentId, snapshot, canonical };
  }
  
  async getAgentAtTime(
    agentId: string,
    validAt?: Date,
    recordedAt?: Date
  ): Promise<CanonicalAgent | null> {
    const snapshot = await this.store.getSnapshot(agentId, {
      validAt,
      recordedAt
    });
    
    if (!snapshot) return null;
    return this.reconstructAgent(snapshot.quads);
  }
}
```

---

## 5. Bi-Temporal Query Algebra

### 5.1 Temporal Operators

#### 5.1.1 AS_OF Operator (Transaction Time)

**Semantics**: Returns the database state as it was recorded at a specific transaction time.

**Signature**:
```typescript
AS_OF(relation: R, tt: TransactionTime): R
```

**Implementation**:
```typescript
function asOf<T extends BiTemporalQuad>(
  quads: T[],
  transactionTime: Date
): T[] {
  return quads.filter(q => 
    q.coordinates.transactionTime.from <= transactionTime &&
    (q.coordinates.transactionTime.to === null || 
     q.coordinates.transactionTime.to > transactionTime)
  );
}
```

**SQL:2011 Equivalent**:
```sql
SELECT * FROM agents FOR SYSTEM_TIME AS OF TIMESTAMP '2024-03-01';
```

#### 5.1.2 VALID_AT Operator (Valid Time)

**Semantics**: Returns facts that were valid (true in reality) at a specific point in time.

**Signature**:
```typescript
VALID_AT(relation: R, vt: ValidTime): R
```

**Implementation**:
```typescript
function validAt<T extends BiTemporalQuad>(
  quads: T[],
  validTime: Date
): T[] {
  return quads.filter(q =>
    q.coordinates.validTime.from <= validTime &&
    (q.coordinates.validTime.to === null ||
     q.coordinates.validTime.to > validTime)
  );
}
```

**SQL:2011 Equivalent**:
```sql
SELECT * FROM agents FOR VALID_TIME AS OF DATE '2024-06-15';
```

#### 5.1.3 BETWEEN_AND Operator (Range Query)

**Semantics**: Returns facts valid/recorded within a time range.

**Signature**:
```typescript
BETWEEN_AND(
  relation: R,
  dimension: 'valid' | 'transaction',
  from: Date,
  to: Date
): R
```

**Implementation**:
```typescript
function betweenAnd<T extends BiTemporalQuad>(
  quads: T[],
  dimension: 'valid' | 'transaction',
  from: Date,
  to: Date
): T[] {
  return quads.filter(q => {
    const interval = dimension === 'valid'
      ? q.coordinates.validTime
      : q.coordinates.transactionTime;
    
    // Overlap check: intervals [a, b) and [c, d) overlap if a < d AND c < b
    const intervalEnd = interval.to ?? new Date(8640000000000000); // Max date
    return interval.from < to && from < intervalEnd;
  });
}
```

**SQL:2011 Equivalent**:
```sql
SELECT * FROM agents 
FOR VALID_TIME BETWEEN DATE '2024-01-01' AND DATE '2024-12-31';
```

#### 5.1.4 COALESCE Operator

**Semantics**: Merges adjacent or overlapping temporal intervals with identical values.

**Signature**:
```typescript
COALESCE(relation: R, dimension: 'valid' | 'transaction'): R
```

**Example**:
```
Before COALESCE:
  [entity, :name, "Ada", VT:[2024-01-01, 2024-03-01)]
  [entity, :name, "Ada", VT:[2024-03-01, 2024-06-01)]
  [entity, :name, "Ada", VT:[2024-06-01, ∞)]

After COALESCE:
  [entity, :name, "Ada", VT:[2024-01-01, ∞)]
```

**Implementation**:
```typescript
function coalesce<T extends BiTemporalQuad>(
  quads: T[],
  dimension: 'valid' | 'transaction'
): T[] {
  // Group by (subject, predicate, object) ignoring temporal
  const groups = groupByContent(quads);
  
  const result: T[] = [];
  
  for (const group of groups.values()) {
    // Sort by interval start
    const sorted = sortByIntervalStart(group, dimension);
    
    // Merge adjacent/overlapping
    let current = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      if (canMerge(current, next, dimension)) {
        current = merge(current, next, dimension);
      } else {
        result.push(current);
        current = next;
      }
    }
    result.push(current);
  }
  
  return result;
}
```

#### 5.1.5 SEQUENCED Modifier

**Semantics**: Applies an operation at each point in time separately, maintaining temporal semantics.

**Example** (Sequenced Join):
```typescript
// Non-sequenced: Join ignoring time
// Sequenced: Join only records with overlapping valid-time

function sequencedJoin(
  r1: BiTemporalQuad[],
  r2: BiTemporalQuad[],
  joinKey: (q: BiTemporalQuad) => string
): BiTemporalQuad[] {
  const result: BiTemporalQuad[] = [];
  
  for (const q1 of r1) {
    for (const q2 of r2) {
      if (joinKey(q1) === joinKey(q2)) {
        // Check valid-time overlap
        const overlap = intervalIntersection(
          q1.coordinates.validTime,
          q2.coordinates.validTime
        );
        
        if (overlap) {
          // Create joined result with intersection valid-time
          result.push(createJoinedQuad(q1, q2, overlap));
        }
      }
    }
  }
  
  return result;
}
```

### 5.2 Combined Bi-Temporal Query

**The fundamental bi-temporal query operation**:

```typescript
/**
 * Execute a combined bi-temporal query
 * 
 * @param agentId - Agent to query
 * @param validTime - Point in valid time
 * @param transactionTime - Point in transaction time
 * @returns Facts that were valid at validTime as known at transactionTime
 */
async function biTemporalQuery(
  store: BiTemporalStore,
  agentId: string,
  validTime: Date,
  transactionTime: Date
): Promise<BiTemporalQuad[]> {
  // 1. First filter by transaction time
  //    "What did we know at transactionTime?"
  const knownAtTT = await store.query({
    patterns: [{ subject: agentId }],
    temporal: {
      transactionTime: { type: 'point', at: transactionTime }
    }
  });
  
  // 2. Then filter by valid time
  //    "Of what we knew, what was valid at validTime?"
  return knownAtTT.filter(q =>
    q.coordinates.validTime.from <= validTime &&
    (q.coordinates.validTime.to === null || 
     q.coordinates.validTime.to > validTime)
  );
}
```

### 5.3 Query Execution Plan

```
BiTemporal Query Plan:

Query: "Get agent-123's capabilities on 2024-06-15 as we knew them on 2024-03-01"

1. Index Scan: transactionTimeIndex
   - Find graphs where TT_start <= 2024-03-01 AND (TT_end > 2024-03-01 OR TT_end = null)
   - Result: [graph-v1, graph-v2]

2. Filter: Valid Time
   - For each graph, check VT_start <= 2024-06-15 AND (VT_end > 2024-06-15 OR VT_end = null)
   - Result: [graph-v2]

3. Pattern Match: Subject = agent-123
   - Scan quads in graph-v2
   - Filter by subject

4. Property Filter: predicate = hasCapability
   - Return matching quads

Estimated Cost: O(log n) + O(m) where n = graphs, m = quads in matched graphs
```

### 5.4 Query API

```typescript
/**
 * Complete bi-temporal query interface
 */
interface BiTemporalQueryAPI {
  /**
   * Point-in-time query
   */
  snapshot(agentId: string, temporal: {
    validAt?: Date;
    recordedAt?: Date;
  }): Promise<AgentSnapshot | null>;
  
  /**
   * Range query
   */
  range(agentId: string, temporal: {
    validFrom?: Date;
    validTo?: Date;
    recordedFrom?: Date;
    recordedTo?: Date;
  }): Promise<AgentSnapshot[]>;
  
  /**
   * History query with temporal metadata
   */
  history(agentId: string, options?: {
    includeSuperseded?: boolean;
  }): Promise<TemporalHistory>;
  
  /**
   * Sequenced query (apply at each time point)
   */
  sequenced<T>(
    query: (snapshot: AgentSnapshot) => T,
    temporal: { from: Date; to: Date; granularity: TemporalGranularity }
  ): Promise<Array<{ time: Date; result: T }>>;
  
  /**
   * SPARQL-like pattern query with temporal
   */
  sparql(query: string, temporal: {
    validAt?: Date;
    recordedAt?: Date;
  }): Promise<BindingSet[]>;
}
```

---

## 6. Conflict Resolution and Temporal Consistency

### 6.1 Conflict Types

#### 6.1.1 Concurrent Modifications

**Scenario**: Two processes attempt to update the same agent simultaneously.

```
Process A:                     Process B:
Read agent v1                  Read agent v1
Modify: add capability X       Modify: add capability Y
Write v2 at T1                 Write v2 at T1+ε
```

**Resolution Strategy**: Last-Writer-Wins with Merge Detection

```typescript
async function handleConcurrentWrite(
  agentId: string,
  incomingQuads: Quad[],
  expectedVersion: number
): Promise<WriteResult> {
  const current = await store.getCurrentState(agentId);
  
  if (current.version !== expectedVersion) {
    // Concurrent modification detected
    const conflict: ConflictRecord = {
      type: 'concurrent_modification',
      agentId,
      expectedVersion,
      actualVersion: current.version,
      incomingQuads,
      currentQuads: current.quads
    };
    
    // Attempt automatic merge
    const merged = attemptMerge(current.quads, incomingQuads);
    if (merged.success) {
      return store.createSnapshot(agentId, merged.quads, {
        correctionType: 'update',
        supersedes: current.graphUri,
        mergedFrom: [current.graphUri, 'incoming']
      });
    }
    
    // Cannot auto-merge, return conflict
    return { success: false, conflict };
  }
  
  // No conflict, proceed
  return store.createSnapshot(agentId, incomingQuads);
}
```

#### 6.1.2 Late-Arriving Data

**Scenario**: Information arrives about a past event after current state has been recorded.

```
Timeline:
T1: Agent created with capabilities [A]
T2: Capability B actually added (in reality)
T3: We record capability C being added
T4: We learn about B (late-arriving)
```

**Resolution Strategy**: Insert with Valid Time Adjustment

```typescript
async function handleLateArriving(
  agentId: string,
  quads: Quad[],
  validFrom: Date,
  discoveredAt: Date = new Date()
): Promise<LateArrivingResult> {
  // Validate: validFrom must be before discoveredAt
  if (validFrom >= discoveredAt) {
    throw new TemporalConstraintError(
      'Late-arriving data must have validFrom before discovery time'
    );
  }
  
  // Find versions affected by this backdated information
  const affected = await store.findVersionsValidAt(agentId, validFrom);
  
  // Create the late-arriving record
  const newSnapshot = await store.createSnapshot(agentId, quads, {
    validFrom,
    validTo: null,  // Extends to present
    correctionType: 'late_arriving',
    discoveredAt
  });
  
  // Potentially split existing valid-time intervals
  for (const version of affected) {
    if (version.validFrom < validFrom && 
        (version.validTo === null || version.validTo > validFrom)) {
      // This version spans the late-arriving data's start
      // May need to adjust or split
      await adjustValidTimeInterval(version, validFrom, newSnapshot.graphUri);
    }
  }
  
  return {
    success: true,
    graphUri: newSnapshot.graphUri,
    affectedVersions: affected.map(v => v.graphUri),
    validInterval: { from: validFrom, to: null }
  };
}
```

#### 6.1.3 Retroactive Corrections

**Scenario**: A previously recorded fact is discovered to be incorrect and needs correction.

```
T1: Recorded agent capability as "tool_use"
T2: Discovered it should have been "function_calling"
```

**Resolution Strategy**: Supersession with Full Audit Trail

```typescript
async function correctHistoricalFact(
  agentId: string,
  correctedQuads: Quad[],
  options: {
    validFrom?: Date;
    validTo?: Date;
    reason: string;
    correctedProperty?: string;
  }
): Promise<CorrectionResult> {
  const current = await store.getCurrentState(agentId);
  
  // 1. Supersede the current version
  await store.recordSupersession(current.graphUri, new Date());
  
  // 2. Create corrected version
  const corrected = await store.createSnapshot(agentId, correctedQuads, {
    validFrom: options.validFrom ?? current.validFrom,
    validTo: options.validTo,
    correctionType: 'update',
    supersedes: current.graphUri,
    reason: options.reason
  });
  
  // 3. Emit correction event for audit
  eventBus.emit('temporal.correction', {
    agentId,
    superseded: current.graphUri,
    corrected: corrected.graphUri,
    reason: options.reason,
    correctedProperty: options.correctedProperty,
    timestamp: new Date()
  });
  
  return {
    success: true,
    supersededGraphUri: current.graphUri,
    newGraphUri: corrected.graphUri,
    correctionType: 'update'
  };
}
```

### 6.2 Temporal Constraint Validation

```typescript
/**
 * Temporal constraints that must be maintained
 */
interface TemporalConstraints {
  /**
   * Valid time constraints
   */
  validTime: {
    // VT_start must be <= VT_end
    startBeforeEnd: boolean;
    
    // VT cannot be in the future (optional - allows scheduled facts)
    noFuture?: boolean;
    
    // Maximum valid-time span
    maxSpan?: Duration;
  };
  
  /**
   * Transaction time constraints (system-enforced)
   */
  transactionTime: {
    // TT_start is always <= now
    startNotFuture: true;  // Always enforced
    
    // TT_end is always > TT_start
    endAfterStart: true;   // Always enforced
    
    // TT_end can only be set once (immutability)
    endSetOnce: true;      // Always enforced
  };
  
  /**
   * Referential constraints
   */
  referential: {
    // supersedes must point to valid graph
    validSupersedes: boolean;
    
    // supersededBy must be consistent with supersedes
    bidirectionalSupersession: boolean;
    
    // Version numbers must be monotonic
    monotonicVersions: boolean;
  };
}

/**
 * Validate temporal constraints
 */
function validateConstraints(
  quad: BiTemporalQuad,
  constraints: TemporalConstraints
): ValidationResult {
  const errors: ConstraintViolation[] = [];
  
  // Valid time validation
  if (constraints.validTime.startBeforeEnd) {
    if (quad.coordinates.validTime.to !== null &&
        quad.coordinates.validTime.from > quad.coordinates.validTime.to) {
      errors.push({
        constraint: 'validTime.startBeforeEnd',
        message: 'Valid time start must be before end',
        actual: { from: quad.coordinates.validTime.from, to: quad.coordinates.validTime.to }
      });
    }
  }
  
  if (constraints.validTime.noFuture) {
    const now = new Date();
    if (quad.coordinates.validTime.from > now) {
      errors.push({
        constraint: 'validTime.noFuture',
        message: 'Valid time cannot be in the future',
        actual: quad.coordinates.validTime.from
      });
    }
  }
  
  // Transaction time validation (always enforced)
  const now = new Date();
  if (quad.coordinates.transactionTime.from > now) {
    errors.push({
      constraint: 'transactionTime.startNotFuture',
      message: 'Transaction time start cannot be in the future',
      actual: quad.coordinates.transactionTime.from
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### 6.3 Consistency Guarantees

| Guarantee | Description | Implementation |
|-----------|-------------|----------------|
| **Transaction Atomicity** | All quads in a snapshot are written together | Transaction wrapper |
| **TT Immutability** | Transaction time can only advance | Write-once semantics |
| **Supersession Consistency** | Bidirectional linkage maintained | Two-phase commit |
| **Version Monotonicity** | Version numbers strictly increase | Atomic increment |
| **Audit Completeness** | No temporal data is lost | Append-only log |

---

## 7. Implementation Roadmap

### 7.1 Phase Overview

```
Phase 1: Foundation (Weeks 1-3)
├── TemporalCoordinates implementation
├── BiTemporalMetadata schema update
├── transactionTo field addition
└── Basic index structures

Phase 2: Query Engine (Weeks 4-6)
├── AS_OF operator
├── VALID_AT operator
├── BETWEEN_AND operator
├── Combined bi-temporal query

Phase 3: Conflict Resolution (Weeks 7-8)
├── Concurrent modification handling
├── Late-arriving data support
├── Retroactive corrections
└── Constraint validation

Phase 4: Integration (Weeks 9-10)
├── Bridge orchestrator integration
├── Service mode implementation
├── Event streaming
└── API finalization

Phase 5: Optimization & Testing (Weeks 11-12)
├── IntervalTree index optimization
├── Query plan optimization
├── Comprehensive testing
└── Documentation
```

### 7.2 Phase 1: Foundation (Weeks 1-3)

#### Week 1: Schema Update

**Deliverables**:
- [ ] `BiTemporalMetadata` interface with all fields
- [ ] `TemporalCoordinates` type with interval semantics
- [ ] Migration of existing `TemporalMetadata` to new schema

**Code Changes**:
```typescript
// File: src/rdf/temporal-coordinates.ts
export interface TemporalCoordinates {
  validTime: TimeInterval;
  transactionTime: TimeInterval;
}

export interface TimeInterval {
  from: Date;
  to: Date | null;
  granularity?: TemporalGranularity;
}
```

#### Week 2: Storage Layer

**Deliverables**:
- [ ] Update `TemporalGraph` to use `BiTemporalMetadata`
- [ ] Add `transactionTo` field to all storage operations
- [ ] Implement supersession log

**Code Changes**:
```typescript
// File: src/rdf/temporal-store.ts
interface BiTemporalGraph {
  uri: string;
  metadata: BiTemporalMetadata;
  quads: Quad[];
}

// Add supersession log
private supersessionLog: SupersessionEntry[] = [];
```

#### Week 3: Basic Indexing

**Deliverables**:
- [ ] Implement simple interval index (linear scan optimization)
- [ ] Add `currentStateIndex` for fast current-state lookup
- [ ] Update `isTemporallyValid()` with TT_end check

**Test Coverage**:
- Unit tests for temporal coordinate operations
- Integration tests for snapshot creation with bi-temporal metadata
- Migration tests for existing data

### 7.3 Phase 2: Query Engine (Weeks 4-6)

#### Week 4: Single-Dimension Operators

**Deliverables**:
- [ ] `AS_OF` operator implementation
- [ ] `VALID_AT` operator implementation
- [ ] Updated `getSnapshot()` with full bi-temporal support

**API**:
```typescript
// Enhanced getSnapshot
async getSnapshot(agentId: string, options?: {
  validAt?: Date;
  recordedAt?: Date;
  version?: number;
}): Promise<AgentSnapshot | null>
```

#### Week 5: Range Operators

**Deliverables**:
- [ ] `BETWEEN_AND` operator implementation
- [ ] Range query API
- [ ] `getHistory()` with temporal metadata

**API**:
```typescript
// Range query
async queryRange(agentId: string, options: {
  validFrom?: Date;
  validTo?: Date;
  recordedFrom?: Date;
  recordedTo?: Date;
}): Promise<AgentSnapshot[]>
```

#### Week 6: Combined Queries

**Deliverables**:
- [ ] Combined bi-temporal query execution
- [ ] `COALESCE` operator
- [ ] Query execution planner (basic)

**Test Coverage**:
- Unit tests for each operator
- Combined query correctness tests
- Performance benchmarks for various query patterns

### 7.4 Phase 3: Conflict Resolution (Weeks 7-8)

#### Week 7: Conflict Detection

**Deliverables**:
- [ ] `ConflictResolver` interface
- [ ] Concurrent modification detection
- [ ] Optimistic locking mechanism

**Code**:
```typescript
// File: src/rdf/conflict-resolver.ts
export class ConflictResolver {
  detectConflict(expected: number, actual: number): boolean;
  resolveOverlap(existing: Quad[], incoming: Quad[]): Resolution;
}
```

#### Week 8: Correction Operations

**Deliverables**:
- [ ] `recordCorrection()` implementation
- [ ] `insertLateArriving()` implementation
- [ ] Constraint validation

**API**:
```typescript
async recordCorrection(agentId: string, quads: Quad[], options: {
  correctionType: 'update' | 'delete';
  validFrom?: Date;
  validTo?: Date;
  reason?: string;
}): Promise<CorrectionResult>

async insertLateArriving(agentId: string, quads: Quad[], options: {
  validFrom: Date;
  validTo?: Date;
  discoveredAt?: Date;
}): Promise<LateArrivingResult>
```

**Test Coverage**:
- Conflict scenario tests
- Late-arriving data tests
- Retroactive correction tests
- Constraint violation tests

### 7.5 Phase 4: Integration (Weeks 9-10)

#### Week 9: Bridge Integration

**Deliverables**:
- [ ] Update `BridgeOrchestrator` to use bi-temporal store
- [ ] Bi-temporal aware adapter base class
- [ ] Time-travel queries in bridge API

**Code**:
```typescript
// File: src/bridge/orchestrator.ts
class BridgeOrchestrator {
  async getAgentAtTime(
    agentId: string,
    validAt?: Date,
    recordedAt?: Date
  ): Promise<CanonicalAgent | null>
}
```

#### Week 10: Service Mode

**Deliverables**:
- [ ] gRPC service definition for bi-temporal store
- [ ] Service mode factory
- [ ] Event streaming for changes

**Proto**:
```protobuf
// File: src/api/grpc/bitemporal.proto
service BiTemporalStore {
  rpc CreateSnapshot(CreateSnapshotRequest) returns (Snapshot);
  rpc GetSnapshot(GetSnapshotRequest) returns (Snapshot);
  rpc WatchChanges(WatchRequest) returns (stream ChangeEvent);
}
```

### 7.6 Phase 5: Optimization & Testing (Weeks 11-12)

#### Week 11: Performance Optimization

**Deliverables**:
- [ ] IntervalTree implementation for temporal indexes
- [ ] Query plan optimization
- [ ] Caching layer for hot paths

**Code**:
```typescript
// File: src/rdf/interval-tree.ts
export class IntervalTree<T> {
  insert(interval: Interval, value: T): void;
  findOverlapping(point: Date): T[];
  findIntersecting(interval: Interval): T[];
}
```

#### Week 12: Final Testing & Documentation

**Deliverables**:
- [ ] Comprehensive test suite (>90% coverage)
- [ ] Performance benchmarks
- [ ] API documentation
- [ ] Migration guide

**Documentation**:
- API reference
- Query algebra guide
- Migration from current store
- Performance tuning guide

### 7.7 Dependency Ordering

```
┌─────────────────────────────────────────────────────────────────┐
│                        Dependency Graph                          │
│                                                                  │
│  TemporalCoordinates ─────────────────────────────┐             │
│         │                                          │             │
│         ▼                                          ▼             │
│  BiTemporalMetadata ───────► BiTemporalQuad ──► TemporalIndex   │
│         │                         │                 │            │
│         │                         ▼                 │            │
│         │              ConflictResolver ◄───────────┤            │
│         │                         │                 │            │
│         ▼                         ▼                 ▼            │
│  QueryEngine ◄────────────────────┴─────────────────┘           │
│         │                                                        │
│         ▼                                                        │
│  MigrationManager                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.8 Integration Milestones

| Milestone | Week | Dependencies | Deliverable |
|-----------|------|--------------|-------------|
| M1: Schema Ready | 1 | None | BiTemporalMetadata interface |
| M2: Storage Ready | 2 | M1 | transactionTo support |
| M3: Basic Queries | 4 | M2 | AS_OF, VALID_AT operators |
| M4: Full Queries | 6 | M3 | Combined bi-temporal queries |
| M5: Corrections | 8 | M4 | Late-arriving, retroactive support |
| M6: Integration | 10 | M5 | Bridge orchestrator integration |
| M7: Production Ready | 12 | M6 | Performance optimization, docs |

### 7.9 Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance degradation | Medium | High | Early benchmarking, indexed queries |
| Data migration issues | Medium | High | Phased migration, rollback plan |
| Query complexity | Low | Medium | Query planner, documentation |
| Integration conflicts | Medium | Medium | Feature flags, gradual rollout |
| Scope creep | High | Medium | Fixed milestone scope, backlog |

---

## 8. Post-Roadmap: Bridge Completion

Upon completion of the bi-temporal store implementation, return to the following remaining bridge work items:

1. **Refactoring Opportunities** (from retrospective):
   - Persistence backend abstraction
   - Distributed event bus
   - Adapter code duplication reduction
   - Detailed fidelity scoring
   - SHACL validation
   - Generic type constraints
   - Temporal store compaction

2. **Extended Adapter Coverage**:
   - OpenAI function calling adapter
   - AutoGPT specification adapter
   - Semantic Kernel agent adapter
   - CrewAI adapter

3. **Production Hardening**:
   - Circuit breaker patterns
   - Rate limiting
   - Telemetry and observability
   - Security audit

---

## Appendix A: Academic Reference Details

### A.1 Snodgrass BCDM Formalization

The Bitemporal Conceptual Data Model (BCDM) defines:

**Tuple**: A bitemporal tuple is a tuple with valid-time and transaction-time attributes.

**Relation**: A bitemporal relation `r` consists of:
- A schema `R(A₁, ..., Aₙ, VT_start, VT_end, TT_start, TT_end)`
- A set of tuples conforming to the schema

**Timestamp Domains**:
- `VT ∈ {t | t is a valid time instant} ∪ {now, UC}`
- `TT ∈ {t | t is a transaction time instant} ∪ {UC}`

**Coalescing Function**:
```
coalesce(r) = {t | t ∈ r ∧ ¬∃t' ∈ r : 
  t.attrs = t'.attrs ∧ 
  (t.VT_end = t'.VT_start ∨ overlaps(t.VT, t'.VT))}
```

### A.2 Allen's Interval Relations Implementation

```typescript
/**
 * Allen's 13 interval relations
 */
function allenRelation(a: Interval, b: Interval): IntervalRelation {
  const aEnd = a.to ?? Infinity;
  const bEnd = b.to ?? Infinity;
  
  if (aEnd < b.from) return 'before';
  if (a.from > bEnd) return 'after';
  if (aEnd === b.from) return 'meets';
  if (a.from === bEnd) return 'met_by';
  if (a.from < b.from && aEnd > b.from && aEnd < bEnd) return 'overlaps';
  if (b.from < a.from && bEnd > a.from && bEnd < aEnd) return 'overlapped_by';
  if (a.from === b.from && aEnd < bEnd) return 'starts';
  if (a.from === b.from && aEnd > bEnd) return 'started_by';
  if (a.from > b.from && aEnd < bEnd) return 'during';
  if (b.from > a.from && bEnd < aEnd) return 'contains';
  if (aEnd === bEnd && a.from > b.from) return 'finishes';
  if (aEnd === bEnd && a.from < b.from) return 'finished_by';
  return 'equals';
}
```

---

*Implementation Plan Version: 1.0.0*  
*Last Updated: 2026-01-11*  
*Status: Approved for Implementation*
