# Chrysalis Universal Agent Bridge - Refactoring Specification

## Executive Summary

This specification documents the identified refactoring opportunities for the Chrysalis Universal Agent Bridge, prioritizes them based on impact and effort, and aligns implementation with the bi-temporal store roadmap. The bridge is currently functional with 173 passing tests, but several architectural improvements will enhance scalability, maintainability, and production readiness.

**Document Status**: Refactoring Plan  
**Related Documents**: BITEMPORAL_IMPLEMENTATION_PLAN.md, BRIDGE_IMPLEMENTATION.md  
**Version**: 1.0.0  
**Last Updated**: 2026-01-11

---

## 1. Current State Assessment

### 1.1 Component Inventory

| Component | File | Lines | Status | Notes |
|-----------|------|-------|--------|-------|
| Base Adapter | `src/adapters/base-adapter.ts` | ~600 | Complete | Template method pattern |
| SemanticAgent Adapter | `src/adapters/usa-adapter.ts` | ~450 | Complete | Native Chrysalis format |
| LMOS Adapter | `src/adapters/lmos-adapter.ts` | ~500 | Complete | Eclipse LMOS protocol |
| MCP Adapter | `src/adapters/mcp-adapter.ts` | ~400 | Complete | Model Context Protocol |
| LangChain Adapter | `src/adapters/langchain-adapter.ts` | ~400 | Complete | LangChain agents |
| Temporal Store | `src/rdf/temporal-store.ts` | 1,212 | Partial Bi-temporal | Needs TT_end |
| Orchestrator | `src/bridge/orchestrator.ts` | 945 | Complete | Translation coordination |
| Service Integration | `src/bridge/service-integration.ts` | 1,115 | Complete | Discovery, Events, Persistence |
| API Controller | `src/api/bridge/controller.ts` | ~800 | Complete | REST endpoints |
| Canonical Ontology | `src/ontology/chrysalis-agent.ttl` | ~350 | Complete | RDF schema |

### 1.2 Test Coverage

```
Bridge Test Suite:
├── adapters/
│   ├── base-adapter.test.ts      (32 tests)
│   ├── usa-adapter.test.ts       (28 tests)
│   ├── lmos-adapter.test.ts      (31 tests)
│   ├── mcp-adapter.test.ts       (24 tests)
│   └── langchain-adapter.test.ts (22 tests)
├── rdf/
│   └── temporal-store.test.ts    (18 tests)
├── bridge/
│   ├── orchestrator.test.ts      (12 tests)
│   └── service-integration.test.ts (6 tests)
└── Total: 173 tests passing
```

### 1.3 Known Technical Debt

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| In-memory persistence only | High | No production persistence | Medium |
| Single-process event bus | Medium | No distributed events | Medium |
| Repeated quad creation code | Low | Maintenance overhead | Low |
| Coarse fidelity scoring | Low | Limited diagnostics | Medium |
| No SHACL validation | Medium | No schema enforcement | High |
| Loose generic types | Low | Type safety gaps | Low |
| No temporal compaction | Medium | Storage growth | Medium |

---

## 2. Refactoring Opportunities

### 2.1 Persistence Backend Abstraction

**Current State**: In-memory Maps in `BridgePersistenceService` and `TemporalRDFStore`.

**Problem**: Data is lost on restart; no production deployment path.

**Solution**: Introduce `StorageBackend` interface with pluggable implementations.

```typescript
/**
 * Storage backend abstraction
 */
export interface StorageBackend {
  // Key-value operations
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  
  // Iteration
  keys(prefix?: string): AsyncIterable<string>;
  values<T>(prefix?: string): AsyncIterable<T>;
  entries<T>(prefix?: string): AsyncIterable<[string, T]>;
  
  // Batch operations
  batch(operations: BatchOperation[]): Promise<void>;
  
  // Transaction support
  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
  
  // Health
  healthCheck(): Promise<HealthStatus>;
}

/**
 * Backend implementations
 */
export class InMemoryBackend implements StorageBackend { /* ... */ }
export class LevelDBBackend implements StorageBackend { /* ... */ }
export class SQLiteBackend implements StorageBackend { /* ... */ }
export class PostgresBackend implements StorageBackend { /* ... */ }
```

**Migration Path**:
1. Extract current Map operations to `InMemoryBackend`
2. Define `StorageBackend` interface from extracted operations
3. Implement `LevelDBBackend` for embedded persistence
4. Implement `PostgresBackend` for production deployments
5. Update `TemporalRDFStore` and `BridgePersistenceService` to use backend

**Priority**: High  
**Effort**: Medium (2-3 weeks)  
**Dependencies**: None

### 2.2 Distributed Event Bus

**Current State**: In-process `EventEmitter` in `BridgeEventBus`.

**Problem**: Events don't propagate across service instances; no pub/sub durability.

**Solution**: Introduce `EventTransport` interface with distributed implementations.

```typescript
/**
 * Event transport abstraction
 */
export interface EventTransport {
  // Publishing
  publish(channel: string, event: BridgeEvent): Promise<void>;
  
  // Subscribing
  subscribe(channel: string, handler: EventHandler): Promise<Subscription>;
  unsubscribe(subscription: Subscription): Promise<void>;
  
  // Pattern subscription
  psubscribe(pattern: string, handler: EventHandler): Promise<Subscription>;
  
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  // Health
  healthCheck(): Promise<HealthStatus>;
}

/**
 * Transport implementations
 */
export class LocalEventTransport implements EventTransport { /* ... */ }
export class RedisEventTransport implements EventTransport { /* ... */ }
export class KafkaEventTransport implements EventTransport { /* ... */ }
export class NATSEventTransport implements EventTransport { /* ... */ }
```

**Migration Path**:
1. Extract `EventEmitter` usage to `LocalEventTransport`
2. Define `EventTransport` interface
3. Implement `RedisEventTransport` for simple pub/sub
4. Consider `KafkaEventTransport` for event sourcing alignment
5. Update `BridgeEventBus` to use transport abstraction

**Priority**: Medium  
**Effort**: Medium (2-3 weeks)  
**Dependencies**: None

### 2.3 Adapter Code Deduplication

**Current State**: Each adapter repeats similar quad creation patterns.

**Problem**: Boilerplate code increases maintenance burden; risk of inconsistency.

**Solution**: Introduce declarative field mapping with quad generation helpers.

```typescript
/**
 * Declarative field mapping configuration
 */
export interface FieldMapping<TNative, TCanonical> {
  // Source field path (dot notation)
  source: string;
  
  // Target predicate
  predicate: string;
  
  // Value transformation
  transform?: (value: unknown) => unknown;
  
  // Datatype for literals
  datatype?: string;
  
  // Whether field is required
  required?: boolean;
  
  // Default value if missing
  default?: unknown;
  
  // Nested object handling
  nested?: FieldMapping<unknown, unknown>[];
  
  // Array handling
  array?: {
    itemType: 'literal' | 'node' | 'nested';
    itemMapping?: FieldMapping<unknown, unknown>[];
  };
}

/**
 * Declarative adapter with automatic quad generation
 */
export abstract class DeclarativeAdapter<TNative, TCanonical> extends BaseAdapter {
  abstract readonly mappings: FieldMapping<TNative, TCanonical>[];
  
  protected generateQuads(
    subject: Subject,
    data: Record<string, unknown>,
    mappings: FieldMapping<unknown, unknown>[]
  ): Quad[] {
    const quads: Quad[] = [];
    
    for (const mapping of mappings) {
      const value = this.getNestedValue(data, mapping.source);
      if (value === undefined && !mapping.required) continue;
      
      const transformedValue = mapping.transform 
        ? mapping.transform(value) 
        : value;
      
      if (mapping.nested) {
        // Handle nested object
        const nestedNode = this.createBlankNode();
        quads.push(this.createQuad(subject, mapping.predicate, nestedNode));
        quads.push(...this.generateQuads(nestedNode, transformedValue as Record<string, unknown>, mapping.nested));
      } else if (mapping.array && Array.isArray(transformedValue)) {
        // Handle array
        for (const item of transformedValue) {
          quads.push(...this.createArrayItemQuads(subject, mapping, item));
        }
      } else {
        // Simple value
        quads.push(this.createValueQuad(subject, mapping, transformedValue));
      }
    }
    
    return quads;
  }
}
```

**Example Usage**:
```typescript
class USAAdapterDeclarative extends DeclarativeAdapter<USAAgent, CanonicalAgent> {
  readonly mappings: FieldMapping<USAAgent, CanonicalAgent>[] = [
    { source: 'name', predicate: 'chrysalis:name', required: true },
    { source: 'description', predicate: 'chrysalis:description' },
    { source: 'systemPrompt', predicate: 'chrysalis:systemPrompt' },
    {
      source: 'llm',
      predicate: 'chrysalis:hasLLMConfig',
      nested: [
        { source: 'provider', predicate: 'chrysalis:provider', required: true },
        { source: 'model', predicate: 'chrysalis:model', required: true },
        { source: 'temperature', predicate: 'chrysalis:temperature', datatype: 'xsd:float' }
      ]
    },
    {
      source: 'tools',
      predicate: 'chrysalis:hasTool',
      array: {
        itemType: 'nested',
        itemMapping: [
          { source: 'name', predicate: 'chrysalis:toolName', required: true },
          { source: 'description', predicate: 'chrysalis:toolDescription' }
        ]
      }
    }
  ];
}
```

**Priority**: Low  
**Effort**: Medium (2 weeks)  
**Dependencies**: None

### 2.4 Detailed Fidelity Scoring

**Current State**: Single aggregate fidelity score (0.0-1.0).

**Problem**: Doesn't explain what was lost or degraded in translation.

**Solution**: Multi-dimensional fidelity report with per-field scores.

```typescript
/**
 * Detailed fidelity report
 */
export interface FidelityReport {
  // Overall score (weighted average)
  overallScore: number;
  
  // Per-dimension scores
  dimensions: {
    identity: DimensionScore;      // Name, ID, description
    capabilities: DimensionScore;  // Tools, actions, skills
    configuration: DimensionScore; // LLM config, parameters
    protocols: DimensionScore;     // Bindings, channels
    metadata: DimensionScore;      // Extensions, provenance
  };
  
  // Field-level detail
  fields: FieldFidelity[];
  
  // Recommendations
  recommendations: FidelityRecommendation[];
}

export interface DimensionScore {
  score: number;
  fieldsTotal: number;
  fieldsMapped: number;
  fieldsLost: number;
  fieldsDegraded: number;
}

export interface FieldFidelity {
  field: string;
  status: 'mapped' | 'degraded' | 'lost' | 'default';
  sourceValue?: unknown;
  targetValue?: unknown;
  lossReason?: string;
  recoverable: boolean;
}

export interface FidelityRecommendation {
  priority: 'high' | 'medium' | 'low';
  field: string;
  issue: string;
  suggestion: string;
}
```

**Priority**: Low  
**Effort**: Medium (2 weeks)  
**Dependencies**: Adapter deduplication (optional but helpful)

### 2.5 SHACL Validation

**Current State**: Basic structural validation in adapters.

**Problem**: No RDF-level schema enforcement; canonical form can be malformed.

**Solution**: Implement SHACL (Shapes Constraint Language) validation.

```typescript
/**
 * SHACL validator for canonical agents
 */
export interface SHACLValidator {
  // Load shapes from Turtle file
  loadShapes(shapesPath: string): Promise<void>;
  
  // Validate quads against shapes
  validate(quads: Quad[]): Promise<SHACLValidationResult>;
  
  // Validate specific node
  validateNode(quads: Quad[], nodeUri: string): Promise<SHACLValidationResult>;
}

export interface SHACLValidationResult {
  conforms: boolean;
  results: SHACLValidationReport[];
  severity: 'violation' | 'warning' | 'info';
}

export interface SHACLValidationReport {
  focusNode: string;
  resultPath: string;
  constraint: string;
  severity: 'violation' | 'warning' | 'info';
  message: string;
  value?: unknown;
}
```

**SHACL Shapes Example**:
```turtle
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix chrysalis: <https://chrysalis.dev/ontology/agent#> .

chrysalis:AgentShape a sh:NodeShape ;
    sh:targetClass chrysalis:Agent ;
    sh:property [
        sh:path chrysalis:name ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:minLength 1 ;
        sh:message "Agent must have exactly one non-empty name" ;
    ] ;
    sh:property [
        sh:path chrysalis:hasLLMConfig ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:node chrysalis:LLMConfigShape ;
        sh:message "Agent must have exactly one LLM configuration" ;
    ] .

chrysalis:LLMConfigShape a sh:NodeShape ;
    sh:property [
        sh:path chrysalis:provider ;
        sh:minCount 1 ;
        sh:in ("openai" "anthropic" "google" "local") ;
    ] ;
    sh:property [
        sh:path chrysalis:model ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
    ] ;
    sh:property [
        sh:path chrysalis:temperature ;
        sh:datatype xsd:float ;
        sh:minInclusive 0.0 ;
        sh:maxInclusive 2.0 ;
    ] .
```

**Priority**: Medium  
**Effort**: High (3-4 weeks)  
**Dependencies**: None (but informed by canonical ontology)

### 2.6 Generic Type Constraints

**Current State**: Loose generic types in adapters and orchestrator.

**Problem**: Type safety gaps; possible runtime type errors.

**Solution**: Strengthen generic constraints throughout the codebase.

```typescript
// Before: Loose generics
export interface NativeAgent {
  framework: AgentFramework;
  data: unknown;  // Too loose
}

// After: Constrained generics
export interface NativeAgent<TData extends Record<string, unknown> = Record<string, unknown>> {
  framework: AgentFramework;
  data: TData;
}

// Framework-specific type guards
export function isUSAAgent(agent: NativeAgent): agent is NativeAgent<USAAgentData> {
  return agent.framework === 'usa';
}

export function isLMOSAgent(agent: NativeAgent): agent is NativeAgent<LMOSAgentData> {
  return agent.framework === 'lmos';
}

// Adapter with constrained generics
export abstract class TypedAdapter<
  TData extends Record<string, unknown>,
  TFramework extends AgentFramework
> extends BaseAdapter {
  abstract readonly framework: TFramework;
  
  async toCanonical(agent: NativeAgent<TData>): Promise<CanonicalAgent> {
    // Type-safe access to agent.data
  }
  
  async fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent<TData>> {
    // Type-safe return
  }
}
```

**Priority**: Low  
**Effort**: Low (1 week)  
**Dependencies**: None

### 2.7 Temporal Store Compaction

**Current State**: No compaction; all versions retained indefinitely.

**Problem**: Storage grows unbounded; query performance degrades.

**Solution**: Implement configurable compaction with retention policies.

```typescript
/**
 * Compaction configuration
 */
export interface CompactionConfig {
  // Retention period for superseded versions
  retentionPeriod: Duration;
  
  // Minimum versions to keep per agent
  minVersionsPerAgent: number;
  
  // Maximum versions per agent before triggering compaction
  maxVersionsPerAgent?: number;
  
  // Compaction schedule
  schedule?: CronExpression;
  
  // Compaction mode
  mode: 'snapshot' | 'delta' | 'hybrid';
}

/**
 * Compaction service
 */
export class TemporalCompactionService {
  constructor(
    private readonly store: BiTemporalRDFStore,
    private readonly config: CompactionConfig
  ) {}
  
  /**
   * Run compaction
   */
  async compact(): Promise<CompactionResult> {
    const candidates = await this.findCompactionCandidates();
    const compacted: string[] = [];
    const preserved: string[] = [];
    const errors: CompactionError[] = [];
    
    for (const candidate of candidates) {
      try {
        if (this.shouldCompact(candidate)) {
          await this.compactVersion(candidate);
          compacted.push(candidate.graphUri);
        } else {
          preserved.push(candidate.graphUri);
        }
      } catch (error) {
        errors.push({ graphUri: candidate.graphUri, error: String(error) });
      }
    }
    
    return { compacted, preserved, errors };
  }
  
  /**
   * Find versions eligible for compaction
   */
  private async findCompactionCandidates(): Promise<CompactionCandidate[]> {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod.toMillis());
    
    // Find all superseded versions older than retention period
    return this.store.findSupersededBefore(cutoff);
  }
  
  /**
   * Determine if a specific version should be compacted
   */
  private shouldCompact(candidate: CompactionCandidate): boolean {
    // Keep if within minimum versions
    if (candidate.versionIndex < this.config.minVersionsPerAgent) {
      return false;
    }
    
    // Keep if has dependent references
    if (candidate.hasDependents) {
      return false;
    }
    
    return true;
  }
}
```

**Priority**: Medium  
**Effort**: Medium (2 weeks)  
**Dependencies**: Bi-temporal store implementation

---

## 3. Implementation Priorities

### 3.1 Priority Matrix

| Opportunity | Priority | Effort | Impact | Risk | Dependencies |
|-------------|----------|--------|--------|------|--------------|
| Persistence Backend | High | Medium | High | Low | None |
| Distributed Event Bus | Medium | Medium | Medium | Low | None |
| SHACL Validation | Medium | High | High | Medium | None |
| Temporal Compaction | Medium | Medium | High | Low | Bi-temporal |
| Adapter Deduplication | Low | Medium | Medium | Low | None |
| Detailed Fidelity | Low | Medium | Low | Low | Optional |
| Generic Constraints | Low | Low | Low | Low | None |

### 3.2 Recommended Implementation Order

**Phase 1 (Weeks 1-4)**: Foundation
1. Persistence Backend Abstraction (enables production deployment)
2. Generic Type Constraints (low effort, improves development)

**Phase 2 (Weeks 5-8)**: Schema Enforcement
3. SHACL Validation (ensures data quality)

**Phase 3 (Weeks 9-12)**: Scalability (aligned with bi-temporal Phase 4-5)
4. Distributed Event Bus
5. Temporal Compaction

**Phase 4 (Weeks 13-16)**: Quality of Life
6. Adapter Deduplication
7. Detailed Fidelity Scoring

### 3.3 Alignment with Bi-Temporal Roadmap

```
Bi-Temporal Timeline:
Week 1-3: Foundation (Schema, Storage, Basic Index)
Week 4-6: Query Engine
Week 7-8: Conflict Resolution
Week 9-10: Integration  ◄─── Bridge Integration
Week 11-12: Optimization

Bridge Refactoring Timeline:
Week 1-4: Persistence Backend  ◄─── Run in parallel with Bi-Temporal Week 1-4
Week 5-8: SHACL Validation     ◄─── Run in parallel with Bi-Temporal Week 4-8
Week 9-12: Event Bus, Compaction ◄─── Integrate with Bi-Temporal Week 9-12
Week 13-16: Adapter improvements ◄─── After Bi-Temporal complete
```

---

## 4. Detailed Implementation Plans

### 4.1 Persistence Backend (Weeks 1-4)

**Week 1**: Interface Design
- Define `StorageBackend` interface
- Define `Transaction` interface
- Define `BatchOperation` types
- Write interface tests

**Week 2**: In-Memory Implementation
- Extract current Map operations to `InMemoryBackend`
- Implement full interface
- Pass interface tests
- Update `TemporalRDFStore` to use backend

**Week 3**: LevelDB Implementation
- Implement `LevelDBBackend`
- Add serialization layer (JSON or CBOR)
- Handle transactions via batches
- Performance testing

**Week 4**: Integration & Testing
- Update `BridgePersistenceService`
- Configuration/factory pattern
- Integration tests
- Documentation

### 4.2 SHACL Validation (Weeks 5-8)

**Week 5**: SHACL Parser
- Parse SHACL shapes from Turtle
- Build internal shape representation
- Handle property shapes, node shapes

**Week 6**: Validator Implementation
- Implement constraint checking
- Handle sh:minCount, sh:maxCount, sh:datatype
- Handle sh:in, sh:pattern, sh:node
- Generate validation reports

**Week 7**: Integration
- Add validation to `BaseAdapter.validateCanonical()`
- Add validation to `BridgeOrchestrator.translate()`
- Configuration for validation strictness

**Week 8**: Testing & Documentation
- Comprehensive shape tests
- Invalid data detection tests
- Documentation and examples

### 4.3 Distributed Event Bus (Weeks 9-10)

**Week 9**: Transport Abstraction
- Define `EventTransport` interface
- Implement `LocalEventTransport` (current behavior)
- Update `BridgeEventBus` to use transport

**Week 10**: Redis Implementation
- Implement `RedisEventTransport`
- Handle pub/sub channels
- Connection management
- Integration tests

### 4.4 Temporal Compaction (Weeks 11-12)

**Week 11**: Compaction Logic
- Implement `CompactionService`
- Define retention policies
- Identify compaction candidates

**Week 12**: Integration
- Add compaction to store lifecycle
- Scheduled compaction
- Manual compaction API
- Monitoring metrics

---

## 5. Risk Assessment

### 5.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Persistence migration breaks existing data | Low | High | Versioned serialization, migration scripts |
| SHACL adds validation overhead | Medium | Medium | Configurable strictness, async validation |
| Distributed events add latency | Medium | Medium | Local fallback, batching |
| Compaction removes needed data | Low | High | Conservative defaults, audit log |

### 5.2 Schedule Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Bi-temporal work delays | Medium | Medium | Parallelizable refactoring |
| SHACL complexity | Medium | Medium | Use existing libraries (rdf-validate-shacl) |
| Integration testing scope | Medium | Low | Incremental integration |

---

## 6. Success Criteria

### 6.1 Persistence Backend

- [ ] All existing tests pass with `InMemoryBackend`
- [ ] `LevelDBBackend` passes same test suite
- [ ] Data survives process restart
- [ ] Performance within 2x of in-memory for reads

### 6.2 Distributed Event Bus

- [ ] Events propagate across 2+ service instances
- [ ] Event ordering preserved within same agent
- [ ] Graceful degradation when transport unavailable

### 6.3 SHACL Validation

- [ ] All canonical agents pass validation
- [ ] Invalid agents rejected with clear messages
- [ ] Validation time < 50ms per agent

### 6.4 Temporal Compaction

- [ ] Storage reduced by 50%+ for high-churn agents
- [ ] Required versions preserved
- [ ] Compaction completes within SLA

---

## 7. Future Considerations

### 7.1 Additional Adapters

The modular adapter architecture supports future expansion:

- **OpenAI Function Calling** - High demand, well-documented spec
- **AutoGPT** - Complex agent structure, growing ecosystem
- **Semantic Kernel** - Microsoft enterprise adoption
- **CrewAI** - Multi-agent orchestration
- **AgentProtocol** - Industry standardization effort

### 7.2 Advanced Features

- **Agent Versioning UI** - Visual timeline of agent changes
- **Translation Preview** - Show expected output before committing
- **Batch Migration Tools** - Convert entire agent fleets
- **Compatibility Reports** - Framework-to-framework analysis

### 7.3 Performance Optimization

- **Query Caching** - Cache frequently-accessed agent snapshots
- **Lazy Loading** - Load quad data on demand
- **Streaming Translation** - For large agent definitions
- **Parallel Batch Processing** - Worker pool for batch operations

---

*Specification Version: 1.0.0*  
*Last Updated: 2026-01-11*  
*Status: Approved - Implementation Pending*
