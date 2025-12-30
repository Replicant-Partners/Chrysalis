"""
Uniform Semantic Agent - Core Types v2.0
Enhanced with comprehensive memory architecture support
"""
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any, Union
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================

class ProtocolType(str, Enum):
    """Supported protocol types"""
    MCP = "mcp"
    NATIVE = "native"
    API = "api"


class MCPRole(str, Enum):
    """MCP protocol roles"""
    CLIENT = "client"
    SERVER = "server"
    BOTH = "both"


class ReasoningStrategy(str, Enum):
    """Reasoning strategies"""
    CHAIN_OF_THOUGHT = "chain_of_thought"
    REACT = "react"
    REFLEXION = "reflexion"
    TREE_OF_THOUGHTS = "tree_of_thoughts"


# ============================================================================
# MEMORY ENUMS (New in v2.0)
# ============================================================================

class MemoryArchitecture(str, Enum):
    """Memory architecture patterns"""
    HIERARCHICAL = "hierarchical"  # MemGPT/Letta style
    STRUCTURED = "structured"      # MIRIX style
    DUAL_AGENT = "dual_agent"      # GAM style
    FLAT = "flat"                  # Simple RAG
    CUSTOM = "custom"


class MemoryStorageType(str, Enum):
    """Storage backend types"""
    VECTOR_DB = "vector_db"
    GRAPH_DB = "graph_db"
    RELATIONAL_DB = "relational_db"
    DOCUMENT_STORE = "document_store"
    IN_MEMORY = "in_memory"
    HYBRID = "hybrid"


class RetrievalStrategy(str, Enum):
    """Memory retrieval strategies"""
    PASSIVE_RAG = "passive_rag"           # Traditional RAG
    AGENTIC_RAG = "agentic_rag"           # Agent-controlled
    HYBRID_SEARCH = "hybrid_search"        # Vector + keyword
    SEMANTIC_ONLY = "semantic_only"        # Vector similarity
    TEMPORAL_AWARE = "temporal_aware"      # Time-based
    GRAPH_TRAVERSAL = "graph_traversal"    # Relationship-based


class ConsolidationStrategy(str, Enum):
    """Memory consolidation strategies"""
    NONE = "none"
    PERIODIC = "periodic"
    SLEEP_TIME = "sleep_time"  # Async during idle
    THRESHOLD_BASED = "threshold_based"
    CONTINUOUS = "continuous"


class ForgettingStrategy(str, Enum):
    """Memory forgetting/pruning strategies"""
    NONE = "none"
    FIFO = "fifo"                     # First in, first out
    LRU = "lru"                       # Least recently used
    UTILITY_BASED = "utility_based"   # RIF (Recency+Relevance+Frequency)
    EBBINGHAUS = "ebbinghaus"         # Forgetting curve
    THRESHOLD = "threshold"            # Score-based


# ============================================================================
# BASIC TYPES (Unchanged from v1)
# ============================================================================

@dataclass
class Metadata:
    """Agent metadata"""
    name: str
    version: str
    description: Optional[str] = None
    author: Optional[str] = None
    license: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Metadata':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        result = {
            "name": self.name,
            "version": self.version,
        }
        if self.description:
            result["description"] = self.description
        if self.author:
            result["author"] = self.author
        if self.license:
            result["license"] = self.license
        if self.tags:
            result["tags"] = self.tags
        return result


@dataclass
class Identity:
    """Agent identity and persona"""
    role: str
    goal: str
    backstory: Optional[str] = None
    personality_traits: Dict[str, Any] = field(default_factory=dict)
    constraints: List[str] = field(default_factory=list)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Identity':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        result = {
            "role": self.role,
            "goal": self.goal,
        }
        if self.backstory:
            result["backstory"] = self.backstory
        if self.personality_traits:
            result["personality_traits"] = self.personality_traits
        if self.constraints:
            result["constraints"] = self.constraints
        return result


@dataclass
class Tool:
    """Tool specification"""
    name: str
    protocol: ProtocolType
    config: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Tool':
        return cls(
            name=data['name'],
            protocol=ProtocolType(data['protocol']),
            config=data.get('config', {})
        )
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "protocol": self.protocol.value,
            "config": self.config
        }


@dataclass
class Skill:
    """Skill specification"""
    name: str
    type: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Skill':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.type,
            "parameters": self.parameters
        }


@dataclass
class Reasoning:
    """Reasoning configuration"""
    strategy: ReasoningStrategy
    max_iterations: int = 20
    allow_backtracking: bool = True
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Reasoning':
        return cls(
            strategy=ReasoningStrategy(data['strategy']),
            max_iterations=data.get('max_iterations', 20),
            allow_backtracking=data.get('allow_backtracking', True)
        )
    
    def to_dict(self) -> dict:
        return {
            "strategy": self.strategy.value,
            "max_iterations": self.max_iterations,
            "allow_backtracking": self.allow_backtracking
        }


# ============================================================================
# MEMORY TYPES (New in v2.0)
# ============================================================================

@dataclass
class WorkingMemoryConfig:
    """Working memory (short-term) configuration"""
    enabled: bool = True
    max_tokens: int = 8192
    buffer_type: str = "rolling"  # rolling, sliding, fixed
    
    @classmethod
    def from_dict(cls, data: dict) -> 'WorkingMemoryConfig':
        if isinstance(data, bool):
            return cls(enabled=data)
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "max_tokens": self.max_tokens,
            "buffer_type": self.buffer_type
        }


@dataclass
class EpisodicMemoryConfig:
    """Episodic memory (experiences) configuration"""
    enabled: bool = True
    storage: str = "vector_db"  # vector_db, hybrid, structured
    retention_days: Optional[int] = None  # None = unlimited
    temporal_indexing: bool = True
    metadata_fields: List[str] = field(default_factory=lambda: ["timestamp", "actor", "event_type"])
    
    @classmethod
    def from_dict(cls, data: dict) -> 'EpisodicMemoryConfig':
        if isinstance(data, bool):
            return cls(enabled=data)
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "storage": self.storage,
            "retention_days": self.retention_days,
            "temporal_indexing": self.temporal_indexing,
            "metadata_fields": self.metadata_fields
        }


@dataclass
class RAGConfig:
    """RAG (Retrieval-Augmented Generation) configuration"""
    enabled: bool = True
    top_k: int = 5
    min_relevance: float = 0.7
    reranking: bool = False
    
    @classmethod
    def from_dict(cls, data: dict) -> 'RAGConfig':
        if isinstance(data, bool):
            return cls(enabled=data)
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "top_k": self.top_k,
            "min_relevance": self.min_relevance,
            "reranking": self.reranking
        }


@dataclass
class SemanticMemoryConfig:
    """Semantic memory (knowledge) configuration"""
    enabled: bool = True
    storage: str = "hybrid"  # vector_db, graph_db, hybrid
    rag: Optional[RAGConfig] = None
    knowledge_graph: bool = False
    
    @classmethod
    def from_dict(cls, data: dict) -> 'SemanticMemoryConfig':
        if isinstance(data, bool):
            return cls(enabled=data)
        
        rag = None
        if 'rag' in data:
            rag = RAGConfig.from_dict(data['rag'])
        
        return cls(
            enabled=data.get('enabled', True),
            storage=data.get('storage', 'hybrid'),
            rag=rag,
            knowledge_graph=data.get('knowledge_graph', False)
        )
    
    def to_dict(self) -> dict:
        result = {
            "enabled": self.enabled,
            "storage": self.storage,
            "knowledge_graph": self.knowledge_graph
        }
        if self.rag:
            result["rag"] = self.rag.to_dict()
        return result


@dataclass
class ProceduralMemoryConfig:
    """Procedural memory (skills/procedures) configuration"""
    enabled: bool = True
    storage: str = "structured"  # structured, vector_db, code
    format: str = "pydantic"  # pydantic, json_schema, pddl, code
    versioning: bool = True
    
    @classmethod
    def from_dict(cls, data: dict) -> 'ProceduralMemoryConfig':
        if isinstance(data, bool):
            return cls(enabled=data)
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "storage": self.storage,
            "format": self.format,
            "versioning": self.versioning
        }


@dataclass
class CoreMemoryBlock:
    """Core memory block configuration"""
    name: str
    content: str
    editable: bool = True
    
    @classmethod
    def from_dict(cls, data: dict) -> 'CoreMemoryBlock':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "content": self.content,
            "editable": self.editable
        }


@dataclass
class CoreMemoryConfig:
    """Core memory (persistent context) configuration"""
    enabled: bool = True
    blocks: List[CoreMemoryBlock] = field(default_factory=list)
    self_editing: bool = True  # Agent can modify its own core memory
    
    @classmethod
    def from_dict(cls, data: dict) -> 'CoreMemoryConfig':
        if isinstance(data, bool):
            return cls(enabled=data)
        
        blocks = []
        if 'blocks' in data:
            if isinstance(data['blocks'], list):
                blocks = [CoreMemoryBlock.from_dict(b) if isinstance(b, dict) else b 
                         for b in data['blocks']]
            elif isinstance(data['blocks'], dict):
                # Handle dict format: {persona: "...", user_facts: "..."}
                blocks = [CoreMemoryBlock(name=k, content=v, editable=True) 
                         for k, v in data['blocks'].items()]
        
        return cls(
            enabled=data.get('enabled', True),
            blocks=blocks,
            self_editing=data.get('self_editing', True)
        )
    
    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "blocks": [b.to_dict() for b in self.blocks],
            "self_editing": self.self_editing
        }


@dataclass
class EmbeddingsConfig:
    """Embeddings model configuration"""
    model: str = "openai/text-embedding-3-small"
    dimensions: int = 1536
    batch_size: int = 100
    provider: Optional[str] = None
    
    @classmethod
    def from_dict(cls, data: dict) -> 'EmbeddingsConfig':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        result = {
            "model": self.model,
            "dimensions": self.dimensions,
            "batch_size": self.batch_size
        }
        if self.provider:
            result["provider"] = self.provider
        return result


@dataclass
class VectorDBConfig:
    """Vector database configuration"""
    provider: str  # faiss, pinecone, weaviate, chroma, qdrant, pgvector
    collection: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'VectorDBConfig':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        result = {"provider": self.provider}
        if self.collection:
            result["collection"] = self.collection
        if self.config:
            result["config"] = self.config
        return result


@dataclass
class GraphDBConfig:
    """Graph database configuration"""
    provider: str  # neo4j, neptune, knowledge_graph
    database: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'GraphDBConfig':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        result = {"provider": self.provider}
        if self.database:
            result["database"] = self.database
        if self.config:
            result["config"] = self.config
        return result


@dataclass
class StorageConfig:
    """Storage backend configuration"""
    primary: str  # Primary storage type
    vector_db: Optional[VectorDBConfig] = None
    graph_db: Optional[GraphDBConfig] = None
    cache: Optional[str] = None  # redis, valkey, memcached
    backup: Optional[str] = None
    
    @classmethod
    def from_dict(cls, data: dict) -> 'StorageConfig':
        vector_db = None
        if 'vector_db' in data:
            vector_db = VectorDBConfig.from_dict(data['vector_db'])
        
        graph_db = None
        if 'graph_db' in data:
            graph_db = GraphDBConfig.from_dict(data['graph_db'])
        
        return cls(
            primary=data['primary'],
            vector_db=vector_db,
            graph_db=graph_db,
            cache=data.get('cache'),
            backup=data.get('backup')
        )
    
    def to_dict(self) -> dict:
        result = {"primary": self.primary}
        if self.vector_db:
            result["vector_db"] = self.vector_db.to_dict()
        if self.graph_db:
            result["graph_db"] = self.graph_db.to_dict()
        if self.cache:
            result["cache"] = self.cache
        if self.backup:
            result["backup"] = self.backup
        return result


@dataclass
class RetrievalConfig:
    """Memory retrieval configuration"""
    strategy: RetrievalStrategy = RetrievalStrategy.AGENTIC_RAG
    hybrid_search: bool = True
    reranking: bool = False
    max_results: int = 10
    
    @classmethod
    def from_dict(cls, data: dict) -> 'RetrievalConfig':
        if isinstance(data, str):
            return cls(strategy=RetrievalStrategy(data))
        
        strategy = RetrievalStrategy(data.get('strategy', 'agentic_rag'))
        return cls(
            strategy=strategy,
            hybrid_search=data.get('hybrid_search', True),
            reranking=data.get('reranking', False),
            max_results=data.get('max_results', 10)
        )
    
    def to_dict(self) -> dict:
        return {
            "strategy": self.strategy.value,
            "hybrid_search": self.hybrid_search,
            "reranking": self.reranking,
            "max_results": self.max_results
        }


@dataclass
class ConsolidationConfig:
    """Memory consolidation configuration"""
    strategy: ConsolidationStrategy = ConsolidationStrategy.PERIODIC
    frequency: Optional[str] = "daily"  # hourly, daily, weekly
    async_processing: bool = True
    
    @classmethod
    def from_dict(cls, data: dict) -> 'ConsolidationConfig':
        if isinstance(data, str):
            return cls(strategy=ConsolidationStrategy(data))
        
        strategy = ConsolidationStrategy(data.get('strategy', 'periodic'))
        return cls(
            strategy=strategy,
            frequency=data.get('frequency', 'daily'),
            async_processing=data.get('async_processing', True)
        )
    
    def to_dict(self) -> dict:
        return {
            "strategy": self.strategy.value,
            "frequency": self.frequency,
            "async_processing": self.async_processing
        }


@dataclass
class ForgettingConfig:
    """Memory forgetting/pruning configuration"""
    enabled: bool = False
    strategy: ForgettingStrategy = ForgettingStrategy.UTILITY_BASED
    threshold: float = 0.3
    parameters: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'ForgettingConfig':
        if isinstance(data, bool):
            return cls(enabled=data)
        
        strategy = ForgettingStrategy(data.get('strategy', 'utility_based'))
        return cls(
            enabled=data.get('enabled', False),
            strategy=strategy,
            threshold=data.get('threshold', 0.3),
            parameters=data.get('parameters', {})
        )
    
    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "strategy": self.strategy.value,
            "threshold": self.threshold,
            "parameters": self.parameters
        }


@dataclass
class MemoryOperations:
    """Memory operations configuration"""
    retrieval: RetrievalConfig = field(default_factory=RetrievalConfig)
    consolidation: ConsolidationConfig = field(default_factory=ConsolidationConfig)
    forgetting: ForgettingConfig = field(default_factory=ForgettingConfig)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'MemoryOperations':
        retrieval = RetrievalConfig.from_dict(data.get('retrieval', {}))
        consolidation = ConsolidationConfig.from_dict(data.get('consolidation', {}))
        forgetting = ForgettingConfig.from_dict(data.get('forgetting', {}))
        
        return cls(
            retrieval=retrieval,
            consolidation=consolidation,
            forgetting=forgetting
        )
    
    def to_dict(self) -> dict:
        return {
            "retrieval": self.retrieval.to_dict(),
            "consolidation": self.consolidation.to_dict(),
            "forgetting": self.forgetting.to_dict()
        }


@dataclass
class MemorySystem:
    """Complete memory system configuration (New in v2.0)"""
    architecture: MemoryArchitecture = MemoryArchitecture.HIERARCHICAL
    
    # Memory types
    working: Optional[WorkingMemoryConfig] = None
    episodic: Optional[EpisodicMemoryConfig] = None
    semantic: Optional[SemanticMemoryConfig] = None
    procedural: Optional[ProceduralMemoryConfig] = None
    core: Optional[CoreMemoryConfig] = None
    
    # Infrastructure
    embeddings: Optional[EmbeddingsConfig] = None
    storage: Optional[StorageConfig] = None
    operations: Optional[MemoryOperations] = None
    
    @classmethod
    def from_dict(cls, data: dict) -> 'MemorySystem':
        architecture = MemoryArchitecture(data.get('architecture', 'hierarchical'))
        
        # Parse memory types
        working = None
        if 'working' in data:
            working = WorkingMemoryConfig.from_dict(data['working'])
        
        episodic = None
        if 'episodic' in data:
            episodic = EpisodicMemoryConfig.from_dict(data['episodic'])
        
        semantic = None
        if 'semantic' in data:
            semantic = SemanticMemoryConfig.from_dict(data['semantic'])
        
        procedural = None
        if 'procedural' in data:
            procedural = ProceduralMemoryConfig.from_dict(data['procedural'])
        
        core = None
        if 'core' in data:
            core = CoreMemoryConfig.from_dict(data['core'])
        
        # Parse infrastructure
        embeddings = None
        if 'embeddings' in data:
            embeddings = EmbeddingsConfig.from_dict(data['embeddings'])
        
        storage = None
        if 'storage' in data:
            storage = StorageConfig.from_dict(data['storage'])
        
        operations = None
        if 'operations' in data:
            operations = MemoryOperations.from_dict(data['operations'])
        
        return cls(
            architecture=architecture,
            working=working,
            episodic=episodic,
            semantic=semantic,
            procedural=procedural,
            core=core,
            embeddings=embeddings,
            storage=storage,
            operations=operations
        )
    
    def to_dict(self) -> dict:
        result = {
            "architecture": self.architecture.value
        }
        
        if self.working:
            result["working"] = self.working.to_dict()
        if self.episodic:
            result["episodic"] = self.episodic.to_dict()
        if self.semantic:
            result["semantic"] = self.semantic.to_dict()
        if self.procedural:
            result["procedural"] = self.procedural.to_dict()
        if self.core:
            result["core"] = self.core.to_dict()
        if self.embeddings:
            result["embeddings"] = self.embeddings.to_dict()
        if self.storage:
            result["storage"] = self.storage.to_dict()
        if self.operations:
            result["operations"] = self.operations.to_dict()
        
        return result


# ============================================================================
# CAPABILITIES (Updated in v2.0)
# ============================================================================

@dataclass
class Capabilities:
    """Agent capabilities (Updated with memory system)"""
    tools: List[Tool] = field(default_factory=list)
    skills: List[Skill] = field(default_factory=list)
    reasoning: Optional[Reasoning] = None
    memory: Optional[MemorySystem] = None  # Now uses MemorySystem instead of simple Memory
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Capabilities':
        tools = [Tool.from_dict(t) for t in data.get('tools', [])]
        skills = [Skill.from_dict(s) for s in data.get('skills', [])]
        reasoning = Reasoning.from_dict(data['reasoning']) if data.get('reasoning') else None
        memory = MemorySystem.from_dict(data['memory']) if data.get('memory') else None
        
        return cls(
            tools=tools,
            skills=skills,
            reasoning=reasoning,
            memory=memory
        )
    
    def to_dict(self) -> dict:
        result = {
            "tools": [t.to_dict() for t in self.tools],
            "skills": [s.to_dict() for s in self.skills],
        }
        if self.reasoning:
            result["reasoning"] = self.reasoning.to_dict()
        if self.memory:
            result["memory"] = self.memory.to_dict()
        return result


# ============================================================================
# PROTOCOLS (Unchanged from v1)
# ============================================================================

@dataclass
class MCPServer:
    """MCP server configuration"""
    name: str
    command: str
    args: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'MCPServer':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "command": self.command,
            "args": self.args,
            "env": self.env
        }


@dataclass
class MCPProtocol:
    """MCP protocol configuration"""
    enabled: bool
    role: MCPRole
    servers: List[MCPServer] = field(default_factory=list)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'MCPProtocol':
        role = MCPRole(data['role'])
        servers = [MCPServer.from_dict(s) for s in data.get('servers', [])]
        return cls(
            enabled=data['enabled'],
            role=role,
            servers=servers
        )
    
    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "role": self.role.value,
            "servers": [s.to_dict() for s in self.servers]
        }


@dataclass
class Authentication:
    """Authentication configuration"""
    type: str
    config: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Authentication':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "config": self.config
        }


@dataclass
class A2AProtocol:
    """A2A protocol configuration"""
    enabled: bool
    role: str = "server"
    endpoint: Optional[str] = None
    authentication: Optional[Authentication] = None
    
    @classmethod
    def from_dict(cls, data: dict) -> 'A2AProtocol':
        if isinstance(data, bool):
            return cls(enabled=data)
        
        auth = Authentication.from_dict(data['authentication']) if data.get('authentication') else None
        return cls(
            enabled=data.get('enabled', False),
            role=data.get('role', 'server'),
            endpoint=data.get('endpoint'),
            authentication=auth
        )
    
    def to_dict(self) -> dict:
        result = {
            "enabled": self.enabled,
            "role": self.role,
        }
        if self.endpoint:
            result["endpoint"] = self.endpoint
        if self.authentication:
            result["authentication"] = self.authentication.to_dict()
        return result


@dataclass
class AgentProtocolConfig:
    """Agent Protocol configuration"""
    enabled: bool
    endpoint: str = "/ap/v1"
    
    @classmethod
    def from_dict(cls, data: dict) -> 'AgentProtocolConfig':
        if isinstance(data, bool):
            return cls(enabled=data)
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "endpoint": self.endpoint
        }


@dataclass
class Protocols:
    """Protocol configurations"""
    mcp: Optional[MCPProtocol] = None
    a2a: Optional[A2AProtocol] = None
    agent_protocol: Optional[AgentProtocolConfig] = None
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Protocols':
        mcp = MCPProtocol.from_dict(data['mcp']) if data.get('mcp') else None
        a2a = A2AProtocol.from_dict(data['a2a']) if data.get('a2a') is not None else None
        
        agent_protocol = None
        if data.get('agent_protocol') is not None:
            agent_protocol = AgentProtocolConfig.from_dict(data['agent_protocol'])
        
        return cls(mcp=mcp, a2a=a2a, agent_protocol=agent_protocol)
    
    def to_dict(self) -> dict:
        result = {}
        if self.mcp:
            result["mcp"] = self.mcp.to_dict()
        if self.a2a:
            result["a2a"] = self.a2a.to_dict()
        if self.agent_protocol:
            result["agent_protocol"] = self.agent_protocol.to_dict()
        return result


# ============================================================================
# EXECUTION (Unchanged from v1)
# ============================================================================

@dataclass
class LLMConfig:
    """LLM configuration"""
    provider: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 4096
    parameters: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'LLMConfig':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "parameters": self.parameters
        }


@dataclass
class RetryPolicy:
    """Retry policy configuration"""
    max_attempts: int = 3
    backoff: str = "exponential"
    initial_delay: int = 1
    
    @classmethod
    def from_dict(cls, data: dict) -> 'RetryPolicy':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "max_attempts": self.max_attempts,
            "backoff": self.backoff,
            "initial_delay": self.initial_delay
        }


@dataclass
class Runtime:
    """Runtime configuration"""
    timeout: int = 300
    max_iterations: int = 20
    retry_policy: Optional[RetryPolicy] = None
    error_handling: str = "graceful_degradation"
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Runtime':
        retry_policy = RetryPolicy.from_dict(data['retry_policy']) if data.get('retry_policy') else None
        return cls(
            timeout=data.get('timeout', 300),
            max_iterations=data.get('max_iterations', 20),
            retry_policy=retry_policy,
            error_handling=data.get('error_handling', 'graceful_degradation')
        )
    
    def to_dict(self) -> dict:
        result = {
            "timeout": self.timeout,
            "max_iterations": self.max_iterations,
            "error_handling": self.error_handling
        }
        if self.retry_policy:
            result["retry_policy"] = self.retry_policy.to_dict()
        return result


@dataclass
class Execution:
    """Execution configuration"""
    llm: LLMConfig
    runtime: Runtime
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Execution':
        llm = LLMConfig.from_dict(data['llm'])
        runtime = Runtime.from_dict(data['runtime'])
        return cls(llm=llm, runtime=runtime)
    
    def to_dict(self) -> dict:
        return {
            "llm": self.llm.to_dict(),
            "runtime": self.runtime.to_dict()
        }


# ============================================================================
# DEPLOYMENT (Unchanged from v1)
# ============================================================================

@dataclass
class Scaling:
    """Scaling configuration"""
    min_instances: int = 1
    max_instances: int = 10
    target_cpu: int = 70
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Scaling':
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def to_dict(self) -> dict:
        return {
            "min_instances": self.min_instances,
            "max_instances": self.max_instances,
            "target_cpu": self.target_cpu
        }


@dataclass
class Deployment:
    """Deployment configuration"""
    context: str
    environment: Dict[str, Any] = field(default_factory=dict)
    scaling: Optional[Scaling] = None
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Deployment':
        scaling = Scaling.from_dict(data['scaling']) if data.get('scaling') else None
        return cls(
            context=data['context'],
            environment=data.get('environment', {}),
            scaling=scaling
        )
    
    def to_dict(self) -> dict:
        result = {
            "context": self.context,
            "environment": self.environment
        }
        if self.scaling:
            result["scaling"] = self.scaling.to_dict()
        return result


# ============================================================================
# AGENT SPEC (Updated in v2.0)
# ============================================================================

@dataclass
class AgentSpec:
    """Uniform Semantic Agent v2.0"""
    api_version: str
    kind: str
    metadata: Metadata
    identity: Identity
    capabilities: Capabilities
    protocols: Protocols
    execution: Execution
    deployment: Deployment
    
    @classmethod
    def from_dict(cls, data: dict) -> 'AgentSpec':
        """Create AgentSpec from dictionary"""
        return cls(
            api_version=data.get('apiVersion', 'usa/v2'),
            kind=data.get('kind', 'Agent'),
            metadata=Metadata.from_dict(data['metadata']),
            identity=Identity.from_dict(data['identity']),
            capabilities=Capabilities.from_dict(data['capabilities']),
            protocols=Protocols.from_dict(data['protocols']),
            execution=Execution.from_dict(data['execution']),
            deployment=Deployment.from_dict(data['deployment'])
        )
    
    def to_dict(self) -> dict:
        """Convert AgentSpec to dictionary"""
        return {
            "apiVersion": self.api_version,
            "kind": self.kind,
            "metadata": self.metadata.to_dict(),
            "identity": self.identity.to_dict(),
            "capabilities": self.capabilities.to_dict(),
            "protocols": self.protocols.to_dict(),
            "execution": self.execution.to_dict(),
            "deployment": self.deployment.to_dict()
        }
    
    def validate(self) -> bool:
        """Validate the specification"""
        if not self.metadata.name:
            raise ValueError("Agent name is required")
        
        if not self.metadata.version:
            raise ValueError("Agent version is required")
        
        if not self.identity.role:
            raise ValueError("Agent role is required")
        
        if not self.identity.goal:
            raise ValueError("Agent goal is required")
        
        # Memory validation
        if self.capabilities.memory:
            memory = self.capabilities.memory
            
            # If embeddings are used, validate configuration
            if memory.embeddings and not memory.embeddings.model:
                raise ValueError("Embedding model is required when embeddings are configured")
            
            # If vector storage is used, validate configuration
            if memory.storage and memory.storage.vector_db:
                if not memory.storage.vector_db.provider:
                    raise ValueError("Vector DB provider is required")
        
        return True
