# Migration Plan: Semantic Services into Chrysalis

**Version:** 1.0.0  
**Date:** 2026-01-06  
**Status:** Proposed  
**Estimated Duration:** 6-8 weeks

---

## Executive Summary

This document outlines the migration of six semantic processing capabilities from distributed repositories into a unified Chrysalis Semantic Processing subsystem. The migration follows a phased approach prioritizing high-value consolidations with minimal disruption to existing functionality.

---

## 1. Target Architecture

### 1.1 Directory Structure

```
Chrysalis/
├── memory_system/
│   ├── __init__.py
│   ├── core.py                          # Existing
│   ├── embeddings.py                    # Extend (Service 3)
│   │
│   ├── semantic/                        # NEW: Service 1
│   │   ├── __init__.py
│   │   ├── decomposer.py               # Unified triple extraction
│   │   ├── models.py                   # SemanticFrame, Triple
│   │   ├── strategies/
│   │   │   ├── __init__.py
│   │   │   ├── ollama_strategy.py      # LLM-based (from SkyPrompt)
│   │   │   ├── spacy_strategy.py       # NLP-based (from MetaSemantic)
│   │   │   └── treesitter_strategy.py  # AST-based (new)
│   │   └── confidence.py               # Calibration (from SkyPrompt)
│   │
│   ├── graph/                           # NEW: Service 2
│   │   ├── __init__.py
│   │   ├── storage.py                  # Unified graph interface
│   │   ├── adapters/
│   │   │   ├── __init__.py
│   │   │   ├── sqlite_adapter.py       # From Ludwig
│   │   │   ├── arangodb_adapter.py     # Existing integration
│   │   │   └── networkx_adapter.py     # From SkyPrompt (in-memory)
│   │   ├── external/
│   │   │   ├── __init__.py
│   │   │   └── yago_client.py          # From Ludwig
│   │   └── migrations/                 # Schema versioning
│   │       └── __init__.py
│   │
│   ├── lsp/                             # NEW: Service 4
│   │   ├── __init__.py
│   │   ├── resolver.py                 # Symbol resolution
│   │   ├── index.py                    # Symbol index management
│   │   └── adapters/
│   │       ├── __init__.py
│   │       └── serena_adapter.py       # serena LSP bridge
│   │
│   ├── analysis/                        # NEW: Service 5
│   │   ├── __init__.py
│   │   ├── shannon.py                  # Information theory evaluator
│   │   ├── metrics.py                  # Quality metrics
│   │   └── reports.py                  # Analysis report generation
│   │
│   ├── converters/                      # NEW: Service 6
│   │   ├── __init__.py
│   │   ├── base.py                     # ContentConverter base class
│   │   ├── text_to_md.py               # From LibraryLadder
│   │   ├── html_to_md.py               # From LibraryLadder
│   │   └── epub_to_md.py               # From LibraryLadder
│   │
│   ├── knowledgebuilder/                # Existing - enhanced
│   └── skillbuilder/                    # Existing - enhanced
│
├── mcp-servers/
│   └── semantic-processing/             # NEW: MCP interface
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   └── index.ts                # MCP server entry
│       └── README.md
```

### 1.2 Component Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Chrysalis Semantic Processing                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  Decomposer  │────▶│    Graph     │────▶│   Analysis   │                │
│  │   Service    │     │   Service    │     │   Service    │                │
│  └──────┬───────┘     └──────┬───────┘     └──────────────┘                │
│         │                    │                                              │
│         │  SemanticFrame     │  Entities/Relations                         │
│         ▼                    ▼                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  Embedding   │◀───▶│   External   │     │  Converters  │                │
│  │   Service    │     │  Knowledge   │     │   Service    │                │
│  └──────────────┘     │ (YAGO/Wiki)  │     └──────────────┘                │
│         │             └──────────────┘            │                         │
│         │                    ▲                    │                         │
│         ▼                    │                    ▼                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   LanceDB    │     │    LSP       │────▶│  KnowledgeB  │                │
│  │   Storage    │     │   Resolver   │     │  SkillBuilder│                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                           MCP Interface Layer                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tools: decompose | embed | search | analyze | resolve | convert     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Migration Phases

### Phase 1: Foundation (Week 1-2)

**Objective:** Create base infrastructure and shared models

#### 2.1.1 Shared Models

```python
# memory_system/semantic/models.py

from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from enum import Enum

class Intent(Enum):
    DEBUG = "DEBUG"
    REFACTOR = "REFACTOR"
    CREATE = "CREATE"
    EXPLAIN = "EXPLAIN"
    TEST = "TEST"
    QUERY = "QUERY"
    TRANSFORM = "TRANSFORM"

@dataclass
class Triple:
    """Subject-Predicate-Object triple"""
    subject: str
    predicate: str
    object: str
    confidence: float = 1.0
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class SemanticFrame:
    """Unified semantic frame for decomposed content"""
    intent: Intent
    target: str
    triples: List[Triple]
    confidence: float
    raw: str
    strategy_used: str = "unknown"
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "intent": self.intent.value,
            "target": self.target,
            "triples": [
                {"subject": t.subject, "predicate": t.predicate, "object": t.object}
                for t in self.triples
            ],
            "confidence": self.confidence,
            "raw": self.raw,
            "strategy_used": self.strategy_used,
        }
```

#### 2.1.2 Tasks
| Task | Source | Target | Priority |
|------|--------|--------|----------|
| Create `memory_system/semantic/` directory | N/A | New | P0 |
| Create `memory_system/semantic/models.py` | SkyPrompt | New | P0 |
| Create `memory_system/graph/` directory | N/A | New | P0 |
| Define storage adapter interface | Ludwig | New | P0 |
| Add pytest fixtures for semantic testing | N/A | tests/ | P0 |

---

### Phase 2: Triple Decomposition (Week 2-3)

**Objective:** Migrate and unify decomposer implementations

#### 2.2.1 Strategy Pattern Implementation

```python
# memory_system/semantic/decomposer.py

from abc import ABC, abstractmethod
from typing import Optional
from .models import SemanticFrame

class DecompositionStrategy(ABC):
    """Base strategy for semantic decomposition"""
    
    @abstractmethod
    async def decompose(self, text: str) -> SemanticFrame:
        """Decompose text into semantic frame"""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Strategy identifier"""
        pass
    
    @property
    def priority(self) -> int:
        """Priority for strategy selection (higher = preferred)"""
        return 0

class UnifiedDecomposer:
    """
    Unified decomposer with pluggable strategies.
    
    Strategy selection:
    1. Code content → TreeSitter (AST analysis)
    2. Natural language → spaCy (NLP dependency parsing)
    3. Complex/ambiguous → Ollama (LLM semantic parsing)
    4. Fallback → Keyword heuristics
    """
    
    def __init__(self, strategies: Optional[list[DecompositionStrategy]] = None):
        self.strategies = strategies or self._default_strategies()
        self._sort_by_priority()
    
    def _default_strategies(self) -> list[DecompositionStrategy]:
        from .strategies import OllamaStrategy, SpacyStrategy, TreeSitterStrategy
        return [
            OllamaStrategy(),    # priority=100
            SpacyStrategy(),     # priority=50
            TreeSitterStrategy(), # priority=75 for code
        ]
    
    async def decompose(
        self, 
        text: str, 
        strategy_hint: Optional[str] = None
    ) -> SemanticFrame:
        """
        Decompose text using best available strategy.
        
        Args:
            text: Input text to decompose
            strategy_hint: Optional hint ("code", "nlp", "llm")
        """
        # Strategy selection logic
        for strategy in self.strategies:
            try:
                frame = await strategy.decompose(text)
                frame.strategy_used = strategy.name
                return frame
            except Exception as e:
                continue  # Try next strategy
        
        # Fallback
        return self._fallback_decompose(text)
```

#### 2.2.2 Migration Tasks
| Task | Source File | Target File | Complexity |
|------|-------------|-------------|------------|
| Port Ollama strategy | SkyPrompt/decomposer.py:76-249 | semantic/strategies/ollama_strategy.py | Medium |
| Port spaCy strategy | MetaSemantic/prompt_decomposer.py:27-74 | semantic/strategies/spacy_strategy.py | Low |
| Create TreeSitter strategy | SkyPrompt/graph_store.py (partial) | semantic/strategies/treesitter_strategy.py | Medium |
| Port confidence calibrator | SkyPrompt/confidence_calibrator.py | semantic/confidence.py | Low |
| Create unified decomposer | New | semantic/decomposer.py | Medium |
| Write unit tests | N/A | tests/semantic/test_decomposer.py | Medium |

#### 2.2.3 Dependencies
```
# requirements.txt additions
spacy>=3.7.0
ollama>=0.1.0
tree-sitter-languages>=1.10.0
```

---

### Phase 3: Graph Storage (Week 3-4)

**Objective:** Create unified graph storage with pluggable backends

#### 2.3.1 Storage Adapter Interface

```python
# memory_system/graph/storage.py

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

@dataclass
class GraphEntity:
    """Entity in knowledge graph"""
    name: str
    type: str = "concept"
    source_file: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class GraphRelationship:
    """Relationship in knowledge graph"""
    source: str
    relation: str
    target: str
    confidence: float = 1.0
    source_file: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class GraphStorageAdapter(ABC):
    """Abstract interface for graph storage backends"""
    
    @abstractmethod
    def add_entity(self, entity: GraphEntity) -> str:
        """Add entity, return ID"""
        pass
    
    @abstractmethod
    def add_relationship(self, rel: GraphRelationship) -> str:
        """Add relationship, return ID"""
        pass
    
    @abstractmethod
    def batch_add_entities(self, entities: List[GraphEntity]) -> int:
        """Batch add entities, return count"""
        pass
    
    @abstractmethod
    def batch_add_relationships(self, rels: List[GraphRelationship]) -> int:
        """Batch add relationships, return count"""
        pass
    
    @abstractmethod
    def query_outgoing(self, source: str, relation: Optional[str] = None) -> List[str]:
        """Get targets from source"""
        pass
    
    @abstractmethod
    def query_incoming(self, target: str, relation: Optional[str] = None) -> List[str]:
        """Get sources to target"""
        pass
    
    @abstractmethod
    def find_related(self, entity: str, depth: int = 1) -> List[GraphEntity]:
        """BFS traversal from entity"""
        pass

class UnifiedGraphStore:
    """
    Unified graph store with pluggable backends.
    
    Backends:
    - SQLite: File-based, portable (default)
    - ArangoDB: Distributed, multi-model
    - NetworkX: In-memory, fast traversal
    """
    
    def __init__(self, adapter: GraphStorageAdapter):
        self.adapter = adapter
        self._external_resolvers = []
    
    def add_external_resolver(self, resolver):
        """Add external knowledge resolver (YAGO, Wikidata)"""
        self._external_resolvers.append(resolver)
    
    async def resolve_and_enrich(self, entity_name: str) -> GraphEntity:
        """Resolve entity using external knowledge bases"""
        for resolver in self._external_resolvers:
            try:
                enriched = await resolver.resolve(entity_name)
                if enriched:
                    return enriched
            except Exception:
                continue
        return GraphEntity(name=entity_name)
```

#### 2.3.2 Migration Tasks
| Task | Source File | Target File | Complexity |
|------|-------------|-------------|------------|
| Create adapter interface | New | graph/storage.py | Medium |
| Port SQLite adapter | Ludwig/graph/storage.py:69-713 | graph/adapters/sqlite_adapter.py | Medium |
| Create ArangoDB adapter | Existing integration | graph/adapters/arangodb_adapter.py | Medium |
| Port NetworkX adapter | SkyPrompt/graph_store.py:26-433 | graph/adapters/networkx_adapter.py | Medium |
| Port YAGO client | Ludwig/external/yago_client.py | graph/external/yago_client.py | Low |
| Port migrations | Ludwig/graph/migrations.py | graph/migrations/ | Low |
| Write integration tests | N/A | tests/graph/test_adapters.py | High |

---

### Phase 4: Embedding Service Extension (Week 4-5)

**Objective:** Enhance existing embedding service with unified interface

#### 2.4.1 Enhanced Embedding Service

```python
# memory_system/embeddings.py (extended)

from typing import List, Optional, Protocol
import numpy as np

class EmbeddingModel(Protocol):
    """Protocol for embedding models"""
    
    def encode(self, texts: List[str]) -> np.ndarray:
        """Encode texts to vectors"""
        ...
    
    @property
    def dimension(self) -> int:
        """Embedding dimension"""
        ...

class UnifiedEmbeddingService:
    """
    Unified embedding service.
    
    Features:
    - Model selection (MiniLM, MPNet, custom)
    - Auto device detection (CUDA/MPS/CPU)
    - Batch processing with progress
    - Caching layer
    """
    
    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        device: Optional[str] = None,
        batch_size: int = 32,
        cache_enabled: bool = True,
    ):
        self.model = self._load_model(model_name, device)
        self.batch_size = batch_size
        self.cache = {} if cache_enabled else None
    
    def embed(self, text: str) -> np.ndarray:
        """Embed single text"""
        if self.cache and text in self.cache:
            return self.cache[text]
        vector = self.model.encode([text])[0]
        if self.cache:
            self.cache[text] = vector
        return vector
    
    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """Embed batch of texts"""
        return self.model.encode(texts)
    
    async def embed_chunks(self, chunks: List[dict]) -> List[dict]:
        """Embed chunks in-place (compatible with SemanticLadder)"""
        texts = [c["text"] for c in chunks]
        vectors = self.embed_batch(texts)
        for chunk, vec in zip(chunks, vectors):
            chunk["embedding"] = vec.tolist()
        return chunks
```

#### 2.4.2 Migration Tasks
| Task | Source File | Target File | Complexity |
|------|-------------|-------------|------------|
| Port Embedder class | SemanticLadder/embedder.py:15-155 | memory_system/embeddings.py | Medium |
| Add caching layer | New | memory_system/embeddings.py | Low |
| Add model registry | New | memory_system/embeddings.py | Low |
| Update existing callers | memory_system/*.py | Various | Medium |
| Write benchmarks | N/A | tests/benchmark_embeddings.py | Low |

---

### Phase 5: LSP Resolution (Week 5-6)

**Objective:** Integrate symbol resolution with serena bridge

#### 2.5.1 LSP Resolver

```python
# memory_system/lsp/resolver.py

from typing import Optional, Dict, List
from pathlib import Path
import json

class SymbolInfo:
    """Resolved symbol information"""
    name: str
    path: str
    kind: str  # class, function, variable, etc.
    uri: str
    line: Optional[int] = None
    docstring: Optional[str] = None

class LspResolver:
    """
    LSP symbol resolver.
    
    Sources:
    1. Local symbol index (JSON)
    2. serena LSP servers (live)
    3. External code search (fallback)
    """
    
    def __init__(self, index_path: Optional[Path] = None):
        self.index_path = index_path
        self._symbols: Dict[str, SymbolInfo] = {}
        self._serena_client = None
        
        if index_path and index_path.exists():
            self._load_index(index_path)
    
    def resolve(self, name: str) -> Optional[SymbolInfo]:
        """Resolve symbol by name (case-insensitive fuzzy match)"""
        # 1. Try exact match
        if name in self._symbols:
            return self._symbols[name]
        
        # 2. Try fuzzy match
        name_lower = name.lower()
        for sym_name, sym in self._symbols.items():
            if name_lower in sym_name.lower():
                return sym
        
        # 3. Try serena (live LSP)
        if self._serena_client:
            return self._serena_client.resolve(name)
        
        return None
    
    def index_workspace(self, workspace_path: Path, languages: List[str] = None):
        """Index workspace using serena LSP"""
        # Integration with serena for live indexing
        pass
```

#### 2.5.2 Migration Tasks
| Task | Source File | Target File | Complexity |
|------|-------------|-------------|------------|
| Port LspResolver | SkyPrompt/lsp_resolver.py | lsp/resolver.py | Low |
| Create serena adapter | serena integration | lsp/adapters/serena_adapter.py | High |
| Add workspace indexing | New | lsp/index.py | Medium |
| Write tests | N/A | tests/lsp/test_resolver.py | Medium |

---

### Phase 6: Information Theory Analysis (Week 6-7)

**Objective:** Port Shannon evaluator for knowledge graph quality analysis

#### 2.6.1 Shannon Analyzer

```python
# memory_system/analysis/shannon.py

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from collections import Counter
import math

@dataclass
class AnalysisObservation:
    """Observation from analysis"""
    type: str  # STRUCTURAL, GAP, OPPORTUNITY, META_COGNITIVE
    title: str
    description: str
    evidence: List[str]
    confidence: float
    impact: str
    metadata: Dict[str, Any]

@dataclass
class ShannonAnalysisResult:
    """Complete analysis result"""
    summary: str
    observations: List[AnalysisObservation]
    metrics: Dict[str, float]
    recommendations: List[str]

class ShannonAnalyzer:
    """
    Information-theoretic analysis of knowledge graphs.
    
    Metrics:
    - Redundancy detection
    - Information density
    - Signal-to-noise ratio
    - Entropy distribution
    - Compression opportunities
    """
    
    def __init__(
        self,
        redundancy_threshold: int = 3,
        min_information_threshold: int = 2,
    ):
        self.redundancy_threshold = redundancy_threshold
        self.min_information_threshold = min_information_threshold
    
    def analyze(self, graph_store) -> ShannonAnalysisResult:
        """Run full analysis on graph store"""
        observations = []
        
        # 1. Redundancy analysis
        redundancy = self._analyze_redundancy(graph_store)
        if redundancy:
            observations.append(redundancy)
        
        # 2. Information density
        density = self._analyze_density(graph_store)
        if density:
            observations.append(density)
        
        # 3. Entropy
        entropy = self._analyze_entropy(graph_store)
        if entropy:
            observations.append(entropy)
        
        # 4. Compression opportunities
        compression = self._find_compression_opportunities(graph_store)
        if compression:
            observations.append(compression)
        
        return ShannonAnalysisResult(
            summary=self._generate_summary(observations),
            observations=observations,
            metrics=self._compute_metrics(observations),
            recommendations=self._generate_recommendations(observations),
        )
    
    def _analyze_entropy(self, graph_store) -> Optional[AnalysisObservation]:
        """Calculate Shannon entropy of relationship types"""
        relations = graph_store.get_all_relations()
        if not relations:
            return None
        
        counts = Counter(relations)
        total = len(relations)
        
        entropy = -sum(
            (c / total) * math.log2(c / total)
            for c in counts.values()
        )
        
        max_entropy = math.log2(len(counts)) if len(counts) > 1 else 0
        normalized = entropy / max_entropy if max_entropy > 0 else 0
        
        return AnalysisObservation(
            type="META_COGNITIVE",
            title=f"Entropy: {'High' if normalized > 0.8 else 'Moderate' if normalized > 0.5 else 'Low'}",
            description=f"Normalized entropy: {normalized:.2%}",
            evidence=[f"Shannon entropy: {entropy:.2f} bits"],
            confidence=0.85,
            impact="High entropy = diverse connections; Low = focused but narrow",
            metadata={"entropy": entropy, "normalized": normalized},
        )
```

#### 2.6.2 Migration Tasks
| Task | Source File | Target File | Complexity |
|------|-------------|-------------|------------|
| Port ShannonEvaluator | Ludwig/evaluators/shannon.py | analysis/shannon.py | Medium |
| Adapt to new graph interface | N/A | analysis/shannon.py | Medium |
| Add report generation | Ludwig/evaluators/base.py (partial) | analysis/reports.py | Low |
| Write tests | N/A | tests/analysis/test_shannon.py | Medium |

---

### Phase 7: Content Converters (Week 7)

**Objective:** Port document converters for ingestion pipeline

#### 2.7.1 Converter Base

```python
# memory_system/converters/base.py

from abc import ABC, abstractmethod
from typing import Dict, Any, List

class ContentConverter(ABC):
    """Base class for content converters"""
    
    @property
    @abstractmethod
    def supported_formats(self) -> List[str]:
        """Return list of supported input formats"""
        pass
    
    @abstractmethod
    def convert(self, content: bytes, metadata: Dict[str, Any]) -> str:
        """Convert content to markdown"""
        pass
    
    def can_convert(self, format: str) -> bool:
        """Check if format is supported"""
        return format.lower() in self.supported_formats

class ConverterRegistry:
    """Registry for content converters"""
    
    def __init__(self):
        self._converters: Dict[str, ContentConverter] = {}
    
    def register(self, converter: ContentConverter):
        for fmt in converter.supported_formats:
            self._converters[fmt] = converter
    
    def convert(self, content: bytes, format: str, metadata: Dict = None) -> str:
        if format not in self._converters:
            raise ValueError(f"No converter for format: {format}")
        return self._converters[format].convert(content, metadata or {})
```

#### 2.7.2 Migration Tasks
| Task | Source File | Target File | Complexity |
|------|-------------|-------------|------------|
| Create base class | LibraryLadder/base.py | converters/base.py | Low |
| Port TextToMd | LibraryLadder/text_to_md.py | converters/text_to_md.py | Low |
| Port HtmlToMd | LibraryLadder/html_to_md.py | converters/html_to_md.py | Low |
| Port EpubToMd | LibraryLadder/epub_to_md.py | converters/epub_to_md.py | Low |
| Write tests | N/A | tests/converters/test_converters.py | Low |

---

### Phase 8: MCP Interface (Week 8)

**Objective:** Create MCP server exposing all semantic services

#### 2.8.1 MCP Server Definition

```typescript
// mcp-servers/semantic-processing/src/index.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "chrysalis-semantic",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
    resources: {},
  }
});

// Tool: decompose
server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "decompose",
      description: "Decompose text into semantic triples",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to decompose" },
          strategy: { type: "string", enum: ["auto", "llm", "nlp", "ast"] },
        },
        required: ["text"],
      },
    },
    {
      name: "embed",
      description: "Generate embedding vector for text",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
          model: { type: "string", default: "all-MiniLM-L6-v2" },
        },
        required: ["text"],
      },
    },
    {
      name: "graph_query",
      description: "Query knowledge graph",
      inputSchema: {
        type: "object",
        properties: {
          entity: { type: "string" },
          relation: { type: "string" },
          depth: { type: "number", default: 1 },
        },
        required: ["entity"],
      },
    },
    {
      name: "analyze",
      description: "Run Shannon analysis on graph",
      inputSchema: {
        type: "object",
        properties: {
          metrics: { type: "array", items: { type: "string" } },
        },
      },
    },
    {
      name: "resolve_symbol",
      description: "Resolve code symbol via LSP",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          workspace: { type: "string" },
        },
        required: ["name"],
      },
    },
    {
      name: "convert",
      description: "Convert document to markdown",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "Base64 encoded content" },
          format: { type: "string", enum: ["txt", "html", "epub"] },
        },
        required: ["content", "format"],
      },
    },
  ],
}));

// Tool handlers call into Python services via subprocess/IPC
```

---

## 3. Dependency Requirements

### 3.1 Python Dependencies

```
# requirements.txt additions

# Semantic Decomposition
spacy>=3.7.0
ollama>=0.1.0
tree-sitter>=0.21.0
tree-sitter-languages>=1.10.0

# Graph Storage
networkx>=3.2.0
python-arango>=7.9.0  # Already present

# Embedding
sentence-transformers>=2.2.0
torch>=2.0.0

# Analysis
scipy>=1.11.0  # For statistical functions

# Converters
beautifulsoup4>=4.12.0
ebooklib>=0.18
markdownify>=0.11.0
```

### 3.2 TypeScript Dependencies

```json
// mcp-servers/semantic-processing/package.json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "child_process": "^1.0.0"
  }
}
```

---

## 4. Testing Strategy

### 4.1 Test Categories

| Category | Directory | Coverage Target |
|----------|-----------|-----------------|
| Unit | tests/semantic/ | 90% |
| Unit | tests/graph/ | 85% |
| Unit | tests/analysis/ | 80% |
| Integration | tests/integration/ | 70% |
| E2E | tests/e2e/ | 60% |

### 4.2 Key Test Cases

```python
# tests/semantic/test_decomposer.py

import pytest
from memory_system.semantic import UnifiedDecomposer, SemanticFrame

@pytest.fixture
def decomposer():
    return UnifiedDecomposer()

@pytest.mark.asyncio
async def test_decompose_code_intent(decomposer):
    frame = await decomposer.decompose("fix the login bug in auth.py")
    assert frame.intent.value == "DEBUG"
    assert len(frame.triples) > 0

@pytest.mark.asyncio
async def test_decompose_fallback(decomposer):
    # Should fallback to heuristics when LLM unavailable
    frame = await decomposer.decompose("do something")
    assert frame.confidence < 0.5  # Low confidence fallback
```

---

## 5. Migration Checklist

### Week 1-2: Foundation
- [ ] Create directory structure
- [ ] Define shared models (SemanticFrame, Triple, GraphEntity)
- [ ] Set up pytest fixtures
- [ ] Create base adapter interfaces

### Week 2-3: Decomposition
- [ ] Port Ollama strategy from SkyPrompt
- [ ] Port spaCy strategy from MetaSemantic
- [ ] Create TreeSitter strategy
- [ ] Port confidence calibrator
- [ ] Create UnifiedDecomposer
- [ ] Write unit tests (90% coverage)

### Week 3-4: Graph Storage
- [ ] Port SQLite adapter from Ludwig
- [ ] Create ArangoDB adapter
- [ ] Port NetworkX adapter from SkyPrompt
- [ ] Port YAGO client from Ludwig
- [ ] Create UnifiedGraphStore
- [ ] Write integration tests

### Week 4-5: Embedding
- [ ] Extend embeddings.py with unified interface
- [ ] Add model registry
- [ ] Add caching layer
- [ ] Update existing callers
- [ ] Write benchmarks

### Week 5-6: LSP
- [ ] Port LspResolver from SkyPrompt
- [ ] Create serena adapter
- [ ] Add workspace indexing
- [ ] Write tests

### Week 6-7: Analysis
- [ ] Port ShannonEvaluator from Ludwig
- [ ] Adapt to new graph interface
- [ ] Add report generation
- [ ] Write tests

### Week 7: Converters
- [ ] Port base converter from LibraryLadder
- [ ] Port TextToMd
- [ ] Port HtmlToMd
- [ ] Port EpubToMd
- [ ] Write tests

### Week 8: MCP Interface
- [ ] Create mcp-servers/semantic-processing
- [ ] Implement tool handlers
- [ ] Write integration tests
- [ ] Document API

---

## 6. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Ollama unavailable | Medium | High | Fallback to spaCy/heuristics |
| spaCy model download fail | Low | Medium | Bundle model or cache |
| serena integration complexity | Medium | Medium | Start with static index only |
| ArangoDB schema migration | Low | High | Version migrations carefully |
| Performance regression | Medium | Medium | Benchmark before/after |

---

## 7. Success Criteria

1. **Functional:** All 6 services operational with ≥80% test coverage
2. **Performance:** Decomposition <100ms (cached), embedding <50ms
3. **Integration:** KnowledgeBuilder/SkillBuilder use new services
4. **MCP:** All tools accessible via MCP interface
5. **Documentation:** API docs and migration guides complete

---

## Appendix A: File Mapping

| Source Repository | Source File | Target File |
|-------------------|-------------|-------------|
| SkyPrompt | src/decomposer.py | memory_system/semantic/strategies/ollama_strategy.py |
| SkyPrompt | src/confidence_calibrator.py | memory_system/semantic/confidence.py |
| SkyPrompt | src/graph_store.py | memory_system/graph/adapters/networkx_adapter.py |
| SkyPrompt | src/lsp_resolver.py | memory_system/lsp/resolver.py |
| MetaSemantic | backend/prompt_decomposer.py | memory_system/semantic/strategies/spacy_strategy.py |
| Ludwig | src/ludwig/graph/storage.py | memory_system/graph/adapters/sqlite_adapter.py |
| Ludwig | src/ludwig/external/yago_client.py | memory_system/graph/external/yago_client.py |
| Ludwig | src/ludwig/evaluators/shannon.py | memory_system/analysis/shannon.py |
| SemanticLadder | src/ingestion/embedder.py | memory_system/embeddings.py (merge) |
| LibraryLadder | src/library_ladder/converters/*.py | memory_system/converters/*.py |
