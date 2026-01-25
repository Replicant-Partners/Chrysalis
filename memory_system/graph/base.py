"""
Base Graph Store Interface.

Abstract base class defining the graph storage contract.
All backend adapters must implement this interface.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set, Iterator
from enum import Enum
import logging

logger = logging.getLogger(__name__)


@dataclass
class Triple:
    """
    Graph triple (Subject, Predicate, Object).
    
    Maps to semantic triples from decomposition.
    """
    subject: str
    predicate: str
    object: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "subject": self.subject,
            "predicate": self.predicate,
            "object": self.object,
            "metadata": self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Triple":
        """Create from dictionary."""
        return cls(
            subject=data["subject"],
            predicate=data["predicate"],
            object=data["object"],
            metadata=data.get("metadata", {}),
        )


@dataclass
class Node:
    """
    Graph node with attributes.
    """
    id: str
    type: str = "entity"
    path: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "type": self.type,
            "path": self.path,
            **self.metadata,
        }


class GraphStoreBase(ABC):
    """
    Abstract base class for graph storage backends.
    
    Provides interface for:
    - Adding/removing nodes and edges
    - Querying graph structure
    - Traversal operations
    - Import/export
    """
    
    @abstractmethod
    def add_node(
        self, 
        node_id: str, 
        node_type: str = "entity",
        path: Optional[str] = None,
        **attributes
    ) -> None:
        """
        Add a node to the graph.
        
        Args:
            node_id: Unique node identifier
            node_type: Node type (file, class, function, etc.)
            path: Optional file path
            **attributes: Additional node attributes
        """
        pass
    
    @abstractmethod
    def add_edge(
        self,
        source: str,
        target: str,
        edge_type: str = "relates_to",
        **attributes
    ) -> None:
        """
        Add an edge between two nodes.
        
        Creates nodes if they don't exist.
        
        Args:
            source: Source node ID
            target: Target node ID
            edge_type: Edge/relationship type
            **attributes: Additional edge attributes
        """
        pass
    
    def add_triple(
        self,
        subject: str,
        predicate: str,
        obj: str,
        **metadata
    ) -> None:
        """
        Add a semantic triple as an edge.
        
        Convenience method that creates nodes if needed.
        
        Args:
            subject: Subject node
            predicate: Relationship type
            obj: Object node
            **metadata: Additional metadata
        """
        self.add_node(subject)
        self.add_node(obj)
        self.add_edge(subject, obj, edge_type=predicate, **metadata)
    
    @abstractmethod
    def has_node(self, node_id: str) -> bool:
        """Check if node exists."""
        pass
    
    @abstractmethod
    def has_edge(self, source: str, target: str) -> bool:
        """Check if edge exists between two nodes."""
        pass
    
    @abstractmethod
    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        """
        Get node attributes.
        
        Returns:
            Node attributes dict or None if not found
        """
        pass
    
    @abstractmethod
    def get_edge(self, source: str, target: str) -> Optional[Dict[str, Any]]:
        """
        Get edge attributes.
        
        Returns:
            Edge attributes dict or None if not found
        """
        pass
    
    @abstractmethod
    def remove_node(self, node_id: str) -> bool:
        """
        Remove a node and all its edges.
        
        Returns:
            True if node was removed
        """
        pass
    
    @abstractmethod
    def remove_edge(self, source: str, target: str) -> bool:
        """
        Remove an edge.
        
        Returns:
            True if edge was removed
        """
        pass
    
    @abstractmethod
    def nodes(self) -> Iterator[str]:
        """Iterate over all node IDs."""
        pass
    
    @abstractmethod
    def edges(self) -> Iterator[tuple]:
        """Iterate over all edges as (source, target) tuples."""
        pass
    
    @abstractmethod
    def node_count(self) -> int:
        """Get total number of nodes."""
        pass
    
    @abstractmethod
    def edge_count(self) -> int:
        """Get total number of edges."""
        pass
    
    @abstractmethod
    def neighbors(self, node_id: str, direction: str = "both") -> List[str]:
        """
        Get neighboring nodes.
        
        Args:
            node_id: Node to get neighbors for
            direction: 'out' (successors), 'in' (predecessors), or 'both'
            
        Returns:
            List of neighbor node IDs
        """
        pass
    
    @abstractmethod
    async def find_related(
        self,
        entity: str,
        depth: int = 1,
        max_results: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Find related entities using BFS traversal.
        
        Args:
            entity: Starting entity name
            depth: Maximum traversal depth
            max_results: Maximum results to return
            
        Returns:
            List of related node dictionaries
        """
        pass
    
    @abstractmethod
    def find_path(
        self,
        source: str,
        target: str,
        max_depth: int = 10,
    ) -> Optional[List[str]]:
        """
        Find shortest path between two nodes.
        
        Args:
            source: Source node
            target: Target node
            max_depth: Maximum path length
            
        Returns:
            List of node IDs in path, or None if no path exists
        """
        pass
    
    @abstractmethod
    def query_by_type(self, node_type: str) -> List[Dict[str, Any]]:
        """
        Query all nodes of a specific type.
        
        Args:
            node_type: Type to filter by
            
        Returns:
            List of matching node dictionaries
        """
        pass
    
    @abstractmethod
    def query_edges_by_type(self, edge_type: str) -> List[Dict[str, Any]]:
        """
        Query all edges of a specific type.
        
        Args:
            edge_type: Edge type to filter by
            
        Returns:
            List of edge dictionaries with source, target, type
        """
        pass
    
    def find_similar_nodes(
        self, 
        name: str, 
        max_candidates: int = 10,
        threshold: float = 0.3,
    ) -> List[tuple]:
        """
        Find nodes with similar names using fuzzy matching.
        
        Args:
            name: Name to search for
            max_candidates: Maximum candidates to return
            threshold: Minimum similarity score (0-1)
            
        Returns:
            List of (node_id, similarity_score) tuples
        """
        if not name or not name.strip():
            return []
        
        name_lower = name.lower()
        candidates = []
        
        for node_id in self.nodes():
            node_lower = node_id.lower()
            score = self._calculate_similarity(name_lower, node_lower)
            
            if score >= threshold:
                candidates.append((node_id, score))
        
        # Sort by score descending
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[:max_candidates]
    
    def _calculate_similarity(self, a: str, b: str) -> float:
        """
        Calculate similarity score between two strings.
        
        Uses multiple metrics and returns max score.
        """
        scores = []

        # Exact match
        if a == b:
            return 1.0

        # Contains match
        if a in b:
            scores.append(len(a) / max(len(b), 1) * 0.8)
        elif b in a:
            scores.append(len(b) / max(len(a), 1) * 0.7)

        # Token overlap (Jaccard)
        a_tokens = set(a.replace('_', ' ').replace('-', ' ').split())
        b_tokens = set(b.replace('_', ' ').replace('-', ' ').split())
        if a_tokens and b_tokens:
            jaccard = len(a_tokens & b_tokens) / len(a_tokens | b_tokens)
            scores.append(jaccard * 0.6)

        # Prefix match
        if b.startswith(a):
            scores.append(len(a) / max(len(b), 1) * 0.5)
        elif a.startswith(b):
            scores.append(len(b) / max(len(a), 1) * 0.4)

        return max(scores, default=0.0)
    
    @abstractmethod
    def export_json(self) -> Dict[str, Any]:
        """
        Export graph to JSON-serializable dict.
        
        Returns:
            Dict with 'nodes' and 'edges' lists
        """
        pass
    
    @abstractmethod
    def import_json(self, data: Dict[str, Any]) -> None:
        """
        Import graph from JSON dict.
        
        Args:
            data: Dict with 'nodes' and 'edges' lists
        """
        pass
    
    @abstractmethod
    def clear(self) -> None:
        """Clear all nodes and edges."""
        pass
    
    @property
    @abstractmethod
    def backend_name(self) -> str:
        """Get the backend adapter name."""
        pass
