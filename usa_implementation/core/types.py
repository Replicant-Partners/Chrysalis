"""
Uniform Semantic Agent - Core Types
"""
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any
from enum import Enum


class ProtocolType(str, Enum):
    """Supported protocol types"""
    MCP = "mcp"
    NATIVE = "native"
    API = "api"


class MCPRole(str, Enum):
    """MCP protocol roles"""
    CLIENT = "client"
    SERVER = "server"
    BOTH = "both"


class MemoryType(str, Enum):
    """Memory types"""
    NONE = "none"
    SHORT_TERM = "short_term"
    LONG_TERM = "long_term"
    VECTOR = "vector"


class ReasoningStrategy(str, Enum):
    """Reasoning strategies"""
    CHAIN_OF_THOUGHT = "chain_of_thought"
    REACT = "react"
    REFLEXION = "reflexion"
    TREE_OF_THOUGHTS = "tree_of_thoughts"


@dataclass
class Metadata:
    """Agent metadata"""
    name: str
    version: str
    description: Optional[str] = None
    author: Optional[str] = None
    license: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Metadata':
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "license": self.license,
            "tags": self.tags
        }


@dataclass
class Identity:
    """Agent identity and persona"""
    role: str
    goal: str
    backstory: Optional[str] = None
    personality_traits: Dict[str, Any] = field(default_factory=dict)
    constraints: List[str] = field(default_factory=list)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Identity':
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "role": self.role,
            "goal": self.goal,
            "backstory": self.backstory,
            "personality_traits": self.personality_traits,
            "constraints": self.constraints
        }


@dataclass
class Tool:
    """Tool specification"""
    name: str
    protocol: ProtocolType
    config: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Tool':
        data['protocol'] = ProtocolType(data['protocol'])
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "protocol": self.protocol.value,
            "config": self.config
        }


@dataclass
class Skill:
    """Skill specification"""
    name: str
    type: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Skill':
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.type,
            "parameters": self.parameters
        }


@dataclass
class Reasoning:
    """Reasoning configuration"""
    strategy: ReasoningStrategy
    max_iterations: int = 20
    allow_backtracking: bool = True
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Reasoning':
        data['strategy'] = ReasoningStrategy(data['strategy'])
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "strategy": self.strategy.value,
            "max_iterations": self.max_iterations,
            "allow_backtracking": self.allow_backtracking
        }


@dataclass
class Memory:
    """Memory configuration"""
    type: MemoryType
    scope: str
    provider: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Memory':
        data['type'] = MemoryType(data['type'])
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "type": self.type.value,
            "scope": self.scope,
            "provider": self.provider,
            "config": self.config
        }


@dataclass
class Capabilities:
    """Agent capabilities"""
    tools: List[Tool] = field(default_factory=list)
    skills: List[Skill] = field(default_factory=list)
    reasoning: Optional[Reasoning] = None
    memory: Optional[Memory] = None
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Capabilities':
        tools = [Tool.from_dict(t) for t in data.get('tools', [])]
        skills = [Skill.from_dict(s) for s in data.get('skills', [])]
        reasoning = Reasoning.from_dict(data['reasoning']) if data.get('reasoning') else None
        memory = Memory.from_dict(data['memory']) if data.get('memory') else None
        
        return cls(
            tools=tools,
            skills=skills,
            reasoning=reasoning,
            memory=memory
        )
    
    def to_dict(self) -> dict:
        return {
            "tools": [t.to_dict() for t in self.tools],
            "skills": [s.to_dict() for s in self.skills],
            "reasoning": self.reasoning.to_dict() if self.reasoning else None,
            "memory": self.memory.to_dict() if self.memory else None
        }


@dataclass
class MCPServer:
    """MCP server configuration"""
    name: str
    command: str
    args: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'MCPServer':
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "command": self.command,
            "args": self.args,
            "env": self.env
        }


@dataclass
class MCPProtocol:
    """MCP protocol configuration"""
    enabled: bool
    role: MCPRole
    servers: List[MCPServer] = field(default_factory=list)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'MCPProtocol':
        role = MCPRole(data['role'])
        servers = [MCPServer.from_dict(s) for s in data.get('servers', [])]
        return cls(
            enabled=data['enabled'],
            role=role,
            servers=servers
        )
    
    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "role": self.role.value,
            "servers": [s.to_dict() for s in self.servers]
        }


@dataclass
class Authentication:
    """Authentication configuration"""
    type: str
    config: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Authentication':
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "config": self.config
        }


@dataclass
class A2AProtocol:
    """A2A protocol configuration"""
    enabled: bool
    role: str = "server"
    endpoint: Optional[str] = None
    authentication: Optional[Authentication] = None
    
    @classmethod
    def from_dict(cls, data: dict) -> 'A2AProtocol':
        # Handle simple boolean false case
        if isinstance(data, bool):
            return cls(enabled=data)
        
        auth = Authentication.from_dict(data['authentication']) if data.get('authentication') else None
        return cls(
            enabled=data.get('enabled', False),
            role=data.get('role', 'server'),
            endpoint=data.get('endpoint'),
            authentication=auth
        )
    
    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "role": self.role,
            "endpoint": self.endpoint,
            "authentication": self.authentication.to_dict() if self.authentication else None
        }


@dataclass
class AgentProtocolConfig:
    """Agent Protocol configuration"""
    enabled: bool
    endpoint: str = "/ap/v1"
    
    @classmethod
    def from_dict(cls, data: dict) -> 'AgentProtocolConfig':
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "endpoint": self.endpoint
        }


@dataclass
class Protocols:
    """Protocol configurations"""
    mcp: Optional[MCPProtocol] = None
    a2a: Optional[A2AProtocol] = None
    agent_protocol: Optional[AgentProtocolConfig] = None
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Protocols':
        mcp = MCPProtocol.from_dict(data['mcp']) if data.get('mcp') else None
        
        # Handle a2a - can be boolean or dict
        a2a = None
        if data.get('a2a') is not None:
            a2a = A2AProtocol.from_dict(data['a2a'])
        
        # Handle agent_protocol - can be boolean or dict
        agent_protocol = None
        if data.get('agent_protocol') is not None:
            ap_data = data['agent_protocol']
            if isinstance(ap_data, bool):
                agent_protocol = AgentProtocolConfig(enabled=ap_data)
            else:
                agent_protocol = AgentProtocolConfig.from_dict(ap_data)
        
        return cls(
            mcp=mcp,
            a2a=a2a,
            agent_protocol=agent_protocol
        )
    
    def to_dict(self) -> dict:
        return {
            "mcp": self.mcp.to_dict() if self.mcp else None,
            "a2a": self.a2a.to_dict() if self.a2a else None,
            "agent_protocol": self.agent_protocol.to_dict() if self.agent_protocol else None
        }


@dataclass
class LLMConfig:
    """LLM configuration"""
    provider: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 4096
    parameters: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'LLMConfig':
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "parameters": self.parameters
        }


@dataclass
class RetryPolicy:
    """Retry policy configuration"""
    max_attempts: int = 3
    backoff: str = "exponential"
    initial_delay: int = 1
    
    @classmethod
    def from_dict(cls, data: dict) -> 'RetryPolicy':
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "max_attempts": self.max_attempts,
            "backoff": self.backoff,
            "initial_delay": self.initial_delay
        }


@dataclass
class Runtime:
    """Runtime configuration"""
    timeout: int = 300
    max_iterations: int = 20
    retry_policy: Optional[RetryPolicy] = None
    error_handling: str = "graceful_degradation"
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Runtime':
        retry_policy = RetryPolicy.from_dict(data['retry_policy']) if data.get('retry_policy') else None
        return cls(
            timeout=data.get('timeout', 300),
            max_iterations=data.get('max_iterations', 20),
            retry_policy=retry_policy,
            error_handling=data.get('error_handling', 'graceful_degradation')
        )
    
    def to_dict(self) -> dict:
        return {
            "timeout": self.timeout,
            "max_iterations": self.max_iterations,
            "retry_policy": self.retry_policy.to_dict() if self.retry_policy else None,
            "error_handling": self.error_handling
        }


@dataclass
class Execution:
    """Execution configuration"""
    llm: LLMConfig
    runtime: Runtime
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Execution':
        llm = LLMConfig.from_dict(data['llm'])
        runtime = Runtime.from_dict(data['runtime'])
        return cls(llm=llm, runtime=runtime)
    
    def to_dict(self) -> dict:
        return {
            "llm": self.llm.to_dict(),
            "runtime": self.runtime.to_dict()
        }


@dataclass
class Scaling:
    """Scaling configuration"""
    min_instances: int = 1
    max_instances: int = 10
    target_cpu: int = 70
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Scaling':
        return cls(**data)
    
    def to_dict(self) -> dict:
        return {
            "min_instances": self.min_instances,
            "max_instances": self.max_instances,
            "target_cpu": self.target_cpu
        }


@dataclass
class Deployment:
    """Deployment configuration"""
    context: str
    environment: Dict[str, Any] = field(default_factory=dict)
    scaling: Optional[Scaling] = None
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Deployment':
        scaling = Scaling.from_dict(data['scaling']) if data.get('scaling') else None
        return cls(
            context=data['context'],
            environment=data.get('environment', {}),
            scaling=scaling
        )
    
    def to_dict(self) -> dict:
        return {
            "context": self.context,
            "environment": self.environment,
            "scaling": self.scaling.to_dict() if self.scaling else None
        }


@dataclass
class AgentSpec:
    """Uniform Semantic Agent"""
    api_version: str
    kind: str
    metadata: Metadata
    identity: Identity
    capabilities: Capabilities
    protocols: Protocols
    execution: Execution
    deployment: Deployment
    
    @classmethod
    def from_dict(cls, data: dict) -> 'AgentSpec':
        """Create AgentSpec from dictionary"""
        return cls(
            api_version=data.get('apiVersion', 'usa/v1'),
            kind=data.get('kind', 'Agent'),
            metadata=Metadata.from_dict(data['metadata']),
            identity=Identity.from_dict(data['identity']),
            capabilities=Capabilities.from_dict(data['capabilities']),
            protocols=Protocols.from_dict(data['protocols']),
            execution=Execution.from_dict(data['execution']),
            deployment=Deployment.from_dict(data['deployment'])
        )
    
    def to_dict(self) -> dict:
        """Convert AgentSpec to dictionary"""
        return {
            "apiVersion": self.api_version,
            "kind": self.kind,
            "metadata": self.metadata.to_dict(),
            "identity": self.identity.to_dict(),
            "capabilities": self.capabilities.to_dict(),
            "protocols": self.protocols.to_dict(),
            "execution": self.execution.to_dict(),
            "deployment": self.deployment.to_dict()
        }
    
    def validate(self) -> bool:
        """Validate the specification"""
        # Basic validation
        if not self.metadata.name:
            raise ValueError("Agent name is required")
        
        if not self.metadata.version:
            raise ValueError("Agent version is required")
        
        if not self.identity.role:
            raise ValueError("Agent role is required")
        
        if not self.identity.goal:
            raise ValueError("Agent goal is required")
        
        return True
