"""
Flow Graph Data Structures

Pure immutable data structures representing execution flow graphs.
A flow graph is a directed graph where:
- Nodes are execution points (prompts, conditions, loops, registry lookups)
- Edges are transitions with optional conditions
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence, Iterator, FrozenSet
from enum import Enum, auto


class NodeType(Enum):
    """Types of nodes in the flow graph."""
    START = auto()         # Entry point
    END = auto()           # Terminal node
    PROMPT = auto()        # Execute a prompt (P0, P1, ...)
    CONDITION = auto()     # Conditional branch point
    LOOP = auto()          # Iteration loop
    REGISTRY = auto()      # Registry resolution
    MERGE = auto()         # Merge point for branches


@dataclass(frozen=True)
class FlowEdge:
    """
    A directed edge in the flow graph.

    Edges connect nodes and may carry conditions that determine
    whether the transition should be taken.
    """
    source: str           # Source node ID
    target: str           # Target node ID
    condition: str | None = None   # Condition label (e.g., "success", "failure")
    priority: int = 0     # For ordered evaluation of multiple edges

    def __post_init__(self) -> None:
        if not self.source:
            raise ValueError("Edge requires a source")
        if not self.target:
            raise ValueError("Edge requires a target")

    def matches(self, category: str | None) -> bool:
        """Check if this edge's condition matches the given category."""
        if self.condition is None:
            return True  # Unconditional edge always matches
        if category is None:
            return False  # No category provided, conditional edge doesn't match
        return self.condition.lower() == category.lower()


@dataclass(frozen=True)
class FlowNode:
    """
    A node in the flow graph representing an execution point.
    """
    id: str                       # Unique node identifier
    node_type: NodeType           # Type of node
    label: str = ""               # Human-readable label
    prompt_index: int | None = None  # For PROMPT nodes: index into prompts array
    registry_key: str | None = None  # For REGISTRY nodes: key to resolve
    loop_limit: int = 10          # For LOOP nodes: max iterations
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("Node requires an id")
        # Validate prompt_index for PROMPT nodes
        if self.node_type == NodeType.PROMPT and self.prompt_index is None:
            raise ValueError("PROMPT node requires prompt_index")

    @property
    def is_terminal(self) -> bool:
        """Check if this is a terminal node."""
        return self.node_type == NodeType.END

    @property
    def is_branching(self) -> bool:
        """Check if this node can have multiple outgoing paths."""
        return self.node_type in (NodeType.CONDITION, NodeType.LOOP)


@dataclass(frozen=True)
class FlowGraph:
    """
    Immutable directed graph representing the execution flow.

    The graph is constructed from a Mermaid diagram and provides
    traversal operations for the flow executor.
    """
    nodes: Mapping[str, FlowNode]     # Node ID -> Node
    edges: tuple[FlowEdge, ...]       # All edges
    start_node: str                   # ID of the start node
    end_nodes: FrozenSet[str]         # IDs of terminal nodes

    def __post_init__(self) -> None:
        if self.start_node not in self.nodes:
            raise ValueError(f"Start node '{self.start_node}' not in graph")
        for end_id in self.end_nodes:
            if end_id not in self.nodes:
                raise ValueError(f"End node '{end_id}' not in graph")

    def get_node(self, node_id: str) -> FlowNode | None:
        """Get a node by ID."""
        return self.nodes.get(node_id)

    def outgoing_edges(self, node_id: str) -> tuple[FlowEdge, ...]:
        """Get all outgoing edges from a node, sorted by priority."""
        edges = tuple(e for e in self.edges if e.source == node_id)
        return tuple(sorted(edges, key=lambda e: e.priority))

    def incoming_edges(self, node_id: str) -> tuple[FlowEdge, ...]:
        """Get all incoming edges to a node."""
        return tuple(e for e in self.edges if e.target == node_id)

    def successors(self, node_id: str) -> tuple[str, ...]:
        """Get IDs of all successor nodes."""
        return tuple(e.target for e in self.outgoing_edges(node_id))

    def predecessors(self, node_id: str) -> tuple[str, ...]:
        """Get IDs of all predecessor nodes."""
        return tuple(e.source for e in self.incoming_edges(node_id))

    def get_next_node(self, current_id: str, category: str | None = None) -> str | None:
        """
        Get the next node ID based on outgoing edges and optional category.

        For conditional edges, matches category against edge conditions.
        For unconditional edges (condition=None), always matches.
        Returns None if no matching edge found.
        """
        for edge in self.outgoing_edges(current_id):
            if edge.matches(category):
                return edge.target
        return None

    def prompt_nodes(self) -> tuple[FlowNode, ...]:
        """Get all prompt nodes in the graph."""
        return tuple(n for n in self.nodes.values() if n.node_type == NodeType.PROMPT)

    def has_cycles(self) -> bool:
        """Check if the graph contains cycles (for loop detection)."""
        visited: set[str] = set()
        rec_stack: set[str] = set()

        def dfs(node_id: str) -> bool:
            visited.add(node_id)
            rec_stack.add(node_id)
            for succ in self.successors(node_id):
                if succ not in visited:
                    if dfs(succ):
                        return True
                elif succ in rec_stack:
                    return True
            rec_stack.remove(node_id)
            return False

        for node_id in self.nodes:
            if node_id not in visited:
                if dfs(node_id):
                    return True
        return False

    def topological_order(self) -> tuple[str, ...] | None:
        """
        Return nodes in topological order, or None if graph has cycles.

        Useful for validation and analysis.
        """
        in_degree: dict[str, int] = {n: 0 for n in self.nodes}
        for edge in self.edges:
            in_degree[edge.target] += 1

        queue: list[str] = [n for n, d in in_degree.items() if d == 0]
        result: list[str] = []

        while queue:
            node = queue.pop(0)
            result.append(node)
            for succ in self.successors(node):
                in_degree[succ] -= 1
                if in_degree[succ] == 0:
                    queue.append(succ)

        if len(result) != len(self.nodes):
            return None  # Cycle detected
        return tuple(result)

    def validate(self) -> tuple[bool, list[str]]:
        """
        Validate graph structure.

        Returns (is_valid, errors).
        """
        errors: list[str] = []

        # Check start node exists and has no incoming edges
        if not self.incoming_edges(self.start_node):
            pass  # Good
        else:
            # Start can have incoming edges in case of loops - just log
            pass

        # Check end nodes have no outgoing edges
        for end_id in self.end_nodes:
            if self.outgoing_edges(end_id):
                errors.append(f"End node '{end_id}' has outgoing edges")

        # Check all edges reference valid nodes
        for edge in self.edges:
            if edge.source not in self.nodes:
                errors.append(f"Edge source '{edge.source}' not in graph")
            if edge.target not in self.nodes:
                errors.append(f"Edge target '{edge.target}' not in graph")

        # Check all non-end nodes have outgoing edges
        for node_id, node in self.nodes.items():
            if node.node_type != NodeType.END:
                if not self.outgoing_edges(node_id):
                    errors.append(f"Non-terminal node '{node_id}' has no outgoing edges")

        return (len(errors) == 0, errors)

    def __len__(self) -> int:
        """Number of nodes in the graph."""
        return len(self.nodes)

    def __iter__(self) -> Iterator[FlowNode]:
        """Iterate over nodes."""
        return iter(self.nodes.values())

    def __contains__(self, node_id: str) -> bool:
        """Check if node ID exists in graph."""
        return node_id in self.nodes


class FlowGraphBuilder:
    """
    Mutable builder for constructing FlowGraph instances.

    Used by the parser to incrementally build the graph.
    """

    def __init__(self) -> None:
        self._nodes: dict[str, FlowNode] = {}
        self._edges: list[FlowEdge] = []
        self._start_node: str | None = None
        self._end_nodes: set[str] = set()

    def add_node(self, node: FlowNode) -> FlowGraphBuilder:
        """Add a node to the graph."""
        if node.id in self._nodes:
            raise ValueError(f"Duplicate node ID: {node.id}")
        self._nodes[node.id] = node
        if node.node_type == NodeType.START:
            self._start_node = node.id
        elif node.node_type == NodeType.END:
            self._end_nodes.add(node.id)
        return self

    def add_edge(self, edge: FlowEdge) -> FlowGraphBuilder:
        """Add an edge to the graph."""
        self._edges.append(edge)
        return self

    def set_start(self, node_id: str) -> FlowGraphBuilder:
        """Set the start node."""
        self._start_node = node_id
        return self

    def add_end(self, node_id: str) -> FlowGraphBuilder:
        """Add an end node."""
        self._end_nodes.add(node_id)
        return self

    def build(self) -> FlowGraph:
        """Build the immutable FlowGraph."""
        if self._start_node is None:
            raise ValueError("Graph requires a start node")
        if not self._end_nodes:
            raise ValueError("Graph requires at least one end node")

        return FlowGraph(
            nodes=dict(self._nodes),  # Copy
            edges=tuple(self._edges),
            start_node=self._start_node,
            end_nodes=frozenset(self._end_nodes)
        )
