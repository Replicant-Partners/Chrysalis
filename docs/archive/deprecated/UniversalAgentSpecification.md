# Universal Agent Specification (UAS)
**Version:** 1.0.0  
**Date:** December 28, 2025  
**Status:** Design Proposal

---

## Table of Contents

1. [Introduction](#introduction)
2. [Core Design Principles](#core-design-principles)
3. [Universal Agent Specification Format](#universal-agent-specification-format)
4. [Protocol Buffers Definition](#protocol-buffers-definition)
5. [Adapter Architecture](#adapter-architecture)
6. [Implementation Examples](#implementation-examples)
7. [Deployment Scenarios](#deployment-scenarios)
8. [Tool Integration](#tool-integration)
9. [Migration Guide](#migration-guide)
10. [Reference Implementation](#reference-implementation)

---

## Introduction

### Problem Statement

Current agent frameworks use incompatible specification formats:
- **CrewAI**: YAML/Python with specific fields (`role`, `goal`, `backstory`)
- **Cline/Roo Code**: Embedded system prompts with MCP configuration
- **AutoGPT**: JSON configuration with task-based structure
- **LangChain**: Python class-based with chains

This fragmentation prevents:
- ✗ Reusing agent definitions across frameworks
- ✗ Framework-agnostic agent marketplaces
- ✗ Standardized testing and benchmarking
- ✗ Easy migration between frameworks

### Solution: Universal Agent Specification

A **three-layer architecture** that separates:
1. **Core Agent Definition** (framework-agnostic)
2. **Adapter Layer** (framework-specific translation)
3. **Deployment Layer** (runtime environment)

```
┌─────────────────────────────────────────────────┐
│        Universal Agent Definition               │
│        (YAML/JSON/Protocol Buffers)             │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│             Adapter Registry                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  CrewAI  │ │   Cline  │ │ AutoGPT  │ ...  │
│  │ Adapter  │ │ Adapter  │ │ Adapter  │       │
│  └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│           Deployment Contexts                   │
│  • API Service  • IDE Plugin  • CLI Tool        │
│  • Multi-Agent System  • Serverless Function    │
└─────────────────────────────────────────────────┘
```

---

## Core Design Principles

### 1. **Separation of Concerns**

```yaml
# Separate what (agent definition) from how (framework) and where (deployment)
agent:
  definition: "Universal format"     # WHAT
  adapter: "Framework-specific"      # HOW
  deployment: "Context-specific"     # WHERE
```

### 2. **Protocol Support Built-In**

```yaml
agent:
  protocols:
    mcp:
      enabled: true
      role: "client"  # Can use MCP tools
    a2a:
      enabled: true
      role: "server"  # Can be called by other agents
    agent_protocol:
      enabled: true   # Exposes REST API
```

### 3. **Capability-Based Design**

```yaml
# Define capabilities, not implementation
capabilities:
  - type: "tool_use"
    tools: ["web_search", "file_operations"]
  
  - type: "reasoning"
    strategy: "chain_of_thought"
  
  - type: "memory"
    scope: "conversation"
```

### 4. **Framework Agnostic Core**

```python
# Core agent logic independent of framework
class UniversalAgent:
    """Framework-agnostic agent"""
    
    def __init__(self, spec: AgentSpec):
        self.spec = spec
        # No framework-specific code here!
    
    def execute(self, task: Task) -> Result:
        # Pure agent logic
        pass
```

### 5. **Adapter Pattern for Deployment**

```python
# Framework-specific adapters
crewai_agent = CrewAIAdapter().adapt(universal_agent)
cline_agent = ClineAdapter().adapt(universal_agent)
autogpt_agent = AutoGPTAdapter().adapt(universal_agent)
```

---

## Universal Agent Specification Format

### Schema Overview

```yaml
# Universal Agent Specification v1.0
apiVersion: uas/v1
kind: Agent

metadata:
  name: string              # Required: Agent identifier
  version: string           # Required: Semantic version
  description: string       # Optional: Human-readable description
  author: string           # Optional: Creator
  license: string          # Optional: License type
  tags: [string]           # Optional: Categorization
  
identity:
  role: string             # Required: Agent's primary role
  goal: string             # Required: Primary objective
  backstory: string        # Optional: Context and personality
  personality_traits:      # Optional: Behavioral characteristics
    - trait: value
  constraints: [string]    # Optional: Limitations or boundaries

capabilities:
  tools:                   # Tool access
    - name: string
      protocol: "mcp|native|api"
      config: object
  
  skills:                  # High-level abilities
    - name: string
      type: string
      parameters: object
  
  reasoning:               # Reasoning approach
    strategy: string       # "chain_of_thought|react|reflexion"
    max_iterations: int
  
  memory:                  # Memory configuration
    type: string          # "none|short_term|long_term|vector"
    scope: string         # "task|session|permanent"
    provider: string

protocols:
  mcp:                     # Model Context Protocol
    enabled: boolean
    role: "client|server|both"
    servers: [config]
  
  a2a:                     # Agent2Agent Protocol
    enabled: boolean
    role: "client|server|both"
    endpoint: string
    authentication: object
  
  agent_protocol:          # Agent Protocol (orchestration)
    enabled: boolean
    endpoint: string

execution:
  llm:                     # Language Model
    provider: string       # "openai|anthropic|google|..."
    model: string
    temperature: float
    max_tokens: int
    parameters: object
  
  runtime:                 # Runtime settings
    timeout: int          # seconds
    max_iterations: int
    retry_policy: object
    error_handling: string

deployment:
  context: string          # "ide|api|cli|multi_agent|serverless"
  environment: object      # Context-specific config
  scaling: object          # Auto-scaling rules (if applicable)
```

### Complete Example

```yaml
# research_agent.uas.yaml
apiVersion: uas/v1
kind: Agent

metadata:
  name: deep-research-agent
  version: 1.0.0
  description: Advanced research agent with web search and document analysis
  author: Your Organization
  license: MIT
  tags:
    - research
    - analysis
    - web-search

identity:
  role: Senior Research Analyst
  goal: Conduct comprehensive research and provide detailed, well-sourced analysis
  backstory: |
    You are an experienced research analyst with a PhD in Information Science.
    You excel at finding relevant information, synthesizing complex data,
    and presenting findings in clear, actionable formats. You're known for
    your thoroughness and attention to detail.
  
  personality_traits:
    - analytical: high
    - thorough: high
    - creative: medium
    - speed: medium
  
  constraints:
    - "Always cite sources"
    - "Verify information from multiple sources when possible"
    - "Flag uncertain or contradictory information"

capabilities:
  tools:
    - name: web_search
      protocol: mcp
      config:
        server: brave-search
        tool: brave_web_search
    
    - name: wikipedia
      protocol: mcp
      config:
        server: wikipedia
        tool: search
    
    - name: file_operations
      protocol: mcp
      config:
        server: filesystem
        tools:
          - read_file
          - write_file
          - list_directory
    
    - name: document_analysis
      protocol: mcp
      config:
        server: pdf-tools
        tool: extract_text
  
  skills:
    - name: deep_research
      type: composite
      parameters:
        depth: exhaustive
        max_sources: 10
        verification_required: true
    
    - name: summarization
      type: cognitive
      parameters:
        style: executive
        max_length: 500
  
  reasoning:
    strategy: chain_of_thought
    max_iterations: 20
    allow_backtracking: true
  
  memory:
    type: vector
    scope: session
    provider: chromadb
    config:
      collection: research_memory
      embedding_model: text-embedding-3-small

protocols:
  mcp:
    enabled: true
    role: client
    servers:
      - name: brave-search
        command: npx
        args:
          - "-y"
          - "@modelcontextprotocol/server-brave-search"
        env:
          BRAVE_API_KEY: ${BRAVE_API_KEY}
      
      - name: filesystem
        command: npx
        args:
          - "-y"
          - "@modelcontextprotocol/server-filesystem"
          - "/workspace"
      
      - name: wikipedia
        command: python
        args:
          - "-m"
          - "mcp_server_wikipedia"
  
  a2a:
    enabled: true
    role: server
    endpoint: https://agents.example.com/research-agent
    authentication:
      type: oauth2
      provider: auth0
      scopes:
        - agent:read
        - agent:execute
  
  agent_protocol:
    enabled: true
    endpoint: /ap/v1

execution:
  llm:
    provider: openai
    model: gpt-4-turbo-preview
    temperature: 0.3
    max_tokens: 4096
    parameters:
      top_p: 0.9
      frequency_penalty: 0.0
      presence_penalty: 0.0
  
  runtime:
    timeout: 300
    max_iterations: 20
    retry_policy:
      max_attempts: 3
      backoff: exponential
      initial_delay: 1
    error_handling: graceful_degradation

deployment:
  context: api
  environment:
    port: 8000
    workers: 4
    log_level: info
  
  scaling:
    min_instances: 1
    max_instances: 10
    target_cpu: 70
```

---

## Protocol Buffers Definition

### Core Types (uas.proto)

```protobuf
syntax = "proto3";
package uas.v1;

// Root agent specification
message AgentSpec {
  string api_version = 1;  // "uas/v1"
  string kind = 2;         // "Agent"
  Metadata metadata = 3;
  Identity identity = 4;
  Capabilities capabilities = 5;
  Protocols protocols = 6;
  Execution execution = 7;
  Deployment deployment = 8;
}

// Metadata
message Metadata {
  string name = 1;
  string version = 2;
  optional string description = 3;
  optional string author = 4;
  optional string license = 5;
  repeated string tags = 6;
}

// Identity
message Identity {
  string role = 1;
  string goal = 2;
  optional string backstory = 3;
  map<string, string> personality_traits = 4;
  repeated string constraints = 5;
}

// Capabilities
message Capabilities {
  repeated Tool tools = 1;
  repeated Skill skills = 2;
  optional Reasoning reasoning = 3;
  optional Memory memory = 4;
}

message Tool {
  string name = 1;
  string protocol = 2;  // "mcp", "native", "api"
  map<string, string> config = 3;
}

message Skill {
  string name = 1;
  string type = 2;
  map<string, string> parameters = 3;
}

message Reasoning {
  string strategy = 1;
  int32 max_iterations = 2;
  bool allow_backtracking = 3;
}

message Memory {
  string type = 1;    // "none", "short_term", "long_term", "vector"
  string scope = 2;   // "task", "session", "permanent"
  string provider = 3;
  map<string, string> config = 4;
}

// Protocols
message Protocols {
  optional MCPProtocol mcp = 1;
  optional A2AProtocol a2a = 2;
  optional AgentProtocolConfig agent_protocol = 3;
}

message MCPProtocol {
  bool enabled = 1;
  string role = 2;  // "client", "server", "both"
  repeated MCPServer servers = 3;
}

message MCPServer {
  string name = 1;
  string command = 2;
  repeated string args = 3;
  map<string, string> env = 4;
}

message A2AProtocol {
  bool enabled = 1;
  string role = 2;  // "client", "server", "both"
  optional string endpoint = 3;
  optional Authentication authentication = 4;
}

message Authentication {
  string type = 1;
  map<string, string> config = 2;
}

message AgentProtocolConfig {
  bool enabled = 1;
  string endpoint = 2;
}

// Execution
message Execution {
  LLMConfig llm = 1;
  Runtime runtime = 2;
}

message LLMConfig {
  string provider = 1;
  string model = 2;
  float temperature = 3;
  int32 max_tokens = 4;
  map<string, string> parameters = 5;
}

message Runtime {
  int32 timeout = 1;
  int32 max_iterations = 2;
  RetryPolicy retry_policy = 3;
  string error_handling = 4;
}

message RetryPolicy {
  int32 max_attempts = 1;
  string backoff = 2;
  int32 initial_delay = 3;
}

// Deployment
message Deployment {
  string context = 1;  // "ide", "api", "cli", etc.
  map<string, string> environment = 2;
  optional Scaling scaling = 3;
}

message Scaling {
  int32 min_instances = 1;
  int32 max_instances = 2;
  int32 target_cpu = 3;
}
```

---

## Adapter Architecture

### Core Adapter Interface

```python
# uas/core/adapter.py
from abc import ABC, abstractmethod
from typing import Any, TypeVar, Generic
from .types import AgentSpec

T = TypeVar('T')  # Framework-specific agent type

class FrameworkAdapter(ABC, Generic[T]):
    """Base adapter for framework-specific agent creation"""
    
    @abstractmethod
    def adapt(self, spec: AgentSpec) -> T:
        """Convert universal spec to framework-specific agent"""
        pass
    
    @abstractmethod
    def reverse_adapt(self, agent: T) -> AgentSpec:
        """Convert framework-specific agent back to universal spec"""
        pass
    
    @abstractmethod
    def validate(self, spec: AgentSpec) -> bool:
        """Validate spec is compatible with this framework"""
        pass
    
    @abstractmethod
    def get_framework_name(self) -> str:
        """Return framework identifier"""
        pass


class AdapterRegistry:
    """Registry of available framework adapters"""
    
    def __init__(self):
        self._adapters: dict[str, FrameworkAdapter] = {}
    
    def register(self, name: str, adapter: FrameworkAdapter):
        """Register a framework adapter"""
        self._adapters[name] = adapter
    
    def get_adapter(self, name: str) -> FrameworkAdapter:
        """Get adapter by framework name"""
        if name not in self._adapters:
            raise ValueError(f"No adapter registered for framework: {name}")
        return self._adapters[name]
    
    def list_frameworks(self) -> list[str]:
        """List all registered frameworks"""
        return list(self._adapters.keys())


# Global registry instance
registry = AdapterRegistry()
```

### CrewAI Adapter

```python
# uas/adapters/crewai_adapter.py
from crewai import Agent as CrewAIAgent
from crewai.mcp import MCPTool
from uas.core.adapter import FrameworkAdapter
from uas.core.types import AgentSpec

class CrewAIAdapter(FrameworkAdapter[CrewAIAgent]):
    """Adapter for CrewAI framework"""
    
    def adapt(self, spec: AgentSpec) -> CrewAIAgent:
        """Convert universal spec to CrewAI agent"""
        
        # Map tools
        tools = []
        for tool in spec.capabilities.tools:
            if tool.protocol == "mcp":
                mcp_tool = MCPTool(
                    server_name=tool.config.get("server"),
                    tool_name=tool.config.get("tool", tool.name)
                )
                tools.append(mcp_tool)
        
        # Create CrewAI agent
        agent = CrewAIAgent(
            # Identity mapping
            role=spec.identity.role,
            goal=spec.identity.goal,
            backstory=spec.identity.backstory or "",
            
            # Capabilities
            tools=tools,
            
            # Execution settings
            llm=self._create_llm(spec.execution.llm),
            max_iter=spec.execution.runtime.max_iterations,
            
            # Memory
            memory=spec.capabilities.memory.type != "none" if spec.capabilities.memory else False,
            
            # Additional settings
            verbose=True,
            allow_delegation=False
        )
        
        return agent
    
    def _create_llm(self, llm_config):
        """Create LLM instance from config"""
        from langchain_openai import ChatOpenAI
        from langchain_anthropic import ChatAnthropic
        
        if llm_config.provider == "openai":
            return ChatOpenAI(
                model=llm_config.model,
                temperature=llm_config.temperature,
                max_tokens=llm_config.max_tokens
            )
        elif llm_config.provider == "anthropic":
            return ChatAnthropic(
                model=llm_config.model,
                temperature=llm_config.temperature,
                max_tokens=llm_config.max_tokens
            )
        else:
            raise ValueError(f"Unsupported LLM provider: {llm_config.provider}")
    
    def reverse_adapt(self, agent: CrewAIAgent) -> AgentSpec:
        """Convert CrewAI agent back to universal spec"""
        # Implementation for reverse conversion
        pass
    
    def validate(self, spec: AgentSpec) -> bool:
        """Validate spec is compatible with CrewAI"""
        # Check if all required fields are present
        if not spec.identity.role or not spec.identity.goal:
            return False
        
        # Check if tools are MCP or supported
        for tool in spec.capabilities.tools:
            if tool.protocol not in ["mcp", "native"]:
                return False
        
        return True
    
    def get_framework_name(self) -> str:
        return "crewai"
```

### Cline-Style Adapter

```python
# uas/adapters/cline_adapter.py
from uas.core.adapter import FrameworkAdapter
from uas.core.types import AgentSpec
import json

class ClineAdapter(FrameworkAdapter[dict]):
    """Adapter for Cline-style IDE agents"""
    
    def adapt(self, spec: AgentSpec) -> dict:
        """Convert universal spec to Cline configuration"""
        
        # Generate system prompt from identity
        system_prompt = self._generate_system_prompt(spec)
        
        # Generate MCP configuration
        mcp_config = self._generate_mcp_config(spec)
        
        return {
            "agent_config": {
                "name": spec.metadata.name,
                "version": spec.metadata.version,
                "system_prompt": system_prompt,
                "capabilities": self._map_capabilities(spec.capabilities)
            },
            "mcp_servers": mcp_config,
            "execution": {
                "llm": {
                    "provider": spec.execution.llm.provider,
                    "model": spec.execution.llm.model,
                    "temperature": spec.execution.llm.temperature
                }
            }
        }
    
    def _generate_system_prompt(self, spec: AgentSpec) -> str:
        """Generate Cline-style system prompt"""
        prompt = f"""You are {spec.metadata.name}, a {spec.identity.role}.

Your goal: {spec.identity.goal}

Background: {spec.identity.backstory or 'N/A'}

"""
        
        if spec.identity.constraints:
            prompt += "Constraints:\n"
            for constraint in spec.identity.constraints:
                prompt += f"- {constraint}\n"
        
        # Add available tools
        if spec.capabilities.tools:
            prompt += "\nYou have access to the following tools:\n"
            for tool in spec.capabilities.tools:
                prompt += f"- {tool.name}: via {tool.protocol}\n"
        
        return prompt
    
    def _generate_mcp_config(self, spec: AgentSpec) -> dict:
        """Generate MCP server configuration"""
        if not spec.protocols.mcp or not spec.protocols.mcp.enabled:
            return {}
        
        mcp_servers = {}
        for server in spec.protocols.mcp.servers:
            mcp_servers[server.name] = {
                "command": server.command,
                "args": list(server.args),
                "env": dict(server.env)
            }
        
        return mcp_servers
    
    def _map_capabilities(self, capabilities) -> list[str]:
        """Map capabilities to Cline-style capability list"""
        caps = []
        
        for tool in capabilities.tools:
            caps.append(f"tool:{tool.name}")
        
        for skill in capabilities.skills:
            caps.append(f"skill:{skill.name}")
        
        if capabilities.reasoning:
            caps.append(f"reasoning:{capabilities.reasoning.strategy}")
        
        if capabilities.memory and capabilities.memory.type != "none":
            caps.append(f"memory:{capabilities.memory.type}")
        
        return caps
    
    def reverse_adapt(self, agent: dict) -> AgentSpec:
        """Convert Cline config back to universal spec"""
        # Implementation for reverse conversion
        pass
    
    def validate(self, spec: AgentSpec) -> bool:
        """Validate spec is compatible with Cline"""
        # Must have MCP protocol enabled
        if not spec.protocols.mcp or not spec.protocols.mcp.enabled:
            return False
        
        return True
    
    def get_framework_name(self) -> str:
        return "cline"
```

### AutoGPT Adapter

```python
# uas/adapters/autogpt_adapter.py
from uas.core.adapter import FrameworkAdapter
from uas.core.types import AgentSpec

class AutoGPTAdapter(FrameworkAdapter[dict]):
    """Adapter for AutoGPT framework"""
    
    def adapt(self, spec: AgentSpec) -> dict:
        """Convert universal spec to AutoGPT configuration"""
        
        return {
            "agent": {
                "name": spec.metadata.name,
                "role": spec.identity.role,
                "goals": [
                    spec.identity.goal
                ],
                "constraints": spec.identity.constraints or [],
                
                "resources": self._map_tools_to_resources(spec.capabilities.tools),
                
                "best_practices": self._extract_best_practices(spec.identity.backstory),
                
                "llm": {
                    "provider": spec.execution.llm.provider,
                    "model": spec.execution.llm.model,
                    "temperature": spec.execution.llm.temperature
                },
                
                "memory": {
                    "type": spec.capabilities.memory.type if spec.capabilities.memory else "none"
                },
                
                "max_iterations": spec.execution.runtime.max_iterations,
                "timeout": spec.execution.runtime.timeout
            }
        }
    
    def _map_tools_to_resources(self, tools) -> list[str]:
        """Map tools to AutoGPT resources"""
        resources = []
        for tool in tools:
            resources.append(f"Access to {tool.name}")
        return resources
    
    def _extract_best_practices(self, backstory: str) -> list[str]:
        """Extract best practices from backstory"""
        if not backstory:
            return []
        
        # Simple extraction - could be more sophisticated
        practices = []
        for line in backstory.split('\n'):
            line = line.strip()
            if line and not line.startswith('#'):
                practices.append(line)
        
        return practices
    
    def reverse_adapt(self, agent: dict) -> AgentSpec:
        """Convert AutoGPT config back to universal spec"""
        pass
    
    def validate(self, spec: AgentSpec) -> bool:
        """Validate spec is compatible with AutoGPT"""
        return True  # AutoGPT is fairly flexible
    
    def get_framework_name(self) -> str:
        return "autogpt"
```

---

## Implementation Examples

### Universal Agent Loader

```python
# uas/loader.py
import yaml
import json
from pathlib import Path
from typing import Union
from .core.types import AgentSpec
from .core.adapter import registry

class UniversalAgentLoader:
    """Load and deploy universal agent specifications"""
    
    @staticmethod
    def load_from_file(file_path: Union[str, Path]) -> AgentSpec:
        """Load agent spec from YAML or JSON file"""
        file_path = Path(file_path)
        
        with open(file_path, 'r') as f:
            if file_path.suffix in ['.yaml', '.yml']:
                data = yaml.safe_load(f)
            elif file_path.suffix == '.json':
                data = json.load(f)
            else:
                raise ValueError(f"Unsupported file format: {file_path.suffix}")
        
        return AgentSpec.from_dict(data)
    
    @staticmethod
    def load_from_dict(data: dict) -> AgentSpec:
        """Load agent spec from dictionary"""
        return AgentSpec.from_dict(data)
    
    @staticmethod
    def deploy(spec: AgentSpec, framework: str, **kwargs):
        """Deploy agent to specified framework"""
        
        # Get appropriate adapter
        adapter = registry.get_adapter(framework)
        
        # Validate spec is compatible
        if not adapter.validate(spec):
            raise ValueError(f"Spec is not compatible with {framework}")
        
        # Adapt to framework
        framework_agent = adapter.adapt(spec)
        
        return framework_agent
    
    @staticmethod
    def deploy_multi(spec: AgentSpec, frameworks: list[str]) -> dict:
        """Deploy agent to multiple frameworks"""
        deployed = {}
        
        for framework in frameworks:
            try:
                agent = UniversalAgentLoader.deploy(spec, framework)
                deployed[framework] = agent
            except Exception as e:
                deployed[framework] = {"error": str(e)}
        
        return deployed


# Convenience function
def load_and_deploy(spec_file: str, framework: str):
    """Load spec and deploy in one step"""
    loader = UniversalAgentLoader()
    spec = loader.load_from_file(spec_file)
    return loader.deploy(spec, framework)
```

### Usage Example

```python
# example_usage.py
from uas.loader import UniversalAgentLoader, load_and_deploy
from uas.adapters import CrewAIAdapter, ClineAdapter, AutoGPTAdapter
from uas.core.adapter import registry

# Register adapters
registry.register("crewai", CrewAIAdapter())
registry.register("cline", ClineAdapter())
registry.register("autogpt", AutoGPTAdapter())

# Load universal agent spec
spec_file = "research_agent.uas.yaml"
loader = UniversalAgentLoader()
spec = loader.load_from_file(spec_file)

print(f"Loaded agent: {spec.metadata.name} v{spec.metadata.version}")
print(f"Role: {spec.identity.role}")
print(f"Capabilities: {len(spec.capabilities.tools)} tools")

# Deploy to CrewAI
print("\n=== Deploying to CrewAI ===")
crewai_agent = loader.deploy(spec, "crewai")
print(f"CrewAI Agent: {crewai_agent.role}")

# Deploy to Cline
print("\n=== Deploying to Cline ===")
cline_config = loader.deploy(spec, "cline")
print(f"Cline Config: {cline_config['agent_config']['name']}")
print(f"System Prompt Preview: {cline_config['agent_config']['system_prompt'][:100]}...")

# Deploy to AutoGPT
print("\n=== Deploying to AutoGPT ===")
autogpt_config = loader.deploy(spec, "autogpt")
print(f"AutoGPT Agent: {autogpt_config['agent']['name']}")
print(f"Goals: {autogpt_config['agent']['goals']}")

# Deploy to multiple frameworks at once
print("\n=== Multi-Framework Deployment ===")
deployed = loader.deploy_multi(spec, ["crewai", "cline", "autogpt"])
for framework, result in deployed.items():
    if isinstance(result, dict) and "error" in result:
        print(f"{framework}: FAILED - {result['error']}")
    else:
        print(f"{framework}: SUCCESS")
```

---

## Deployment Scenarios

### Scenario 1: CrewAI Multi-Agent System

```python
# deploy_to_crewai.py
from crewai import Crew, Task, Process
from uas.loader import UniversalAgentLoader
from uas.adapters import CrewAIAdapter
from uas.core.adapter import registry

# Register adapter
registry.register("crewai", CrewAIAdapter())

# Load multiple agents
loader = UniversalAgentLoader()

researcher = loader.deploy(
    loader.load_from_file("agents/researcher.uas.yaml"),
    "crewai"
)

analyst = loader.deploy(
    loader.load_from_file("agents/analyst.uas.yaml"),
    "crewai"
)

writer = loader.deploy(
    loader.load_from_file("agents/writer.uas.yaml"),
    "crewai"
)

# Define tasks
research_task = Task(
    description="Research the latest developments in {topic}",
    agent=researcher,
    expected_output="Detailed research report with sources"
)

analysis_task = Task(
    description="Analyze the research findings and identify key insights",
    agent=analyst,
    expected_output="Analysis report with recommendations"
)

writing_task = Task(
    description="Create a comprehensive article based on the analysis",
    agent=writer,
    expected_output="Well-written article"
)

# Create crew
crew = Crew(
    agents=[researcher, analyst, writer],
    tasks=[research_task, analysis_task, writing_task],
    process=Process.sequential,
    verbose=True
)

# Execute
result = crew.kickoff(inputs={"topic": "AI Agent Standards"})
print(result)
```

### Scenario 2: IDE Integration (Cline-Style)

```python
# deploy_to_ide.py
from uas.loader import UniversalAgentLoader
from uas.adapters import ClineAdapter
from uas.core.adapter import registry
import json

# Register adapter
registry.register("cline", ClineAdapter())

# Load agent
loader = UniversalAgentLoader()
spec = loader.load_from_file("agents/coding_assistant.uas.yaml")

# Deploy to Cline
cline_config = loader.deploy(spec, "cline")

# Generate Cline configuration file
config_output = {
    "systemPrompt": cline_config["agent_config"]["system_prompt"],
    "mcpServers": cline_config["mcp_servers"],
    "customInstructions": {
        "capabilities": cline_config["agent_config"]["capabilities"],
        "llm": cline_config["execution"]["llm"]
    }
}

# Save to IDE config location
with open(".vscode/cline_settings.json", "w") as f:
    json.dump(config_output, f, indent=2)

print("Cline configuration generated at .vscode/cline_settings.json")
print("\nMCP Servers configured:")
for server_name in cline_config["mcp_servers"].keys():
    print(f"  - {server_name}")
```

### Scenario 3: Standalone API Service

```python
# deploy_as_api.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from uas.loader import UniversalAgentLoader
from uas.adapters import CrewAIAdapter
from uas.core.adapter import registry

app = FastAPI(title="Universal Agent API")

# Load and deploy agent at startup
registry.register("crewai", CrewAIAdapter())
loader = UniversalAgentLoader()
spec = loader.load_from_file("agents/api_agent.uas.yaml")
agent = loader.deploy(spec, "crewai")

class TaskRequest(BaseModel):
    input: str
    context: dict = {}

class TaskResponse(BaseModel):
    output: str
    status: str

@app.post("/execute", response_model=TaskResponse)
async def execute_task(request: TaskRequest):
    """Execute a task using the deployed agent"""
    try:
        # Use agent to process request
        result = await agent.kickoff(request.input)
        
        return TaskResponse(
            output=result.raw,
            status="completed"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agent/info")
async def get_agent_info():
    """Get information about the deployed agent"""
    return {
        "name": spec.metadata.name,
        "version": spec.metadata.version,
        "role": spec.identity.role,
        "capabilities": [tool.name for tool in spec.capabilities.tools]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Scenario 4: Serverless Deployment (AWS Lambda)

```python
# lambda_handler.py
import json
from uas.loader import UniversalAgentLoader
from uas.adapters import CrewAIAdapter
from uas.core.adapter import registry

# Initialize at cold start
registry.register("crewai", CrewAIAdapter())
loader = UniversalAgentLoader()

# Load from environment or S3
import os
spec_path = os.environ.get("AGENT_SPEC_PATH", "agent.uas.yaml")
spec = loader.load_from_file(spec_path)
agent = loader.deploy(spec, "crewai")

def lambda_handler(event, context):
    """AWS Lambda handler"""
    
    # Extract task from event
    task_input = event.get("body", {})
    if isinstance(task_input, str):
        task_input = json.loads(task_input)
    
    # Execute agent
    try:
        result = agent.kickoff(task_input.get("input", ""))
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "output": result.raw,
                "status": "completed"
            })
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e)
            })
        }
```

### Scenario 5: CLI Tool

```python
# cli.py
import click
from uas.loader import UniversalAgentLoader
from uas.adapters import CrewAIAdapter
from uas.core.adapter import registry

@click.group()
def cli():
    """Universal Agent CLI"""
    pass

@cli.command()
@click.argument('spec_file')
@click.option('--framework', default='crewai', help='Target framework')
def deploy(spec_file, framework):
    """Deploy an agent from a spec file"""
    registry.register("crewai", CrewAIAdapter())
    
    loader = UniversalAgentLoader()
    spec = loader.load_from_file(spec_file)
    agent = loader.deploy(spec, framework)
    
    click.echo(f"✓ Agent deployed: {spec.metadata.name}")
    click.echo(f"  Framework: {framework}")
    click.echo(f"  Role: {spec.identity.role}")

@cli.command()
@click.argument('spec_file')
@click.argument('task')
def execute(spec_file, task):
    """Execute a task using the agent"""
    registry.register("crewai", CrewAIAdapter())
    
    loader = UniversalAgentLoader()
    spec = loader.load_from_file(spec_file)
    agent = loader.deploy(spec, "crewai")
    
    click.echo(f"Executing: {task}")
    result = agent.kickoff(task)
    
    click.echo("\nResult:")
    click.echo(result.raw)

@cli.command()
@click.argument('spec_file')
def validate(spec_file):
    """Validate an agent spec file"""
    loader = UniversalAgentLoader()
    
    try:
        spec = loader.load_from_file(spec_file)
        click.echo(f"✓ Valid spec: {spec.metadata.name} v{spec.metadata.version}")
    except Exception as e:
        click.echo(f"✗ Invalid spec: {e}", err=True)

if __name__ == '__main__':
    cli()
```

Usage:
```bash
# Deploy agent
python cli.py deploy research_agent.uas.yaml --framework crewai

# Execute task
python cli.py execute research_agent.uas.yaml "Research AI trends"

# Validate spec
python cli.py validate research_agent.uas.yaml
```

---

## Tool Integration

### MCP Tool Wrapper

```python
# uas/tools/mcp_wrapper.py
from typing import Any, Dict
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

class MCPToolWrapper:
    """Universal wrapper for MCP tools"""
    
    def __init__(self, server_config: dict):
        self.server_name = server_config["name"]
        self.command = server_config["command"]
        self.args = server_config.get("args", [])
        self.env = server_config.get("env", {})
        self.session = None
    
    async def connect(self):
        """Connect to MCP server"""
        server_params = StdioServerParameters(
            command=self.command,
            args=self.args,
            env=self.env
        )
        
        self.stdio, self.write = await stdio_client(server_params)
        async with ClientSession(self.stdio, self.write) as session:
            self.session = session
            await session.initialize()
    
    async def list_tools(self) -> list[dict]:
        """List available tools from MCP server"""
        if not self.session:
            await self.connect()
        
        tools = await self.session.list_tools()
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.inputSchema
            }
            for tool in tools.tools
        ]
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Call a tool on the MCP server"""
        if not self.session:
            await self.connect()
        
        result = await self.session.call_tool(tool_name, arguments)
        return result
```

### A2A Protocol Wrapper

```python
# uas/protocols/a2a_wrapper.py
import httpx
from typing import Dict, Any

class A2AProtocolWrapper:
    """Universal wrapper for A2A protocol"""
    
    def __init__(self, agent_spec):
        self.spec = agent_spec
        self.a2a_config = agent_spec.protocols.a2a
        self.client = httpx.AsyncClient()
    
    async def discover_agent(self, agent_url: str) -> Dict[str, Any]:
        """Discover agent capabilities via Agent Card"""
        response = await self.client.get(
            f"{agent_url}/.well-known/agent-card.json"
        )
        return response.json()
    
    async def send_message(self, agent_url: str, message: str) -> Dict[str, Any]:
        """Send A2A message to another agent"""
        response = await self.client.post(
            f"{agent_url}/a2a/v1/sendMessage",
            json={
                "jsonrpc": "2.0",
                "method": "sendMessage",
                "params": {
                    "message": {
                        "role": "user",
                        "content": [{"text": message}]
                    }
                },
                "id": 1
            }
        )
        return response.json()
    
    def get_agent_card(self) -> Dict[str, Any]:
        """Generate Agent Card for this agent"""
        return {
            "name": self.spec.metadata.name,
            "version": self.spec.metadata.version,
            "protocolVersion": "0.3.0",
            "capabilities": [tool.name for tool in self.spec.capabilities.tools],
            "skills": [skill.name for skill in self.spec.capabilities.skills],
            "endpoint": self.a2a_config.endpoint,
            "authentication": {
                "type": self.a2a_config.authentication.type
            }
        }
```

---

## Migration Guide

### From CrewAI to Universal Spec

```python
# migrate_from_crewai.py
from crewai import Agent
from uas.core.types import AgentSpec, Metadata, Identity, Capabilities
from uas.adapters import CrewAIAdapter
import yaml

def migrate_crewai_to_uas(crewai_agent: Agent) -> AgentSpec:
    """Convert CrewAI agent to Universal Spec"""
    
    # Use reverse adapter
    adapter = CrewAIAdapter()
    spec = adapter.reverse_adapt(crewai_agent)
    
    return spec

def save_as_uas_file(spec: AgentSpec, output_path: str):
    """Save spec as UAS YAML file"""
    with open(output_path, 'w') as f:
        yaml.dump(spec.to_dict(), f, default_flow_style=False)

# Example usage
existing_crewai_agent = Agent(
    role="Research Analyst",
    goal="Conduct research",
    backstory="Expert researcher...",
    tools=[...]
)

# Convert to universal spec
universal_spec = migrate_crewai_to_uas(existing_crewai_agent)

# Save as UAS file
save_as_uas_file(universal_spec, "migrated_agent.uas.yaml")

print("Migration complete! Agent saved as migrated_agent.uas.yaml")
```

### From Cline Config to Universal Spec

```python
# migrate_from_cline.py
import json
from uas.core.types import AgentSpec
from uas.adapters import ClineAdapter

def migrate_cline_to_uas(cline_config_path: str) -> AgentSpec:
    """Convert Cline configuration to Universal Spec"""
    
    with open(cline_config_path, 'r') as f:
        cline_config = json.load(f)
    
    # Use reverse adapter
    adapter = ClineAdapter()
    spec = adapter.reverse_adapt(cline_config)
    
    return spec

# Example
spec = migrate_cline_to_uas(".vscode/cline_settings.json")
```

---

## Reference Implementation

### Complete Example: Research Agent

**Step 1: Define Universal Spec**

```yaml
# research_agent.uas.yaml
apiVersion: uas/v1
kind: Agent

metadata:
  name: advanced-research-agent
  version: 1.0.0
  description: Multi-framework research agent
  tags: [research, analysis, multi-framework]

identity:
  role: Senior Research Analyst
  goal: Conduct comprehensive research and analysis
  backstory: |
    Expert researcher with deep analytical skills

capabilities:
  tools:
    - name: web_search
      protocol: mcp
      config:
        server: brave-search
        tool: brave_web_search

protocols:
  mcp:
    enabled: true
    role: client
    servers:
      - name: brave-search
        command: npx
        args: ["-y", "@modelcontextprotocol/server-brave-search"]
        env:
          BRAVE_API_KEY: ${BRAVE_API_KEY}

execution:
  llm:
    provider: openai
    model: gpt-4-turbo-preview
    temperature: 0.3
    max_tokens: 4096
  runtime:
    max_iterations: 20
    timeout: 300
```

**Step 2: Deploy to CrewAI**

```python
# deploy_research_agent.py
from uas.loader import load_and_deploy
from uas.adapters import CrewAIAdapter, ClineAdapter
from uas.core.adapter import registry
from crewai import Task

# Register adapters
registry.register("crewai", CrewAIAdapter())
registry.register("cline", ClineAdapter())

# Deploy to CrewAI
agent = load_and_deploy("research_agent.uas.yaml", "crewai")

# Use in CrewAI workflow
task = Task(
    description="Research the latest AI agent frameworks",
    agent=agent,
    expected_output="Detailed report"
)

result = agent.execute_task(task)
print(result)
```

**Step 3: Deploy to Cline**

```python
# Generate Cline config
cline_config = load_and_deploy("research_agent.uas.yaml", "cline")

# Save configuration
import json
with open(".vscode/cline_settings.json", "w") as f:
    json.dump(cline_config, f, indent=2)
```

**Step 4: Deploy as API**

```python
# api.py
from fastapi import FastAPI
from uas.loader import load_and_deploy

app = FastAPI()
agent = load_and_deploy("research_agent.uas.yaml", "crewai")

@app.post("/research")
async def research(query: str):
    result = await agent.kickoff(query)
    return {"result": result.raw}
```

---

## Benefits of Universal Specification

### 1. **Framework Independence**
```yaml
# Write once
agent_definition: research_agent.uas.yaml

# Deploy anywhere
deployments:
  - crewai     # Multi-agent workflows
  - cline      # IDE integration
  - autogpt    # Autonomous operation
  - api        # Service deployment
```

### 2. **Reusability**
```python
# Agent marketplace
marketplace = {
    "research-agent": "research_agent.uas.yaml",
    "coding-agent": "coding_agent.uas.yaml",
    "analysis-agent": "analysis_agent.uas.yaml"
}

# Use any agent in any framework
agent = load_and_deploy(marketplace["research-agent"], "crewai")
```

### 3. **Testing & Validation**
```python
# Test agent across frameworks
frameworks = ["crewai", "autogpt", "cline"]
for framework in frameworks:
    agent = load_and_deploy("agent.uas.yaml", framework)
    test_result = run_test_suite(agent)
    print(f"{framework}: {test_result}")
```

### 4. **Version Control**
```bash
# Track agent evolution
git log research_agent.uas.yaml

# Compare versions
git diff v1.0..v2.0 research_agent.uas.yaml
```

### 5. **Easy Migration**
```python
# Start with CrewAI
agent = load_and_deploy("agent.uas.yaml", "crewai")

# Later, switch to AutoGPT (same spec!)
agent = load_and_deploy("agent.uas.yaml", "autogpt")
```

---

## Conclusion

The Universal Agent Specification provides:

✅ **Framework independence** - Write once, deploy anywhere  
✅ **Protocol support** - MCP, A2A, Agent Protocol built-in  
✅ **Adapter pattern** - Easy framework integration  
✅ **Deployment flexibility** - IDE, API, CLI, serverless  
✅ **Future-proof** - Protocol Buffers foundation  

This design enables a true **agent marketplace** where agents are portable, reusable, and framework-agnostic.

---

**Next Steps:**
1. Implement core types and adapters
2. Build reference implementations
3. Create test suite
4. Publish to open source
5. Build ecosystem tools (validators, converters, marketplace)
