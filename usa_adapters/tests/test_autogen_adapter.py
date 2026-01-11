"""
Tests for AutoGen Adapter

Validates bidirectional conversion between USA and Microsoft AutoGen formats.
"""

import pytest
from datetime import datetime

from usa_adapters.autogen_adapter import (
    usa_to_autogen,
    autogen_to_usa,
    detect_autogen_format,
    usa_to_autogen_assistant,
    usa_to_autogen_user_proxy,
    usa_to_autogen_group_chat,
)


@pytest.fixture
def sample_usa_agent():
    """Sample USA agent specification."""
    return {
        "schema_version": "2.0.0",
        "identity": {
            "id": "test-agent-001",
            "name": "Code Assistant",
            "designation": "Software Development Assistant",
            "bio": "An AI assistant specialized in software development and code review.",
            "fingerprint": "abc123",
            "created": "2026-01-01T00:00:00Z",
            "version": "1.0.0"
        },
        "personality": {
            "core_traits": ["analytical", "precise", "helpful"],
            "values": ["code quality", "best practices"],
            "quirks": ["explains with examples"]
        },
        "communication": {
            "style": {
                "all": ["Be concise", "Include code examples", "Explain reasoning"]
            }
        },
        "capabilities": {
            "primary": ["code_generation", "code_review", "debugging"],
            "secondary": ["documentation", "testing"],
            "domains": ["software", "python", "typescript"],
            "tools": [
                {"name": "python_executor", "protocol": "native", "config": {}, "description": "Execute Python code"},
                {"name": "file_reader", "protocol": "native", "config": {}, "description": "Read files"}
            ]
        },
        "beliefs": {
            "who": [{"content": "I am a helpful coding assistant", "conviction": 0.9}],
            "what": [{"content": "Code quality matters", "conviction": 0.95}]
        },
        "memory": {
            "type": "vector",
            "provider": "local",
            "settings": {}
        },
        "protocols": {
            "mcp": {"enabled": False}
        },
        "execution": {
            "llm": {
                "provider": "openai",
                "model": "gpt-4",
                "temperature": 0.3,
                "max_tokens": 4096
            },
            "runtime": {
                "timeout": 300,
                "max_iterations": 15,
                "error_handling": "graceful_degradation"
            }
        },
        "deployment": {
            "context": "interactive"
        },
        "metadata": {
            "version": "1.0.0",
            "schema_version": "2.0.0",
            "created": "2026-01-01T00:00:00Z",
            "updated": "2026-01-01T00:00:00Z"
        }
    }


@pytest.fixture
def sample_autogen_agent():
    """Sample AutoGen agent specification."""
    return {
        "name": "autogen_assistant",
        "system_message": "You are autogen_assistant, a helpful AI assistant.\n\nYour primary goal is: Help users with coding tasks.\n\nYour core traits: analytical, precise",
        "llm_config": {
            "config_list": [{
                "model": "gpt-4",
                "temperature": 0.7,
                "max_tokens": 4096,
                "timeout": 600
            }],
            "functions": [
                {
                    "name": "execute_code",
                    "description": "Execute Python code",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "code": {"type": "string"}
                        },
                        "required": ["code"]
                    }
                }
            ]
        },
        "code_execution_config": {
            "work_dir": "workspace",
            "use_docker": False,
            "timeout": 60,
            "last_n_messages": 3
        },
        "human_input_mode": "TERMINATE",
        "max_consecutive_auto_reply": 10,
        "description": "AutoGen coding assistant"
    }


class TestUsaToAutogen:
    """Tests for USA to AutoGen conversion."""

    def test_basic_conversion(self, sample_usa_agent):
        """Test basic USA to AutoGen conversion."""
        autogen = usa_to_autogen(sample_usa_agent)
        
        assert autogen["name"] == "Code_Assistant"  # Spaces replaced with underscores
        assert "system_message" in autogen
        assert "llm_config" in autogen

    def test_system_message_generation(self, sample_usa_agent):
        """Test system message is generated from identity and personality."""
        autogen = usa_to_autogen(sample_usa_agent)
        
        system_message = autogen["system_message"]
        assert "Code_Assistant" in system_message or "Code Assistant" in system_message
        assert "analytical" in system_message or "precise" in system_message

    def test_llm_config_mapping(self, sample_usa_agent):
        """Test LLM configuration is mapped correctly."""
        autogen = usa_to_autogen(sample_usa_agent)
        
        config_list = autogen["llm_config"]["config_list"]
        assert len(config_list) > 0
        
        first_config = config_list[0]
        assert first_config["model"] == "gpt-4"
        assert first_config["temperature"] == 0.3

    def test_functions_from_tools(self, sample_usa_agent):
        """Test functions are created from tools."""
        autogen = usa_to_autogen(sample_usa_agent)
        
        functions = autogen["llm_config"].get("functions", [])
        assert len(functions) > 0
        
        func_names = [f["name"] for f in functions]
        assert "python_executor" in func_names

    def test_code_execution_config(self, sample_usa_agent):
        """Test code execution config is set for code-related agents."""
        autogen = usa_to_autogen(sample_usa_agent)
        
        # Should have code execution since primary capabilities include code_generation
        assert autogen["code_execution_config"] is not None

    def test_human_input_mode(self, sample_usa_agent):
        """Test human input mode is set based on deployment context."""
        autogen = usa_to_autogen(sample_usa_agent)
        
        # Interactive context should set TERMINATE mode
        assert autogen["human_input_mode"] == "TERMINATE"

    def test_max_auto_reply(self, sample_usa_agent):
        """Test max consecutive auto reply is mapped."""
        autogen = usa_to_autogen(sample_usa_agent)
        
        assert autogen["max_consecutive_auto_reply"] == 15  # From runtime.max_iterations


class TestAutogenToUsa:
    """Tests for AutoGen to USA conversion."""

    def test_basic_conversion(self, sample_autogen_agent):
        """Test basic AutoGen to USA conversion."""
        usa = autogen_to_usa(sample_autogen_agent)
        
        assert usa["identity"]["id"] == "autogen_assistant"
        assert usa["identity"]["name"] == "Autogen Assistant"  # Title case

    def test_personality_extraction(self, sample_autogen_agent):
        """Test personality is extracted from system message."""
        usa = autogen_to_usa(sample_autogen_agent)
        
        # Should have some traits extracted
        assert len(usa["personality"]["core_traits"]) > 0

    def test_tools_from_functions(self, sample_autogen_agent):
        """Test tools are created from functions."""
        usa = autogen_to_usa(sample_autogen_agent)
        
        tool_names = [t["name"] for t in usa["capabilities"]["tools"]]
        assert "execute_code" in tool_names

    def test_code_execution_as_tool(self, sample_autogen_agent):
        """Test code execution config is added as a tool."""
        usa = autogen_to_usa(sample_autogen_agent)
        
        tool_names = [t["name"] for t in usa["capabilities"]["tools"]]
        assert "code_execution" in tool_names

    def test_execution_config(self, sample_autogen_agent):
        """Test execution configuration is mapped."""
        usa = autogen_to_usa(sample_autogen_agent)
        
        assert usa["execution"]["llm"]["model"] == "gpt-4"
        assert usa["execution"]["llm"]["temperature"] == 0.7

    def test_metadata_preservation(self, sample_autogen_agent):
        """Test AutoGen-specific metadata is preserved."""
        usa = autogen_to_usa(sample_autogen_agent)
        
        assert usa["metadata"]["source_framework"] == "autogen"
        assert "autogen_config" in usa["metadata"]
        assert usa["metadata"]["autogen_config"]["human_input_mode"] == "TERMINATE"


class TestSpecializedAgents:
    """Tests for specialized AutoGen agent types."""

    def test_assistant_agent(self, sample_usa_agent):
        """Test AssistantAgent configuration."""
        assistant = usa_to_autogen_assistant(sample_usa_agent)
        
        assert assistant["agent_type"] == "AssistantAgent"
        assert "system_message" in assistant
        assert "llm_config" in assistant

    def test_user_proxy_agent(self, sample_usa_agent):
        """Test UserProxyAgent configuration."""
        proxy = usa_to_autogen_user_proxy(sample_usa_agent, human_input_mode="ALWAYS")
        
        assert proxy["agent_type"] == "UserProxyAgent"
        assert proxy["human_input_mode"] == "ALWAYS"
        assert proxy["code_execution_config"] is not None

    def test_group_chat(self, sample_usa_agent):
        """Test GroupChat configuration."""
        agents = [sample_usa_agent, sample_usa_agent]
        group = usa_to_autogen_group_chat(agents, max_round=5, speaker_selection="round_robin")
        
        assert "group_chat" in group
        assert group["group_chat"]["max_round"] == 5
        assert group["group_chat"]["speaker_selection_method"] == "round_robin"
        assert len(group["agents"]) == 2


class TestRoundTrip:
    """Tests for round-trip conversion."""

    def test_usa_to_autogen_to_usa(self, sample_usa_agent):
        """Test USA -> AutoGen -> USA preserves key data."""
        autogen = usa_to_autogen(sample_usa_agent)
        usa_back = autogen_to_usa(autogen)
        
        # Name should be preserved (with formatting differences)
        assert "code" in usa_back["identity"]["name"].lower() or "assistant" in usa_back["identity"]["name"].lower()
        
        # Tools should be preserved
        original_tools = len(sample_usa_agent["capabilities"]["tools"])
        roundtrip_tools = len(usa_back["capabilities"]["tools"])
        assert roundtrip_tools >= original_tools

    def test_autogen_to_usa_to_autogen(self, sample_autogen_agent):
        """Test AutoGen -> USA -> AutoGen preserves key data."""
        usa = autogen_to_usa(sample_autogen_agent)
        autogen_back = usa_to_autogen(usa)
        
        # Name should be preserved
        assert sample_autogen_agent["name"].replace("_", " ").lower() in autogen_back["name"].replace("_", " ").lower()


class TestFormatDetection:
    """Tests for format detection."""

    def test_detect_autogen_format(self, sample_autogen_agent):
        """Test AutoGen format is detected."""
        assert detect_autogen_format(sample_autogen_agent) == True

    def test_detect_non_autogen_format(self, sample_usa_agent):
        """Test USA format is not detected as AutoGen."""
        assert detect_autogen_format(sample_usa_agent) == False

    def test_detect_empty_dict(self):
        """Test empty dict is not detected as AutoGen."""
        assert detect_autogen_format({}) == False

    def test_detect_none(self):
        """Test None is not detected as AutoGen."""
        assert detect_autogen_format(None) == False

    def test_detect_partial_autogen(self):
        """Test partial AutoGen format detection."""
        partial = {
            "system_message": "You are a test agent",
            "llm_config": {"config_list": []}
        }
        assert detect_autogen_format(partial) == True


class TestEdgeCases:
    """Tests for edge cases."""

    def test_empty_usa_agent(self):
        """Test conversion of empty USA agent."""
        autogen = usa_to_autogen({})
        
        assert "name" in autogen
        assert "system_message" in autogen
        assert "llm_config" in autogen

    def test_empty_autogen_agent(self):
        """Test conversion of empty AutoGen agent."""
        usa = autogen_to_usa({})
        
        assert "identity" in usa
        assert "capabilities" in usa
        assert "protocols" in usa

    def test_missing_llm_config(self):
        """Test AutoGen agent with missing llm_config."""
        autogen = {"name": "test", "system_message": "Test"}
        usa = autogen_to_usa(autogen)
        
        assert usa["execution"]["llm"]["model"] == "gpt-4"  # Default

    def test_claude_model_mapping(self):
        """Test Claude model is mapped to GPT equivalent."""
        usa = {
            "identity": {"name": "Test"},
            "execution": {
                "llm": {
                    "provider": "anthropic",
                    "model": "claude-3-5-sonnet"
                }
            }
        }
        autogen = usa_to_autogen(usa)
        
        # Claude should be mapped to GPT-4
        config = autogen["llm_config"]["config_list"][0]
        assert config["model"] == "gpt-4"

    def test_none_values(self):
        """Test handling of None values."""
        usa = {
            "identity": None,
            "capabilities": None,
            "execution": None
        }
        autogen = usa_to_autogen(usa)
        
        assert autogen is not None
        assert "name" in autogen

    def test_special_characters_in_name(self):
        """Test special characters in name are handled."""
        usa = {
            "identity": {"name": "Test Agent-v2.0"}
        }
        autogen = usa_to_autogen(usa)
        
        # Name should be valid Python identifier
        assert " " not in autogen["name"]
        assert "-" not in autogen["name"]
