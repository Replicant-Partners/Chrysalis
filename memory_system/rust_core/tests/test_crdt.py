"""
Tests for Chrysalis Memory CRDT types.

Run with: pytest tests/
After: maturin develop
"""

import pytest
import asyncio
import tempfile
import os

# Try to import Rust bindings, fall back to stubs
try:
    from chrysalis_memory import (
        GSet,
        ORSet,
        LWWRegister,
        GCounter,
        VectorClock,
        MemoryDocument,
        MemoryCollection,
        MemoryStorage,
        AgentMemory,
        RUST_AVAILABLE,
    )
except ImportError:
    pytest.skip("Rust bindings not available, run 'maturin develop' first", allow_module_level=True)


class TestGSet:
    """Tests for GSet (Grow-only Set) CRDT."""

    def test_add_and_contains(self):
        gset = GSet()
        gset.add("element1")
        gset.add("element2")

        assert gset.contains("element1")
        assert gset.contains("element2")
        assert not gset.contains("element3")

    def test_elements(self):
        gset = GSet()
        gset.add("a")
        gset.add("b")
        gset.add("c")

        elements = gset.elements()
        assert len(elements) == 3
        assert set(elements) == {"a", "b", "c"}

    def test_merge_is_union(self):
        set1 = GSet()
        set1.add("a")
        set1.add("b")

        set2 = GSet()
        set2.add("b")
        set2.add("c")

        merged = set1.merge(set2)

        assert merged.len() == 3
        assert merged.contains("a")
        assert merged.contains("b")
        assert merged.contains("c")

    def test_merge_is_commutative(self):
        set1 = GSet()
        set1.add("a")
        set1.add("b")

        set2 = GSet()
        set2.add("c")
        set2.add("d")

        ab = set1.merge(set2)
        ba = set2.merge(set1)

        assert set(ab.elements()) == set(ba.elements())

    def test_merge_is_idempotent(self):
        gset = GSet()
        gset.add("a")
        gset.add("b")

        merged = gset.merge(gset)
        assert merged.len() == gset.len()


class TestORSet:
    """Tests for ORSet (Observed-Remove Set) CRDT."""

    def test_add_and_contains(self):
        orset = ORSet("instance1")
        orset.add("element1")

        assert orset.contains("element1")
        assert not orset.contains("element2")

    def test_remove(self):
        orset = ORSet("instance1")
        tag = orset.add("element1")

        assert orset.contains("element1")

        orset.remove("element1", [tag])

        assert not orset.contains("element1")

    def test_concurrent_add_remove(self):
        """Concurrent add+remove: add wins (because new tag wasn't observed)."""
        orset1 = ORSet("instance1")
        orset2 = ORSet("instance2")

        # Instance 1 adds element
        tag1 = orset1.add("shared")

        # Instance 2 also adds element
        tag2 = orset2.add("shared")

        # Instance 1 removes what it observed
        orset1.remove("shared", [tag1])

        # Merge should preserve instance 2's add (tag2 wasn't observed by instance 1)
        merged = orset1.merge(orset2)

        assert merged.contains("shared")

    def test_merge_is_commutative(self):
        set1 = ORSet("i1")
        set1.add("a")
        set1.add("b")

        set2 = ORSet("i2")
        set2.add("c")

        ab = set1.merge(set2)
        ba = set2.merge(set1)

        assert set(ab.elements()) == set(ba.elements())


class TestLWWRegister:
    """Tests for LWWRegister (Last-Writer-Wins Register) CRDT."""

    def test_set_and_get(self):
        reg = LWWRegister()
        reg.set("value1", 1.0, "writer1")

        assert reg.get() == "value1"
        assert reg.get_timestamp() == 1.0
        assert reg.get_writer() == "writer1"

    def test_latest_timestamp_wins(self):
        reg1 = LWWRegister()
        reg1.set("old_value", 1.0, "writer1")

        reg2 = LWWRegister()
        reg2.set("new_value", 2.0, "writer2")

        merged = reg1.merge(reg2)

        assert merged.get() == "new_value"

    def test_merge_is_commutative(self):
        reg1 = LWWRegister()
        reg1.set("value1", 1.0, "w1")

        reg2 = LWWRegister()
        reg2.set("value2", 2.0, "w2")

        ab = reg1.merge(reg2)
        ba = reg2.merge(reg1)

        assert ab.get() == ba.get()


class TestVectorClock:
    """Tests for VectorClock."""

    def test_tick(self):
        vc = VectorClock()

        val1 = vc.tick("agent1")
        val2 = vc.tick("agent1")

        assert val1 == 1
        assert val2 == 2
        assert vc.get("agent1") == 2

    def test_happened_before(self):
        vc1 = VectorClock()
        vc1.set("a", 1)
        vc1.set("b", 2)

        vc2 = VectorClock()
        vc2.set("a", 2)
        vc2.set("b", 3)

        assert vc1.happened_before(vc2)
        assert not vc2.happened_before(vc1)

    def test_concurrent(self):
        vc1 = VectorClock()
        vc1.set("a", 2)
        vc1.set("b", 1)

        vc2 = VectorClock()
        vc2.set("a", 1)
        vc2.set("b", 2)

        assert vc1.concurrent(vc2)


class TestMemoryDocument:
    """Tests for MemoryDocument."""

    def test_create(self):
        mem = MemoryDocument(
            id="test-1",
            content="Test content",
            memory_type="semantic",
            source_instance="agent-001"
        )

        assert mem.id == "test-1"
        assert mem.content == "Test content"
        assert mem.memory_type == "semantic"
        assert mem.source_instance == "agent-001"

    def test_tags(self):
        mem = MemoryDocument(content="Test")

        mem.add_tag("tag1")
        mem.add_tag("tag2")

        tags = mem.get_tags()
        assert "tag1" in tags
        assert "tag2" in tags

    def test_importance(self):
        mem = MemoryDocument(content="Test")

        mem.set_importance(0.9, "agent1")
        assert mem.get_importance() == 0.9

    def test_merge_accumulates_tags(self):
        mem1 = MemoryDocument(id="shared", content="Content 1", source_instance="a1")
        mem1.add_tag("tag1")

        mem2 = MemoryDocument(id="shared", content="Content 2", source_instance="a2")
        mem2.add_tag("tag2")

        merged = mem1.merge(mem2)

        tags = merged.get_tags()
        assert "tag1" in tags
        assert "tag2" in tags

    def test_merge_max_importance(self):
        mem1 = MemoryDocument(id="shared", content="Test", source_instance="a1")
        mem1.set_importance(0.5, "a1")

        mem2 = MemoryDocument(id="shared", content="Test", source_instance="a2")
        mem2.set_importance(0.9, "a2")

        merged = mem1.merge(mem2)

        assert merged.get_importance() >= 0.9


@pytest.mark.skipif(not RUST_AVAILABLE, reason="Rust bindings required")
class TestMemoryStorage:
    """Tests for MemoryStorage."""

    def test_put_and_get(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test.db")
            storage = MemoryStorage(db_path, "test-agent")

            mem = MemoryDocument(
                id="test-1",
                content="Test content",
                memory_type="semantic",
                source_instance="test-agent"
            )

            storage.put(mem)

            retrieved = storage.get("test-1")
            assert retrieved is not None
            assert retrieved.content == "Test content"

    def test_merge_on_put(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test.db")
            storage = MemoryStorage(db_path, "test-agent")

            # First version
            mem1 = MemoryDocument(id="merge-test", content="V1", source_instance="a1")
            mem1.add_tag("tag1")
            storage.put(mem1)

            # Second version (should merge)
            mem2 = MemoryDocument(id="merge-test", content="V2", source_instance="a2")
            mem2.add_tag("tag2")
            mem2.set_importance(0.9, "a2")
            storage.put(mem2)

            merged = storage.get("merge-test")

            # Should have both tags
            tags = merged.get_tags()
            assert "tag1" in tags
            assert "tag2" in tags

            # Should have max importance
            assert merged.get_importance() >= 0.9

    def test_query_by_type(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test.db")
            storage = MemoryStorage(db_path, "test-agent")

            storage.put(MemoryDocument(id="m1", content="C1", memory_type="semantic"))
            storage.put(MemoryDocument(id="m2", content="C2", memory_type="episodic"))
            storage.put(MemoryDocument(id="m3", content="C3", memory_type="semantic"))

            semantic = storage.query_by_type("semantic")
            assert len(semantic) == 2


@pytest.mark.asyncio
class TestAgentMemory:
    """Tests for high-level AgentMemory API."""

    async def test_learn_and_recall(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["FIREPROOF_DB_PATH"] = os.path.join(tmpdir, "agent.db")

            async with AgentMemory("test-agent") as memory:
                # Learn something
                mem_id = await memory.learn(
                    "Python is great for AI",
                    importance=0.9,
                    tags=["python", "ai"]
                )

                assert mem_id is not None

                # Recall
                results = await memory.recall("What is good for AI?")

                assert len(results) > 0
                assert any("Python" in r.content for r in results)

    async def test_update(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["FIREPROOF_DB_PATH"] = os.path.join(tmpdir, "agent.db")

            async with AgentMemory("test-agent") as memory:
                mem_id = await memory.learn("Original content", importance=0.5)

                updated = await memory.update(
                    mem_id,
                    importance=0.9,
                    tags_add=["updated"]
                )

                assert updated is not None
                assert updated.get_importance() >= 0.9
                assert "updated" in updated.get_tags()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
