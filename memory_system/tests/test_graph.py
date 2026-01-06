"""
Tests for graph storage module.
"""

import pytest
import tempfile
from pathlib import Path

from memory_system.graph import GraphStore, GraphStoreBase
from memory_system.semantic.exceptions import GraphStorageError

# Check if NetworkX is available
try:
    import networkx
    NETWORKX_AVAILABLE = True
except ImportError:
    NETWORKX_AVAILABLE = False


@pytest.mark.skipif(not NETWORKX_AVAILABLE, reason="NetworkX not installed")
class TestGraphStoreNetworkX:
    """Tests for NetworkX-based graph store."""
    
    @pytest.fixture
    def store(self):
        """Create in-memory NetworkX store."""
        return GraphStore(backend="networkx")
    
    def test_add_node(self, store):
        """Test adding a node."""
        store.add_node("A", node_type="entity", label="Test")
        
        assert store.has_node("A")
        node = store.get_node("A")
        assert node["type"] == "entity"
        assert node["label"] == "Test"
    
    def test_add_edge(self, store):
        """Test adding an edge."""
        store.add_node("A")
        store.add_node("B")
        store.add_edge("A", "B", edge_type="related_to")
        
        assert store.has_edge("A", "B")
        edge = store.get_edge("A", "B")
        assert edge["type"] == "related_to"
    
    def test_remove_node(self, store):
        """Test removing a node."""
        store.add_node("A")
        assert store.has_node("A")
        
        store.remove_node("A")
        assert not store.has_node("A")
    
    def test_remove_edge(self, store):
        """Test removing an edge."""
        store.add_node("A")
        store.add_node("B")
        store.add_edge("A", "B")
        
        store.remove_edge("A", "B")
        assert not store.has_edge("A", "B")
    
    def test_neighbors(self, store):
        """Test getting neighbors."""
        store.add_node("A")
        store.add_node("B")
        store.add_node("C")
        store.add_edge("A", "B")
        store.add_edge("A", "C")
        
        neighbors = list(store.neighbors("A"))
        assert len(neighbors) == 2
        assert "B" in neighbors
        assert "C" in neighbors
    
    def test_node_count(self, store):
        """Test node count."""
        assert store.node_count() == 0
        
        store.add_node("A")
        store.add_node("B")
        
        assert store.node_count() == 2
    
    def test_edge_count(self, store):
        """Test edge count."""
        store.add_node("A")
        store.add_node("B")
        store.add_edge("A", "B")
        
        assert store.edge_count() == 1
    
    def test_clear(self, store):
        """Test clearing the graph."""
        store.add_node("A")
        store.add_node("B")
        store.add_edge("A", "B")
        
        store.clear()
        
        assert store.node_count() == 0
        assert store.edge_count() == 0


class TestGraphStoreSQLite:
    """Tests for SQLite-based graph store."""
    
    @pytest.fixture
    def store(self, tmp_path):
        """Create SQLite store with temp file."""
        db_path = tmp_path / "test_graph.db"
        return GraphStore(backend="sqlite", path=str(db_path))
    
    def test_add_node(self, store):
        """Test adding a node."""
        store.add_node("entity_1", node_type="person", name="Alice")
        
        assert store.has_node("entity_1")
        node = store.get_node("entity_1")
        assert node["type"] == "person"
        assert node["name"] == "Alice"
    
    def test_add_edge(self, store):
        """Test adding an edge."""
        store.add_node("A")
        store.add_node("B")
        store.add_edge("A", "B", edge_type="knows", since=2020)
        
        edge = store.get_edge("A", "B")
        assert edge["type"] == "knows"
        assert edge["since"] == 2020
    
    def test_persistence(self, tmp_path):
        """Test that data persists across instances."""
        db_path = tmp_path / "persist_test.db"
        
        # Create and populate
        store1 = GraphStore(backend="sqlite", path=str(db_path))
        store1.add_node("X", node_type="entity", value=42)
        store1.add_node("Y")
        store1.add_edge("X", "Y", edge_type="link")
        
        # Create new instance
        store2 = GraphStore(backend="sqlite", path=str(db_path))
        
        assert store2.has_node("X")
        assert store2.get_node("X")["value"] == 42
        assert store2.has_edge("X", "Y")
    
    def test_update_node(self, store):
        """Test updating node properties."""
        store.add_node("A", node_type="entity", count=1)
        
        # Update by adding again
        store.add_node("A", node_type="entity", count=2, new_prop="test")
        
        node = store.get_node("A")
        assert node["count"] == 2
        assert node["new_prop"] == "test"
    
    def test_nodes_iteration(self, store):
        """Test iterating over nodes."""
        store.add_node("A")
        store.add_node("B")
        store.add_node("C")
        
        nodes = list(store.nodes())
        assert len(nodes) == 3
        assert set(nodes) == {"A", "B", "C"}
    
    def test_edges_iteration(self, store):
        """Test iterating over edges."""
        store.add_node("A")
        store.add_node("B")
        store.add_node("C")
        store.add_edge("A", "B")
        store.add_edge("B", "C")
        
        edges = list(store.edges())
        assert len(edges) == 2


class TestGraphStoreFactory:
    """Tests for graph store factory."""
    
    @pytest.mark.skipif(not NETWORKX_AVAILABLE, reason="NetworkX not installed")
    def test_create_networkx(self):
        """Test creating NetworkX store."""
        store = GraphStore(backend="networkx")
        assert store is not None
        assert store.backend == "networkx"
    
    def test_create_sqlite(self, tmp_path):
        """Test creating SQLite store."""
        store = GraphStore(backend="sqlite", path=str(tmp_path / "test.db"))
        assert store is not None
        assert store.backend == "sqlite"
    
    def test_invalid_backend(self):
        """Test invalid backend raises error."""
        with pytest.raises(GraphStorageError):
            GraphStore(backend="invalid")


@pytest.mark.skipif(not NETWORKX_AVAILABLE, reason="NetworkX not installed")
class TestGraphStoreAdvanced:
    """Advanced graph operations tests."""
    
    @pytest.fixture
    def store(self):
        """Create in-memory store with test data."""
        store = GraphStore(backend="networkx")
        # Build a small knowledge graph
        store.add_node("Python", node_type="language")
        store.add_node("NetworkX", node_type="library")
        store.add_node("Graphs", node_type="concept")
        store.add_node("Algorithms", node_type="concept")
        
        store.add_edge("NetworkX", "Python", edge_type="written_in")
        store.add_edge("NetworkX", "Graphs", edge_type="implements")
        store.add_edge("Graphs", "Algorithms", edge_type="uses")
        
        return store
    
    def test_find_path(self, store):
        """Test path finding."""
        path = store.find_path("NetworkX", "Algorithms")
        
        assert path is not None
        assert path[0] == "NetworkX"
        assert path[-1] == "Algorithms"
    
    def test_find_path_no_path(self, store):
        """Test when no path exists."""
        store.add_node("Isolated")
        path = store.find_path("NetworkX", "Isolated")
        
        assert path is None
    
    def test_query_by_type(self, store):
        """Test querying nodes by type."""
        concepts = store.query_by_type("concept")
        
        assert len(concepts) == 2
        names = [c["id"] for c in concepts]
        assert "Graphs" in names
        assert "Algorithms" in names
    
    def test_query_edges_by_type(self, store):
        """Test querying edges by type."""
        edges = store.query_edges_by_type("implements")
        
        assert len(edges) == 1
        assert edges[0]["source"] == "NetworkX"
        assert edges[0]["target"] == "Graphs"
    
    def test_export_import_json(self, store):
        """Test JSON export/import."""
        # Export
        data = store.export_json()
        
        assert "nodes" in data
        assert "edges" in data
        assert len(data["nodes"]) == 4
        assert len(data["edges"]) == 3
        
        # Import into new store
        new_store = GraphStore(backend="networkx")
        new_store.import_json(data)
        
        assert new_store.node_count() == 4
        assert new_store.edge_count() == 3
        assert new_store.has_node("Python")
    
    @pytest.mark.skipif(not NETWORKX_AVAILABLE, reason="NetworkX not installed")
    def test_edge_auto_creates_nodes(self):
        """Test that adding edge auto-creates missing nodes."""
        store = GraphStore(backend="networkx")
        
        # Add edge without creating nodes first
        store.add_edge("X", "Y", edge_type="link")
        
        assert store.has_node("X")
        assert store.has_node("Y")
        assert store.has_edge("X", "Y")
