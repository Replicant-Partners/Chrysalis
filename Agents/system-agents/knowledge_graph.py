"""
Knowledge Graph Loader for Complex Learner Agent Configuration.

Parses YAML-based knowledge graph schemas and integrates them into
the Chrysalis reasoning engine for system agent decision-making.

Architecture:
    YAML Config → KnowledgeGraphLoader → ReasoningEngine → SystemAgents
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Callable
import json

logger = logging.getLogger(__name__)

# YAML support with fallback
try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False
    logger.warning("PyYAML not available, YAML config loading disabled")


@dataclass
class KnowledgeNode:
    """A node in the knowledge graph."""
    id: str
    label: str
    node_type: str
    description: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "type": self.node_type,
            "description": self.description,
            "metadata": self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnowledgeNode":
        return cls(
            id=data["id"],
            label=data.get("label", data["id"]),
            node_type=data.get("type", "unknown"),
            description=data.get("description", ""),
            metadata={k: v for k, v in data.items() 
                     if k not in ("id", "label", "type", "description")},
        )


@dataclass
class KnowledgeEdge:
    """An edge connecting nodes in the knowledge graph."""
    from_node: str
    to_node: str
    relation: str
    weight: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "from": self.from_node,
            "to": self.to_node,
            "relation": self.relation,
            "weight": self.weight,
            "metadata": self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnowledgeEdge":
        return cls(
            from_node=data["from"],
            to_node=data["to"],
            relation=data.get("relation", "related_to"),
            weight=data.get("weight", 1.0),
            metadata={k: v for k, v in data.items() 
                     if k not in ("from", "to", "relation", "weight")},
        )


class KnowledgeGraphValidationError(Exception):
    """Raised when knowledge graph validation fails."""
    pass


@dataclass
class KnowledgeGraph:
    """
    A knowledge graph representing agent reasoning patterns.
    
    Supports:
    - Node types: agent, principle, framework, priority, scope, domain,
                  deliverable, workflow_stage, method, rigor, collaboration, reporting
    - Edge relations: embodies, anchored_in, prioritizes, balances, operates_in,
                     focuses_on, produces, sequences, precedes, employs, guides,
                     constrained_by, requires, favors, communicates_with, aims_for,
                     communicates_through, includes
    """
    
    name: str
    source: Optional[str] = None
    nodes: Dict[str, KnowledgeNode] = field(default_factory=dict)
    edges: List[KnowledgeEdge] = field(default_factory=list)
    
    # Valid node types for validation
    VALID_NODE_TYPES: Set[str] = field(default_factory=lambda: {
        "agent", "principle", "framework", "priority", "scope", "domain",
        "deliverable", "workflow_stage", "method", "rigor", "collaboration", "reporting"
    })
    
    # Valid edge relations for validation
    VALID_RELATIONS: Set[str] = field(default_factory=lambda: {
        "embodies", "anchored_in", "prioritizes", "balances", "operates_in",
        "focuses_on", "produces", "sequences", "precedes", "employs", "guides",
        "constrained_by", "requires", "favors", "communicates_with", "aims_for",
        "communicates_through", "includes", "related_to"
    })
    
    def add_node(self, node: KnowledgeNode) -> None:
        """Add a node to the graph."""
        self.nodes[node.id] = node
    
    def add_edge(self, edge: KnowledgeEdge) -> None:
        """Add an edge to the graph."""
        self.edges.append(edge)
    
    def get_node(self, node_id: str) -> Optional[KnowledgeNode]:
        """Get a node by ID."""
        return self.nodes.get(node_id)
    
    def get_nodes_by_type(self, node_type: str) -> List[KnowledgeNode]:
        """Get all nodes of a specific type."""
        return [n for n in self.nodes.values() if n.node_type == node_type]
    
    def get_edges_from(self, node_id: str) -> List[KnowledgeEdge]:
        """Get all edges originating from a node."""
        return [e for e in self.edges if e.from_node == node_id]
    
    def get_edges_to(self, node_id: str) -> List[KnowledgeEdge]:
        """Get all edges pointing to a node."""
        return [e for e in self.edges if e.to_node == node_id]
    
    def get_related_nodes(self, node_id: str, relation: Optional[str] = None) -> List[KnowledgeNode]:
        """Get nodes related to the given node, optionally filtered by relation."""
        related_ids = set()
        for edge in self.edges:
            if edge.from_node == node_id:
                if relation is None or edge.relation == relation:
                    related_ids.add(edge.to_node)
            elif edge.to_node == node_id:
                if relation is None or edge.relation == relation:
                    related_ids.add(edge.from_node)
        return [self.nodes[nid] for nid in related_ids if nid in self.nodes]
    
    def get_workflow_sequence(self) -> List[KnowledgeNode]:
        """Get workflow stages in order based on 'precedes' relations."""
        workflow_nodes = self.get_nodes_by_type("workflow_stage")
        if not workflow_nodes:
            return []
        
        # Build precedence map
        precedes = {}
        for edge in self.edges:
            if edge.relation == "precedes":
                precedes[edge.from_node] = edge.to_node
        
        # Find the start (node with no predecessor)
        all_targets = set(precedes.values())
        starts = [n for n in workflow_nodes if n.id not in all_targets]
        
        if not starts:
            return workflow_nodes  # No clear order, return as-is
        
        # Build sequence
        sequence = []
        current = starts[0].id
        visited = set()
        while current and current not in visited:
            visited.add(current)
            if current in self.nodes:
                sequence.append(self.nodes[current])
            current = precedes.get(current)
        
        return sequence
    
    def validate(self) -> List[str]:
        """
        Validate the knowledge graph structure.
        
        Returns list of validation errors (empty if valid).
        """
        errors = []
        
        # Check for orphan edges
        node_ids = set(self.nodes.keys())
        for i, edge in enumerate(self.edges):
            if edge.from_node not in node_ids:
                errors.append(f"Edge {i}: from_node '{edge.from_node}' not found in nodes")
            if edge.to_node not in node_ids:
                errors.append(f"Edge {i}: to_node '{edge.to_node}' not found in nodes")
        
        # Warn about unknown node types (but don't fail)
        for node in self.nodes.values():
            if node.node_type not in self.VALID_NODE_TYPES:
                logger.warning(f"Unknown node type '{node.node_type}' for node '{node.id}'")
        
        # Warn about unknown relations (but don't fail)
        for edge in self.edges:
            if edge.relation not in self.VALID_RELATIONS:
                logger.warning(f"Unknown relation '{edge.relation}' in edge {edge.from_node} -> {edge.to_node}")
        
        return errors
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "name": self.name,
            "source": self.source,
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "edges": [e.to_dict() for e in self.edges],
        }
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=2)


class KnowledgeGraphLoader:
    """
    Loads and validates knowledge graph configurations from YAML files.
    
    Example:
        >>> loader = KnowledgeGraphLoader()
        >>> graph = loader.load_from_yaml(Path("complex-learner-knowledge-graph.yaml"))
        >>> errors = graph.validate()
        >>> if errors:
        ...     raise KnowledgeGraphValidationError(f"Validation failed: {errors}")
        >>> 
        >>> # Get workflow sequence
        >>> workflow = graph.get_workflow_sequence()
        >>> for stage in workflow:
        ...     print(f"Stage: {stage.label}")
    """
    
    def __init__(self):
        if not YAML_AVAILABLE:
            raise ImportError("PyYAML is required for KnowledgeGraphLoader")
    
    def load_from_yaml(self, path: Path) -> KnowledgeGraph:
        """
        Load a knowledge graph from a YAML file.
        
        Args:
            path: Path to the YAML configuration file
            
        Returns:
            Parsed and validated KnowledgeGraph
            
        Raises:
            FileNotFoundError: If the file doesn't exist
            KnowledgeGraphValidationError: If the YAML structure is invalid
        """
        if not path.exists():
            raise FileNotFoundError(f"Knowledge graph config not found: {path}")
        
        with open(path, 'r') as f:
            data = yaml.safe_load(f)
        
        return self._parse_yaml_data(data, path.stem)
    
    def load_from_string(self, yaml_content: str, name: str = "unnamed") -> KnowledgeGraph:
        """Load a knowledge graph from a YAML string."""
        data = yaml.safe_load(yaml_content)
        return self._parse_yaml_data(data, name)
    
    def _parse_yaml_data(self, data: Dict[str, Any], name: str) -> KnowledgeGraph:
        """Parse YAML data into a KnowledgeGraph."""
        if not isinstance(data, dict):
            raise KnowledgeGraphValidationError("YAML root must be a dictionary")
        
        graph = KnowledgeGraph(
            name=name,
            source=data.get("source"),
        )
        
        # Parse nodes
        nodes_data = data.get("nodes", [])
        if not isinstance(nodes_data, list):
            raise KnowledgeGraphValidationError("'nodes' must be a list")
        
        for i, node_data in enumerate(nodes_data):
            if not isinstance(node_data, dict):
                raise KnowledgeGraphValidationError(f"Node {i} must be a dictionary")
            if "id" not in node_data:
                raise KnowledgeGraphValidationError(f"Node {i} missing required 'id' field")
            
            node = KnowledgeNode.from_dict(node_data)
            graph.add_node(node)
        
        # Parse edges
        edges_data = data.get("edges", [])
        if not isinstance(edges_data, list):
            raise KnowledgeGraphValidationError("'edges' must be a list")
        
        for i, edge_data in enumerate(edges_data):
            if not isinstance(edge_data, dict):
                raise KnowledgeGraphValidationError(f"Edge {i} must be a dictionary")
            if "from" not in edge_data:
                raise KnowledgeGraphValidationError(f"Edge {i} missing required 'from' field")
            if "to" not in edge_data:
                raise KnowledgeGraphValidationError(f"Edge {i} missing required 'to' field")
            
            edge = KnowledgeEdge.from_dict(edge_data)
            graph.add_edge(edge)
        
        # Validate
        errors = graph.validate()
        if errors:
            raise KnowledgeGraphValidationError(f"Validation errors: {errors}")
        
        logger.info(f"Loaded knowledge graph '{name}' with {len(graph.nodes)} nodes and {len(graph.edges)} edges")
        return graph


class ReasoningEngine:
    """
    Reasoning engine that uses knowledge graphs for agent decision-making.
    
    Integrates with system agents to provide:
    - Workflow stage guidance
    - Method selection based on context
    - Rigor constraints enforcement
    - Priority balancing
    """
    
    def __init__(self):
        self._graphs: Dict[str, KnowledgeGraph] = {}
        self._active_graph: Optional[str] = None
        logger.info("ReasoningEngine initialized")
    
    def load_graph(self, name: str, graph: KnowledgeGraph) -> None:
        """Load a knowledge graph into the engine."""
        self._graphs[name] = graph
        if self._active_graph is None:
            self._active_graph = name
        logger.info(f"Loaded knowledge graph: {name}")
    
    def set_active_graph(self, name: str) -> None:
        """Set the active knowledge graph for reasoning."""
        if name not in self._graphs:
            raise ValueError(f"Unknown graph: {name}")
        self._active_graph = name
    
    def get_active_graph(self) -> Optional[KnowledgeGraph]:
        """Get the currently active knowledge graph."""
        if self._active_graph:
            return self._graphs.get(self._active_graph)
        return None
    
    def get_workflow_stages(self) -> List[Dict[str, Any]]:
        """Get ordered workflow stages from the active graph."""
        graph = self.get_active_graph()
        if not graph:
            return []
        
        stages = graph.get_workflow_sequence()
        return [s.to_dict() for s in stages]
    
    def get_methods(self) -> List[Dict[str, Any]]:
        """Get available methods from the active graph."""
        graph = self.get_active_graph()
        if not graph:
            return []
        
        methods = graph.get_nodes_by_type("method")
        return [m.to_dict() for m in methods]
    
    def get_rigor_constraints(self) -> List[Dict[str, Any]]:
        """Get rigor constraints from the active graph."""
        graph = self.get_active_graph()
        if not graph:
            return []
        
        rigor = graph.get_nodes_by_type("rigor")
        return [r.to_dict() for r in rigor]
    
    def get_priorities(self) -> List[Dict[str, Any]]:
        """Get priorities from the active graph."""
        graph = self.get_active_graph()
        if not graph:
            return []
        
        priorities = graph.get_nodes_by_type("priority")
        return [p.to_dict() for p in priorities]
    
    def get_frameworks(self) -> List[Dict[str, Any]]:
        """Get frameworks from the active graph."""
        graph = self.get_active_graph()
        if not graph:
            return []
        
        frameworks = graph.get_nodes_by_type("framework")
        return [f.to_dict() for f in frameworks]
    
    def suggest_next_action(self, current_stage: Optional[str] = None) -> Dict[str, Any]:
        """
        Suggest the next action based on current workflow stage.
        
        Returns a dictionary with:
        - next_stage: The next workflow stage (if any)
        - methods: Applicable methods for the stage
        - constraints: Rigor constraints to apply
        """
        graph = self.get_active_graph()
        if not graph:
            return {"error": "No active knowledge graph"}
        
        workflow = graph.get_workflow_sequence()
        if not workflow:
            return {"error": "No workflow defined"}
        
        # Find current position in workflow
        current_idx = -1
        if current_stage:
            for i, stage in enumerate(workflow):
                if stage.id == current_stage:
                    current_idx = i
                    break
        
        # Get next stage
        next_stage = None
        if current_idx < len(workflow) - 1:
            next_stage = workflow[current_idx + 1]
        
        # Get applicable methods
        methods = self.get_methods()
        
        # Get rigor constraints
        constraints = self.get_rigor_constraints()
        
        return {
            "current_stage": current_stage,
            "next_stage": next_stage.to_dict() if next_stage else None,
            "methods": methods,
            "constraints": constraints,
            "workflow_complete": next_stage is None and current_idx >= 0,
        }
    
    def get_reasoning_context(self) -> Dict[str, Any]:
        """
        Get the full reasoning context for agent decision-making.
        
        Returns all relevant information from the active knowledge graph.
        """
        graph = self.get_active_graph()
        if not graph:
            return {"error": "No active knowledge graph"}
        
        return {
            "graph_name": graph.name,
            "source": graph.source,
            "workflow": self.get_workflow_stages(),
            "methods": self.get_methods(),
            "rigor_constraints": self.get_rigor_constraints(),
            "priorities": self.get_priorities(),
            "frameworks": self.get_frameworks(),
            "total_nodes": len(graph.nodes),
            "total_edges": len(graph.edges),
        }


# Global reasoning engine instance
_reasoning_engine: Optional[ReasoningEngine] = None


def get_reasoning_engine() -> ReasoningEngine:
    """Get or create the global reasoning engine instance."""
    global _reasoning_engine
    if _reasoning_engine is None:
        _reasoning_engine = ReasoningEngine()
    return _reasoning_engine


def load_complex_learner_graph(config_path: Optional[Path] = None) -> KnowledgeGraph:
    """
    Load the complex learner knowledge graph.
    
    Args:
        config_path: Path to the YAML file. If None, uses default location.
        
    Returns:
        Loaded and validated KnowledgeGraph
    """
    if config_path is None:
        # Default to project root
        config_path = Path(__file__).parent.parent.parent / "complex-learner-knowledge-graph.yaml"
    
    loader = KnowledgeGraphLoader()
    graph = loader.load_from_yaml(config_path)
    
    # Register with global engine
    engine = get_reasoning_engine()
    engine.load_graph("complex_learner", graph)
    
    return graph


# Exports
__all__ = [
    "KnowledgeNode",
    "KnowledgeEdge",
    "KnowledgeGraph",
    "KnowledgeGraphLoader",
    "KnowledgeGraphValidationError",
    "ReasoningEngine",
    "get_reasoning_engine",
    "load_complex_learner_graph",
    "YAML_AVAILABLE",
]
