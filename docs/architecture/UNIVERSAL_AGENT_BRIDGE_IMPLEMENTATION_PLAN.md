# Chrysalis Universal Agent Bridge: Implementation Plan

**Version**: 1.0.0
**Date**: January 11, 2026
**Status**: Technical Design Specification
**Dependencies**: Prior Strategic Analysis (AGENT_SPECIFICATION_STRATEGIC_ANALYSIS.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Canonical Agent Ontology and RDF Schema](#2-canonical-agent-ontology-and-rdf-schema)
3. [Temporal RDF Store Infrastructure](#3-temporal-rdf-store-infrastructure)
4. [Adapter Interface Contract](#4-adapter-interface-contract)
5. [LMOS Protocol Adapter](#5-lmos-protocol-adapter-reference-implementation)
6. [Chrysalis Agent Type Adapters](#6-chrysalis-agent-type-adapters)
7. [Bridge Orchestration Layer](#7-bridge-orchestration-layer)
8. [Semantic Validation and Fidelity Testing](#8-semantic-validation-and-fidelity-testing-framework)
9. [Operational Tooling](#9-operational-tooling)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Executive Summary

### 1.1 Vision

The Chrysalis Universal Agent Bridge (CUAB) is a semantic interoperability layer enabling bidirectional translation between heterogeneous AI agent frameworks. The architecture centers on a canonical RDF-based agent ontology backed by a temporal triple store, with framework-specific adapters handling the translation to and from native representations.

### 1.2 Design Principles

| Principle | Description |
|-----------|-------------|
| **Semantic Fidelity** | Preserve meaning across translations; quantify and minimize information loss |
| **Temporal Coherence** | Maintain full version history; enable point-in-time reconstruction |
| **Extensibility** | New frameworks require only new adapters, not ontology changes |
| **Provenance Tracking** | Record transformation lineage for auditability |
| **Graceful Degradation** | Partial mappings preferred over translation failures |

### 1.3 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CHRYSALIS UNIVERSAL AGENT BRIDGE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     FRAMEWORK ADAPTERS                               │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │    │
│  │  │  LMOS   │ │   USA   │ │   MCP   │ │LangChain│ │ OpenAI  │ ...   │    │
│  │  │ Adapter │ │ Adapter │ │ Adapter │ │ Adapter │ │ Adapter │       │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │    │
│  └───────│──────────│──────────│──────────│──────────│────────────────┘    │
│          │          │          │          │          │                      │
│          ▼          ▼          ▼          ▼          ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ADAPTER INTERFACE (IAgentAdapter)                 │    │
│  │   toCanonical(native) → RDF        fromCanonical(RDF) → native      │    │
│  │   validate(RDF) → ValidationResult  getCapabilities() → Capability[]│    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    BRIDGE ORCHESTRATION LAYER                        │    │
│  │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │    │
│  │   │  Translation  │  │    Cache      │  │   Discovery   │           │    │
│  │   │    Router     │  │   Manager     │  │    Service    │           │    │
│  │   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘           │    │
│  └───────────│──────────────────│──────────────────│───────────────────┘    │
│              │                  │                  │                        │
│              ▼                  ▼                  ▼                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    TEMPORAL RDF STORE                                │    │
│  │   ┌─────────────────────────────────────────────────────────────┐   │    │
│  │   │  Named Graphs (Temporal Snapshots)                          │   │    │
│  │   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │   │    │
│  │   │  │ T=2026- │ │ T=2026- │ │ T=2026- │ │ T=2026- │ ...       │   │    │
│  │   │  │ 01-10   │ │ 01-11   │ │ 01-12   │ │ 01-13   │           │   │    │
│  │   │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │   │    │
│  │   └─────────────────────────────────────────────────────────────┘   │    │
│  │   ┌─────────────────────────────────────────────────────────────┐   │    │
│  │   │  Canonical Agent Ontology (chrysalis:Agent)                 │   │    │
│  │   └─────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Agent Ontology and RDF Schema

### 2.1 Ontology Design Rationale

The canonical ontology must capture the **semantic union** of expressiveness across target frameworks while remaining **internally coherent**. This is achieved through:

1. **Core classes** representing universal agent concepts
2. **Extension namespaces** for framework-specific properties
3. **SKOS mappings** documenting equivalences between ontology terms and framework concepts

### 2.2 Namespace Definitions

```turtle
# Namespace Prefixes
@prefix chrysalis: <https://chrysalis.dev/ontology/agent#> .
@prefix lmos: <https://eclipse.dev/lmos/ontology#> .
@prefix usa: <https://chrysalis.dev/usa#> .
@prefix mcp: <https://anthropic.com/mcp#> .
@prefix langchain: <https://langchain.com/ontology#> .
@prefix openai: <https://openai.com/api#> .

@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix td: <https://www.w3.org/2019/wot/td#> .
```

### 2.3 Core Ontology Classes

```turtle
# =============================================================================
# CHRYSALIS AGENT ONTOLOGY v1.0
# =============================================================================

# -----------------------------------------------------------------------------
# Core Agent Class
# -----------------------------------------------------------------------------
chrysalis:Agent a owl:Class ;
    rdfs:label "Agent" ;
    rdfs:comment "A computational entity capable of autonomous action and interaction" ;
    rdfs:subClassOf td:Thing ;  # Aligns with W3C Web of Things
    .

# -----------------------------------------------------------------------------
# Identity Classes
# -----------------------------------------------------------------------------
chrysalis:AgentIdentity a owl:Class ;
    rdfs:label "Agent Identity" ;
    rdfs:comment "Unique identifier and cryptographic identity for an agent" ;
    .

chrysalis:DecentralizedIdentifier a owl:Class ;
    rdfs:subClassOf chrysalis:AgentIdentity ;
    rdfs:label "Decentralized Identifier" ;
    rdfs:comment "W3C DID-based identity (used by LMOS)" ;
    skos:exactMatch lmos:DID ;
    .

chrysalis:FingerprintIdentity a owl:Class ;
    rdfs:subClassOf chrysalis:AgentIdentity ;
    rdfs:label "Fingerprint Identity" ;
    rdfs:comment "SHA-384 fingerprint-based identity (used by USA)" ;
    skos:exactMatch usa:fingerprint ;
    .

# -----------------------------------------------------------------------------
# Capability Classes
# -----------------------------------------------------------------------------
chrysalis:Capability a owl:Class ;
    rdfs:label "Capability" ;
    rdfs:comment "An ability that an agent possesses" ;
    .

chrysalis:Tool a owl:Class ;
    rdfs:subClassOf chrysalis:Capability ;
    rdfs:label "Tool" ;
    rdfs:comment "An invocable function or API that an agent can use" ;
    skos:relatedMatch td:ActionAffordance ;
    skos:relatedMatch mcp:Tool ;
    skos:relatedMatch openai:Function ;
    .

chrysalis:Skill a owl:Class ;
    rdfs:subClassOf chrysalis:Capability ;
    rdfs:label "Skill" ;
    rdfs:comment "A learned or configured behavior pattern" ;
    skos:relatedMatch usa:Skill ;
    .

chrysalis:ReasoningStrategy a owl:Class ;
    rdfs:subClassOf chrysalis:Capability ;
    rdfs:label "Reasoning Strategy" ;
    rdfs:comment "A method for structured thinking (CoT, ReAct, etc.)" ;
    .

# -----------------------------------------------------------------------------
# Memory Classes
# -----------------------------------------------------------------------------
chrysalis:MemorySystem a owl:Class ;
    rdfs:label "Memory System" ;
    rdfs:comment "The cognitive memory architecture of an agent" ;
    .

chrysalis:WorkingMemory a owl:Class ;
    rdfs:subClassOf chrysalis:MemorySystem ;
    rdfs:label "Working Memory" ;
    rdfs:comment "Short-term active memory for current task context" ;
    .

chrysalis:EpisodicMemory a owl:Class ;
    rdfs:subClassOf chrysalis:MemorySystem ;
    rdfs:label "Episodic Memory" ;
    rdfs:comment "Memory of past experiences and interactions" ;
    .

chrysalis:SemanticMemory a owl:Class ;
    rdfs:subClassOf chrysalis:MemorySystem ;
    rdfs:label "Semantic Memory" ;
    rdfs:comment "Knowledge base and facts storage" ;
    .

chrysalis:ProceduralMemory a owl:Class ;
    rdfs:subClassOf chrysalis:MemorySystem ;
    rdfs:label "Procedural Memory" ;
    rdfs:comment "Learned procedures and action sequences" ;
    .

chrysalis:CoreMemory a owl:Class ;
    rdfs:subClassOf chrysalis:MemorySystem ;
    rdfs:label "Core Memory" ;
    rdfs:comment "Persistent identity and persona information" ;
    .

# -----------------------------------------------------------------------------
# Communication Classes
# -----------------------------------------------------------------------------
chrysalis:Protocol a owl:Class ;
    rdfs:label "Protocol" ;
    rdfs:comment "A communication protocol supported by the agent" ;
    .

chrysalis:MCPProtocol a owl:Class ;
    rdfs:subClassOf chrysalis:Protocol ;
    rdfs:label "Model Context Protocol" ;
    skos:exactMatch mcp:Protocol ;
    .

chrysalis:A2AProtocol a owl:Class ;
    rdfs:subClassOf chrysalis:Protocol ;
    rdfs:label "Agent-to-Agent Protocol" ;
    .

chrysalis:HTTPBinding a owl:Class ;
    rdfs:subClassOf chrysalis:Protocol ;
    rdfs:label "HTTP Binding" ;
    skos:relatedMatch td:Form ;
    .

# -----------------------------------------------------------------------------
# Execution Classes
# -----------------------------------------------------------------------------
chrysalis:ExecutionConfig a owl:Class ;
    rdfs:label "Execution Configuration" ;
    rdfs:comment "Runtime and LLM configuration for the agent" ;
    .

chrysalis:LLMConfig a owl:Class ;
    rdfs:subClassOf chrysalis:ExecutionConfig ;
    rdfs:label "LLM Configuration" ;
    rdfs:comment "Language model provider and parameters" ;
    .
```

### 2.4 Core Properties

```turtle
# -----------------------------------------------------------------------------
# Agent Properties
# -----------------------------------------------------------------------------
chrysalis:hasIdentity a owl:ObjectProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range chrysalis:AgentIdentity ;
    .

chrysalis:hasCapability a owl:ObjectProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range chrysalis:Capability ;
    .

chrysalis:hasMemorySystem a owl:ObjectProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range chrysalis:MemorySystem ;
    .

chrysalis:supportsProtocol a owl:ObjectProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range chrysalis:Protocol ;
    .

chrysalis:hasExecutionConfig a owl:ObjectProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range chrysalis:ExecutionConfig ;
    .

# -----------------------------------------------------------------------------
# Identity Properties
# -----------------------------------------------------------------------------
chrysalis:identifierValue a owl:DatatypeProperty ;
    rdfs:domain chrysalis:AgentIdentity ;
    rdfs:range xsd:string ;
    .

chrysalis:identifierScheme a owl:DatatypeProperty ;
    rdfs:domain chrysalis:AgentIdentity ;
    rdfs:range xsd:string ;
    rdfs:comment "e.g., 'did:web', 'sha384-fingerprint', 'uuid'" ;
    .

# -----------------------------------------------------------------------------
# Metadata Properties
# -----------------------------------------------------------------------------
chrysalis:name a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range xsd:string ;
    skos:exactMatch td:title ;
    .

chrysalis:description a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range xsd:string ;
    skos:exactMatch td:description ;
    .

chrysalis:version a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range xsd:string ;
    .

chrysalis:author a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range xsd:string ;
    .

# -----------------------------------------------------------------------------
# Tool Properties
# -----------------------------------------------------------------------------
chrysalis:toolName a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Tool ;
    rdfs:range xsd:string ;
    .

chrysalis:toolDescription a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Tool ;
    rdfs:range xsd:string ;
    .

chrysalis:inputSchema a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Tool ;
    rdfs:range xsd:string ;
    rdfs:comment "JSON Schema as string" ;
    .

chrysalis:outputSchema a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Tool ;
    rdfs:range xsd:string ;
    .

chrysalis:toolEndpoint a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Tool ;
    rdfs:range xsd:anyURI ;
    .

# -----------------------------------------------------------------------------
# LLM Properties
# -----------------------------------------------------------------------------
chrysalis:llmProvider a owl:DatatypeProperty ;
    rdfs:domain chrysalis:LLMConfig ;
    rdfs:range xsd:string ;
    rdfs:comment "e.g., 'openai', 'anthropic', 'google'" ;
    .

chrysalis:llmModel a owl:DatatypeProperty ;
    rdfs:domain chrysalis:LLMConfig ;
    rdfs:range xsd:string ;
    .

chrysalis:temperature a owl:DatatypeProperty ;
    rdfs:domain chrysalis:LLMConfig ;
    rdfs:range xsd:float ;
    .

chrysalis:maxTokens a owl:DatatypeProperty ;
    rdfs:domain chrysalis:LLMConfig ;
    rdfs:range xsd:integer ;
    .
```

### 2.5 Temporal and Provenance Properties

```turtle
# -----------------------------------------------------------------------------
# Temporal Versioning (using PROV-O patterns)
# -----------------------------------------------------------------------------
chrysalis:AgentSnapshot a owl:Class ;
    rdfs:subClassOf prov:Entity ;
    rdfs:label "Agent Snapshot" ;
    rdfs:comment "A point-in-time snapshot of an agent's configuration" ;
    .

chrysalis:snapshotOf a owl:ObjectProperty ;
    rdfs:domain chrysalis:AgentSnapshot ;
    rdfs:range chrysalis:Agent ;
    .

chrysalis:snapshotTimestamp a owl:DatatypeProperty ;
    rdfs:domain chrysalis:AgentSnapshot ;
    rdfs:range xsd:dateTime ;
    .

chrysalis:snapshotVersion a owl:DatatypeProperty ;
    rdfs:domain chrysalis:AgentSnapshot ;
    rdfs:range xsd:integer ;
    rdfs:comment "Monotonically increasing version number" ;
    .

# -----------------------------------------------------------------------------
# Provenance Tracking
# -----------------------------------------------------------------------------
chrysalis:TranslationActivity a owl:Class ;
    rdfs:subClassOf prov:Activity ;
    rdfs:label "Translation Activity" ;
    rdfs:comment "Records a translation between agent formats" ;
    .

chrysalis:sourceFormat a owl:DatatypeProperty ;
    rdfs:domain chrysalis:TranslationActivity ;
    rdfs:range xsd:string ;
    rdfs:comment "e.g., 'lmos', 'usa', 'mcp'" ;
    .

chrysalis:targetFormat a owl:DatatypeProperty ;
    rdfs:domain chrysalis:TranslationActivity ;
    rdfs:range xsd:string ;
    .

chrysalis:fidelityScore a owl:DatatypeProperty ;
    rdfs:domain chrysalis:TranslationActivity ;
    rdfs:range xsd:float ;
    rdfs:comment "0.0-1.0 score indicating semantic preservation" ;
    .

chrysalis:lostFields a owl:DatatypeProperty ;
    rdfs:domain chrysalis:TranslationActivity ;
    rdfs:range xsd:string ;
    rdfs:comment "JSON array of fields that could not be mapped" ;
    .

chrysalis:translatedBy a owl:ObjectProperty ;
    rdfs:domain prov:Entity ;
    rdfs:range chrysalis:TranslationActivity ;
    .
```

### 2.6 Extension Namespace Pattern

Framework-specific extensions use dedicated namespaces to preserve non-canonical information:

```turtle
# LMOS Extensions
lmos:agentClass a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range xsd:string ;
    rdfs:comment "LMOS-specific agent classification" ;
    .

lmos:securityDefinitions a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range xsd:string ;
    rdfs:comment "LMOS security definitions as JSON" ;
    .

# USA Extensions  
usa:memoryArchitecture a owl:DatatypeProperty ;
    rdfs:domain chrysalis:MemorySystem ;
    rdfs:range xsd:string ;
    rdfs:comment "e.g., 'hierarchical', 'structured', 'dual_agent'" ;
    .

usa:experienceSync a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Agent ;
    rdfs:range xsd:string ;
    rdfs:comment "USA experience sync configuration as JSON" ;
    .

# MCP Extensions
mcp:serverCommand a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Tool ;
    rdfs:range xsd:string ;
    rdfs:comment "MCP server startup command" ;
    .

mcp:serverArgs a owl:DatatypeProperty ;
    rdfs:domain chrysalis:Tool ;
    rdfs:range xsd:string ;
    rdfs:comment "MCP server arguments as JSON array" ;
    .
```

---

## 3. Temporal RDF Store Infrastructure

### 3.1 Technology Selection Criteria

| Criterion | Weight | Requirement |
|-----------|--------|-------------|
| Named Graph Support | Critical | Must support SPARQL 1.1 named graphs |
| Temporal Queries | High | Must support point-in-time queries |
| SPARQL Performance | High | Sub-second queries for agent retrieval |
| Horizontal Scaling | Medium | Support clustering for high availability |
| JSON-LD Support | High | Native or efficient JSON-LD serialization |
| Python/TypeScript SDKs | High | First-class client libraries |
| Open Source | Preferred | Apache/MIT/BSD license |

### 3.2 Technology Recommendation

**Primary: Apache Jena Fuseki**
- ✅ Full SPARQL 1.1 support including named graphs
- ✅ TDB2 backend for production performance
- ✅ REST API with JSON-LD support
- ✅ Apache 2.0 license
- ✅ Mature ecosystem, active development
- ⚠️ Java-based (requires JVM)

**Alternative: Oxigraph**
- ✅ Rust-based, embedded or server mode
- ✅ SPARQL 1.1 compliant
- ✅ Apache/MIT dual license
- ✅ Python bindings via PyO3
- ⚠️ Less mature for production

**Recommendation**: Start with Fuseki for production stability; evaluate Oxigraph for embedded use cases.

### 3.3 Named Graph Organization Strategy

```
Graph URI Pattern: chrysalis:snapshot/{agent_id}/v{version}

Example:
  chrysalis:snapshot/agent-123/v1   # Initial version
  chrysalis:snapshot/agent-123/v2   # After first update
  chrysalis:snapshot/agent-123/v3   # After second update

Metadata Graph: chrysalis:meta
  - Stores agent registry
  - Stores version pointers (latest version for each agent)
  - Stores provenance records
```

**Graph Naming Convention**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NAMED GRAPH HIERARCHY                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  chrysalis:meta                         # System metadata                │
│    ├─ Agent registry index                                               │
│    ├─ Latest version pointers                                            │
│    └─ Translation activity logs                                          │
│                                                                          │
│  chrysalis:ontology                     # Ontology definitions           │
│    └─ Agent ontology (owl:Ontology)                                      │
│                                                                          │
│  chrysalis:snapshot/{agent_id}/v{n}     # Versioned agent snapshots     │
│    └─ Complete agent state at version n                                  │
│                                                                          │
│  chrysalis:diff/{agent_id}/v{n}         # Version diffs (optional)       │
│    └─ Delta from v{n-1} to v{n}                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.4 SPARQL Query Patterns

#### 3.4.1 Point-in-Time Agent Reconstruction

```sparql
# Retrieve agent at specific version
PREFIX chrysalis: <https://chrysalis.dev/ontology/agent#>

SELECT ?property ?value
FROM NAMED <chrysalis:snapshot/agent-123/v2>
WHERE {
  GRAPH <chrysalis:snapshot/agent-123/v2> {
    ?agent a chrysalis:Agent .
    ?agent ?property ?value .
  }
}
```

#### 3.4.2 Latest Version Query

```sparql
# Get latest version of an agent
PREFIX chrysalis: <https://chrysalis.dev/ontology/agent#>

SELECT ?version ?graphUri
FROM <chrysalis:meta>
WHERE {
  ?entry chrysalis:agentId "agent-123" ;
         chrysalis:latestVersion ?version ;
         chrysalis:graphUri ?graphUri .
}
```

#### 3.4.3 Agent Discovery by Capability

```sparql
# Find all agents with a specific tool
PREFIX chrysalis: <https://chrysalis.dev/ontology/agent#>

SELECT DISTINCT ?agentId ?agentName ?toolName
WHERE {
  GRAPH ?g {
    ?agent a chrysalis:Agent ;
           chrysalis:name ?agentName ;
           chrysalis:hasCapability ?capability .
    ?capability a chrysalis:Tool ;
                chrysalis:toolName ?toolName .
    FILTER(?toolName = "web_search")
  }
  GRAPH <chrysalis:meta> {
    ?entry chrysalis:graphUri ?g ;
           chrysalis:agentId ?agentId ;
           chrysalis:isLatest true .
  }
}
```

#### 3.4.4 Version History Query

```sparql
# Get version history for an agent
PREFIX chrysalis: <https://chrysalis.dev/ontology/agent#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?version ?timestamp ?sourceFormat
FROM <chrysalis:meta>
WHERE {
  ?snapshot chrysalis:snapshotOf <chrysalis:agent/agent-123> ;
            chrysalis:snapshotVersion ?version ;
            chrysalis:snapshotTimestamp ?timestamp .
  OPTIONAL {
    ?activity prov:generated ?snapshot ;
              chrysalis:sourceFormat ?sourceFormat .
  }
}
ORDER BY DESC(?version)
```

### 3.5 RDF Store API Contract

```typescript
// src/bridge/store/TripleStoreAPI.ts

/**
 * API contract for triple store operations.
 * All adapters interact with the canonical store through this interface.
 */
export interface ITripleStoreAPI {
  // --- Agent CRUD Operations ---
  
  /**
   * Store agent as new version in named graph.
   * @returns The version number and graph URI
   */
  createAgentSnapshot(
    agentId: string,
    triples: Quad[],
    metadata: SnapshotMetadata
  ): Promise<{ version: number; graphUri: string }>;

  /**
   * Retrieve agent at specific version (or latest if version omitted).
   */
  getAgentSnapshot(
    agentId: string,
    version?: number
  ): Promise<AgentSnapshot | null>;

  /**
   * Get all versions of an agent.
   */
  getAgentHistory(agentId: string): Promise<VersionInfo[]>;

  // --- Query Operations ---
  
  /**
   * Execute SPARQL SELECT query.
   */
  query(sparql: string): Promise<QueryResult>;

  /**
   * Execute SPARQL CONSTRUCT query returning triples.
   */
  construct(sparql: string): Promise<Quad[]>;

  // --- Discovery Operations ---
  
  /**
   * Find agents matching capability criteria.
   */
  discoverAgents(criteria: DiscoveryCriteria): Promise<AgentSummary[]>;

  /**
   * Get all registered agents (latest versions).
   */
  listAgents(pagination: PaginationParams): Promise<AgentSummary[]>;

  // --- Provenance Operations ---
  
  /**
   * Record a translation activity.
   */
  recordTranslation(activity: TranslationActivity): Promise<void>;

  /**
   * Get translation history for an agent.
   */
  getTranslationHistory(agentId: string): Promise<TranslationActivity[]>;

  // --- Administrative Operations ---
  
  /**
   * Compact/optimize the store.
   */
  compact(): Promise<void>;

  /**
   * Get store statistics.
   */
  getStats(): Promise<StoreStats>;
}

// --- Supporting Types ---

export interface SnapshotMetadata {
  timestamp: Date;
  sourceFormat: string;
  translationFidelity?: number;
  author?: string;
  comment?: string;
}

export interface AgentSnapshot {
  agentId: string;
  version: number;
  graphUri: string;
  timestamp: Date;
  triples: Quad[];
  metadata: SnapshotMetadata;
}

export interface VersionInfo {
  version: number;
  timestamp: Date;
  sourceFormat: string;
  fidelityScore?: number;
}

export interface DiscoveryCriteria {
  hasCapability?: string[];
  supportsProtocol?: string[];
  llmProvider?: string;
  nameContains?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface AgentSummary {
  agentId: string;
  name: string;
  latestVersion: number;
  capabilities: string[];
  protocols: string[];
  lastUpdated: Date;
}

export interface TranslationActivity {
  id: string;
  timestamp: Date;
  agentId: string;
  sourceFormat: string;
  targetFormat: string;
  fidelityScore: number;
  lostFields: string[];
  duration: number;
}

export interface StoreStats {
  totalAgents: number;
  totalSnapshots: number;
  totalTriples: number;
  storeSizeBytes: number;
  lastCompaction: Date;
}
```

### 3.6 Fuseki Implementation

```typescript
// src/bridge/store/FusekiTripleStore.ts

import { ITripleStoreAPI, AgentSnapshot, SnapshotMetadata } from './TripleStoreAPI';
import { Quad, DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

export class FusekiTripleStore implements ITripleStoreAPI {
  private readonly baseUrl: string;
  private readonly dataset: string;

  constructor(config: { baseUrl: string; dataset: string }) {
    this.baseUrl = config.baseUrl;
    this.dataset = config.dataset;
  }

  async createAgentSnapshot(
    agentId: string,
    triples: Quad[],
    metadata: SnapshotMetadata
  ): Promise<{ version: number; graphUri: string }> {
    // 1. Get next version number
    const currentVersion = await this.getLatestVersion(agentId);
    const newVersion = currentVersion + 1;
    
    // 2. Create graph URI
    const graphUri = `https://chrysalis.dev/snapshot/${agentId}/v${newVersion}`;
    
    // 3. Insert triples into named graph
    const insertQuery = this.buildInsertQuery(graphUri, triples);
    await this.executeUpdate(insertQuery);
    
    // 4. Update metadata graph
    await this.updateMetadata(agentId, newVersion, graphUri, metadata);
    
    return { version: newVersion, graphUri };
  }

  async getAgentSnapshot(
    agentId: string,
    version?: number
  ): Promise<AgentSnapshot | null> {
    const targetVersion = version ?? await this.getLatestVersion(agentId);
    if (targetVersion === 0) return null;

    const graphUri = `https://chrysalis.dev/snapshot/${agentId}/v${targetVersion}`;
    
    const query = `
      CONSTRUCT { ?s ?p ?o }
      FROM NAMED <${graphUri}>
      WHERE {
        GRAPH <${graphUri}> { ?s ?p ?o }
      }
    `;
    
    const triples = await this.construct(query);
    if (triples.length === 0) return null;
    
    const metadata = await this.getSnapshotMetadata(agentId, targetVersion);
    
    return {
      agentId,
      version: targetVersion,
      graphUri,
      timestamp: metadata.timestamp,
      triples,
      metadata
    };
  }

  async discoverAgents(criteria: DiscoveryCriteria): Promise<AgentSummary[]> {
    const filters: string[] = [];
    
    if (criteria.hasCapability?.length) {
      const capFilter = criteria.hasCapability
        .map(cap => `?toolName = "${cap}"`)
        .join(' || ');
      filters.push(`FILTER(${capFilter})`);
    }
    
    if (criteria.supportsProtocol?.length) {
      const protoFilter = criteria.supportsProtocol
        .map(proto => `?protoType = chrysalis:${proto}Protocol`)
        .join(' || ');
      filters.push(`FILTER(${protoFilter})`);
    }
    
    if (criteria.nameContains) {
      filters.push(`FILTER(CONTAINS(LCASE(?name), LCASE("${criteria.nameContains}")))`);
    }

    const query = `
      PREFIX chrysalis: <https://chrysalis.dev/ontology/agent#>
      
      SELECT DISTINCT ?agentId ?name ?latestVersion
      WHERE {
        GRAPH <https://chrysalis.dev/meta> {
          ?entry chrysalis:agentId ?agentId ;
                 chrysalis:latestVersion ?latestVersion ;
                 chrysalis:isLatest true ;
                 chrysalis:graphUri ?g .
        }
        GRAPH ?g {
          ?agent a chrysalis:Agent ;
                 chrysalis:name ?name .
          OPTIONAL {
            ?agent chrysalis:hasCapability ?cap .
            ?cap chrysalis:toolName ?toolName .
          }
          OPTIONAL {
            ?agent chrysalis:supportsProtocol ?proto .
            ?proto a ?protoType .
          }
        }
        ${filters.join('\n')}
      }
    `;
    
    const results = await this.query(query);
    return this.mapToAgentSummaries(results);
  }

  // ... additional implementation methods
}
```

---

## 4. Adapter Interface Contract

### 4.1 Interface Specification

```typescript
// src/bridge/adapters/IAgentAdapter.ts

import { Quad } from 'n3';

/**
 * Core adapter interface for bidirectional agent translation.
 * All framework adapters must implement this interface.
 */
export interface IAgentAdapter<TNative> {
  /**
   * Unique identifier for this adapter.
   */
  readonly adapterId: string;

  /**
   * Human-readable name.
   */
  readonly adapterName: string;

  /**
   * Framework this adapter handles.
   */
  readonly framework: AgentFramework;

  /**
   * Supported versions of the framework specification.
   */
  readonly supportedVersions: string[];

  // --- Transformation Functions ---

  /**
   * Transform native framework representation to canonical RDF.
   * @param native The framework-specific agent representation
   * @param options Transformation options
   * @returns Canonical RDF triples and transformation report
   */
  toCanonical(
    native: TNative,
    options?: TransformOptions
  ): Promise<TransformResult>;

  /**
   * Transform canonical RDF to native framework representation.
   * @param triples Canonical RDF triples
   * @param options Transformation options
   * @returns Native representation and transformation report
   */
  fromCanonical(
    triples: Quad[],
    options?: TransformOptions
  ): Promise<ReverseTransformResult<TNative>>;

  // --- Validation Functions ---

  /**
   * Validate native representation before transformation.
   */
  validateNative(native: TNative): Promise<ValidationResult>;

  /**
   * Validate that RDF triples are well-formed for this adapter.
   */
  validateCanonical(triples: Quad[]): Promise<ValidationResult>;

  /**
   * Perform round-trip validation (native → RDF → native).
   */
  validateRoundTrip(native: TNative): Promise<RoundTripValidationResult>;

  // --- Capability Discovery ---

  /**
   * Get capabilities this adapter can handle.
   */
  getCapabilities(): AdapterCapability[];

  /**
   * Check if adapter can handle a specific feature.
   */
  supportsFeature(feature: string): boolean;

  // --- Schema Information ---

  /**
   * Get JSON Schema for native format validation.
   */
  getNativeSchema(): object;

  /**
   * Get SHACL shapes for canonical RDF validation.
   */
  getCanonicalShapes(): string;
}

// --- Supporting Types ---

export enum AgentFramework {
  LMOS = 'lmos',
  USA = 'usa',
  MCP = 'mcp',
  LANGCHAIN = 'langchain',
  OPENAI = 'openai',
  CREWAI = 'crewai',
  SEMANTIC_KERNEL = 'semantic_kernel',
  AUTOGEN = 'autogen'
}

export interface TransformOptions {
  /**
   * Include extension namespace properties.
   */
  includeExtensions?: boolean;

  /**
   * Preserve unmapped fields in extension namespace.
   */
  preserveUnmapped?: boolean;

  /**
   * Target RDF serialization format.
   */
  serializationFormat?: 'turtle' | 'json-ld' | 'n-triples';

  /**
   * Base URI for generated resources.
   */
  baseUri?: string;
}

export interface TransformResult {
  /**
   * Generated RDF triples.
   */
  triples: Quad[];

  /**
   * Agent ID extracted or generated.
   */
  agentId: string;

  /**
   * Transformation report.
   */
  report: TransformReport;
}

export interface TransformReport {
  /**
   * Overall success indicator.
   */
  success: boolean;

  /**
   * Semantic fidelity score (0.0-1.0).
   */
  fidelityScore: number;

  /**
   * Fields successfully mapped.
   */
  mappedFields: FieldMapping[];

  /**
   * Fields that could not be mapped.
   */
  unmappedFields: UnmappedField[];

  /**
   * Fields mapped with potential semantic loss.
   */
  lossyMappings: LossyMapping[];

  /**
   * Transformation warnings.
   */
  warnings: TransformWarning[];

  /**
   * Transformation errors (if success=false).
   */
  errors: TransformError[];

  /**
   * Processing time in milliseconds.
   */
  durationMs: number;
}

export interface FieldMapping {
  sourceField: string;
  targetProperty: string;
  mappingType: 'exact' | 'equivalent' | 'approximation';
}

export interface UnmappedField {
  field: string;
  reason: string;
  preservedIn?: string; // Extension namespace if preserved
}

export interface LossyMapping {
  sourceField: string;
  targetProperty: string;
  lossDescription: string;
  estimatedFidelity: number;
}

export interface TransformWarning {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

export interface TransformError {
  code: string;
  message: string;
  field?: string;
  fatal: boolean;
}

export interface ReverseTransformResult<TNative> {
  /**
   * Reconstructed native representation.
   */
  native: TNative;

  /**
   * Reverse transformation report.
   */
  report: TransformReport;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

export interface RoundTripValidationResult {
  /**
   * Original matched reconstructed.
   */
  equivalent: boolean;

  /**
   * Detailed diff if not equivalent.
   */
  diff?: SemanticDiff;

  /**
   * Forward transformation report.
   */
  forwardReport: TransformReport;

  /**
   * Reverse transformation report.
   */
  reverseReport: TransformReport;
}

export interface SemanticDiff {
  addedFields: string[];
  removedFields: string[];
  modifiedFields: FieldDiff[];
  fidelityScore: number;
}

export interface FieldDiff {
  field: string;
  originalValue: unknown;
  reconstructedValue: unknown;
  semanticDistance: number;
}

export interface AdapterCapability {
  name: string;
  description: string;
  bidirectional: boolean;
}
```

### 4.2 Base Adapter Implementation

```typescript
// src/bridge/adapters/BaseAgentAdapter.ts

import { IAgentAdapter, AgentFramework, TransformResult, TransformOptions } from './IAgentAdapter';
import { Quad, DataFactory, Writer, Parser } from 'n3';

const { namedNode, literal, quad } = DataFactory;

/**
 * Abstract base class providing common adapter functionality.
 */
export abstract class BaseAgentAdapter<TNative> implements IAgentAdapter<TNative> {
  abstract readonly adapterId: string;
  abstract readonly adapterName: string;
  abstract readonly framework: AgentFramework;
  abstract readonly supportedVersions: string[];

  protected readonly chrysalisNs = 'https://chrysalis.dev/ontology/agent#';
  protected readonly rdfNs = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
  protected readonly xsdNs = 'http://www.w3.org/2001/XMLSchema#';

  // --- Abstract methods to implement ---
  
  protected abstract mapToTriples(native: TNative, baseUri: string): Quad[];
  protected abstract mapFromTriples(triples: Quad[]): TNative;
  protected abstract extractAgentId(native: TNative): string;
  protected abstract getNativeValidationSchema(): object;

  // --- Concrete implementations ---

  async toCanonical(
    native: TNative,
    options: TransformOptions = {}
  ): Promise<TransformResult> {
    const startTime = Date.now();
    
    // Validate input
    const validation = await this.validateNative(native);
    if (!validation.valid) {
      return {
        triples: [],
        agentId: '',
        report: {
          success: false,
          fidelityScore: 0,
          mappedFields: [],
          unmappedFields: [],
          lossyMappings: [],
          warnings: [],
          errors: validation.errors.map(e => ({
            code: e.code,
            message: e.message,
            field: e.path,
            fatal: true
          })),
          durationMs: Date.now() - startTime
        }
      };
    }

    const agentId = this.extractAgentId(native);
    const baseUri = options.baseUri || `https://chrysalis.dev/agent/${agentId}`;
    
    // Perform mapping
    const { triples, report } = this.performMapping(native, baseUri, options);
    
    report.durationMs = Date.now() - startTime;

    return {
      triples,
      agentId,
      report
    };
  }

  protected performMapping(
    native: TNative,
    baseUri: string,
    options: TransformOptions
  ): { triples: Quad[]; report: TransformReport } {
    const triples: Quad[] = [];
    const mappedFields: FieldMapping[] = [];
    const unmappedFields: UnmappedField[] = [];
    const lossyMappings: LossyMapping[] = [];
    const warnings: TransformWarning[] = [];
    const errors: TransformError[] = [];

    try {
      // Core mapping
      const coreTriples = this.mapToTriples(native, baseUri);
      triples.push(...coreTriples);

      // Track mappings
      this.trackMappings(native, coreTriples, mappedFields, unmappedFields, lossyMappings);

      // Handle extensions if enabled
      if (options.preserveUnmapped) {
        const extensionTriples = this.preserveUnmappedFields(
          native,
          baseUri,
          unmappedFields
        );
        triples.push(...extensionTriples);
      }

    } catch (error) {
      errors.push({
        code: 'MAPPING_ERROR',
        message: error instanceof Error ? error.message : String(error),
        fatal: true
      });
    }

    // Calculate fidelity score
    const fidelityScore = this.calculateFidelity(mappedFields, unmappedFields, lossyMappings);

    return {
      triples,
      report: {
        success: errors.filter(e => e.fatal).length === 0,
        fidelityScore,
        mappedFields,
        unmappedFields,
        lossyMappings,
        warnings,
        errors,
        durationMs: 0
      }
    };
  }

  protected calculateFidelity(
    mapped: FieldMapping[],
    unmapped: UnmappedField[],
    lossy: LossyMapping[]
  ): number {
    const totalFields = mapped.length + unmapped.length;
    if (totalFields === 0) return 1.0;

    let score = 0;
    
    // Exact mappings contribute full points
    score += mapped.filter(m => m.mappingType === 'exact').length;
    
    // Equivalent mappings contribute 0.95
    score += mapped.filter(m => m.mappingType === 'equivalent').length * 0.95;
    
    // Approximations contribute 0.8
    score += mapped.filter(m => m.mappingType === 'approximation').length * 0.8;
    
    // Lossy mappings contribute their estimated fidelity
    score += lossy.reduce((acc, l) => acc + l.estimatedFidelity, 0);
    
    // Unmapped fields contribute 0
    
    return score / totalFields;
  }

  // Utility methods for subclasses
  
  protected createAgentNode(baseUri: string): Quad {
    return quad(
      namedNode(baseUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}Agent`)
    );
  }

  protected createLiteralProperty(
    subject: string,
    property: string,
    value: string | number | boolean,
    datatype?: string
  ): Quad {
    const dt = datatype || this.inferDatatype(value);
    return quad(
      namedNode(subject),
      namedNode(`${this.chrysalisNs}${property}`),
      literal(String(value), namedNode(dt))
    );
  }

  protected createObjectProperty(
    subject: string,
    property: string,
    object: string
  ): Quad {
    return quad(
      namedNode(subject),
      namedNode(`${this.chrysalisNs}${property}`),
      namedNode(object)
    );
  }

  private inferDatatype(value: unknown): string {
    if (typeof value === 'number') {
      return Number.isInteger(value) 
        ? `${this.xsdNs}integer` 
        : `${this.xsdNs}float`;
    }
    if (typeof value === 'boolean') {
      return `${this.xsdNs}boolean`;
    }
    return `${this.xsdNs}string`;
  }
}
```

### 4.3 Error Handling and Partial Mapping Strategy

```typescript
// src/bridge/adapters/MappingStrategies.ts

/**
 * Strategy for handling unmapped or partially mapped fields.
 */
export enum UnmappedFieldStrategy {
  /**
   * Fail the transformation if any field cannot be mapped.
   */
  STRICT = 'strict',

  /**
   * Continue transformation, reporting unmapped fields.
   */
  PERMISSIVE = 'permissive',

  /**
   * Preserve unmapped fields in framework-specific extension namespace.
   */
  PRESERVE = 'preserve',

  /**
   * Apply best-effort approximation mapping.
   */
  APPROXIMATE = 'approximate'
}

/**
 * Configuration for adapter error handling.
 */
export interface ErrorHandlingConfig {
  unmappedFieldStrategy: UnmappedFieldStrategy;
  
  /**
   * Minimum fidelity score required for successful transformation.
   */
  minFidelityThreshold: number;

  /**
   * Fields that must be successfully mapped.
   */
  requiredFields: string[];

  /**
   * Maximum number of warnings before treating as error.
   */
  maxWarnings: number;

  /**
   * Whether to include detailed diagnostics in report.
   */
  verboseDiagnostics: boolean;
}

export const DEFAULT_ERROR_CONFIG: ErrorHandlingConfig = {
  unmappedFieldStrategy: UnmappedFieldStrategy.PRESERVE,
  minFidelityThreshold: 0.7,
  requiredFields: ['name', 'capabilities'],
  maxWarnings: 10,
  verboseDiagnostics: true
};
```

---

## 5. LMOS Protocol Adapter (Reference Implementation)

### 5.1 LMOS Agent Description Format Analysis

LMOS uses JSON-LD based on W3C Web of Things Thing Description:

```json
{
  "@context": [
    "https://www.w3.org/2022/wot/td/v1.1",
    {"lmos": "https://lmos.2060.io/lmos#"}
  ],
  "@type": ["Thing", "lmos:Agent"],
  "id": "urn:uuid:12345",
  "title": "Weather Agent",
  "description": "Provides weather information",
  "securityDefinitions": {
    "bearer": {
      "scheme": "bearer",
      "format": "jwt"
    }
  },
  "security": "bearer",
  "properties": {
    "modelConfiguration": {
      "type": "object",
      "properties": {
        "model": {"type": "string"},
        "temperature": {"type": "number"}
      }
    }
  },
  "actions": {
    "getWeather": {
      "title": "Get Weather",
      "description": "Get weather for a location",
      "input": {
        "type": "object",
        "properties": {
          "location": {"type": "string"}
        },
        "required": ["location"]
      },
      "output": {
        "type": "object",
        "properties": {
          "temperature": {"type": "number"},
          "conditions": {"type": "string"}
        }
      },
      "forms": [{
        "href": "https://api.example.com/weather",
        "op": "invokeaction",
        "contentType": "application/json"
      }]
    }
  },
  "events": {
    "weatherAlert": {
      "data": {
        "type": "object",
        "properties": {
          "alertType": {"type": "string"},
          "message": {"type": "string"}
        }
      },
      "forms": [{
        "href": "wss://api.example.com/alerts",
        "op": "subscribeevent"
      }]
    }
  }
}
```

### 5.2 LMOS Adapter Implementation

```typescript
// src/bridge/adapters/lmos/LMOSAdapter.ts

import { 
  BaseAgentAdapter, 
  AgentFramework, 
  TransformOptions,
  FieldMapping 
} from '../BaseAgentAdapter';
import { Quad, DataFactory } from 'n3';
import { LMOSAgentDescription, LMOSAction, LMOSProperty } from './LMOSTypes';

const { namedNode, literal, quad } = DataFactory;

export class LMOSAdapter extends BaseAgentAdapter<LMOSAgentDescription> {
  readonly adapterId = 'lmos-adapter-v1';
  readonly adapterName = 'Eclipse LMOS Protocol Adapter';
  readonly framework = AgentFramework.LMOS;
  readonly supportedVersions = ['1.0', '1.1'];

  private readonly lmosNs = 'https://lmos.2060.io/lmos#';
  private readonly tdNs = 'https://www.w3.org/2019/wot/td#';
  private readonly wotsecNs = 'https://www.w3.org/2019/wot/security#';

  protected mapToTriples(native: LMOSAgentDescription, baseUri: string): Quad[] {
    const triples: Quad[] = [];
    const agentUri = baseUri;

    // --- Core Agent Type ---
    triples.push(this.createAgentNode(agentUri));
    
    // Also add WoT Thing type for LMOS compatibility
    triples.push(quad(
      namedNode(agentUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.tdNs}Thing`)
    ));

    // --- Identity ---
    if (native.id) {
      const identityUri = `${agentUri}/identity`;
      triples.push(this.createObjectProperty(agentUri, 'hasIdentity', identityUri));
      triples.push(quad(
        namedNode(identityUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}DecentralizedIdentifier`)
      ));
      triples.push(this.createLiteralProperty(identityUri, 'identifierValue', native.id));
      triples.push(this.createLiteralProperty(identityUri, 'identifierScheme', 'urn:uuid'));
    }

    // --- Metadata ---
    if (native.title) {
      triples.push(this.createLiteralProperty(agentUri, 'name', native.title));
    }
    if (native.description) {
      triples.push(this.createLiteralProperty(agentUri, 'description', native.description));
    }

    // --- Actions → Tools ---
    if (native.actions) {
      for (const [actionName, action] of Object.entries(native.actions)) {
        const toolTriples = this.mapActionToTool(agentUri, actionName, action);
        triples.push(...toolTriples);
      }
    }

    // --- Properties → LLM Config (if modelConfiguration exists) ---
    if (native.properties?.modelConfiguration) {
      const llmTriples = this.mapModelConfig(agentUri, native.properties.modelConfiguration);
      triples.push(...llmTriples);
    }

    // --- Security Definitions (preserved as extension) ---
    if (native.securityDefinitions) {
      triples.push(quad(
        namedNode(agentUri),
        namedNode(`${this.lmosNs}securityDefinitions`),
        literal(JSON.stringify(native.securityDefinitions), namedNode(`${this.xsdNs}string`))
      ));
    }

    // --- Events (preserved as extension, no direct canonical mapping) ---
    if (native.events) {
      triples.push(quad(
        namedNode(agentUri),
        namedNode(`${this.lmosNs}events`),
        literal(JSON.stringify(native.events), namedNode(`${this.xsdNs}string`))
      ));
    }

    // --- Protocol Binding ---
    const protocolUri = `${agentUri}/protocol/http`;
    triples.push(this.createObjectProperty(agentUri, 'supportsProtocol', protocolUri));
    triples.push(quad(
      namedNode(protocolUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}HTTPBinding`)
    ));

    return triples;
  }

  private mapActionToTool(agentUri: string, actionName: string, action: LMOSAction): Quad[] {
    const triples: Quad[] = [];
    const toolUri = `${agentUri}/tool/${actionName}`;

    // Create tool
    triples.push(this.createObjectProperty(agentUri, 'hasCapability', toolUri));
    triples.push(quad(
      namedNode(toolUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}Tool`)
    ));

    // Tool properties
    triples.push(this.createLiteralProperty(toolUri, 'toolName', actionName));
    
    if (action.title) {
      triples.push(this.createLiteralProperty(toolUri, 'toolDescription', action.title));
    } else if (action.description) {
      triples.push(this.createLiteralProperty(toolUri, 'toolDescription', action.description));
    }

    // Input/Output schemas
    if (action.input) {
      triples.push(this.createLiteralProperty(
        toolUri, 
        'inputSchema', 
        JSON.stringify(action.input)
      ));
    }
    if (action.output) {
      triples.push(this.createLiteralProperty(
        toolUri, 
        'outputSchema', 
        JSON.stringify(action.output)
      ));
    }

    // Endpoint from forms
    if (action.forms?.[0]?.href) {
      triples.push(quad(
        namedNode(toolUri),
        namedNode(`${this.chrysalisNs}toolEndpoint`),
        namedNode(action.forms[0].href)
      ));
    }

    // Preserve LMOS-specific form details
    if (action.forms) {
      triples.push(quad(
        namedNode(toolUri),
        namedNode(`${this.lmosNs}forms`),
        literal(JSON.stringify(action.forms), namedNode(`${this.xsdNs}string`))
      ));
    }

    return triples;
  }

  private mapModelConfig(agentUri: string, modelConfig: LMOSProperty): Quad[] {
    const triples: Quad[] = [];
    const llmUri = `${agentUri}/execution/llm`;

    triples.push(this.createObjectProperty(agentUri, 'hasExecutionConfig', llmUri));
    triples.push(quad(
      namedNode(llmUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}LLMConfig`)
    ));

    // Map known properties
    const props = modelConfig.properties || {};
    if (props.model) {
      triples.push(this.createLiteralProperty(llmUri, 'llmModel', String(props.model.const || props.model.default || '')));
    }
    if (props.temperature) {
      triples.push(this.createLiteralProperty(llmUri, 'temperature', Number(props.temperature.default || 0.7)));
    }

    return triples;
  }

  protected mapFromTriples(triples: Quad[]): LMOSAgentDescription {
    // Build lookup maps
    const subjects = new Map<string, Map<string, string[]>>();
    
    for (const t of triples) {
      const s = t.subject.value;
      const p = t.predicate.value;
      const o = t.object.termType === 'Literal' ? t.object.value : t.object.value;
      
      if (!subjects.has(s)) subjects.set(s, new Map());
      const props = subjects.get(s)!;
      if (!props.has(p)) props.set(p, []);
      props.get(p)!.push(o);
    }

    // Find agent subject
    let agentUri: string | null = null;
    for (const [s, props] of subjects) {
      const types = props.get(`${this.rdfNs}type`) || [];
      if (types.includes(`${this.chrysalisNs}Agent`)) {
        agentUri = s;
        break;
      }
    }

    if (!agentUri) {
      throw new Error('No Agent found in triples');
    }

    const agentProps = subjects.get(agentUri)!;
    
    // Build LMOS structure
    const lmos: LMOSAgentDescription = {
      '@context': [
        'https://www.w3.org/2022/wot/td/v1.1',
        { 'lmos': 'https://lmos.2060.io/lmos#' }
      ],
      '@type': ['Thing', 'lmos:Agent'],
      id: this.extractIdentityValue(subjects, agentProps),
      title: this.getFirst(agentProps, `${this.chrysalisNs}name`) || '',
      description: this.getFirst(agentProps, `${this.chrysalisNs}description`),
      actions: this.reconstructActions(subjects, agentProps),
      properties: this.reconstructProperties(subjects, agentProps),
      securityDefinitions: this.reconstructSecurityDefs(agentProps),
      events: this.reconstructEvents(agentProps)
    };

    return lmos;
  }

  private extractIdentityValue(
    subjects: Map<string, Map<string, string[]>>,
    agentProps: Map<string, string[]>
  ): string {
    const identityUris = agentProps.get(`${this.chrysalisNs}hasIdentity`) || [];
    for (const uri of identityUris) {
      const identityProps = subjects.get(uri);
      if (identityProps) {
        const value = this.getFirst(identityProps, `${this.chrysalisNs}identifierValue`);
        if (value) return value;
      }
    }
    return `urn:uuid:${crypto.randomUUID()}`;
  }

  private reconstructActions(
    subjects: Map<string, Map<string, string[]>>,
    agentProps: Map<string, string[]>
  ): Record<string, LMOSAction> {
    const actions: Record<string, LMOSAction> = {};
    
    const capabilityUris = agentProps.get(`${this.chrysalisNs}hasCapability`) || [];
    for (const uri of capabilityUris) {
      const capProps = subjects.get(uri);
      if (!capProps) continue;
      
      const types = capProps.get(`${this.rdfNs}type`) || [];
      if (!types.includes(`${this.chrysalisNs}Tool`)) continue;

      const toolName = this.getFirst(capProps, `${this.chrysalisNs}toolName`);
      if (!toolName) continue;

      const action: LMOSAction = {
        title: this.getFirst(capProps, `${this.chrysalisNs}toolDescription`) || toolName
      };

      const inputSchema = this.getFirst(capProps, `${this.chrysalisNs}inputSchema`);
      if (inputSchema) {
        try { action.input = JSON.parse(inputSchema); } catch {}
      }

      const outputSchema = this.getFirst(capProps, `${this.chrysalisNs}outputSchema`);
      if (outputSchema) {
        try { action.output = JSON.parse(outputSchema); } catch {}
      }

      const endpoint = this.getFirst(capProps, `${this.chrysalisNs}toolEndpoint`);
      const formsJson = this.getFirst(capProps, `${this.lmosNs}forms`);
      
      if (formsJson) {
        try { action.forms = JSON.parse(formsJson); } catch {}
      } else if (endpoint) {
        action.forms = [{ href: endpoint, op: 'invokeaction' }];
      }

      actions[toolName] = action;
    }

    return actions;
  }

  private reconstructProperties(
    subjects: Map<string, Map<string, string[]>>,
    agentProps: Map<string, string[]>
  ): Record<string, LMOSProperty> | undefined {
    const properties: Record<string, LMOSProperty> = {};

    const execUris = agentProps.get(`${this.chrysalisNs}hasExecutionConfig`) || [];
    for (const uri of execUris) {
      const execProps = subjects.get(uri);
      if (!execProps) continue;

      const types = execProps.get(`${this.rdfNs}type`) || [];
      if (types.includes(`${this.chrysalisNs}LLMConfig`)) {
        properties['modelConfiguration'] = {
          type: 'object',
          properties: {
            model: { 
              type: 'string',
              const: this.getFirst(execProps, `${this.chrysalisNs}llmModel`)
            },
            temperature: {
              type: 'number',
              default: parseFloat(this.getFirst(execProps, `${this.chrysalisNs}temperature`) || '0.7')
            }
          }
        };
      }
    }

    return Object.keys(properties).length > 0 ? properties : undefined;
  }

  private reconstructSecurityDefs(agentProps: Map<string, string[]>): object | undefined {
    const json = this.getFirst(agentProps, `${this.lmosNs}securityDefinitions`);
    if (json) {
      try { return JSON.parse(json); } catch {}
    }
    return undefined;
  }

  private reconstructEvents(agentProps: Map<string, string[]>): object | undefined {
    const json = this.getFirst(agentProps, `${this.lmosNs}events`);
    if (json) {
      try { return JSON.parse(json); } catch {}
    }
    return undefined;
  }

  private getFirst(props: Map<string, string[]>, key: string): string | undefined {
    return props.get(key)?.[0];
  }

  protected extractAgentId(native: LMOSAgentDescription): string {
    if (native.id) {
      // Extract ID from URN or use as-is
      const match = native.id.match(/urn:uuid:(.+)/);
      return match ? match[1] : native.id;
    }
    return crypto.randomUUID();
  }

  protected getNativeValidationSchema(): object {
    return {
      type: 'object',
      required: ['@context', '@type', 'title'],
      properties: {
        '@context': { type: 'array' },
        '@type': { type: 'array', items: { type: 'string' } },
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        actions: { type: 'object' },
        properties: { type: 'object' },
        events: { type: 'object' },
        securityDefinitions: { type: 'object' }
      }
    };
  }

  getCapabilities(): AdapterCapability[] {
    return [
      { name: 'agent-metadata', description: 'Agent identification and description', bidirectional: true },
      { name: 'tools', description: 'Tool/action definitions', bidirectional: true },
      { name: 'llm-config', description: 'Language model configuration', bidirectional: true },
      { name: 'security', description: 'Security definitions', bidirectional: true },
      { name: 'events', description: 'Event subscriptions', bidirectional: true },
      { name: 'http-binding', description: 'HTTP endpoint bindings', bidirectional: true }
    ];
  }

  supportsFeature(feature: string): boolean {
    const supported = ['tools', 'llm-config', 'http-binding', 'security', 'events'];
    return supported.includes(feature);
  }
}
```

### 5.3 LMOS Types

```typescript
// src/bridge/adapters/lmos/LMOSTypes.ts

export interface LMOSAgentDescription {
  '@context': (string | Record<string, string>)[];
  '@type': string[];
  id?: string;
  title: string;
  description?: string;
  securityDefinitions?: Record<string, LMOSSecurityScheme>;
  security?: string | string[];
  properties?: Record<string, LMOSProperty>;
  actions?: Record<string, LMOSAction>;
  events?: Record<string, LMOSEvent>;
}

export interface LMOSSecurityScheme {
  scheme: string;
  format?: string;
  in?: string;
  name?: string;
}

export interface LMOSProperty {
  type: string;
  properties?: Record<string, LMOSPropertySchema>;
  const?: unknown;
  default?: unknown;
}

export interface LMOSPropertySchema {
  type: string;
  const?: unknown;
  default?: unknown;
}

export interface LMOSAction {
  title?: string;
  description?: string;
  input?: LMOSSchema;
  output?: LMOSSchema;
  forms?: LMOSForm[];
}

export interface LMOSEvent {
  data?: LMOSSchema;
  forms?: LMOSForm[];
}

export interface LMOSSchema {
  type: string;
  properties?: Record<string, LMOSSchemaProperty>;
  required?: string[];
  items?: LMOSSchema;
}

export interface LMOSSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface LMOSForm {
  href: string;
  op?: string | string[];
  contentType?: string;
  subprotocol?: string;
}
```

---

## 6. Chrysalis Agent Type Adapters

### 6.1 USA Specification Adapter

```typescript
// src/bridge/adapters/usa/USAAdapter.ts

import { BaseAgentAdapter, AgentFramework } from '../BaseAgentAdapter';
import { Quad, DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

export interface USAAgentSpec {
  apiVersion: string;
  kind: 'Agent';
  metadata: {
    name: string;
    version?: string;
    description?: string;
    author?: string;
    tags?: string[];
  };
  identity?: {
    role?: string;
    goal?: string;
    backstory?: string;
    personality_traits?: string[];
  };
  capabilities?: {
    tools?: USATool[];
    skills?: USASkill[];
    reasoning?: {
      strategy?: string;
      max_iterations?: number;
    };
    memory?: USAMemoryConfig;
  };
  protocols?: {
    mcp?: { enabled: boolean; servers?: object[] };
    a2a?: { enabled: boolean; endpoint?: string };
  };
  execution?: {
    llm?: { provider?: string; model?: string; temperature?: number; max_tokens?: number };
    runtime?: { timeout?: number; max_iterations?: number };
  };
  deployment?: {
    context?: string;
    scaling?: { min_instances?: number; max_instances?: number };
  };
}

export interface USATool {
  name: string;
  protocol?: string;
  config?: object;
}

export interface USASkill {
  name: string;
  type?: string;
  parameters?: object;
}

export interface USAMemoryConfig {
  architecture?: string;
  working?: { enabled: boolean; max_tokens?: number };
  episodic?: { enabled: boolean; storage?: string };
  semantic?: { enabled: boolean; rag?: object };
  procedural?: { enabled: boolean };
  core?: { enabled: boolean; blocks?: string[] };
}

export class USAAdapter extends BaseAgentAdapter<USAAgentSpec> {
  readonly adapterId = 'usa-adapter-v2';
  readonly adapterName = 'Chrysalis USA Specification Adapter';
  readonly framework = AgentFramework.USA;
  readonly supportedVersions = ['usa/v1', 'usa/v2'];

  private readonly usaNs = 'https://chrysalis.dev/usa#';

  protected mapToTriples(native: USAAgentSpec, baseUri: string): Quad[] {
    const triples: Quad[] = [];
    const agentUri = baseUri;

    // Core agent type
    triples.push(this.createAgentNode(agentUri));

    // --- Metadata ---
    triples.push(this.createLiteralProperty(agentUri, 'name', native.metadata.name));
    
    if (native.metadata.version) {
      triples.push(this.createLiteralProperty(agentUri, 'version', native.metadata.version));
    }
    if (native.metadata.description) {
      triples.push(this.createLiteralProperty(agentUri, 'description', native.metadata.description));
    }
    if (native.metadata.author) {
      triples.push(this.createLiteralProperty(agentUri, 'author', native.metadata.author));
    }

    // --- Identity (USA-specific extension) ---
    if (native.identity) {
      const identityUri = `${agentUri}/identity`;
      triples.push(this.createObjectProperty(agentUri, 'hasIdentity', identityUri));
      triples.push(quad(
        namedNode(identityUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}FingerprintIdentity`)
      ));
      
      if (native.identity.role) {
        triples.push(quad(
          namedNode(identityUri),
          namedNode(`${this.usaNs}role`),
          literal(native.identity.role)
        ));
      }
      if (native.identity.goal) {
        triples.push(quad(
          namedNode(identityUri),
          namedNode(`${this.usaNs}goal`),
          literal(native.identity.goal)
        ));
      }
      if (native.identity.backstory) {
        triples.push(quad(
          namedNode(identityUri),
          namedNode(`${this.usaNs}backstory`),
          literal(native.identity.backstory)
        ));
      }
    }

    // --- Tools ---
    if (native.capabilities?.tools) {
      for (const tool of native.capabilities.tools) {
        const toolTriples = this.mapTool(agentUri, tool);
        triples.push(...toolTriples);
      }
    }

    // --- Skills ---
    if (native.capabilities?.skills) {
      for (const skill of native.capabilities.skills) {
        const skillTriples = this.mapSkill(agentUri, skill);
        triples.push(...skillTriples);
      }
    }

    // --- Memory System (USA's distinctive feature) ---
    if (native.capabilities?.memory) {
      const memoryTriples = this.mapMemorySystem(agentUri, native.capabilities.memory);
      triples.push(...memoryTriples);
    }

    // --- Reasoning Strategy ---
    if (native.capabilities?.reasoning) {
      const reasoningUri = `${agentUri}/reasoning`;
      triples.push(this.createObjectProperty(agentUri, 'hasCapability', reasoningUri));
      triples.push(quad(
        namedNode(reasoningUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}ReasoningStrategy`)
      ));
      if (native.capabilities.reasoning.strategy) {
        triples.push(quad(
          namedNode(reasoningUri),
          namedNode(`${this.usaNs}strategy`),
          literal(native.capabilities.reasoning.strategy)
        ));
      }
    }

    // --- Protocols ---
    if (native.protocols?.mcp?.enabled) {
      const mcpUri = `${agentUri}/protocol/mcp`;
      triples.push(this.createObjectProperty(agentUri, 'supportsProtocol', mcpUri));
      triples.push(quad(
        namedNode(mcpUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}MCPProtocol`)
      ));
      if (native.protocols.mcp.servers) {
        triples.push(quad(
          namedNode(mcpUri),
          namedNode(`${this.usaNs}servers`),
          literal(JSON.stringify(native.protocols.mcp.servers))
        ));
      }
    }

    if (native.protocols?.a2a?.enabled) {
      const a2aUri = `${agentUri}/protocol/a2a`;
      triples.push(this.createObjectProperty(agentUri, 'supportsProtocol', a2aUri));
      triples.push(quad(
        namedNode(a2aUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}A2AProtocol`)
      ));
      if (native.protocols.a2a.endpoint) {
        triples.push(quad(
          namedNode(a2aUri),
          namedNode(`${this.usaNs}endpoint`),
          namedNode(native.protocols.a2a.endpoint)
        ));
      }
    }

    // --- LLM Execution Config ---
    if (native.execution?.llm) {
      const llmUri = `${agentUri}/execution/llm`;
      triples.push(this.createObjectProperty(agentUri, 'hasExecutionConfig', llmUri));
      triples.push(quad(
        namedNode(llmUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}LLMConfig`)
      ));
      
      if (native.execution.llm.provider) {
        triples.push(this.createLiteralProperty(llmUri, 'llmProvider', native.execution.llm.provider));
      }
      if (native.execution.llm.model) {
        triples.push(this.createLiteralProperty(llmUri, 'llmModel', native.execution.llm.model));
      }
      if (native.execution.llm.temperature !== undefined) {
        triples.push(this.createLiteralProperty(llmUri, 'temperature', native.execution.llm.temperature));
      }
      if (native.execution.llm.max_tokens !== undefined) {
        triples.push(this.createLiteralProperty(llmUri, 'maxTokens', native.execution.llm.max_tokens));
      }
    }

    return triples;
  }

  private mapTool(agentUri: string, tool: USATool): Quad[] {
    const triples: Quad[] = [];
    const toolUri = `${agentUri}/tool/${tool.name}`;

    triples.push(this.createObjectProperty(agentUri, 'hasCapability', toolUri));
    triples.push(quad(
      namedNode(toolUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}Tool`)
    ));
    triples.push(this.createLiteralProperty(toolUri, 'toolName', tool.name));

    if (tool.protocol) {
      triples.push(quad(
        namedNode(toolUri),
        namedNode(`${this.usaNs}protocol`),
        literal(tool.protocol)
      ));
    }
    if (tool.config) {
      triples.push(quad(
        namedNode(toolUri),
        namedNode(`${this.usaNs}config`),
        literal(JSON.stringify(tool.config))
      ));
    }

    return triples;
  }

  private mapSkill(agentUri: string, skill: USASkill): Quad[] {
    const triples: Quad[] = [];
    const skillUri = `${agentUri}/skill/${skill.name}`;

    triples.push(this.createObjectProperty(agentUri, 'hasCapability', skillUri));
    triples.push(quad(
      namedNode(skillUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}Skill`)
    ));
    triples.push(quad(
      namedNode(skillUri),
      namedNode(`${this.usaNs}skillName`),
      literal(skill.name)
    ));

    if (skill.type) {
      triples.push(quad(
        namedNode(skillUri),
        namedNode(`${this.usaNs}skillType`),
        literal(skill.type)
      ));
    }

    return triples;
  }

  private mapMemorySystem(agentUri: string, memory: USAMemoryConfig): Quad[] {
    const triples: Quad[] = [];
    const memoryUri = `${agentUri}/memory`;

    triples.push(this.createObjectProperty(agentUri, 'hasMemorySystem', memoryUri));
    triples.push(quad(
      namedNode(memoryUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}MemorySystem`)
    ));

    if (memory.architecture) {
      triples.push(quad(
        namedNode(memoryUri),
        namedNode(`${this.usaNs}memoryArchitecture`),
        literal(memory.architecture)
      ));
    }

    // Working memory
    if (memory.working?.enabled) {
      const workingUri = `${memoryUri}/working`;
      triples.push(quad(
        namedNode(memoryUri),
        namedNode(`${this.chrysalisNs}hasComponent`),
        namedNode(workingUri)
      ));
      triples.push(quad(
        namedNode(workingUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}WorkingMemory`)
      ));
      if (memory.working.max_tokens) {
        triples.push(quad(
          namedNode(workingUri),
          namedNode(`${this.usaNs}maxTokens`),
          literal(String(memory.working.max_tokens), namedNode(`${this.xsdNs}integer`))
        ));
      }
    }

    // Episodic memory
    if (memory.episodic?.enabled) {
      const episodicUri = `${memoryUri}/episodic`;
      triples.push(quad(
        namedNode(memoryUri),
        namedNode(`${this.chrysalisNs}hasComponent`),
        namedNode(episodicUri)
      ));
      triples.push(quad(
        namedNode(episodicUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}EpisodicMemory`)
      ));
    }

    // Semantic memory
    if (memory.semantic?.enabled) {
      const semanticUri = `${memoryUri}/semantic`;
      triples.push(quad(
        namedNode(memoryUri),
        namedNode(`${this.chrysalisNs}hasComponent`),
        namedNode(semanticUri)
      ));
      triples.push(quad(
        namedNode(semanticUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}SemanticMemory`)
      ));
    }

    // Procedural memory
    if (memory.procedural?.enabled) {
      const proceduralUri = `${memoryUri}/procedural`;
      triples.push(quad(
        namedNode(memoryUri),
        namedNode(`${this.chrysalisNs}hasComponent`),
        namedNode(proceduralUri)
      ));
      triples.push(quad(
        namedNode(proceduralUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}ProceduralMemory`)
      ));
    }

    // Core memory
    if (memory.core?.enabled) {
      const coreUri = `${memoryUri}/core`;
      triples.push(quad(
        namedNode(memoryUri),
        namedNode(`${this.chrysalisNs}hasComponent`),
        namedNode(coreUri)
      ));
      triples.push(quad(
        namedNode(coreUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}CoreMemory`)
      ));
    }

    return triples;
  }

  protected mapFromTriples(triples: Quad[]): USAAgentSpec {
    // Implementation mirrors the mapToTriples logic in reverse
    // ... (similar pattern to LMOSAdapter.mapFromTriples)
    throw new Error('Not implemented - see LMOSAdapter for pattern');
  }

  protected extractAgentId(native: USAAgentSpec): string {
    return native.metadata.name.toLowerCase().replace(/\s+/g, '-');
  }

  protected getNativeValidationSchema(): object {
    return {
      type: 'object',
      required: ['apiVersion', 'kind', 'metadata'],
      properties: {
        apiVersion: { type: 'string', pattern: '^usa/v[12]$' },
        kind: { const: 'Agent' },
        metadata: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' }
          }
        }
      }
    };
  }

  getCapabilities(): AdapterCapability[] {
    return [
      { name