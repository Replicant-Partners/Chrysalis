"""
Unified Graph Store with Multiple Backend Support.

Provides a consistent interface for graph operations across different backends:
- NetworkX: Fast in-memory operations (default)
- SQLite: Persistent embedded storage
- ArangoDB: Distributed graph database (optional)
"""

import json
import logging
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional, Iterator, Literal

from memory_system.graph.base import GraphStoreBase, Triple, Node
from memory_system.semantic.exceptions import GraphStorageError

logger = logging.getLogger(__name__)

# Conditional imports
try:
    import networkx as nx
    NETWORKX_AVAILABLE = True
except ImportError:
    NETWORKX_AVAILABLE = False
    nx = None


class NetworkXAdapter(GraphStoreBase):
    """
    In-memory graph storage using NetworkX.
    
    Fast operations, good for development and smaller graphs.
    No persistence by default (use export_json/import_json).
    """
    
    def __init__(self):
        if not NETWORKX_AVAILABLE:
            raise GraphStorageError(
                "NetworkX not installed",
                "DEPENDENCY_MISSING"
            )
        self._graph = nx.DiGraph()
    
    @property
    def backend_name(self) -> str:
        return "networkx"
    
    def add_node(
        self,
        node_id: str,
        node_type: str = "entity",
        path: Optional[str] = None,
        **attributes
    ) -> None:
        self._graph.add_node(
            node_id,
            type=node_type,
            path=path,
            **attributes
        )
    
    def add_edge(
        self,
        source: str,
        target: str,
        edge_type: str = "relates_to",
        **attributes
    ) -> None:
        # Auto-create nodes if they don't exist
        if not self._graph.has_node(source):
            self.add_node(source)
        if not self._graph.has_node(target):
            self.add_node(target)
        
        self._graph.add_edge(source, target, type=edge_type, **attributes)
    
    def has_node(self, node_id: str) -> bool:
        return self._graph.has_node(node_id)
    
    def has_edge(self, source: str, target: str) -> bool:
        return self._graph.has_edge(source, target)
    
    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        if not self._graph.has_node(node_id):
            return None
        return {"id": node_id, **self._graph.nodes[node_id]}
    
    def get_edge(self, source: str, target: str) -> Optional[Dict[str, Any]]:
        if not self._graph.has_edge(source, target):
            return None
        return {
            "source": source,
            "target": target,
            **self._graph.edges[source, target]
        }
    
    def remove_node(self, node_id: str) -> bool:
        if not self._graph.has_node(node_id):
            return False
        self._graph.remove_node(node_id)
        return True
    
    def remove_edge(self, source: str, target: str) -> bool:
        if not self._graph.has_edge(source, target):
            return False
        self._graph.remove_edge(source, target)
        return True
    
    def nodes(self) -> Iterator[str]:
        return iter(self._graph.nodes())
    
    def edges(self) -> Iterator[tuple]:
        return iter(self._graph.edges())
    
    def node_count(self) -> int:
        return self._graph.number_of_nodes()
    
    def edge_count(self) -> int:
        return self._graph.number_of_edges()
    
    def neighbors(self, node_id: str, direction: str = "both") -> List[str]:
        if not self._graph.has_node(node_id):
            return []
        
        if direction == "out":
            return list(self._graph.successors(node_id))
        elif direction == "in":
            return list(self._graph.predecessors(node_id))
        else:
            out_neighbors = set(self._graph.successors(node_id))
            in_neighbors = set(self._graph.predecessors(node_id))
            return list(out_neighbors | in_neighbors)
    
    async def find_related(
        self,
        entity: str,
        depth: int = 1,
        max_results: int = 100,
    ) -> List[Dict[str, Any]]:
        # Handle fuzzy matching
        if entity not in self._graph:
            candidates = self.find_similar_nodes(entity)
            if not candidates:
                return []
            entity = candidates[0][0]
        
        # BFS traversal
        try:
            related = list(nx.bfs_tree(self._graph, entity, depth_limit=depth))
        except nx.NetworkXError:
            return []
        
        # Limit results
        related = related[:max_results]
        
        # Build result dicts
        results = []
        for node_id in related:
            results.append(self.get_node(node_id))
        
        return results
    
    def find_path(
        self,
        source: str,
        target: str,
        max_depth: int = 10,
    ) -> Optional[List[str]]:
        if source not in self._graph or target not in self._graph:
            return None
        
        try:
            path = nx.shortest_path(
                self._graph,
                source=source,
                target=target
            )
            if len(path) > max_depth:
                return None
            return path
        except (nx.NetworkXNoPath, nx.NetworkXError):
            return None
    
    def query_by_type(self, node_type: str) -> List[Dict[str, Any]]:
        results = []
        for node_id in self._graph.nodes():
            attrs = self._graph.nodes[node_id]
            if attrs.get("type") == node_type:
                results.append({"id": node_id, **attrs})
        return results
    
    def query_edges_by_type(self, edge_type: str) -> List[Dict[str, Any]]:
        results = []
        for source, target in self._graph.edges():
            attrs = self._graph.edges[source, target]
            if attrs.get("type") == edge_type:
                results.append({
                    "source": source,
                    "target": target,
                    **attrs
                })
        return results
    
    def export_json(self) -> Dict[str, Any]:
        nodes = []
        for node_id in self._graph.nodes():
            nodes.append({"id": node_id, **self._graph.nodes[node_id]})
        
        edges = []
        for source, target in self._graph.edges():
            edges.append({
                "source": source,
                "target": target,
                **self._graph.edges[source, target]
            })
        
        return {"nodes": nodes, "edges": edges}
    
    def import_json(self, data: Dict[str, Any]) -> None:
        for node in data.get("nodes", []):
            node_id = node.pop("id", node.pop("name", None))
            if node_id:
                self._graph.add_node(node_id, **node)
        
        for edge in data.get("edges", []):
            source = edge.pop("source")
            target = edge.pop("target")
            self._graph.add_edge(source, target, **edge)
    
    def clear(self) -> None:
        self._graph.clear()


class SQLiteAdapter(GraphStoreBase):
    """
    Persistent graph storage using SQLite.
    
    Good for medium-sized graphs that need persistence.
    Supports concurrent reads, serialized writes.
    """
    
    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None
        self._init_db()
    
    @property
    def backend_name(self) -> str:
        return "sqlite"
    
    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(
                self.db_path,
                check_same_thread=False
            )
            self._conn.row_factory = sqlite3.Row
        return self._conn
    
    def _init_db(self) -> None:
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                type TEXT DEFAULT 'entity',
                path TEXT,
                metadata TEXT DEFAULT '{}'
            );
            
            CREATE TABLE IF NOT EXISTS edges (
                source TEXT NOT NULL,
                target TEXT NOT NULL,
                type TEXT DEFAULT 'relates_to',
                metadata TEXT DEFAULT '{}',
                PRIMARY KEY (source, target),
                FOREIGN KEY (source) REFERENCES nodes(id),
                FOREIGN KEY (target) REFERENCES nodes(id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
            CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
            CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
            CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
        """)
        conn.commit()
    
    def add_node(
        self,
        node_id: str,
        node_type: str = "entity",
        path: Optional[str] = None,
        **attributes
    ) -> None:
        conn = self._get_conn()
        metadata = json.dumps(attributes) if attributes else "{}"
        conn.execute(
            """
            INSERT OR REPLACE INTO nodes (id, type, path, metadata)
            VALUES (?, ?, ?, ?)
            """,
            (node_id, node_type, path, metadata)
        )
        conn.commit()
    
    def add_edge(
        self,
        source: str,
        target: str,
        edge_type: str = "relates_to",
        **attributes
    ) -> None:
        # Auto-create nodes
        if not self.has_node(source):
            self.add_node(source)
        if not self.has_node(target):
            self.add_node(target)
        
        conn = self._get_conn()
        metadata = json.dumps(attributes) if attributes else "{}"
        conn.execute(
            """
            INSERT OR REPLACE INTO edges (source, target, type, metadata)
            VALUES (?, ?, ?, ?)
            """,
            (source, target, edge_type, metadata)
        )
        conn.commit()
    
    def has_node(self, node_id: str) -> bool:
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT 1 FROM nodes WHERE id = ?",
            (node_id,)
        )
        return cursor.fetchone() is not None
    
    def has_edge(self, source: str, target: str) -> bool:
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT 1 FROM edges WHERE source = ? AND target = ?",
            (source, target)
        )
        return cursor.fetchone() is not None
    
    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT * FROM nodes WHERE id = ?",
            (node_id,)
        )
        row = cursor.fetchone()
        if row is None:
            return None
        
        result = {"id": row["id"], "type": row["type"], "path": row["path"]}
        if row["metadata"]:
            result.update(json.loads(row["metadata"]))
        return result
    
    def get_edge(self, source: str, target: str) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT * FROM edges WHERE source = ? AND target = ?",
            (source, target)
        )
        row = cursor.fetchone()
        if row is None:
            return None
        
        result = {
            "source": row["source"],
            "target": row["target"],
            "type": row["type"],
        }
        if row["metadata"]:
            result.update(json.loads(row["metadata"]))
        return result
    
    def remove_node(self, node_id: str) -> bool:
        if not self.has_node(node_id):
            return False
        
        conn = self._get_conn()
        # Remove edges first
        conn.execute("DELETE FROM edges WHERE source = ? OR target = ?", (node_id, node_id))
        conn.execute("DELETE FROM nodes WHERE id = ?", (node_id,))
        conn.commit()
        return True
    
    def remove_edge(self, source: str, target: str) -> bool:
        if not self.has_edge(source, target):
            return False
        
        conn = self._get_conn()
        conn.execute(
            "DELETE FROM edges WHERE source = ? AND target = ?",
            (source, target)
        )
        conn.commit()
        return True
    
    def nodes(self) -> Iterator[str]:
        conn = self._get_conn()
        cursor = conn.execute("SELECT id FROM nodes")
        for row in cursor:
            yield row[0]
    
    def edges(self) -> Iterator[tuple]:
        conn = self._get_conn()
        cursor = conn.execute("SELECT source, target FROM edges")
        for row in cursor:
            yield (row[0], row[1])
    
    def node_count(self) -> int:
        conn = self._get_conn()
        cursor = conn.execute("SELECT COUNT(*) FROM nodes")
        return cursor.fetchone()[0]
    
    def edge_count(self) -> int:
        conn = self._get_conn()
        cursor = conn.execute("SELECT COUNT(*) FROM edges")
        return cursor.fetchone()[0]
    
    def neighbors(self, node_id: str, direction: str = "both") -> List[str]:
        conn = self._get_conn()
        results = set()
        
        if direction in ("out", "both"):
            cursor = conn.execute(
                "SELECT target FROM edges WHERE source = ?",
                (node_id,)
            )
            for row in cursor:
                results.add(row[0])
        
        if direction in ("in", "both"):
            cursor = conn.execute(
                "SELECT source FROM edges WHERE target = ?",
                (node_id,)
            )
            for row in cursor:
                results.add(row[0])
        
        return list(results)
    
    async def find_related(
        self,
        entity: str,
        depth: int = 1,
        max_results: int = 100,
    ) -> List[Dict[str, Any]]:
        # Handle fuzzy matching
        if not self.has_node(entity):
            candidates = self.find_similar_nodes(entity)
            if not candidates:
                return []
            entity = candidates[0][0]
        
        # BFS traversal using SQL
        visited = set()
        queue = [(entity, 0)]
        results = []
        
        while queue and len(results) < max_results:
            current, current_depth = queue.pop(0)
            
            if current in visited:
                continue
            visited.add(current)
            
            node = self.get_node(current)
            if node:
                results.append(node)
            
            if current_depth < depth:
                for neighbor in self.neighbors(current, direction="both"):
                    if neighbor not in visited:
                        queue.append((neighbor, current_depth + 1))
        
        return results[:max_results]
    
    def find_path(
        self,
        source: str,
        target: str,
        max_depth: int = 10,
    ) -> Optional[List[str]]:
        if not self.has_node(source) or not self.has_node(target):
            return None
        
        # BFS for shortest path
        visited = {source}
        queue = [(source, [source])]
        
        while queue:
            current, path = queue.pop(0)
            
            if current == target:
                return path
            
            if len(path) >= max_depth:
                continue
            
            for neighbor in self.neighbors(current, direction="out"):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, path + [neighbor]))
        
        return None
    
    def query_by_type(self, node_type: str) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT * FROM nodes WHERE type = ?",
            (node_type,)
        )
        
        results = []
        for row in cursor:
            result = {"id": row["id"], "type": row["type"], "path": row["path"]}
            if row["metadata"]:
                result.update(json.loads(row["metadata"]))
            results.append(result)
        return results
    
    def query_edges_by_type(self, edge_type: str) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT * FROM edges WHERE type = ?",
            (edge_type,)
        )
        
        results = []
        for row in cursor:
            result = {
                "source": row["source"],
                "target": row["target"],
                "type": row["type"],
            }
            if row["metadata"]:
                result.update(json.loads(row["metadata"]))
            results.append(result)
        return results
    
    def export_json(self) -> Dict[str, Any]:
        conn = self._get_conn()
        
        nodes = []
        cursor = conn.execute("SELECT * FROM nodes")
        for row in cursor:
            node = {"id": row["id"], "type": row["type"], "path": row["path"]}
            if row["metadata"]:
                node.update(json.loads(row["metadata"]))
            nodes.append(node)
        
        edges = []
        cursor = conn.execute("SELECT * FROM edges")
        for row in cursor:
            edge = {
                "source": row["source"],
                "target": row["target"],
                "type": row["type"],
            }
            if row["metadata"]:
                edge.update(json.loads(row["metadata"]))
            edges.append(edge)
        
        return {"nodes": nodes, "edges": edges}
    
    def import_json(self, data: Dict[str, Any]) -> None:
        for node in data.get("nodes", []):
            node_id = node.pop("id", node.pop("name", None))
            node_type = node.pop("type", "entity")
            path = node.pop("path", None)
            if node_id:
                self.add_node(node_id, node_type, path, **node)
        
        for edge in data.get("edges", []):
            source = edge.pop("source")
            target = edge.pop("target")
            edge_type = edge.pop("type", "relates_to")
            self.add_edge(source, target, edge_type, **edge)
    
    def clear(self) -> None:
        conn = self._get_conn()
        conn.execute("DELETE FROM edges")
        conn.execute("DELETE FROM nodes")
        conn.commit()
    
    def close(self) -> None:
        """Close database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None


class GraphStore:
    """
    High-level graph store with automatic backend selection.
    
    Wraps backend adapters and provides unified interface.
    """
    
    def __init__(
        self,
        backend: Literal["auto", "networkx", "sqlite"] = "auto",
        path: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize graph store.
        
        Args:
            backend: Backend to use ('auto', 'networkx', 'sqlite')
            path: Path for persistent storage (sqlite)
            **kwargs: Backend-specific options
        """
        self._adapter: GraphStoreBase
        
        if backend == "auto":
            # Prefer NetworkX for in-memory, SQLite if path provided
            if path:
                backend = "sqlite"
            elif NETWORKX_AVAILABLE:
                backend = "networkx"
            else:
                backend = "sqlite"
        
        if backend == "networkx":
            self._adapter = NetworkXAdapter()
        elif backend == "sqlite":
            self._adapter = SQLiteAdapter(path or ":memory:")
        else:
            raise GraphStorageError(
                f"Unknown backend: {backend}",
                "INVALID_BACKEND"
            )
        
        logger.info(f"GraphStore initialized with backend: {self._adapter.backend_name}")
    
    @property
    def backend(self) -> str:
        """Get current backend name."""
        return self._adapter.backend_name
    
    # Delegate all methods to adapter
    def add_node(self, *args, **kwargs):
        return self._adapter.add_node(*args, **kwargs)
    
    def add_edge(self, *args, **kwargs):
        return self._adapter.add_edge(*args, **kwargs)
    
    def add_triple(self, *args, **kwargs):
        return self._adapter.add_triple(*args, **kwargs)
    
    def has_node(self, *args, **kwargs):
        return self._adapter.has_node(*args, **kwargs)
    
    def has_edge(self, *args, **kwargs):
        return self._adapter.has_edge(*args, **kwargs)
    
    def get_node(self, *args, **kwargs):
        return self._adapter.get_node(*args, **kwargs)
    
    def get_edge(self, *args, **kwargs):
        return self._adapter.get_edge(*args, **kwargs)
    
    def remove_node(self, *args, **kwargs):
        return self._adapter.remove_node(*args, **kwargs)
    
    def remove_edge(self, *args, **kwargs):
        return self._adapter.remove_edge(*args, **kwargs)
    
    def nodes(self):
        return self._adapter.nodes()
    
    def edges(self):
        return self._adapter.edges()
    
    def node_count(self):
        return self._adapter.node_count()
    
    def edge_count(self):
        return self._adapter.edge_count()
    
    def neighbors(self, *args, **kwargs):
        return self._adapter.neighbors(*args, **kwargs)
    
    async def find_related(self, *args, **kwargs):
        return await self._adapter.find_related(*args, **kwargs)
    
    def find_path(self, *args, **kwargs):
        return self._adapter.find_path(*args, **kwargs)
    
    def find_similar_nodes(self, *args, **kwargs):
        return self._adapter.find_similar_nodes(*args, **kwargs)
    
    def query_by_type(self, *args, **kwargs):
        return self._adapter.query_by_type(*args, **kwargs)
    
    def query_edges_by_type(self, *args, **kwargs):
        return self._adapter.query_edges_by_type(*args, **kwargs)
    
    def export_json(self):
        return self._adapter.export_json()
    
    def import_json(self, *args, **kwargs):
        return self._adapter.import_json(*args, **kwargs)
    
    def clear(self):
        return self._adapter.clear()
    
    def save(self, path: str) -> None:
        """Save graph to JSON file."""
        data = self.export_json()
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Graph saved to {path}")
    
    def load(self, path: str) -> None:
        """Load graph from JSON file."""
        with open(path, "r") as f:
            data = json.load(f)
        self.import_json(data)
        logger.info(f"Graph loaded from {path}")


def create_graph_store(
    backend: str = "auto",
    path: Optional[str] = None,
    **kwargs
) -> GraphStore:
    """
    Factory function to create graph store.
    
    Args:
        backend: Backend type ('auto', 'networkx', 'sqlite')
        path: Path for persistent storage
        **kwargs: Backend-specific options
        
    Returns:
        GraphStore instance
    """
    return GraphStore(backend=backend, path=path, **kwargs)
