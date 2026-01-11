"""
Tests for LMOS Adapter

Validates bidirectional conversion between USA and LMOS formats.
"""

import pytest
from datetime import datetime

from usa_adapters.lmos_adapter import (
    usa_to_lmos,
    lmos_to_usa,
    detect_lmos_format,
)


@pytest.fixture
def sample_usa_agent():
    """Sample USA agent specification."""
    return {
        "schema_version": "2.0.0",
        "identity": {
            "id": "test-agent-001",
            "name": "Test Agent",
            "designation": "AI Assistant",
            "bio": "A helpful AI assistant for testing purposes.",
            "fingerprint": "abc123",
            "created": "2026-01-01T00:00:00Z",
            "version": "1.0.0"
        },
        "personality": {
            "core_traits": ["analytical", "helpful", "creative"],
            "values": ["accuracy", "efficiency"],
            "quirks": ["uses metaphors"]
        },
        "communication": {
            "style": {
                "all": ["Be concise", "Use examples"]
            }
        },
        "capabilities": {
            "primary": ["code_generation", "analysis"],
            "secondary": ["documentation"],
            "domains": ["software"],
            "tools": [
                {"name": "python", "protocol": "native", "config": {}},
                {"name": "search", "protocol": "mcp", "config": {}}
            ],
            "learned_skills": [
                {"name": "debugging", "category": "development", "prerequisites": []}
            ]
        },
        "memory": {
            "type": "vector",
            "provider": "local",
            "settings": {"max_tokens": 8192}
        },
        "protocols": {
            "mcp": {"enabled": True, "role": "client", "servers": [], "tools": []},
            "a2a": {"enabled": False}
        },
        "execution": {
            "llm": {
                "provider": "anthropic",
                "model": "claude-3-5-sonnet",
                "temperature": 0.7,
                "max_tokens": 4096
            },
            "runtime": {
                "timeout": 300,
                "max_iterations": 20,
                "error_handling": "graceful_degradation"
            }
        },
        "metadata": {
            "version": "1.0.0",
            "schema_version": "2.0.0",
            "created": "2026-01-01T00:00:00Z",
            "updated": "2026-01-01T00:00:00Z",
            "tags": ["test", "demo"]
        }
    }


@pytest.fixture
def sample_lmos_agent():
    """Sample LMOS agent specification."""
    return {
        "agent_id": "lmos-agent-001",
        "name": "LMOS Test Agent",
        "description": "A test agent in LMOS format",
        "system_prompt": "You are LMOS Test Agent, a helpful AI assistant.\n\nYour core traits: analytical, precise.",
        "skills": [
            {
                "name": "code_review",
                "description": "Review code for quality",
                "parameters": {},
                "required_capabilities": [],
                "version": "1.0.0"
            },
            {
                "name": "documentation",
                "description": "Generate documentation",
                "parameters": {},
                "required_capabilities": [],
                "version": "1.0.0"
            }
        ],
        "channels": [
            {
                "channel_id": "text-channel",
                "channel_type": "text",
                "config": {}
            },
            {
                "channel_id": "mcp-channel",
                "channel_type": "api",
                "config": {"protocol": "mcp", "role": "client"}
            }
        ],
        "memory": {
            "type": "vector",
            "provider": "local",
            "embedding_model": "text-embedding-3-small",
            "max_context_tokens": 8192,
            "persistence": True
        },
        "model": "gpt-4",
        "temperature": 0.7,
        "max_tokens": 4096,
        "metadata": {
            "source": "test",
            "tags": ["lmos", "test"]
        }
    }


class TestUsaToLmos:
    """Tests for USA to LMOS conversion."""

    def test_basic_conversion(self, sample_usa_agent):
        """Test basic USA to LMOS conversion."""
        lmos = usa_to_lmos(sample_usa_agent)
        
        assert lmos["name"] == "Test Agent"
        assert "test-agent" in lmos["agent_id"].lower()
        assert "AI Assistant" in lmos["description"]

    def test_system_prompt_generation(self, sample_usa_agent):
        """Test system prompt is generated from identity and personality."""
        lmos = usa_to_lmos(sample_usa_agent)
        
        system_prompt = lmos["system_prompt"]
        assert "Test Agent" in system_prompt
        assert "analytical" in system_prompt or "helpful" in system_prompt

    def test_skills_extraction(self, sample_usa_agent):
        """Test skills are extracted from capabilities."""
        lmos = usa_to_lmos(sample_usa_agent)
        
        skill_names = [s["name"] for s in lmos["skills"]]
        assert "python" in skill_names
        assert "search" in skill_names

    def test_channels_from_protocols(self, sample_usa_agent):
        """Test channels are created from protocols."""
        lmos = usa_to_lmos(sample_usa_agent)
        
        channel_types = [c["channel_type"] for c in lmos["channels"]]
        assert "text" in channel_types  # Default text channel
        
        # MCP channel should be present since mcp.enabled = True
        mcp_channels = [c for c in lmos["channels"] if c.get("config", {}).get("protocol") == "mcp"]
        assert len(mcp_channels) > 0

    def test_memory_configuration(self, sample_usa_agent):
        """Test memory configuration is mapped."""
        lmos = usa_to_lmos(sample_usa_agent)
        
        assert lmos["memory"]["type"] == "vector"
        assert lmos["memory"]["max_context_tokens"] == 8192

    def test_model_configuration(self, sample_usa_agent):
        """Test model configuration is mapped."""
        lmos = usa_to_lmos(sample_usa_agent)
        
        # Model should be mapped (Claude -> GPT equivalent for LMOS)
        assert lmos["temperature"] == 0.7
        assert lmos["max_tokens"] == 4096

    def test_metadata_preservation(self, sample_usa_agent):
        """Test metadata is preserved."""
        lmos = usa_to_lmos(sample_usa_agent)
        
        assert lmos["metadata"]["source"] == "usa"
        assert "usa_version" in lmos["metadata"]
        assert "imported_at" in lmos["metadata"]


class TestLmosToUsa:
    """Tests for LMOS to USA conversion."""

    def test_basic_conversion(self, sample_lmos_agent):
        """Test basic LMOS to USA conversion."""
        usa = lmos_to_usa(sample_lmos_agent)
        
        assert usa["identity"]["name"] == "Lmos Test Agent"  # Title case
        assert usa["identity"]["id"] == "lmos-agent-001"

    def test_personality_extraction(self, sample_lmos_agent):
        """Test personality is extracted from system prompt."""
        usa = lmos_to_usa(sample_lmos_agent)
        
        # Should have some traits extracted
        assert len(usa["personality"]["core_traits"]) > 0

    def test_tools_from_skills(self, sample_lmos_agent):
        """Test tools are created from skills."""
        usa = lmos_to_usa(sample_lmos_agent)
        
        tool_names = [t["name"] for t in usa["capabilities"]["tools"]]
        assert "code_review" in tool_names
        assert "documentation" in tool_names

    def test_protocols_from_channels(self, sample_lmos_agent):
        """Test protocols are extracted from channels."""
        usa = lmos_to_usa(sample_lmos_agent)
        
        # MCP should be enabled based on channel config
        assert usa["protocols"]["mcp"]["enabled"] == True

    def test_execution_config(self, sample_lmos_agent):
        """Test execution configuration is mapped."""
        usa = lmos_to_usa(sample_lmos_agent)
        
        assert usa["execution"]["llm"]["model"] == "gpt-4"
        assert usa["execution"]["llm"]["temperature"] == 0.7

    def test_schema_version(self, sample_lmos_agent):
        """Test schema version is set."""
        usa = lmos_to_usa(sample_lmos_agent)
        
        assert usa["schema_version"] == "2.0.0"


class TestRoundTrip:
    """Tests for round-trip conversion."""

    def test_usa_to_lmos_to_usa(self, sample_usa_agent):
        """Test USA -> LMOS -> USA preserves key data."""
        lmos = usa_to_lmos(sample_usa_agent)
        usa_back = lmos_to_usa(lmos)
        
        # Identity should be preserved
        assert usa_back["identity"]["name"] == sample_usa_agent["identity"]["name"]
        
        # Tools should be preserved (at least count)
        original_tools = len(sample_usa_agent["capabilities"]["tools"])
        roundtrip_tools = len(usa_back["capabilities"]["tools"])
        assert roundtrip_tools >= original_tools - 1  # Allow for some loss

    def test_lmos_to_usa_to_lmos(self, sample_lmos_agent):
        """Test LMOS -> USA -> LMOS preserves key data."""
        usa = lmos_to_usa(sample_lmos_agent)
        lmos_back = usa_to_lmos(usa)
        
        # Name should be preserved
        assert sample_lmos_agent["name"].lower() in lmos_back["name"].lower()
        
        # Skills should be preserved
        original_skills = len(sample_lmos_agent["skills"])
        roundtrip_skills = len(lmos_back["skills"])
        assert roundtrip_skills >= original_skills


class TestFormatDetection:
    """Tests for format detection."""

    def test_detect_lmos_format(self, sample_lmos_agent):
        """Test LMOS format is detected."""
        assert detect_lmos_format(sample_lmos_agent) == True

    def test_detect_non_lmos_format(self, sample_usa_agent):
        """Test USA format is not detected as LMOS."""
        assert detect_lmos_format(sample_usa_agent) == False

    def test_detect_empty_dict(self):
        """Test empty dict is not detected as LMOS."""
        assert detect_lmos_format({}) == False

    def test_detect_none(self):
        """Test None is not detected as LMOS."""
        assert detect_lmos_format(None) == False

    def test_detect_partial_lmos(self):
        """Test partial LMOS format detection."""
        partial = {
            "agent_id": "test",
            "system_prompt": "You are a test agent"
        }
        assert detect_lmos_format(partial) == True


class TestEdgeCases:
    """Tests for edge cases."""

    def test_empty_usa_agent(self):
        """Test conversion of empty USA agent."""
        lmos = usa_to_lmos({})
        
        assert "agent_id" in lmos
        assert "name" in lmos
        assert "system_prompt" in lmos

    def test_empty_lmos_agent(self):
        """Test conversion of empty LMOS agent."""
        usa = lmos_to_usa({})
        
        assert "identity" in usa
        assert "capabilities" in usa
        assert "protocols" in usa

    def test_missing_identity(self):
        """Test USA agent with missing identity."""
        usa = {"capabilities": {"tools": []}}
        lmos = usa_to_lmos(usa)
        
        assert lmos["name"] == "usa-agent"

    def test_missing_skills(self):
        """Test LMOS agent with missing skills."""
        lmos = {"agent_id": "test", "name": "Test"}
        usa = lmos_to_usa(lmos)
        
        assert usa["capabilities"]["tools"] == []

    def test_none_values(self):
        """Test handling of None values."""
        usa = {
            "identity": None,
            "capabilities": None,
            "protocols": None
        }
        lmos = usa_to_lmos(usa)
        
        assert lmos is not None
        assert "agent_id" in lmos
