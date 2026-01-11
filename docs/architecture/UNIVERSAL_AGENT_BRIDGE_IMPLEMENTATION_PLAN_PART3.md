# Chrysalis Universal Agent Bridge: Implementation Plan (Part 3)

**Continuation of UNIVERSAL_AGENT_BRIDGE_IMPLEMENTATION_PLAN_PART2.md**

---

## 9. Operational Tooling (Continued)

### 9.2 Monitoring Dashboard Metrics (Continued)

```typescript
// src/bridge/monitoring/metrics.ts (continued)

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class BridgeMetrics {
  private readonly registry: Registry;

  // Counters
  readonly translationsTotal: Counter;
  readonly translationErrors: Counter;
  readonly cacheHits: Counter;
  readonly cacheMisses: Counter;

  // Histograms
  readonly translationDuration: Histogram;
  readonly fidelityScore: Histogram;

  // Gauges
  readonly storeAgentCount: Gauge;
  readonly storeTripleCount: Gauge;
  readonly adapterCount: Gauge;
  readonly cacheSize: Gauge;

  constructor() {
    this.registry = new Registry();

    // Initialize counters
    this.translationsTotal = new Counter({
      name: 'bridge_translations_total',
      help: 'Total number of translations performed',
      labelNames: ['source_format', 'target_format', 'status'],
      registers: [this.registry]
    });

    this.translationErrors = new Counter({
      name: 'bridge_translation_errors_total',
      help: 'Total number of translation errors',
      labelNames: ['source_format', 'target_format', 'error_type'],
      registers: [this.registry]
    });

    this.cacheHits = new Counter({
      name: 'bridge_cache_hits_total',
      help: 'Total cache hits',
      registers: [this.registry]
    });

    this.cacheMisses = new Counter({
      name: 'bridge_cache_misses_total',
      help: 'Total cache misses',
      registers: [this.registry]
    });

    // Initialize histograms
    this.translationDuration = new Histogram({
      name: 'bridge_translation_duration_seconds',
      help: 'Translation duration in seconds',
      labelNames: ['source_format', 'target_format'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });

    this.fidelityScore = new Histogram({
      name: 'bridge_translation_fidelity',
      help: 'Translation fidelity scores',
      labelNames: ['source_format', 'target_format'],
      buckets: [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.99, 1.0],
      registers: [this.registry]
    });

    // Initialize gauges
    this.storeAgentCount = new Gauge({
      name: 'bridge_store_agents',
      help: 'Number of agents in the store',
      registers: [this.registry]
    });

    this.storeTripleCount = new Gauge({
      name: 'bridge_store_triples',
      help: 'Number of triples in the store',
      registers: [this.registry]
    });

    this.adapterCount = new Gauge({
      name: 'bridge_adapters_registered',
      help: 'Number of registered adapters',
      labelNames: ['enabled'],
      registers: [this.registry]
    });

    this.cacheSize = new Gauge({
      name: 'bridge_cache_entries',
      help: 'Number of cache entries',
      registers: [this.registry]
    });
  }

  /**
   * Record a translation event.
   */
  recordTranslation(
    sourceFormat: string,
    targetFormat: string,
    success: boolean,
    durationMs: number,
    fidelity: number
  ): void {
    const status = success ? 'success' : 'failure';
    this.translationsTotal.inc({ source_format: sourceFormat, target_format: targetFormat, status });
    this.translationDuration.observe(
      { source_format: sourceFormat, target_format: targetFormat },
      durationMs / 1000
    );
    
    if (success) {
      this.fidelityScore.observe(
        { source_format: sourceFormat, target_format: targetFormat },
        fidelity
      );
    }
  }

  /**
   * Record a translation error.
   */
  recordError(sourceFormat: string, targetFormat: string, errorType: string): void {
    this.translationErrors.inc({
      source_format: sourceFormat,
      target_format: targetFormat,
      error_type: errorType
    });
  }

  /**
   * Update store metrics.
   */
  updateStoreMetrics(agentCount: number, tripleCount: number): void {
    this.storeAgentCount.set(agentCount);
    this.storeTripleCount.set(tripleCount);
  }

  /**
   * Update adapter metrics.
   */
  updateAdapterMetrics(enabledCount: number, disabledCount: number): void {
    this.adapterCount.set({ enabled: 'true' }, enabledCount);
    this.adapterCount.set({ enabled: 'false' }, disabledCount);
  }

  /**
   * Get metrics for Prometheus scraping.
   */
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  /**
   * Get registry for custom middleware.
   */
  getRegistry(): Registry {
    return this.registry;
  }
}
```

### 9.3 Debugging Tools

```typescript
// src/bridge/debug/RDFInspector.ts

import { Quad, Writer, Parser } from 'n3';
import { SemanticDiffTool, DiffReport } from '../testing/SemanticDiff';

export interface InspectionResult {
  agentId: string;
  version: number;
  tripleCount: number;
  subjects: SubjectSummary[];
  predicateStats: PredicateStats[];
  serializations: {
    turtle: string;
    jsonld: string;
    ntriples: string;
  };
}

export interface SubjectSummary {
  uri: string;
  type: string[];
  propertyCount: number;
  outgoingLinks: number;
}

export interface PredicateStats {
  predicate: string;
  count: number;
  objectTypes: { literals: number; uris: number };
}

export class RDFInspector {
  private readonly diffTool = new SemanticDiffTool();

  /**
   * Inspect RDF triples for an agent snapshot.
   */
  inspect(triples: Quad[], agentId: string, version: number): InspectionResult {
    // Gather subjects
    const subjectMap = new Map<string, { types: Set<string>; properties: number; links: number }>();
    const predicateMap = new Map<string, { count: number; literals: number; uris: number }>();

    for (const triple of triples) {
      const s = triple.subject.value;
      const p = triple.predicate.value;
      const isLiteral = triple.object.termType === 'Literal';

      // Track subjects
      if (!subjectMap.has(s)) {
        subjectMap.set(s, { types: new Set(), properties: 0, links: 0 });
      }
      const subjectData = subjectMap.get(s)!;
      
      if (p === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        subjectData.types.add(triple.object.value);
      } else {
        subjectData.properties++;
        if (!isLiteral) subjectData.links++;
      }

      // Track predicates
      if (!predicateMap.has(p)) {
        predicateMap.set(p, { count: 0, literals: 0, uris: 0 });
      }
      const predData = predicateMap.get(p)!;
      predData.count++;
      if (isLiteral) predData.literals++;
      else predData.uris++;
    }

    // Build summaries
    const subjects: SubjectSummary[] = Array.from(subjectMap.entries()).map(([uri, data]) => ({
      uri: this.shortenUri(uri),
      type: Array.from(data.types).map(t => this.shortenUri(t)),
      propertyCount: data.properties,
      outgoingLinks: data.links
    }));

    const predicateStats: PredicateStats[] = Array.from(predicateMap.entries())
      .map(([predicate, stats]) => ({
        predicate: this.shortenUri(predicate),
        count: stats.count,
        objectTypes: { literals: stats.literals, uris: stats.uris }
      }))
      .sort((a, b) => b.count - a.count);

    // Generate serializations
    const serializations = {
      turtle: this.serializeTurtle(triples),
      jsonld: this.serializeJsonLd(triples),
      ntriples: this.serializeNTriples(triples)
    };

    return {
      agentId,
      version,
      tripleCount: triples.length,
      subjects,
      predicateStats,
      serializations
    };
  }

  /**
   * Compare two agent versions.
   */
  compare(
    leftTriples: Quad[],
    rightTriples: Quad[],
    leftLabel: string,
    rightLabel: string
  ): ComparisonResult {
    const diff = this.diffTool.diff(leftTriples, rightTriples);
    const report = this.diffTool.formatReport(diff);

    return {
      leftLabel,
      rightLabel,
      diff,
      formattedReport: report,
      similarity: diff.similarity
    };
  }

  /**
   * Trace a subject through all its relationships.
   */
  traceSubject(triples: Quad[], subjectUri: string, maxDepth: number = 3): SubjectTrace {
    const visited = new Set<string>();
    return this.traceRecursive(triples, subjectUri, 0, maxDepth, visited);
  }

  private traceRecursive(
    triples: Quad[],
    uri: string,
    depth: number,
    maxDepth: number,
    visited: Set<string>
  ): SubjectTrace {
    if (visited.has(uri) || depth > maxDepth) {
      return { uri: this.shortenUri(uri), properties: [], children: [], circular: visited.has(uri) };
    }

    visited.add(uri);

    const properties: PropertyValue[] = [];
    const children: SubjectTrace[] = [];

    for (const triple of triples) {
      if (triple.subject.value === uri) {
        const predicate = this.shortenUri(triple.predicate.value);
        
        if (triple.object.termType === 'Literal') {
          properties.push({ predicate, value: triple.object.value, type: 'literal' });
        } else {
          properties.push({ predicate, value: this.shortenUri(triple.object.value), type: 'uri' });
          
          // Recurse into object if it's a URI
          const child = this.traceRecursive(triples, triple.object.value, depth + 1, maxDepth, visited);
          if (child.properties.length > 0 || child.children.length > 0) {
            children.push(child);
          }
        }
      }
    }

    return {
      uri: this.shortenUri(uri),
      properties,
      children,
      circular: false
    };
  }

  private serializeTurtle(triples: Quad[]): string {
    const writer = new Writer({
      prefixes: {
        chrysalis: 'https://chrysalis.dev/ontology/agent#',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
        lmos: 'https://lmos.2060.io/lmos#',
        usa: 'https://chrysalis.dev/usa#',
        mcp: 'https://anthropic.com/mcp#'
      }
    });

    for (const triple of triples) {
      writer.addQuad(triple);
    }

    let result = '';
    writer.end((error, output) => { result = output; });
    return result;
  }

  private serializeJsonLd(triples: Quad[]): string {
    // Simplified JSON-LD generation (in practice, use jsonld library)
    const nodes = new Map<string, Record<string, unknown>>();

    for (const triple of triples) {
      const s = triple.subject.value;
      if (!nodes.has(s)) {
        nodes.set(s, { '@id': s });
      }
      const node = nodes.get(s)!;

      const p = triple.predicate.value;
      const isType = p === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
      const key = isType ? '@type' : p;

      const value = triple.object.termType === 'Literal'
        ? triple.object.value
        : { '@id': triple.object.value };

      if (node[key]) {
        if (!Array.isArray(node[key])) {
          node[key] = [node[key]];
        }
        (node[key] as unknown[]).push(value);
      } else {
        node[key] = value;
      }
    }

    return JSON.stringify({
      '@context': {
        'chrysalis': 'https://chrysalis.dev/ontology/agent#',
        'lmos': 'https://lmos.2060.io/lmos#',
        'usa': 'https://chrysalis.dev/usa#'
      },
      '@graph': Array.from(nodes.values())
    }, null, 2);
  }

  private serializeNTriples(triples: Quad[]): string {
    return triples.map(t => {
      const s = `<${t.subject.value}>`;
      const p = `<${t.predicate.value}>`;
      const o = t.object.termType === 'Literal'
        ? `"${t.object.value.replace(/"/g, '\\"')}"`
        : `<${t.object.value}>`;
      return `${s} ${p} ${o} .`;
    }).join('\n');
  }

  private shortenUri(uri: string): string {
    const prefixes: Record<string, string> = {
      'https://chrysalis.dev/ontology/agent#': 'chrysalis:',
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf:',
      'http://www.w3.org/2000/01/rdf-schema#': 'rdfs:',
      'https://lmos.2060.io/lmos#': 'lmos:',
      'https://chrysalis.dev/usa#': 'usa:',
      'https://anthropic.com/mcp#': 'mcp:'
    };

    for (const [prefix, short] of Object.entries(prefixes)) {
      if (uri.startsWith(prefix)) {
        return short + uri.substring(prefix.length);
      }
    }
    return uri;
  }
}

export interface ComparisonResult {
  leftLabel: string;
  rightLabel: string;
  diff: DiffReport;
  formattedReport: string;
  similarity: number;
}

export interface SubjectTrace {
  uri: string;
  properties: PropertyValue[];
  children: SubjectTrace[];
  circular: boolean;
}

export interface PropertyValue {
  predicate: string;
  value: string;
  type: 'literal' | 'uri';
}
```

### 9.4 Migration Utilities

```typescript
// src/bridge/migration/BulkMigrator.ts

import { BridgeOrchestrator, TranslationResponse } from '../orchestration/BridgeOrchestrator';
import { AgentFramework } from '../adapters/IAgentAdapter';
import { EventEmitter } from 'events';

export interface MigrationJob {
  id: string;
  sourceFormat: AgentFramework;
  targetFormat: AgentFramework;
  agents: unknown[];
  options: MigrationOptions;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: MigrationProgress;
  startedAt?: Date;
  completedAt?: Date;
}

export interface MigrationOptions {
  batchSize: number;
  maxConcurrency: number;
  continueOnError: boolean;
  minFidelityThreshold: number;
  dryRun: boolean;
}

export interface MigrationProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  averageFidelity: number;
}

export interface MigrationResult {
  jobId: string;
  success: boolean;
  progress: MigrationProgress;
  duration: number;
  results: AgentMigrationResult[];
  errors: MigrationError[];
}

export interface AgentMigrationResult {
  index: number;
  agentId: string;
  success: boolean;
  fidelity: number;
  sourceVersion?: number;
  targetVersion?: number;
  warnings: string[];
}

export interface MigrationError {
  index: number;
  agentId?: string;
  error: string;
  recoverable: boolean;
}

export class BulkMigrator extends EventEmitter {
  private readonly jobs = new Map<string, MigrationJob>();
  private readonly activeJobs = new Set<string>();

  constructor(
    private readonly orchestrator: BridgeOrchestrator,
    private readonly maxConcurrentJobs: number = 3
  ) {
    super();
  }

  /**
   * Create a migration job.
   */
  createJob(
    sourceFormat: AgentFramework,
    targetFormat: AgentFramework,
    agents: unknown[],
    options: Partial<MigrationOptions> = {}
  ): MigrationJob {
    const job: MigrationJob = {
      id: crypto.randomUUID(),
      sourceFormat,
      targetFormat,
      agents,
      options: {
        batchSize: options.batchSize ?? 10,
        maxConcurrency: options.maxConcurrency ?? 5,
        continueOnError: options.continueOnError ?? true,
        minFidelityThreshold: options.minFidelityThreshold ?? 0.7,
        dryRun: options.dryRun ?? false
      },
      status: 'pending',
      progress: {
        total: agents.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        averageFidelity: 0
      }
    };

    this.jobs.set(job.id, job);
    return job;
  }

  /**
   * Start a migration job.
   */
  async startJob(jobId: string): Promise<MigrationResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      throw new Error('Maximum concurrent jobs reached');
    }

    job.status = 'running';
    job.startedAt = new Date();
    this.activeJobs.add(jobId);

    const results: AgentMigrationResult[] = [];
    const errors: MigrationError[] = [];
    let totalFidelity = 0;

    try {
      // Process in batches
      for (let i = 0; i < job.agents.length; i += job.options.batchSize) {
        if (job.status === 'cancelled') break;

        const batch = job.agents.slice(i, i + job.options.batchSize);
        const batchResults = await this.processBatch(job, batch, i);

        for (const result of batchResults) {
          results.push(result);
          job.progress.processed++;

          if (result.success) {
            job.progress.succeeded++;
            totalFidelity += result.fidelity;
          } else {
            job.progress.failed++;
            errors.push({
              index: result.index,
              agentId: result.agentId,
              error: result.warnings.join('; '),
              recoverable: true
            });

            if (!job.options.continueOnError) {
              job.status = 'failed';
              break;
            }
          }

          // Update average fidelity
          if (job.progress.succeeded > 0) {
            job.progress.averageFidelity = totalFidelity / job.progress.succeeded;
          }

          this.emit('progress', { jobId, progress: job.progress });
        }
      }

      if (job.status !== 'cancelled' && job.status !== 'failed') {
        job.status = 'completed';
      }
    } catch (error) {
      job.status = 'failed';
      errors.push({
        index: -1,
        error: error instanceof Error ? error.message : String(error),
        recoverable: false
      });
    } finally {
      job.completedAt = new Date();
      this.activeJobs.delete(jobId);
    }

    const result: MigrationResult = {
      jobId,
      success: job.status === 'completed' && errors.length === 0,
      progress: job.progress,
      duration: job.completedAt!.getTime() - job.startedAt!.getTime(),
      results,
      errors
    };

    this.emit('complete', result);
    return result;
  }

  private async processBatch(
    job: MigrationJob,
    batch: unknown[],
    startIndex: number
  ): Promise<AgentMigrationResult[]> {
    const promises = batch.map((agent, i) =>
      this.processAgent(job, agent, startIndex + i)
    );

    // Process with concurrency limit
    const results: AgentMigrationResult[] = [];
    const chunks = this.chunk(promises, job.options.maxConcurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk);
      results.push(...chunkResults);
    }

    return results;
  }

  private async processAgent(
    job: MigrationJob,
    agent: unknown,
    index: number
  ): Promise<AgentMigrationResult> {
    try {
      const response = await this.orchestrator.translate({
        sourceFormat: job.sourceFormat,
        targetFormat: job.targetFormat,
        sourceData: agent,
        options: {
          persist: !job.options.dryRun,
          maxFidelityLoss: 1 - job.options.minFidelityThreshold
        }
      });

      return {
        index,
        agentId: response.agentId,
        success: response.success,
        fidelity: response.totalFidelity,
        sourceVersion: response.version,
        warnings: response.warnings
      };
    } catch (error) {
      return {
        index,
        agentId: 'unknown',
        success: false,
        fidelity: 0,
        warnings: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Cancel a running job.
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') return false;
    
    job.status = 'cancelled';
    return true;
  }

  /**
   * Get job status.
   */
  getJob(jobId: string): MigrationJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * List all jobs.
   */
  listJobs(): MigrationJob[] {
    return Array.from(this.jobs.values());
  }
}
```

---

## 10. Implementation Roadmap

### 10.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION PHASES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: Foundation (Weeks 1-3)                                            │
│  ├─ Ontology and RDF schema definition                                      │
│  ├─ Triple store setup (Fuseki)                                             │
│  ├─ Base adapter interface implementation                                    │
│  └─ Core orchestration layer                                                 │
│                                                                              │
│  Phase 2: Reference Adapters (Weeks 4-6)                                    │
│  ├─ LMOS adapter (reference implementation)                                 │
│  ├─ USA adapter                                                             │
│  ├─ MCP adapter                                                             │
│  └─ Round-trip testing framework                                            │
│                                                                              │
│  Phase 3: Extended Ecosystem (Weeks 7-9)                                    │
│  ├─ LangChain adapter                                                       │
│  ├─ OpenAI function calling adapter                                         │
│  ├─ Semantic Kernel adapter (optional)                                      │
│  └─ Cross-framework fidelity testing                                        │
│                                                                              │
│  Phase 4: Operations & Polish (Weeks 10-12)                                 │
│  ├─ Monitoring and metrics integration                                      │
│  ├─ Admin CLI and dashboard                                                 │
│  ├─ Bulk migration tooling                                                  │
│  ├─ Documentation and contribution guide                                    │
│  └─ CI/CD integration                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Detailed Task Breakdown

#### Phase 1: Foundation (Weeks 1-3)

| Week | Task | Deliverable | Dependencies |
|------|------|-------------|--------------|
| 1 | Finalize ontology design | `chrysalis-agent-ontology.ttl` | None |
| 1 | Set up Fuseki triple store | Docker compose config | None |
| 1 | Implement `ITripleStoreAPI` | `FusekiTripleStore.ts` | Fuseki setup |
| 2 | Implement `IAgentAdapter` interface | Interface + `BaseAgentAdapter.ts` | None |
| 2 | Implement `AdapterRegistry` | `AdapterRegistry.ts` | Adapter interface |
| 2 | Implement `CacheManager` | `CacheManager.ts` | None |
| 3 | Implement `BridgeOrchestrator` | `BridgeOrchestrator.ts` | All above |
| 3 | Unit tests for core components | Jest test suite | All above |

#### Phase 2: Reference Adapters (Weeks 4-6)

| Week | Task | Deliverable | Dependencies |
|------|------|-------------|--------------|
| 4 | LMOS adapter - toCanonical | `LMOSAdapter.ts` (partial) | Base adapter |
| 4 | LMOS adapter - fromCanonical | `LMOSAdapter.ts` (complete) | toCanonical |
| 4 | LMOS round-trip tests | Test suite | LMOS adapter |
| 5 | USA adapter implementation | `USAAdapter.ts` | Base adapter |
| 5 | MCP adapter implementation | `MCPAdapter.ts` | Base adapter |
| 5 | USA/MCP round-trip tests | Test suite | Adapters |
| 6 | `RoundTripTester` framework | `RoundTripTester.ts` | Adapters |
| 6 | `SemanticDiffTool` | `SemanticDiff.ts` | None |
| 6 | Fidelity benchmarks | Benchmark suite | Test framework |

#### Phase 3: Extended Ecosystem (Weeks 7-9)

| Week | Task | Deliverable | Dependencies |
|------|------|-------------|--------------|
| 7 | LangChain adapter | `LangChainAdapter.ts` | Base adapter |
| 7 | LangChain tests | Test suite | LangChain adapter |
| 8 | OpenAI adapter | `OpenAIAdapter.ts` | Base adapter |
| 8 | Cross-framework test matrix | Matrix tests | All adapters |
| 9 | Semantic Kernel adapter (stretch) | `SemanticKernelAdapter.ts` | Base adapter |
| 9 | Fidelity regression suite | CI integration | Test framework |

#### Phase 4: Operations & Polish (Weeks 10-12)

| Week | Task | Deliverable | Dependencies |
|------|------|-------------|--------------|
| 10 | Prometheus metrics | `BridgeMetrics.ts` | Orchestrator |
| 10 | Admin CLI | `bridge-admin.ts` | BridgeAPI |
| 11 | RDF Inspector tool | `RDFInspector.ts` | Triple store |
| 11 | Bulk migrator | `BulkMigrator.ts` | Orchestrator |
| 12 | Documentation | `docs/bridge/` | All |
| 12 | Contribution guide | `CONTRIBUTING.md` updates | Docs |
| 12 | CI/CD pipeline | GitHub Actions config | Tests |

### 10.3 Resource Requirements

| Role | Allocation | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|------------|---------|---------|---------|---------|
| Senior Backend Engineer | Full-time | Core infrastructure | Adapters | Cross-framework | Operations |
| RDF/Ontology Specialist | Part-time | Ontology design | Validation | Optimization | Documentation |
| QA Engineer | Part-time | Test planning | Testing | Regression | CI/CD |

**Total Estimated Effort**: 12 person-weeks

### 10.4 Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LMOS spec instability | Medium | High | Abstract via adapter; version pin |
| Fuseki performance issues | Low | Medium | Evaluate Oxigraph as fallback |
| Fidelity below threshold | Medium | High | Extension namespaces; shadow fields |
| Scope creep (more adapters) | High | Medium | Tiered support model |
| Triple store scaling | Low | High | Named graph partitioning strategy |

### 10.5 Success Criteria

| Milestone | Criteria | Target Date |
|-----------|----------|-------------|
| M1: Foundation | Core orchestrator passes unit tests | End Week 3 |
| M2: Reference Adapters | LMOS, USA, MCP round-trip fidelity ≥ 85% | End Week 6 |
| M3: Ecosystem | 5+ adapters with cross-framework tests | End Week 9 |
| M4: Production Ready | Monitoring, CLI, docs complete | End Week 12 |

---

## 11. Appendices

### Appendix A: Directory Structure

```
src/bridge/
├── adapters/
│   ├── IAgentAdapter.ts
│   ├── BaseAgentAdapter.ts
│   ├── MappingStrategies.ts
│   ├── lmos/
│   │   ├── LMOSAdapter.ts
│   │   └── LMOSTypes.ts
│   ├── usa/
│   │   └── USAAdapter.ts
│   ├── mcp/
│   │   └── MCPAdapter.ts
│   └── langchain/
│       └── LangChainAdapter.ts
├── orchestration/
│   ├── BridgeOrchestrator.ts
│   ├── AdapterRegistry.ts
│   └── CacheManager.ts
├── store/
│   ├── TripleStoreAPI.ts
│   └── FusekiTripleStore.ts
├── api/
│   └── BridgeAPI.ts
├── testing/
│   ├── RoundTripTester.ts
│   ├── SemanticDiff.ts
│   └── CIRunner.ts
├── monitoring/
│   └── metrics.ts
├── debug/
│   └── RDFInspector.ts
├── migration/
│   └── BulkMigrator.ts
└── cli/
    └── bridge-admin.ts

ontology/
└── chrysalis-agent-ontology.ttl

docker/
└── docker-compose.fuseki.yml
```

### Appendix B: Ontology File Location

The complete ontology should be saved to: `ontology/chrysalis-agent-ontology.ttl`

### Appendix C: Configuration Templates

**docker-compose.fuseki.yml**
```yaml
version: '3.8'
services:
  fuseki:
    image: stain/jena-fuseki:4.9.0
    container_name: chrysalis-fuseki
    ports:
      - "3030:3030"
    environment:
      - ADMIN_PASSWORD=chrysalis-admin
      - JVM_ARGS=-Xmx2g
    volumes:
      - fuseki-data:/fuseki
      - ./fuseki-config:/fuseki-config
    command: ["--config=/fuseki-config/config.ttl"]

volumes:
  fuseki-data:
```

---

## 12. Conclusion

This implementation plan provides a comprehensive roadmap for building the Chrysalis Universal Agent Bridge. The system architecture centers on:

1. **Canonical RDF Ontology**: A semantic model capturing the union of agent capabilities across ecosystems
2. **Temporal Triple Store**: Versioned agent state with point-in-time reconstruction
3. **Adapter Pattern**: Framework-specific adapters enabling bidirectional translation
4. **Fidelity Tracking**: Quantified semantic preservation with provenance
5. **Operational Tooling**: CLI, monitoring, and migration utilities

The phased approach ensures incremental delivery while managing technical risk. By starting with LMOS as the reference adapter, the project establishes patterns that scale to the broader agent ecosystem.

**Next Steps**:
1. Review and approve ontology design
2. Provision Fuseki infrastructure
3. Begin Phase 1 implementation

---

**Document History**:
- v1.0.0 (2026-01-11): Initial implementation plan
