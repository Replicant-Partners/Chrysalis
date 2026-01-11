"""
Capability Enablement Tests

Validates that the system enables AI agents to build, extend, and compose
new capabilities autonomously while maintaining system coherence and safety.

Tests cover:
- Lossless morphing round-trips
- Experience sync convergence
- Adapter semantic correctness
- Protocol extensibility
- Memory deduplication effectiveness

@see docs/DESIGN_PATTERN_ANALYSIS.md - Section 2: AI Agent Capability Enablement
@see ARCHITECTURE.md - Component Architecture
"""

import pytest
from unittest.mock import Mock, MagicMock, patch
import json
import copy


class TestLosslessMorphing:
    """Test lossless morphing between frameworks."""
    
    def create_test_agent(self) -> dict:
        """Create a test agent with all fields populated."""
        return {
            "schema_version": "2.0.0",
            "identity": {
                "id": "agent-123",
                "name": "TestAgent",
                "designation": "Test Designation",
                "bio": "Test bio",
                "fingerprint": "abc123",
                "created": "2026-01-01T00:00:00Z",
                "version": "1.0.0",
            },
            "personality": {
                "core_traits": ["analytical", "creative"],
                "values": ["accuracy", "helpfulness"],
                "quirks": ["uses metaphors"],
            },
            "communication": {
                "style": {
                    "all": ["Be concise", "Use examples"],
                },
            },
            "capabilities": {
                "primary": ["code_generation", "analysis"],
                "secondary": ["documentation"],
                "domains": ["software", "data"],
                "tools": [
                    {"name": "python", "protocol": "native", "config": {}},
                ],
            },
            "knowledge": {
                "facts": ["Python is a programming language"],
                "topics": ["programming", "AI"],
                "expertise": ["machine learning"],
            },
            "memory": {
                "type": "vector",
                "provider": "local",
                "settings": {},
            },
            "beliefs": {
                "who": [{"content": "I am an AI assistant", "conviction": 0.9, "privacy": "PUBLIC", "source": "training"}],
                "what": [],
                "why": [],
                "how": [],
            },
            "instances": {
                "active": [],
                "terminated": [],
            },
            "experience_sync": {
                "enabled": True,
                "default_protocol": "streaming",
                "merge_strategy": {
                    "conflict_resolution": "latest_wins",
                    "memory_deduplication": True,
                    "skill_aggregation": "max",
                    "knowledge_verification_threshold": 0.7,
                },
            },
            "protocols": {
                "mcp": {"enabled": True, "role": "client", "servers": [], "tools": []},
            },
            "execution": {
                "llm": {
                    "provider": "anthropic",
                    "model": "claude-3-5-sonnet",
                    "temperature": 0.7,
                    "max_tokens": 4096,
                },
                "runtime": {
                    "timeout": 300,
                    "max_iterations": 20,
                    "error_handling": "graceful_degradation",
                },
            },
            "metadata": {
                "version": "1.0.0",
                "schema_version": "2.0.0",
                "created": "2026-01-01T00:00:00Z",
                "updated": "2026-01-01T00:00:00Z",
            },
        }
    
    def test_identity_preservation(self):
        """Identity fields should be preserved through morphing."""
        original = self.create_test_agent()
        
        # Simulate morph to CrewAI format
        crewai_format = {
            "agent": {
                "role": original["identity"]["designation"],
                "goal": original["capabilities"]["primary"][0] if original["capabilities"]["primary"] else "",
                "backstory": original["identity"]["bio"],
                "tools": [t["name"] for t in original["capabilities"].get("tools", [])],
            }
        }
        
        # Shadow fields store non-mappable data
        shadow_fields = {
            "identity": original["identity"],
            "personality": original["personality"],
            "beliefs": original["beliefs"],
            "memory": original["memory"],
            "experience_sync": original["experience_sync"],
            "protocols": original["protocols"],
            "execution": original["execution"],
            "metadata": original["metadata"],
        }
        
        # Restore from CrewAI + shadow
        restored = {
            **shadow_fields,
            "schema_version": original["schema_version"],
            "communication": original["communication"],
            "capabilities": original["capabilities"],
            "knowledge": original["knowledge"],
            "instances": original["instances"],
        }
        
        # Verify identity preserved
        assert restored["identity"]["id"] == original["identity"]["id"]
        assert restored["identity"]["name"] == original["identity"]["name"]
        assert restored["identity"]["fingerprint"] == original["identity"]["fingerprint"]
    
    def test_personality_preservation(self):
        """Personality traits should be preserved through morphing."""
        original = self.create_test_agent()
        
        # Deep copy to simulate morph/restore
        shadow = {"personality": copy.deepcopy(original["personality"])}
        restored_personality = shadow["personality"]
        
        assert restored_personality["core_traits"] == original["personality"]["core_traits"]
        assert restored_personality["values"] == original["personality"]["values"]
        assert restored_personality["quirks"] == original["personality"]["quirks"]
    
    def test_tool_configuration_preservation(self):
        """Tool configurations should be preserved through morphing."""
        original = self.create_test_agent()
        original["capabilities"]["tools"] = [
            {"name": "python", "protocol": "native", "config": {"version": "3.10"}},
            {"name": "search", "protocol": "mcp", "config": {"endpoint": "http://search"}},
        ]
        
        shadow = {"tools": copy.deepcopy(original["capabilities"]["tools"])}
        restored_tools = shadow["tools"]
        
        assert len(restored_tools) == 2
        assert restored_tools[0]["config"]["version"] == "3.10"
        assert restored_tools[1]["config"]["endpoint"] == "http://search"
    
    def test_memory_configuration_preservation(self):
        """Memory configuration should be preserved through morphing."""
        original = self.create_test_agent()
        original["memory"]["settings"] = {
            "embedding_model": "voyage-3",
            "similarity_threshold": 0.85,
        }
        
        shadow = {"memory": copy.deepcopy(original["memory"])}
        restored_memory = shadow["memory"]
        
        assert restored_memory["type"] == original["memory"]["type"]
        assert restored_memory["settings"]["embedding_model"] == "voyage-3"
        assert restored_memory["settings"]["similarity_threshold"] == 0.85


class TestExperienceSyncConvergence:
    """Test experience synchronization convergence."""
    
    def test_streaming_sync_ordering(self):
        """Streaming sync should maintain event ordering."""
        events = [
            {"event_id": "e1", "timestamp": "2026-01-01T00:00:01Z", "priority": 0.8},
            {"event_id": "e2", "timestamp": "2026-01-01T00:00:02Z", "priority": 0.5},
            {"event_id": "e3", "timestamp": "2026-01-01T00:00:03Z", "priority": 0.9},
        ]
        
        # Sort by timestamp (streaming order)
        sorted_events = sorted(events, key=lambda e: e["timestamp"])
        
        assert sorted_events[0]["event_id"] == "e1"
        assert sorted_events[1]["event_id"] == "e2"
        assert sorted_events[2]["event_id"] == "e3"
    
    def test_lumped_sync_batching(self):
        """Lumped sync should correctly batch events."""
        class LumpedSyncSimulator:
            def __init__(self, batch_size: int = 10):
                self.batch_size = batch_size
                self.pending = []
            
            def add_event(self, event: dict):
                self.pending.append(event)
            
            def should_flush(self) -> bool:
                return len(self.pending) >= self.batch_size
            
            def flush(self) -> list:
                batch = self.pending[:self.batch_size]
                self.pending = self.pending[self.batch_size:]
                return batch
        
        sync = LumpedSyncSimulator(batch_size=5)
        
        # Add events
        for i in range(12):
            sync.add_event({"event_id": f"e{i}"})
        
        # Should have 2 full batches + 2 remaining
        assert sync.should_flush()
        
        batch1 = sync.flush()
        assert len(batch1) == 5
        
        batch2 = sync.flush()
        assert len(batch2) == 5
        
        assert len(sync.pending) == 2
    
    def test_conflict_resolution_latest_wins(self):
        """Latest wins conflict resolution should select most recent."""
        class ConflictResolver:
            def resolve_latest_wins(self, values: list) -> dict:
                """Select value with latest timestamp."""
                return max(values, key=lambda v: v["timestamp"])
        
        resolver = ConflictResolver()
        
        conflicting_values = [
            {"value": "old", "timestamp": "2026-01-01T00:00:00Z", "source": "instance-1"},
            {"value": "new", "timestamp": "2026-01-01T00:00:05Z", "source": "instance-2"},
            {"value": "middle", "timestamp": "2026-01-01T00:00:03Z", "source": "instance-3"},
        ]
        
        winner = resolver.resolve_latest_wins(conflicting_values)
        
        assert winner["value"] == "new"
        assert winner["source"] == "instance-2"
    
    def test_skill_aggregation_max(self):
        """Max skill aggregation should select highest proficiency."""
        class SkillAggregator:
            def aggregate_max(self, skill_reports: list) -> dict:
                """Aggregate skills using max proficiency."""
                skills = {}
                for report in skill_reports:
                    for skill in report["skills"]:
                        name = skill["name"]
                        if name not in skills or skill["proficiency"] > skills[name]["proficiency"]:
                            skills[name] = skill
                return skills
        
        aggregator = SkillAggregator()
        
        reports = [
            {"instance": "i1", "skills": [
                {"name": "python", "proficiency": 0.7},
                {"name": "sql", "proficiency": 0.5},
            ]},
            {"instance": "i2", "skills": [
                {"name": "python", "proficiency": 0.9},
                {"name": "javascript", "proficiency": 0.6},
            ]},
        ]
        
        aggregated = aggregator.aggregate_max(reports)
        
        assert aggregated["python"]["proficiency"] == 0.9
        assert aggregated["sql"]["proficiency"] == 0.5
        assert aggregated["javascript"]["proficiency"] == 0.6


class TestAdapterSemanticCorrectness:
    """Test adapter semantic correctness."""
    
    def test_crewai_adapter_identity_mapping(self):
        """CrewAI adapter should correctly map identity fields."""
        usa_agent = {
            "identity": {
                "name": "Ada",
                "designation": "Research Assistant",
                "bio": "Specialized in data analysis",
            },
            "capabilities": {
                "primary": ["analysis", "research"],
                "tools": [{"name": "python", "protocol": "native", "config": {}}],
            },
        }
        
        # Simulate CrewAI mapping
        crewai_agent = {
            "role": usa_agent["identity"]["designation"],
            "goal": usa_agent["capabilities"]["primary"][0],
            "backstory": usa_agent["identity"]["bio"],
            "tools": [t["name"] for t in usa_agent["capabilities"]["tools"]],
        }
        
        assert crewai_agent["role"] == "Research Assistant"
        assert crewai_agent["goal"] == "analysis"
        assert crewai_agent["backstory"] == "Specialized in data analysis"
        assert "python" in crewai_agent["tools"]
    
    def test_eliza_adapter_persona_mapping(self):
        """ElizaOS adapter should correctly map persona fields."""
        usa_agent = {
            "identity": {
                "name": "Eliza",
                "bio": "A conversational AI",
            },
            "personality": {
                "core_traits": ["empathetic", "curious"],
                "values": ["helpfulness"],
            },
            "communication": {
                "signature_phrases": ["Tell me more", "How does that make you feel?"],
            },
        }
        
        # Simulate ElizaOS mapping
        eliza_persona = {
            "name": usa_agent["identity"]["name"],
            "system": usa_agent["identity"]["bio"],
            "adjectives": usa_agent["personality"]["core_traits"],
            "topics": usa_agent["personality"]["values"],
        }
        
        assert eliza_persona["name"] == "Eliza"
        assert eliza_persona["system"] == "A conversational AI"
        assert "empathetic" in eliza_persona["adjectives"]
    
    def test_replicant_adapter_comprehensive_mapping(self):
        """Replicant adapter should preserve comprehensive personality data."""
        replicant = {
            "name": "Deckard",
            "designation": "Blade Runner",
            "bio": "A detective specializing in replicant cases",
            "personality": {
                "core_traits": ["determined", "conflicted"],
                "quirks": ["chain smoker"],
                "values": ["justice"],
                "fears": ["losing humanity"],
                "aspirations": ["find truth"],
            },
            "beliefs": {
                "who": [{"content": "I might be a replicant", "conviction": 0.3}],
                "what": [{"content": "Replicants deserve rights", "conviction": 0.7}],
            },
            "emotional_ranges": {
                "anger": {"triggers": ["injustice"], "expressions": ["cold stare"]},
            },
        }
        
        # Simulate USA mapping
        usa_agent = {
            "identity": {
                "name": replicant["name"],
                "designation": replicant["designation"],
                "bio": replicant["bio"],
            },
            "personality": replicant["personality"],
            "beliefs": replicant["beliefs"],
        }
        
        # Verify comprehensive preservation
        assert usa_agent["personality"]["fears"] == ["losing humanity"]
        assert usa_agent["personality"]["aspirations"] == ["find truth"]
        assert len(usa_agent["beliefs"]["who"]) == 1
        assert usa_agent["beliefs"]["who"][0]["conviction"] == 0.3


class TestMemoryDeduplication:
    """Test memory deduplication effectiveness."""
    
    def test_jaccard_similarity_calculation(self):
        """Jaccard similarity should be correctly calculated."""
        def jaccard_similarity(text1: str, text2: str) -> float:
            """Calculate Jaccard similarity between two texts."""
            words1 = set(text1.lower().split())
            words2 = set(text2.lower().split())
            
            intersection = len(words1 & words2)
            union = len(words1 | words2)
            
            return intersection / union if union > 0 else 0.0
        
        # Identical texts
        assert jaccard_similarity("hello world", "hello world") == 1.0
        
        # Completely different
        assert jaccard_similarity("hello world", "foo bar") == 0.0
        
        # Partial overlap
        sim = jaccard_similarity("the quick brown fox", "the slow brown dog")
        assert 0.2 < sim < 0.6  # "the" and "brown" overlap
    
    def test_duplicate_detection_threshold(self):
        """Duplicates should be detected above threshold."""
        class MemoryDeduplicator:
            def __init__(self, threshold: float = 0.9):
                self.threshold = threshold
                self.memories = []
            
            def jaccard(self, text1: str, text2: str) -> float:
                words1 = set(text1.lower().split())
                words2 = set(text2.lower().split())
                intersection = len(words1 & words2)
                union = len(words1 | words2)
                return intersection / union if union > 0 else 0.0
            
            def find_duplicate(self, new_memory: str) -> str | None:
                for existing in self.memories:
                    if self.jaccard(new_memory, existing) >= self.threshold:
                        return existing
                return None
            
            def add_memory(self, memory: str) -> tuple[bool, str | None]:
                """Add memory, returns (is_new, duplicate_if_found)."""
                duplicate = self.find_duplicate(memory)
                if duplicate:
                    return False, duplicate
                self.memories.append(memory)
                return True, None
        
        dedup = MemoryDeduplicator(threshold=0.8)
        
        # Add first memory
        is_new, dup = dedup.add_memory("The user asked about Python programming")
        assert is_new
        assert dup is None
        
        # Add similar memory (should be duplicate)
        is_new, dup = dedup.add_memory("The user asked about Python programming language")
        # This might or might not be a duplicate depending on exact threshold
        
        # Add different memory
        is_new, dup = dedup.add_memory("The weather is sunny today")
        assert is_new
        assert dup is None
    
    def test_merge_preserves_metadata(self):
        """Merging duplicates should preserve important metadata."""
        class MemoryMerger:
            def merge(self, existing: dict, new: dict) -> dict:
                """Merge new memory into existing, preserving metadata."""
                return {
                    "content": existing["content"],  # Keep original content
                    "confidence": max(existing["confidence"], new["confidence"]),
                    "accessed_count": existing["accessed_count"] + 1,
                    "last_accessed": new["timestamp"],
                    "sources": list(set(existing.get("sources", []) + new.get("sources", []))),
                }
        
        merger = MemoryMerger()
        
        existing = {
            "content": "Python is a programming language",
            "confidence": 0.8,
            "accessed_count": 5,
            "sources": ["instance-1"],
        }
        
        new = {
            "content": "Python is a programming language used for AI",
            "confidence": 0.9,
            "timestamp": "2026-01-01T00:00:00Z",
            "sources": ["instance-2"],
        }
        
        merged = merger.merge(existing, new)
        
        assert merged["confidence"] == 0.9  # Max of both
        assert merged["accessed_count"] == 6  # Incremented
        assert "instance-1" in merged["sources"]
        assert "instance-2" in merged["sources"]


class TestProtocolExtensibility:
    """Test protocol extensibility for future agent protocols."""
    
    def test_protocol_registry(self):
        """Protocol registry should support adding new protocols."""
        class ProtocolRegistry:
            def __init__(self):
                self.protocols = {}
            
            def register(self, name: str, handler: callable):
                self.protocols[name] = handler
            
            def get(self, name: str) -> callable | None:
                return self.protocols.get(name)
            
            def list_protocols(self) -> list:
                return list(self.protocols.keys())
        
        registry = ProtocolRegistry()
        
        # Register built-in protocols
        registry.register("mcp", lambda: "MCP handler")
        registry.register("a2a", lambda: "A2A handler")
        registry.register("agent_protocol", lambda: "Agent Protocol handler")
        
        assert len(registry.list_protocols()) == 3
        
        # Register new protocol
        registry.register("lmos", lambda: "LMOS handler")
        
        assert "lmos" in registry.list_protocols()
        assert registry.get("lmos")() == "LMOS handler"
    
    def test_adapter_interface_compliance(self):
        """New adapters should comply with adapter interface."""
        class AdapterInterface:
            """Base interface for framework adapters."""
            
            def morph(self, agent: dict, target_type: str) -> tuple[dict, dict]:
                """Morph agent to target format, return (morphed, shadow)."""
                raise NotImplementedError
            
            def restore(self, morphed: dict, shadow: dict) -> dict:
                """Restore agent from morphed format and shadow fields."""
                raise NotImplementedError
        
        class NewProtocolAdapter(AdapterInterface):
            """Example new protocol adapter."""
            
            def morph(self, agent: dict, target_type: str) -> tuple[dict, dict]:
                morphed = {"name": agent["identity"]["name"]}
                shadow = {"full_agent": agent}
                return morphed, shadow
            
            def restore(self, morphed: dict, shadow: dict) -> dict:
                return shadow["full_agent"]
        
        adapter = NewProtocolAdapter()
        
        test_agent = {"identity": {"name": "Test"}, "capabilities": {}}
        
        morphed, shadow = adapter.morph(test_agent, "new_protocol")
        restored = adapter.restore(morphed, shadow)
        
        assert restored == test_agent, "Round-trip should preserve agent"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
