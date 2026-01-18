"""
Uniform Semantic Agent Loader
Supports both v1 and v2 types with optional memory system integration.

The loader provides:
- Basic loading: load_agent() returns AgentSpec
- Memory-enabled loading: load_agent_with_memory() returns LoadedAgent with FusionRetriever
"""
import yaml
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Union, Any, Optional, TYPE_CHECKING

from .core import types_legacy
from .core import types

if TYPE_CHECKING:
    from memory_system.agent_adapter import AgentMemoryServices, AgentMemoryContext
    from memory_system.fusion import FusionRetriever

logger = logging.getLogger("central_logger")


class SemanticAgentLoader:
    """Load and deploy Uniform Semantic Agent specifications"""
    
    @staticmethod
    def load_from_file(file_path: Union[str, Path], type_module: Any = None) -> Any:
        """
        Load agent spec from YAML or JSON file
        
        Args:
            file_path: Path to specification file (.yaml, .yml, or .json)
            type_module: Type module to use (types_v1 or types_v2). 
                        Defaults to v2 if apiVersion is usa/v2, else v1
        
        Returns:
            AgentSpec object
        
        Raises:
            ValueError: If file format is not supported
            FileNotFoundError: If file does not exist
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"Spec file not found: {file_path}")
        
        with open(file_path, 'r') as f:
            if file_path.suffix in ['.yaml', '.yml', '.usa']:
                data = yaml.safe_load(f)
            elif file_path.suffix == '.json':
                data = json.load(f)
            else:
                raise ValueError(
                    f"Unsupported file format: {file_path.suffix}. "
                    "Use .yaml, .yml, .usa, or .json"
                )
        
        # Auto-detect version if type_module not specified
        if type_module is None:
            api_version = data.get('apiVersion', 'usa/v1')
            type_module = types_v2 if api_version == 'usa/v2' else types_v1
        
        return type_module.AgentSpec.from_dict(data)
    
    @staticmethod
    def load_from_dict(data: dict, type_module: Any = None) -> Any:
        """
        Load agent spec from dictionary
        
        Args:
            data: Dictionary containing agent specification
            type_module: Type module to use (defaults to auto-detect)
        
        Returns:
            AgentSpec object
        """
        if type_module is None:
            api_version = data.get('apiVersion', 'usa/v1')
            type_module = types_v2 if api_version == 'usa/v2' else types_v1
        
        return type_module.AgentSpec.from_dict(data)
    
    @staticmethod
    def load_from_yaml_string(yaml_string: str, type_module: Any = None) -> Any:
        """
        Load agent spec from YAML string
        
        Args:
            yaml_string: YAML formatted string
            type_module: Type module to use (defaults to auto-detect)
        
        Returns:
            AgentSpec object
        """
        data = yaml.safe_load(yaml_string)
        return SemanticAgentLoader.load_from_dict(data, type_module)
    
    @staticmethod
    def load_from_json_string(json_string: str, type_module: Any = None) -> Any:
        """
        Load agent spec from JSON string
        
        Args:
            json_string: JSON formatted string
            type_module: Type module to use (defaults to auto-detect)
        
        Returns:
            AgentSpec object
        """
        data = json.loads(json_string)
        return SemanticAgentLoader.load_from_dict(data, type_module)
    
    @staticmethod
    def save_to_file(spec: Any, file_path: Union[str, Path], format: str = "yaml"):
        """
        Save agent spec to file
        
        Args:
            spec: AgentSpec object to save
            file_path: Path where to save the file
            format: Output format ('yaml' or 'json')
        """
        file_path = Path(file_path)
        data = spec.to_dict()
        
        with open(file_path, 'w') as f:
            if format == "yaml":
                yaml.dump(data, f, default_flow_style=False, sort_keys=False)
            elif format == "json":
                json.dump(data, f, indent=2)
            else:
                raise ValueError(f"Unsupported format: {format}")


def load_agent(file_path: str, type_module: Any = None) -> Any:
    """
    Convenience function to load an agent specification
    
    Args:
        file_path: Path to agent specification file
        type_module: Type module to use (defaults to auto-detect)
    
    Returns:
        AgentSpec object (v1 or v2)
    """
    return SemanticAgentLoader.load_from_file(file_path, type_module)


def save_agent(spec: Any, file_path: str, format: str = "yaml"):
    """
    Convenience function to save an agent specification
    
    Args:
        spec: AgentSpec to save (v1 or v2)
        file_path: Where to save the file
        format: Output format ('yaml' or 'json')
    """
    SemanticAgentLoader.save_to_file(spec, file_path, format)


# =============================================================================
# MEMORY-ENABLED LOADING (requires memory_system package)
# =============================================================================

@dataclass
class LoadedAgent:
    """
    Container for a loaded agent with its memory services.
    
    Provides unified access to both the agent specification and
    the three-tier memory stack (Beads + Fireproof + Zep).
    
    Usage:
        loaded = await load_agent_with_memory("agent.yaml")
        
        # Access spec
        print(loaded.spec.metadata.name)
        
        # Use memory
        result = await loaded.fusion.retrieve_async("query")
        loaded.fusion.ingest("important fact", importance=0.9)
        
        # Cleanup when done
        await loaded.close()
    """
    spec: Any  # AgentSpec (v1 or v2)
    memory_services: Optional[Any] = None  # AgentMemoryServices when memory enabled
    _context: Optional[Any] = field(default=None, repr=False)  # AgentMemoryContext
    
    @property
    def fusion(self) -> Optional[Any]:
        """Get the FusionRetriever for three-tier memory access."""
        if self.memory_services:
            return self.memory_services.fusion
        return None
    
    @property
    def has_memory(self) -> bool:
        """Check if memory services are available."""
        return self.memory_services is not None
    
    @property
    def name(self) -> str:
        """Convenience accessor for agent name."""
        return self.spec.metadata.name
    
    @property
    def version(self) -> str:
        """Convenience accessor for agent version."""
        return self.spec.metadata.version
    
    async def close(self) -> None:
        """Clean up memory services."""
        if self._context:
            await self._context.shutdown()
        elif self.memory_services:
            await self.memory_services.close()
    
    async def __aenter__(self) -> "LoadedAgent":
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.close()


async def load_agent_with_memory(
    file_path: str,
    type_module: Any = None,
    enable_memory: bool = True,
) -> LoadedAgent:
    """
    Load an agent specification with initialized memory services.
    
    This function:
    1. Loads the AgentSpec from file
    2. Parses the memory configuration from capabilities.memory
    3. Creates a FusionRetriever with appropriate tiers:
       - BeadsService (short-term) - always enabled
       - FireproofService (hybrid) - if storage.fireproof configured
       - ZepHooks (long-term) - if storage.vector_db configured
    
    Args:
        file_path: Path to agent specification file (.yaml, .yml, or .json)
        type_module: Type module to use (defaults to auto-detect v1/v2)
        enable_memory: Whether to initialize memory services (default: True)
    
    Returns:
        LoadedAgent with spec and memory_services
    
    Example:
        async with await load_agent_with_memory("my-agent.yaml") as agent:
            # Ingest data
            agent.fusion.ingest("User prefers dark mode", importance=0.8)
            
            # Retrieve context
            result = await agent.fusion.retrieve_async("user preferences")
            print(result["beads"])  # Short-term context
            print(result["fireproof"])  # Durable local cache
            print(result["remote_embeddings"])  # Long-term from Zep
    """
    # Load the spec
    spec = load_agent(file_path, type_module)
    
    if not enable_memory:
        return LoadedAgent(spec=spec)
    
    # Check if this is a v2 spec with memory configuration
    api_version = getattr(spec, 'api_version', 'usa/v1')
    has_memory_config = (
        api_version == 'usa/v2' and
        spec.capabilities and
        spec.capabilities.memory is not None
    )
    
    if not has_memory_config:
        logger.info(
            "loader.load_agent_with_memory.no_memory_config",
            extra={"agent": spec.metadata.name, "api_version": api_version}
        )
        return LoadedAgent(spec=spec)
    
    # Import memory system components
    try:
        from memory_system.agent_adapter import AgentMemoryContext
        
        # Create and initialize memory context
        context = AgentMemoryContext(spec)
        services = await context.initialize()
        
        logger.info(
            "loader.load_agent_with_memory.success",
            extra={
                "agent": spec.metadata.name,
                "has_fireproof": services.fireproof is not None,
                "has_zep": services.zep_hooks is not None,
            }
        )
        
        return LoadedAgent(
            spec=spec,
            memory_services=services,
            _context=context,
        )
        
    except ImportError as e:
        logger.warning(
            "loader.load_agent_with_memory.import_error",
            extra={"error": str(e), "agent": spec.metadata.name}
        )
        return LoadedAgent(spec=spec)
    except Exception as e:
        logger.error(
            "loader.load_agent_with_memory.failed",
            extra={"error": str(e), "agent": spec.metadata.name}
        )
        return LoadedAgent(spec=spec)


def load_agent_sync(file_path: str, type_module: Any = None) -> LoadedAgent:
    """
    Synchronously load an agent without memory services.
    
    Use this when you don't need the three-tier memory stack,
    or when calling from sync code that can't await.
    
    Args:
        file_path: Path to agent specification file
        type_module: Type module to use (defaults to auto-detect)
    
    Returns:
        LoadedAgent with spec only (no memory_services)
    """
    spec = load_agent(file_path, type_module)
    return LoadedAgent(spec=spec)
