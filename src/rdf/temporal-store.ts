/**
 * Chrysalis Universal Agent Bridge - Temporal RDF Store
 * 
 * Provides quad storage with named graph support, temporal versioning using
 * valid-time and transaction-time dimensions, and SPARQL query interface
 * with temporal extensions.
 * 
 * @module rdf/temporal-store
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { NotImplementedError } from '../mcp-server/chrysalis-tools';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * RDF Term types following RDF.js specification
 */
export type TermType = 'NamedNode' | 'BlankNode' | 'Literal' | 'Variable' | 'DefaultGraph';

/**
 * Base interface for all RDF terms
 */
export interface Term {
  readonly termType: TermType;
  readonly value: string;
  equals(other: Term | null | undefined): boolean;
}

/**
 * Named node (URI reference)
 */
export interface NamedNode extends Term {
  readonly termType: 'NamedNode';
}

/**
 * Blank node (anonymous resource)
 */
export interface BlankNode extends Term {
  readonly termType: 'BlankNode';
}

/**
 * Literal value with optional language tag or datatype
 */
export interface Literal extends Term {
  readonly termType: 'Literal';
  readonly language: string;
  readonly datatype: NamedNode;
}

/**
 * Default graph identifier
 */
export interface DefaultGraph extends Term {
  readonly termType: 'DefaultGraph';
  readonly value: '';
}

/**
 * Union type for quad subject positions
 */
export type Subject = NamedNode | BlankNode;

/**
 * Union type for quad predicate positions
 */
export type Predicate = NamedNode;

/**
 * Union type for quad object positions
 */
export type QuadObject = NamedNode | BlankNode | Literal;

/**
 * Union type for quad graph positions
 */
export type Graph = NamedNode | BlankNode | DefaultGraph;

/**
 * RDF Quad (triple with named graph)
 */
export interface Quad {
  readonly subject: Subject;
  readonly predicate: Predicate;
  readonly object: QuadObject;
  readonly graph: Graph;
  equals(other: Quad | null | undefined): boolean;
}

/**
 * Temporal metadata for bitemporal versioning
 */
export interface TemporalMetadata {
  /** When the fact became true in reality */
  validFrom: Date;
  /** When the fact ceased to be true (null if current) */
  validTo: Date | null;
  /** When the fact was recorded in the system */
  transactionTime: Date;
  /** Version number within the agent's history */
  version: number;
}

/**
 * Named graph with temporal metadata
 */
export interface TemporalGraph {
  readonly uri: string;
  readonly metadata: TemporalMetadata;
  readonly quads: Quad[];
}

/**
 * Agent snapshot stored in the temporal store
 */
export interface AgentSnapshot {
  agentId: string;
  graphUri: string;
  version: number;
  validFrom: Date;
  validTo: Date | null;
  transactionTime: Date;
  quads: Quad[];
  sourceFormat?: string;
  fidelityScore?: number;
}

/**
 * Query result binding
 */
export interface Binding {
  [variable: string]: Term;
}

/**
 * SPARQL SELECT query result
 */
export interface SelectResult {
  variables: string[];
  bindings: Binding[];
}

/**
 * SPARQL CONSTRUCT query result
 */
export interface ConstructResult {
  quads: Quad[];
}

/**
 * Temporal query options
 */
export interface TemporalQueryOptions {
  /** Point-in-time for valid-time query */
  asOf?: Date;
  /** Point-in-time for transaction-time query */
  asRecorded?: Date;
  /** Include only current (non-superseded) versions */
  currentOnly?: boolean;
  /** Specific version number */
  version?: number;
}

/**
 * Store statistics
 */
export interface StoreStats {
  totalGraphs: number;
  totalQuads: number;
  totalAgents: number;
  totalSnapshots: number;
  oldestSnapshot: Date | null;
  newestSnapshot: Date | null;
  storeSizeEstimate: number;
}

/**
 * Discovery criteria for finding agents
 */
export interface DiscoveryCriteria {
  hasCapability?: string[];
  supportsProtocol?: string[];
  llmProvider?: string;
  nameContains?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Agent summary for listing
 */
export interface AgentSummary {
  agentId: string;
  name: string;
  latestVersion: number;
  capabilities: string[];
  protocols: string[];
  lastUpdated: Date;
}

// ============================================================================
// Data Factory Implementation
// ============================================================================

/**
 * Factory for creating RDF terms
 */
export const DataFactory = {
  /**
   * Create a named node
   */
  namedNode(value: string): NamedNode {
    return {
      termType: 'NamedNode',
      value,
      equals(other: Term | null | undefined): boolean {
        return other?.termType === 'NamedNode' && other.value === value;
      }
    };
  },

  /**
   * Create a blank node
   */
  blankNode(value?: string): BlankNode {
    const id = value ?? `b${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      termType: 'BlankNode',
      value: id,
      equals(other: Term | null | undefined): boolean {
        return other?.termType === 'BlankNode' && other.value === id;
      }
    };
  },

  /**
   * Create a literal
   */
  literal(value: string, languageOrDatatype?: string | NamedNode): Literal {
    let language = '';
    let datatype: NamedNode;

    if (typeof languageOrDatatype === 'string') {
      language = languageOrDatatype;
      datatype = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
    } else if (languageOrDatatype) {
      datatype = languageOrDatatype;
    } else {
      datatype = DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#string');
    }

    return {
      termType: 'Literal',
      value,
      language,
      datatype,
      equals(other: Term | null | undefined): boolean {
        if (other?.termType !== 'Literal') return false;
        const otherLit = other as Literal;
        return otherLit.value === value &&
               otherLit.language === language &&
               otherLit.datatype.equals(datatype);
      }
    };
  },

  /**
   * Create a default graph reference
   */
  defaultGraph(): DefaultGraph {
    return {
      termType: 'DefaultGraph',
      value: '',
      equals(other: Term | null | undefined): boolean {
        return other?.termType === 'DefaultGraph';
      }
    };
  },

  /**
   * Create a quad
   */
  quad(
    subject: Subject,
    predicate: Predicate,
    object: QuadObject,
    graph: Graph = DataFactory.defaultGraph()
  ): Quad {
    return {
      subject,
      predicate,
      object,
      graph,
      equals(other: Quad | null | undefined): boolean {
        if (!other) return false;
        return subject.equals(other.subject) &&
               predicate.equals(other.predicate) &&
               object.equals(other.object) &&
               graph.equals(other.graph);
      }
    };
  }
};

// ============================================================================
// Namespace Helpers
// ============================================================================

export const CHRYSALIS_NS = 'https://chrysalis.dev/ontology/agent#';
export const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
export const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
export const PROV_NS = 'http://www.w3.org/ns/prov#';

/**
 * Namespace helper for creating prefixed URIs
 */
export function ns(namespace: string): (localName: string) => NamedNode {
  return (localName: string) => DataFactory.namedNode(namespace + localName);
}

export const chrysalis = ns(CHRYSALIS_NS);
export const rdf = ns(RDF_NS);
export const rdfs = ns(RDFS_NS);
export const xsd = ns(XSD_NS);
export const prov = ns(PROV_NS);

// ============================================================================
// Temporal RDF Store Implementation
// ============================================================================

/**
 * In-memory temporal RDF store with bitemporal versioning support.
 * 
 * Features:
 * - Named graph organization for agent snapshots
 * - Valid-time and transaction-time dimensions
 * - Point-in-time query reconstruction
 * - SPARQL-like query patterns
 */
export class TemporalRDFStore extends EventEmitter {
  private graphs: Map<string, TemporalGraph> = new Map();
  private agentIndex: Map<string, string[]> = new Map(); // agentId -> graphUris
  private metadataGraph: Map<string, AgentSnapshot> = new Map();
  
  // Indexes for efficient querying
  private subjectIndex: Map<string, Set<string>> = new Map(); // subject -> graphUris
  private predicateIndex: Map<string, Set<string>> = new Map(); // predicate -> graphUris
  private objectIndex: Map<string, Set<string>> = new Map(); // object -> graphUris

  constructor() {
    super();
  }

  // ==========================================================================
  // Core Storage Operations
  // ==========================================================================

  /**
   * Create a new agent snapshot in a named graph
   */
  async createSnapshot(
    agentId: string,
    quads: Quad[],
    options: {
      sourceFormat?: string;
      fidelityScore?: number;
      validFrom?: Date;
    } = {}
  ): Promise<AgentSnapshot> {
    const now = new Date();
    const existingVersions = this.agentIndex.get(agentId) || [];
    const version = existingVersions.length + 1;
    
    // Generate graph URI
    const graphUri = `https://chrysalis.dev/snapshot/${agentId}/v${version}`;
    
    // Mark previous version as superseded
    if (existingVersions.length > 0) {
      const prevGraphUri = existingVersions[existingVersions.length - 1];
      const prevSnapshot = this.metadataGraph.get(prevGraphUri);
      if (prevSnapshot && !prevSnapshot.validTo) {
        prevSnapshot.validTo = now;
      }
    }

    // Create temporal metadata
    const metadata: TemporalMetadata = {
      validFrom: options.validFrom || now,
      validTo: null, // Current version
      transactionTime: now,
      version
    };

    // Rewrite quads to use the named graph
    const graphNode = DataFactory.namedNode(graphUri);
    const graphQuads = quads.map(q => 
      DataFactory.quad(q.subject, q.predicate, q.object, graphNode)
    );

    // Store the temporal graph
    const temporalGraph: TemporalGraph = {
      uri: graphUri,
      metadata,
      quads: graphQuads
    };
    this.graphs.set(graphUri, temporalGraph);

    // Create snapshot record
    const snapshot: AgentSnapshot = {
      agentId,
      graphUri,
      version,
      validFrom: metadata.validFrom,
      validTo: metadata.validTo,
      transactionTime: metadata.transactionTime,
      quads: graphQuads,
      sourceFormat: options.sourceFormat,
      fidelityScore: options.fidelityScore
    };
    this.metadataGraph.set(graphUri, snapshot);

    // Update agent index
    if (!this.agentIndex.has(agentId)) {
      this.agentIndex.set(agentId, []);
    }
    this.agentIndex.get(agentId)!.push(graphUri);

    // Update search indexes
    this.indexQuads(graphUri, graphQuads);

    this.emit('snapshotCreated', snapshot);
    return snapshot;
  }

  /**
   * Get agent snapshot by ID and optional version
   */
  async getSnapshot(
    agentId: string,
    options: TemporalQueryOptions = {}
  ): Promise<AgentSnapshot | null> {
    const graphUris = this.agentIndex.get(agentId);
    if (!graphUris || graphUris.length === 0) {
      return null;
    }

    // Specific version requested
    if (options.version !== undefined) {
      const graphUri = graphUris.find(uri => {
        const snapshot = this.metadataGraph.get(uri);
        return snapshot?.version === options.version;
      });
      return graphUri ? this.metadataGraph.get(graphUri) || null : null;
    }

    // Point-in-time query (asOf = valid time)
    if (options.asOf) {
      const asOf = options.asOf;
      for (let i = graphUris.length - 1; i >= 0; i--) {
        const snapshot = this.metadataGraph.get(graphUris[i]);
        if (snapshot) {
          const validFrom = snapshot.validFrom;
          const validTo = snapshot.validTo;
          if (validFrom <= asOf && (!validTo || validTo > asOf)) {
            return snapshot;
          }
        }
      }
      return null;
    }

    // Transaction-time query (asRecorded)
    if (options.asRecorded) {
      const asRecorded = options.asRecorded;
      for (let i = graphUris.length - 1; i >= 0; i--) {
        const snapshot = this.metadataGraph.get(graphUris[i]);
        if (snapshot && snapshot.transactionTime <= asRecorded) {
          return snapshot;
        }
      }
      return null;
    }

    // Default: return latest version
    if (options.currentOnly !== false) {
      const latestUri = graphUris[graphUris.length - 1];
      return this.metadataGraph.get(latestUri) || null;
    }

    return null;
  }

  /**
   * Get all versions of an agent
   */
  async getAgentHistory(agentId: string): Promise<AgentSnapshot[]> {
    const graphUris = this.agentIndex.get(agentId);
    if (!graphUris) return [];

    return graphUris
      .map(uri => this.metadataGraph.get(uri))
      .filter((s): s is AgentSnapshot => s !== undefined)
      .sort((a, b) => a.version - b.version);
  }

  /**
   * Get quads from a specific graph
   */
  async getGraphQuads(graphUri: string): Promise<Quad[]> {
    const graph = this.graphs.get(graphUri);
    return graph ? [...graph.quads] : [];
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * Execute a pattern-based query (simplified SPARQL BGP)
   */
  async query(
    pattern: {
      subject?: Subject | string;
      predicate?: Predicate | string;
      object?: QuadObject | string;
      graph?: Graph | string;
    },
    options: TemporalQueryOptions = {}
  ): Promise<Quad[]> {
    const results: Quad[] = [];

    // Determine which graphs to search
    const targetGraphs = this.getTargetGraphs(pattern.graph, options);

    for (const graphUri of targetGraphs) {
      const graph = this.graphs.get(graphUri);
      if (!graph) continue;

      // Check temporal validity
      if (!this.isTemporallyValid(graph.metadata, options)) continue;

      for (const quad of graph.quads) {
        if (this.matchesPattern(quad, pattern)) {
          results.push(quad);
        }
      }
    }

    return results;
  }

  /**
   * Execute a SELECT-style query returning bindings
   */
  async select(
    patterns: Array<{
      subject?: Subject | string | { variable: string };
      predicate?: Predicate | string | { variable: string };
      object?: QuadObject | string | { variable: string };
    }>,
    options: TemporalQueryOptions = {}
  ): Promise<SelectResult> {
    const variables = new Set<string>();
    const bindings: Binding[] = [];

    // Extract variables from patterns
    for (const pattern of patterns) {
      if (this.isVariable(pattern.subject)) variables.add(pattern.subject.variable);
      if (this.isVariable(pattern.predicate)) variables.add(pattern.predicate.variable);
      if (this.isVariable(pattern.object)) variables.add(pattern.object.variable);
    }

    // Get target graphs
    const targetGraphs = this.getTargetGraphs(undefined, options);

    // For each graph, try to find matching bindings
    for (const graphUri of targetGraphs) {
      const graph = this.graphs.get(graphUri);
      if (!graph || !this.isTemporallyValid(graph.metadata, options)) continue;

      // Simple single-pattern matching (could be extended for joins)
      if (patterns.length === 1) {
        const pattern = patterns[0];
        for (const quad of graph.quads) {
          const binding = this.tryBind(quad, pattern);
          if (binding) {
            bindings.push(binding);
          }
        }
      } else {
        // Multi-pattern: nested loop join (simplified)
        const partialBindings = this.evaluatePatterns(graph.quads, patterns);
        bindings.push(...partialBindings);
      }
    }

    return {
      variables: Array.from(variables),
      bindings
    };
  }

  /**
   * Execute a CONSTRUCT-style query returning quads
   */
  async construct(
    template: Array<{
      subject: Subject | string | { variable: string };
      predicate: Predicate | string | { variable: string };
      object: QuadObject | string | { variable: string };
    }>,
    patterns: Array<{
      subject?: Subject | string | { variable: string };
      predicate?: Predicate | string | { variable: string };
      object?: QuadObject | string | { variable: string };
    }>,
    options: TemporalQueryOptions = {}
  ): Promise<ConstructResult> {
    const selectResult = await this.select(patterns, options);
    const constructedQuads: Quad[] = [];
    const defaultGraph = DataFactory.defaultGraph();

    for (const binding of selectResult.bindings) {
      for (const tmpl of template) {
        const subject = this.applyBinding(tmpl.subject, binding) as Subject;
        const predicate = this.applyBinding(tmpl.predicate, binding) as Predicate;
        const object = this.applyBinding(tmpl.object, binding) as QuadObject;

        if (subject && predicate && object) {
          constructedQuads.push(DataFactory.quad(subject, predicate, object, defaultGraph));
        }
      }
    }

    return { quads: constructedQuads };
  }

  // ==========================================================================
  // Discovery Operations
  // ==========================================================================

  /**
   * Discover agents matching criteria
   */
  async discoverAgents(criteria: DiscoveryCriteria): Promise<AgentSummary[]> {
    const results: AgentSummary[] = [];

    for (const [agentId, graphUris] of this.agentIndex) {
      if (graphUris.length === 0) continue;

      // Get latest snapshot
      const latestUri = graphUris[graphUris.length - 1];
      const snapshot = this.metadataGraph.get(latestUri);
      if (!snapshot) continue;

      // Extract agent info from quads
      const agentInfo = this.extractAgentInfo(snapshot.quads);
      
      // Apply filters
      if (criteria.nameContains && 
          !agentInfo.name.toLowerCase().includes(criteria.nameContains.toLowerCase())) {
        continue;
      }

      if (criteria.hasCapability?.length) {
        const hasAll = criteria.hasCapability.every(cap => 
          agentInfo.capabilities.includes(cap)
        );
        if (!hasAll) continue;
      }

      if (criteria.supportsProtocol?.length) {
        const hasAll = criteria.supportsProtocol.every(proto =>
          agentInfo.protocols.includes(proto)
        );
        if (!hasAll) continue;
      }

      if (criteria.createdAfter && snapshot.validFrom < criteria.createdAfter) {
        continue;
      }

      if (criteria.createdBefore && snapshot.validFrom > criteria.createdBefore) {
        continue;
      }

      results.push({
        agentId,
        name: agentInfo.name,
        latestVersion: snapshot.version,
        capabilities: agentInfo.capabilities,
        protocols: agentInfo.protocols,
        lastUpdated: snapshot.validFrom
      });
    }

    return results;
  }

  /**
   * List all agents with pagination
   */
  async listAgents(options: { limit?: number; offset?: number } = {}): Promise<AgentSummary[]> {
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const allAgents = await this.discoverAgents({});
    return allAgents.slice(offset, offset + limit);
  }

  // ==========================================================================
  // Canonical Conversion (P2 Feature Envy Resolution)
  // ==========================================================================

  /**
   * Convert a snapshot to canonical agent representation.
   *
   * This method encapsulates the knowledge of how to build a canonical form
   * from snapshot data, keeping this logic with the store that owns the data.
   * This resolves feature envy from BridgeOrchestrator.getAgent() which
   * previously built canonical representations by accessing snapshot internals.
   *
   * @param snapshot - The agent snapshot to convert
   * @param agentId - The agent identifier
   * @returns Object structurally compatible with CanonicalAgent interface
   */
  snapshotToCanonical(snapshot: AgentSnapshot, agentId: string): {
    uri: string;
    quads: Quad[];
    sourceFramework: string;
    extensions: Array<{ namespace: string; property: string; value: string; sourcePath: string }>;
    metadata: {
      translationTimeMs: number;
      mappedFields: string[];
      unmappedFields: string[];
      lostFields: string[];
      warnings: Array<{ severity: string; code: string; message: string; sourcePath?: string }>;
      fidelityScore: number;
      adapterVersion: string;
      translatedAt: string;
    };
  } {
    return {
      uri: `https://chrysalis.dev/agent/${agentId}`,
      quads: snapshot.quads,
      sourceFramework: snapshot.sourceFormat || 'usa',
      extensions: [],
      metadata: {
        translationTimeMs: 0,
        mappedFields: [],
        unmappedFields: [],
        lostFields: [],
        warnings: [],
        fidelityScore: snapshot.fidelityScore ?? 1.0,
        adapterVersion: '1.0.0',
        translatedAt: snapshot.validFrom.toISOString()
      }
    };
  }

  // ==========================================================================
  // Administrative Operations
  // ==========================================================================

  /**
   * Get store statistics
   */
  async getStats(): Promise<StoreStats> {
    let totalQuads = 0;
    let oldestSnapshot: Date | null = null;
    let newestSnapshot: Date | null = null;

    for (const graph of this.graphs.values()) {
      totalQuads += graph.quads.length;
    }

    for (const snapshot of this.metadataGraph.values()) {
      if (!oldestSnapshot || snapshot.validFrom < oldestSnapshot) {
        oldestSnapshot = snapshot.validFrom;
      }
      if (!newestSnapshot || snapshot.validFrom > newestSnapshot) {
        newestSnapshot = snapshot.validFrom;
      }
    }

    // Rough estimate: ~200 bytes per quad
    const storeSizeEstimate = totalQuads * 200;

    return {
      totalGraphs: this.graphs.size,
      totalQuads,
      totalAgents: this.agentIndex.size,
      totalSnapshots: this.metadataGraph.size,
      oldestSnapshot,
      newestSnapshot,
      storeSizeEstimate
    };
  }

  /**
   * Delete an agent and all its snapshots
   */
  async deleteAgent(agentId: string): Promise<boolean> {
    const graphUris = this.agentIndex.get(agentId);
    if (!graphUris) return false;

    for (const uri of graphUris) {
      this.graphs.delete(uri);
      this.metadataGraph.delete(uri);
      this.removeFromIndexes(uri);
    }

    this.agentIndex.delete(agentId);
    this.emit('agentDeleted', agentId);
    return true;
  }

  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    this.graphs.clear();
    this.agentIndex.clear();
    this.metadataGraph.clear();
    this.subjectIndex.clear();
    this.predicateIndex.clear();
    this.objectIndex.clear();
    this.emit('cleared');
  }

  /**
   * Compact the store
   */
  async compact(): Promise<void> {
    throw new NotImplementedError('TemporalStore.compact: store compaction optimization not implemented');
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private indexQuads(graphUri: string, quads: Quad[]): void {
    for (const quad of quads) {
      // Subject index
      const subjKey = quad.subject.value;
      if (!this.subjectIndex.has(subjKey)) {
        this.subjectIndex.set(subjKey, new Set());
      }
      this.subjectIndex.get(subjKey)!.add(graphUri);

      // Predicate index
      const predKey = quad.predicate.value;
      if (!this.predicateIndex.has(predKey)) {
        this.predicateIndex.set(predKey, new Set());
      }
      this.predicateIndex.get(predKey)!.add(graphUri);

      // Object index (for URIs only)
      if (quad.object.termType !== 'Literal') {
        const objKey = quad.object.value;
        if (!this.objectIndex.has(objKey)) {
          this.objectIndex.set(objKey, new Set());
        }
        this.objectIndex.get(objKey)!.add(graphUri);
      }
    }
  }

  private removeFromIndexes(graphUri: string): void {
    for (const graphs of this.subjectIndex.values()) {
      graphs.delete(graphUri);
    }
    for (const graphs of this.predicateIndex.values()) {
      graphs.delete(graphUri);
    }
    for (const graphs of this.objectIndex.values()) {
      graphs.delete(graphUri);
    }
  }

  private getTargetGraphs(graph: Graph | string | undefined, options: TemporalQueryOptions): string[] {
    if (graph) {
      const graphUri = typeof graph === 'string' ? graph : graph.value;
      return graphUri ? [graphUri] : [];
    }

    // If no specific graph, search all graphs (considering temporal options)
    return Array.from(this.graphs.keys());
  }

  private isTemporallyValid(metadata: TemporalMetadata, options: TemporalQueryOptions): boolean {
    if (options.asOf) {
      const asOf = options.asOf;
      if (metadata.validFrom > asOf) return false;
      if (metadata.validTo && metadata.validTo <= asOf) return false;
    }

    if (options.asRecorded) {
      if (metadata.transactionTime > options.asRecorded) return false;
    }

    if (options.currentOnly && metadata.validTo !== null) {
      return false;
    }

    if (options.version !== undefined && metadata.version !== options.version) {
      return false;
    }

    return true;
  }

  private matchesPattern(
    quad: Quad,
    pattern: {
      subject?: Subject | string;
      predicate?: Predicate | string;
      object?: QuadObject | string;
      graph?: Graph | string;
    }
  ): boolean {
    if (pattern.subject) {
      const subjValue = typeof pattern.subject === 'string' ? pattern.subject : pattern.subject.value;
      if (quad.subject.value !== subjValue) return false;
    }

    if (pattern.predicate) {
      const predValue = typeof pattern.predicate === 'string' ? pattern.predicate : pattern.predicate.value;
      if (quad.predicate.value !== predValue) return false;
    }

    if (pattern.object) {
      const objValue = typeof pattern.object === 'string' ? pattern.object : pattern.object.value;
      if (quad.object.value !== objValue) return false;
    }

    if (pattern.graph) {
      const graphValue = typeof pattern.graph === 'string' ? pattern.graph : pattern.graph.value;
      if (quad.graph.value !== graphValue) return false;
    }

    return true;
  }

  private isVariable(term: unknown): term is { variable: string } {
    return typeof term === 'object' && term !== null && 'variable' in term;
  }

  private tryBind(
    quad: Quad,
    pattern: {
      subject?: Subject | string | { variable: string };
      predicate?: Predicate | string | { variable: string };
      object?: QuadObject | string | { variable: string };
    }
  ): Binding | null {
    const binding: Binding = {};

    // Check subject
    if (this.isVariable(pattern.subject)) {
      binding[pattern.subject.variable] = quad.subject;
    } else if (pattern.subject) {
      const subjValue = typeof pattern.subject === 'string' ? pattern.subject : pattern.subject.value;
      if (quad.subject.value !== subjValue) return null;
    }

    // Check predicate
    if (this.isVariable(pattern.predicate)) {
      binding[pattern.predicate.variable] = quad.predicate;
    } else if (pattern.predicate) {
      const predValue = typeof pattern.predicate === 'string' ? pattern.predicate : pattern.predicate.value;
      if (quad.predicate.value !== predValue) return null;
    }

    // Check object
    if (this.isVariable(pattern.object)) {
      binding[pattern.object.variable] = quad.object;
    } else if (pattern.object) {
      const objValue = typeof pattern.object === 'string' ? pattern.object : pattern.object.value;
      if (quad.object.value !== objValue) return null;
    }

    return binding;
  }

  private evaluatePatterns(
    quads: Quad[],
    patterns: Array<{
      subject?: Subject | string | { variable: string };
      predicate?: Predicate | string | { variable: string };
      object?: QuadObject | string | { variable: string };
    }>
  ): Binding[] {
    if (patterns.length === 0) return [{}];

    const [first, ...rest] = patterns;
    const firstBindings: Binding[] = [];

    for (const quad of quads) {
      const binding = this.tryBind(quad, first);
      if (binding) {
        firstBindings.push(binding);
      }
    }

    if (rest.length === 0) return firstBindings;

    // Join with remaining patterns
    const results: Binding[] = [];
    for (const binding of firstBindings) {
      const substitutedPatterns = rest.map(p => this.substitutePattern(p, binding));
      const restBindings = this.evaluatePatterns(quads, substitutedPatterns);
      
      for (const restBinding of restBindings) {
        // Check compatibility and merge
        const merged = this.mergeBindings(binding, restBinding);
        if (merged) results.push(merged);
      }
    }

    return results;
  }

  private substitutePattern(
    pattern: {
      subject?: Subject | string | { variable: string };
      predicate?: Predicate | string | { variable: string };
      object?: QuadObject | string | { variable: string };
    },
    binding: Binding
  ): {
    subject?: Subject | string | { variable: string };
    predicate?: Predicate | string | { variable: string };
    object?: QuadObject | string | { variable: string };
  } {
    const boundSubject = this.applyBindingForSubject(pattern.subject, binding);
    const boundPredicate = this.applyBindingForPredicate(pattern.predicate, binding);
    const boundObject = this.applyBindingForObject(pattern.object, binding);
    
    return {
      subject: boundSubject ?? pattern.subject,
      predicate: boundPredicate ?? pattern.predicate,
      object: boundObject ?? pattern.object
    };
  }

  private applyBindingForSubject(
    term: Subject | string | { variable: string } | undefined,
    binding: Binding
  ): Subject | string | undefined {
    if (!term) return undefined;
    if (this.isVariable(term)) {
      const bound = binding[term.variable];
      if (bound && (bound.termType === 'NamedNode' || bound.termType === 'BlankNode')) {
        return bound as Subject;
      }
      return undefined;
    }
    return term;
  }

  private applyBindingForPredicate(
    term: Predicate | string | { variable: string } | undefined,
    binding: Binding
  ): Predicate | string | undefined {
    if (!term) return undefined;
    if (this.isVariable(term)) {
      const bound = binding[term.variable];
      if (bound && bound.termType === 'NamedNode') {
        return bound as Predicate;
      }
      return undefined;
    }
    return term;
  }

  private applyBindingForObject(
    term: QuadObject | string | { variable: string } | undefined,
    binding: Binding
  ): QuadObject | string | undefined {
    if (!term) return undefined;
    if (this.isVariable(term)) {
      const bound = binding[term.variable];
      if (bound && (bound.termType === 'NamedNode' || bound.termType === 'BlankNode' || bound.termType === 'Literal')) {
        return bound as QuadObject;
      }
      return undefined;
    }
    return term;
  }

  private applyBinding(
    term: Subject | Predicate | QuadObject | string | { variable: string } | undefined,
    binding: Binding
  ): Term | undefined {
    if (!term) return undefined;
    if (this.isVariable(term)) {
      return binding[term.variable];
    }
    if (typeof term === 'string') {
      return DataFactory.namedNode(term);
    }
    return term;
  }

  private mergeBindings(a: Binding, b: Binding): Binding | null {
    const result: Binding = { ...a };
    
    for (const [key, value] of Object.entries(b)) {
      if (result[key]) {
        // Check compatibility
        if (!result[key].equals(value)) return null;
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  private extractAgentInfo(quads: Quad[]): { name: string; capabilities: string[]; protocols: string[] } {
    let name = '';
    const capabilities: string[] = [];
    const protocols: string[] = [];

    for (const quad of quads) {
      // Extract name
      if (quad.predicate.value === `${CHRYSALIS_NS}name` && quad.object.termType === 'Literal') {
        name = quad.object.value;
      }
      
      // Extract tool names
      if (quad.predicate.value === `${CHRYSALIS_NS}toolName` && quad.object.termType === 'Literal') {
        capabilities.push(quad.object.value);
      }

      // Extract protocol types
      if (quad.predicate.value === `${RDF_NS}type`) {
        const typeUri = quad.object.value;
        if (typeUri.includes('Protocol') || typeUri.includes('Binding')) {
          const localName = typeUri.split('#').pop() || typeUri.split('/').pop() || '';
          if (localName && !protocols.includes(localName)) {
            protocols.push(localName);
          }
        }
      }
    }

    return { name, capabilities, protocols };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Default temporal store instance
 */
export const temporalStore = new TemporalRDFStore();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Serialize quads to N-Triples format
 */
export function serializeNTriples(quads: Quad[]): string {
  return quads.map(q => {
    const s = q.subject.termType === 'BlankNode' 
      ? `_:${q.subject.value}` 
      : `<${q.subject.value}>`;
    const p = `<${q.predicate.value}>`;
    
    let o: string;
    if (q.object.termType === 'Literal') {
      const lit = q.object as Literal;
      const escaped = lit.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      if (lit.language) {
        o = `"${escaped}"@${lit.language}`;
      } else if (lit.datatype.value !== `${XSD_NS}string`) {
        o = `"${escaped}"^^<${lit.datatype.value}>`;
      } else {
        o = `"${escaped}"`;
      }
    } else if (q.object.termType === 'BlankNode') {
      o = `_:${q.object.value}`;
    } else {
      o = `<${q.object.value}>`;
    }

    return `${s} ${p} ${o} .`;
  }).join('\n');
}

/**
 * Parse simple N-Triples format (basic implementation)
 */
export function parseNTriples(ntriples: string): Quad[] {
  const quads: Quad[] = [];
  const lines = ntriples.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  for (const line of lines) {
    const match = line.match(/^(<[^>]+>|_:[^\s]+)\s+(<[^>]+>)\s+(.+)\s+\.$/);
    if (!match) continue;

    const [, subjStr, predStr, objStr] = match;

    // Parse subject
    let subject: Subject;
    if (subjStr.startsWith('_:')) {
      subject = DataFactory.blankNode(subjStr.slice(2));
    } else {
      subject = DataFactory.namedNode(subjStr.slice(1, -1));
    }

    // Parse predicate
    const predicate = DataFactory.namedNode(predStr.slice(1, -1));

    // Parse object
    let object: QuadObject;
    if (objStr.startsWith('<')) {
      object = DataFactory.namedNode(objStr.slice(1, -1));
    } else if (objStr.startsWith('_:')) {
      object = DataFactory.blankNode(objStr.slice(2));
    } else {
      // Literal
      const litMatch = objStr.match(/^"(.*)"/s);
      if (litMatch) {
        const value = litMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        const langMatch = objStr.match(/@([a-z]+(?:-[a-z]+)*)$/i);
        const dtMatch = objStr.match(/\^\^<([^>]+)>$/);
        
        if (langMatch) {
          object = DataFactory.literal(value, langMatch[1]);
        } else if (dtMatch) {
          object = DataFactory.literal(value, DataFactory.namedNode(dtMatch[1]));
        } else {
          object = DataFactory.literal(value);
        }
      } else {
        continue; // Skip malformed
      }
    }

    quads.push(DataFactory.quad(subject, predicate, object, DataFactory.defaultGraph()));
  }

  return quads;
}
