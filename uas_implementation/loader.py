"""
Universal Agent Specification Loader
Supports both v1 and v2 types
"""
import yaml
import json
from pathlib import Path
from typing import Union, Any
from .core import types as types_v1
from .core import types_v2


class UniversalAgentLoader:
    """Load and deploy universal agent specifications"""
    
    @staticmethod
    def load_from_file(file_path: Union[str, Path], type_module: Any = None) -> Any:
        """
        Load agent spec from YAML or JSON file
        
        Args:
            file_path: Path to specification file (.yaml, .yml, or .json)
            type_module: Type module to use (types_v1 or types_v2). 
                        Defaults to v2 if apiVersion is uas/v2, else v1
        
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
            if file_path.suffix in ['.yaml', '.yml', '.uas']:
                data = yaml.safe_load(f)
            elif file_path.suffix == '.json':
                data = json.load(f)
            else:
                raise ValueError(
                    f"Unsupported file format: {file_path.suffix}. "
                    "Use .yaml, .yml, .uas, or .json"
                )
        
        # Auto-detect version if type_module not specified
        if type_module is None:
            api_version = data.get('apiVersion', 'uas/v1')
            type_module = types_v2 if api_version == 'uas/v2' else types_v1
        
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
            api_version = data.get('apiVersion', 'uas/v1')
            type_module = types_v2 if api_version == 'uas/v2' else types_v1
        
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
        return UniversalAgentLoader.load_from_dict(data, type_module)
    
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
        return UniversalAgentLoader.load_from_dict(data, type_module)
    
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
    return UniversalAgentLoader.load_from_file(file_path, type_module)


def save_agent(spec: Any, file_path: str, format: str = "yaml"):
    """
    Convenience function to save an agent specification
    
    Args:
        spec: AgentSpec to save (v1 or v2)
        file_path: Where to save the file
        format: Output format ('yaml' or 'json')
    """
    UniversalAgentLoader.save_to_file(spec, file_path, format)
