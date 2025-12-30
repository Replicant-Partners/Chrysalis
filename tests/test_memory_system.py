"""
Tests for memory system
"""
import pytest
import os
import tempfile
import shutil
from datetime import datetime

from memory_system import Memory, MemoryConfig
from memory_system.core import MemoryEntry
from memory_system.stores import WorkingMemory, CoreMemory


class TestWorkingMemory:
    """Test working memory implementation"""
    
    def test_add_and_retrieve(self):
        """Test adding and retrieving from working memory"""
        wm = WorkingMemory(max_size=3)
        
        entry1 = MemoryEntry.create("First message", "working")
        entry2 = MemoryEntry.create("Second message", "working")
        
        wm.add(entry1)
        wm.add(entry2)
        
        all_entries = wm.get_all()
        assert len(all_entries) == 2
        assert all_entries[0].content == "First message"
        assert all_entries[1].content == "Second message"
    
    def test_max_size_enforcement(self):
        """Test that working memory respects max size"""
        wm = WorkingMemory(max_size=2)
        
        wm.add(MemoryEntry.create("Message 1", "working"))
        wm.add(MemoryEntry.create("Message 2", "working"))
        wm.add(MemoryEntry.create("Message 3", "working"))
        
        all_entries = wm.get_all()
        assert len(all_entries) == 2
        # Should keep most recent
        assert all_entries[0].content == "Message 2"
        assert all_entries[1].content == "Message 3"
    
    def test_get_recent(self):
        """Test getting N recent entries"""
        wm = WorkingMemory(max_size=5)
        
        for i in range(5):
            wm.add(MemoryEntry.create(f"Message {i}", "working"))
        
        recent = wm.get_recent(3)
        assert len(recent) == 3
        assert recent[-1].content == "Message 4"
    
    def test_clear(self):
        """Test clearing working memory"""
        wm = WorkingMemory()
        wm.add(MemoryEntry.create("Message", "working"))
        
        wm.clear()
        assert len(wm.get_all()) == 0


class TestCoreMemory:
    """Test core memory implementation"""
    
    def test_set_and_get(self):
        """Test setting and getting core memory blocks"""
        cm = CoreMemory()
        
        cm.set("persona", "I am a helpful assistant")
        cm.set("user_facts", "User likes Python")
        
        assert cm.get("persona") == "I am a helpful assistant"
        assert cm.get("user_facts") == "User likes Python"
        assert cm.get("nonexistent") is None
    
    def test_update(self):
        """Test updating core memory blocks"""
        cm = CoreMemory()
        
        cm.set("persona", "Old persona")
        assert cm.update("persona", "New persona")
        assert cm.get("persona") == "New persona"
        
        # Cannot update non-existent
        assert not cm.update("nonexistent", "value")
    
    def test_delete(self):
        """Test deleting core memory blocks"""
        cm = CoreMemory()
        
        cm.set("test", "value")
        assert cm.delete("test")
        assert cm.get("test") is None
        
        # Cannot delete non-existent
        assert not cm.delete("nonexistent")
    
    def test_get_all(self):
        """Test getting all core memory blocks"""
        cm = CoreMemory()
        
        cm.set("key1", "value1")
        cm.set("key2", "value2")
        
        all_blocks = cm.get_all()
        assert len(all_blocks) == 2
        assert all_blocks["key1"] == "value1"
        assert all_blocks["key2"] == "value2"
    
    def test_persistence(self):
        """Test core memory persistence"""
        with tempfile.TemporaryDirectory() as tmpdir:
            persist_path = os.path.join(tmpdir, "core_memory.json")
            
            # Create and save
            cm1 = CoreMemory(persist_path=persist_path)
            cm1.set("persona", "Test persona")
            cm1.save()
            
            # Load in new instance
            cm2 = CoreMemory(persist_path=persist_path)
            assert cm2.get("persona") == "Test persona"


class TestMemoryIntegration:
    """Integration tests for full memory system"""
    
    @pytest.fixture
    def temp_memory(self):
        """Create temporary memory instance for testing"""
        tmpdir = tempfile.mkdtemp()
        
        config = MemoryConfig(
            storage_path=tmpdir,
            working_memory_size=5,
            openai_api_key=os.getenv("OPENAI_API_KEY", "test-key")
        )
        
        memory = Memory(config)
        
        yield memory
        
        # Cleanup
        shutil.rmtree(tmpdir, ignore_errors=True)
    
    def test_working_memory_operations(self, temp_memory):
        """Test working memory operations"""
        memory = temp_memory
        
        entry = memory.add_to_working_memory("Test message")
        assert entry.content == "Test message"
        assert entry.memory_type == "working"
        
        entries = memory.get_working_memory()
        assert len(entries) == 1
        assert entries[0].content == "Test message"
        
        memory.clear_working_memory()
        assert len(memory.get_working_memory()) == 0
    
    def test_core_memory_operations(self, temp_memory):
        """Test core memory operations"""
        memory = temp_memory
        
        memory.set_core_memory("persona", "Test persona")
        assert memory.get_core_memory("persona") == "Test persona"
        
        memory.update_core_memory("persona", "Updated persona")
        assert memory.get_core_memory("persona") == "Updated persona"
        
        all_core = memory.get_all_core_memory()
        assert "persona" in all_core
    
    def test_context_assembly(self, temp_memory):
        """Test context assembly for LLM"""
        memory = temp_memory
        
        # Set up memory
        memory.set_core_memory("persona", "I am a test assistant")
        memory.add_to_working_memory("Recent message 1")
        memory.add_to_working_memory("Recent message 2")
        
        # Get context
        context = memory.get_context()
        
        assert "Core Memory" in context
        assert "I am a test assistant" in context
        assert "Recent Context" in context
        assert "Recent message 2" in context
    
    def test_statistics(self, temp_memory):
        """Test memory statistics"""
        memory = temp_memory
        
        memory.set_core_memory("persona", "Test")
        memory.add_to_working_memory("Message 1")
        memory.add_to_working_memory("Message 2")
        
        stats = memory.get_stats()
        
        assert stats["working_memory_size"] == 2
        assert stats["core_memory_blocks"] == 1
        assert "config" in stats


class TestMemoryEntry:
    """Test MemoryEntry class"""
    
    def test_create_entry(self):
        """Test creating memory entry"""
        entry = MemoryEntry.create(
            content="Test content",
            memory_type="episodic",
            metadata={"key": "value"}
        )
        
        assert entry.content == "Test content"
        assert entry.memory_type == "episodic"
        assert entry.metadata["key"] == "value"
        assert isinstance(entry.timestamp, datetime)
        assert entry.id is not None
        assert entry.embedding is None
    
    def test_entry_with_embedding(self):
        """Test entry with embedding"""
        entry = MemoryEntry.create("Test", "semantic")
        entry.embedding = [0.1, 0.2, 0.3]
        
        assert entry.embedding == [0.1, 0.2, 0.3]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
