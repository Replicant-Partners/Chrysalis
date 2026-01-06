"""
Chrysalis Graph Storage Module.

Unified graph storage with multiple backend adapters:
- SQLite: Lightweight embedded storage (default)
- NetworkX: In-memory graph for fast operations
- ArangoDB: Distributed graph database (optional)

Usage:
    from memory_system.graph import GraphStore, create_graph_store
    
    # Auto-detect best available backend
    store = create_graph_store()
    
    # Force specific backend
    store = create_graph_store(backend="sqlite", path="./data/graph.db")
    
    # Add triples
    store.add_triple("UserController", "uses", "AuthService")
    
    # Query related entities
    related = await store.find_related("UserController", depth=2)
"""

from memory_system.graph.base import GraphStoreBase, Triple as GraphTriple
from memory_system.graph.store import GraphStore, create_graph_store

__all__ = [
    "GraphStoreBase",
    "GraphTriple",
    "GraphStore",
    "create_graph_store",
]

# Version
__version__ = "0.1.0"
