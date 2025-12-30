# Universal Agent Specification - Quick Start Guide

## What Is This?

The Universal Agent Specification (UAS) lets you **define an agent once and deploy it anywhere**:

```
One Specification → Multiple Frameworks → Any Deployment Context
```

### The Problem

Today, every framework has its own format:

```python
# CrewAI format
Agent(role="Researcher", goal="Research", tools=[...])

# Cline format  
{"systemPrompt": "...", "mcpServers": {...}}

# AutoGPT format
{"agent": {"role": "...", "goals": [...]}}
```

You can't reuse agents across frameworks. 😞

### The Solution

**Write Once, Deploy Anywhere:**

```yaml
# research_agent.uas.yaml (Universal format)
apiVersion: uas/v1
kind: Agent
metadata:
  name: research-agent
identity:
  role: Researcher
  goal: Conduct research
capabilities:
  tools:
    - name: web_search
      protocol: mcp
```

```python
# Deploy anywhere!
from uas import load_agent, deploy

spec = load_agent("research_agent.uas.yaml")

# Deploy to CrewAI
crewai_agent = deploy(spec, "crewai")

# Deploy to Cline
cline_config = deploy(spec, "cline")

# Deploy as API
api_server = deploy(spec, "api")
```

---

## Installation

```bash
# Navigate to the CharactersAgents directory
cd /home/mdz-axolotl/Documents/GitClones/CharactersAgents

# The implementation is in uas_implementation/
# No installation needed - it's pure Python!
```

---

## Your First Agent in 5 Minutes

### Step 1: Create Agent Specification

```yaml
# my_first_agent.uas.yaml
apiVersion: uas/v1
kind: Agent

metadata:
  name: helpful-assistant
  version: 1.0.0
  description: A helpful AI assistant

identity:
  role: AI Assistant
  goal: Help users with their questions
  backstory: |
    You are a friendly and helpful AI assistant.
    You provide clear, accurate answers.

capabilities:
  tools:
    - name: web_search
      protocol: mcp
      config:
        server: brave-search
        tool: brave_web_search
  
  reasoning:
    strategy: chain_of_thought
    max_iterations: 10
  
  memory:
    type: short_term
    scope: session

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

execution:
  llm:
    provider: openai
    model: gpt-4-turbo-preview
    temperature: 0.7
    max_tokens: 2048
  
  runtime:
    timeout: 120
    max_iterations: 10

deployment:
  context: api
  environment:
    port: 8000
```

### Step 2: Load and Validate

```python
# test_agent.py
from uas_implementation import load_agent

# Load the agent
spec = load_agent("my_first_agent.uas.yaml")

# It's validated automatically!
print(f"✓ Agent loaded: {spec.metadata.name}")
print(f"  Role: {spec.identity.role}")
print(f"  Tools: {[t.name for t in spec.capabilities.tools]}")
```

### Step 3: Deploy

Choose your deployment target:

#### Option A: Deploy to CrewAI

```python
# deploy_crewai.py
from uas_implementation import load_agent
from crewai import Agent, Task, Crew

# Load spec
spec = load_agent("my_first_agent.uas.yaml")

# Create CrewAI agent (manually for now - adapter coming soon!)
agent = Agent(
    role=spec.identity.role,
    goal=spec.identity.goal,
    backstory=spec.identity.backstory,
    tools=[],  # Add MCP tools here
    verbose=True
)

# Use in a crew
task = Task(
    description="Research AI trends",
    agent=agent,
    expected_output="Report"
)

result = agent.execute_task(task)
print(result)
```

#### Option B: Deploy as API

```python
# deploy_api.py
from fastapi import FastAPI
from uas_implementation import load_agent

app = FastAPI()
spec = load_agent("my_first_agent.uas.yaml")

@app.post("/chat")
async def chat(message: str):
    # Use your LLM API to process with agent context
    system_prompt = f"""
You are {spec.identity.role}.
Goal: {spec.identity.goal}
{spec.identity.backstory}
"""
    # Call LLM with system_prompt and user message
    return {"response": "..."}

# Run: uvicorn deploy_api:app --reload
```

#### Option C: Generate Cline Config

```python
# deploy_cline.py
import json
from uas_implementation import load_agent

spec = load_agent("my_first_agent.uas.yaml")

# Generate Cline configuration
cline_config = {
    "systemPrompt": f"""
You are {spec.identity.role}.

Goal: {spec.identity.goal}

{spec.identity.backstory}

Available tools:
{chr(10).join(f"- {t.name}" for t in spec.capabilities.tools)}
""",
    "mcpServers": {}
}

# Add MCP servers
if spec.protocols.mcp and spec.protocols.mcp.enabled:
    for server in spec.protocols.mcp.servers:
        cline_config["mcpServers"][server.name] = {
            "command": server.command,
            "args": list(server.args),
            "env": dict(server.env)
        }

# Save configuration
with open(".vscode/cline_settings.json", "w") as f:
    json.dump(cline_config, f, indent=2)

print("✓ Cline configuration generated!")
```

---

## Complete Example: Research Agent

Let's build a complete research agent that works across frameworks:

### 1. Define the Agent

```yaml
# research_agent_complete.uas.yaml
apiVersion: uas/v1
kind: Agent

metadata:
  name: advanced-research-agent
  version: 1.0.0
  description: Advanced research agent with web search and file operations
  tags:
    - research
    - analysis
    - multi-tool

identity:
  role: Senior Research Analyst
  goal: Conduct comprehensive research and provide detailed analysis
  backstory: |
    You are an experienced research analyst with expertise in:
    - Finding and evaluating credible sources
    - Synthesizing complex information
    - Creating well-structured reports
    
    You always cite your sources and verify information from multiple sources.
  
  personality_traits:
    analytical: high
    thorough: high
    speed: medium
  
  constraints:
    - Always cite sources with URLs
    - Verify facts from multiple sources when possible
    - Acknowledge uncertainty when information is unclear
    - Prioritize recent and authoritative sources

capabilities:
  tools:
    - name: web_search
      protocol: mcp
      config:
        server: brave-search
        tool: brave_web_search
    
    - name: file_read
      protocol: mcp
      config:
        server: filesystem
        tool: read_file
    
    - name: file_write
      protocol: mcp
      config:
        server: filesystem
        tool: write_file
  
  skills:
    - name: deep_research
      type: composite
      parameters:
        min_sources: 3
        verification: true
    
    - name: report_writing
      type: cognitive
      parameters:
        style: professional
        format: markdown
  
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
          - "${WORKSPACE_DIR}"
  
  a2a:
    enabled: true
    role: server
    endpoint: https://agents.example.com/research-agent
    authentication:
      type: oauth2
      config:
        provider: auth0
  
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

### 2. Test and Deploy

```python
# complete_deployment_example.py
from uas_implementation import load_agent
import json

print("=" * 70)
print("Universal Agent Specification - Complete Deployment Example")
print("=" * 70)

# Load the agent
spec = load_agent("research_agent_complete.uas.yaml")

print(f"\n✅ Loaded: {spec.metadata.name} v{spec.metadata.version}")
print(f"   {spec.metadata.description}")

# Validate
print("\n🔍 Validating specification...")
try:
    spec.validate()
    print("   ✓ Validation passed!")
except ValueError as e:
    print(f"   ✗ Validation failed: {e}")
    exit(1)

# Display capabilities
print(f"\n🛠️  Agent Capabilities:")
print(f"   Tools: {len(spec.capabilities.tools)}")
for tool in spec.capabilities.tools:
    print(f"      • {tool.name} (via {tool.protocol.value})")

print(f"   Skills: {len(spec.capabilities.skills)}")
for skill in spec.capabilities.skills:
    print(f"      • {skill.name} ({skill.type})")

if spec.capabilities.reasoning:
    print(f"   Reasoning: {spec.capabilities.reasoning.strategy.value}")

if spec.capabilities.memory:
    print(f"   Memory: {spec.capabilities.memory.type.value}")

# Show protocol support
print(f"\n🔌 Protocol Support:")
protocols = []
if spec.protocols.mcp and spec.protocols.mcp.enabled:
    protocols.append(f"MCP ({spec.protocols.mcp.role.value})")
if spec.protocols.a2a and spec.protocols.a2a.enabled:
    protocols.append(f"A2A ({spec.protocols.a2a.role})")
if spec.protocols.agent_protocol and spec.protocols.agent_protocol.enabled:
    protocols.append("Agent Protocol")

for protocol in protocols:
    print(f"   ✓ {protocol}")

# Deployment options
print(f"\n🚀 Deployment Options:")
print(f"   Target: {spec.deployment.context}")
print(f"   Ready to deploy to:")
print(f"      1. CrewAI (multi-agent workflows)")
print(f"      2. Cline/IDE (interactive development)")
print(f"      3. FastAPI (web service)")
print(f"      4. AWS Lambda (serverless)")
print(f"      5. CLI Tool (command-line)")

# Export for different frameworks
print(f"\n📦 Exporting for frameworks...")

# Export metadata
metadata_export = {
    "name": spec.metadata.name,
    "version": spec.metadata.version,
    "role": spec.identity.role,
    "goal": spec.identity.goal,
    "tools": [t.name for t in spec.capabilities.tools],
    "protocols": {
        "mcp": spec.protocols.mcp.enabled if spec.protocols.mcp else False,
        "a2a": spec.protocols.a2a.enabled if spec.protocols.a2a else False,
    }
}

with open("agent_export.json", "w") as f:
    json.dump(metadata_export, f, indent=2)

print(f"   ✓ Metadata exported to agent_export.json")

print(f"\n" + "=" * 70)
print("Agent is ready for deployment! 🎉")
print("=" * 70)
```

### 3. Run It

```bash
python complete_deployment_example.py
```

---

## Key Benefits

### 1. **Write Once, Deploy Anywhere**

```yaml
# Single specification file
research_agent.uas.yaml
```

```python
# Multiple deployments
deploy(spec, "crewai")    # Multi-agent system
deploy(spec, "cline")     # IDE integration
deploy(spec, "api")       # Web service
deploy(spec, "lambda")    # Serverless
deploy(spec, "cli")       # Command-line tool
```

### 2. **Version Control Friendly**

```bash
git diff v1.0..v2.0 agent.uas.yaml
```

See exactly what changed in your agent!

### 3. **Framework Independent**

```python
# Start with CrewAI
agent = load_and_deploy("agent.uas.yaml", "crewai")

# Switch to AutoGPT later (same spec!)
agent = load_and_deploy("agent.uas.yaml", "autogpt")
```

### 4. **Protocol Support Built-In**

Every agent automatically supports:
- ✅ **MCP** - Tool integration
- ✅ **A2A** - Agent collaboration
- ✅ **Agent Protocol** - Orchestration

### 5. **Agent Marketplace Ready**

```python
# Share and reuse agents
marketplace = {
    "research": "research_agent.uas.yaml",
    "coder": "coding_agent.uas.yaml",
    "analyst": "data_analyst.uas.yaml"
}

# Anyone can use any agent in any framework
agent = load_and_deploy(marketplace["research"], their_framework)
```

---

## Common Patterns

### Pattern 1: Multi-Agent System (CrewAI)

```python
from uas_implementation import load_agent
from crewai import Crew, Task

# Load multiple agents from specs
researcher = adapt_to_crewai(load_agent("researcher.uas.yaml"))
analyst = adapt_to_crewai(load_agent("analyst.uas.yaml"))
writer = adapt_to_crewai(load_agent("writer.uas.yaml"))

# Use in crew
crew = Crew(
    agents=[researcher, analyst, writer],
    tasks=[research_task, analysis_task, writing_task]
)

result = crew.kickoff({"topic": "AI Trends"})
```

### Pattern 2: IDE Integration (Cline)

```python
from uas_implementation import load_agent
import json

# Load agent
spec = load_agent("coding_assistant.uas.yaml")

# Generate IDE config
config = generate_cline_config(spec)

# Save to IDE settings
with open(".vscode/cline_settings.json", "w") as f:
    json.dump(config, f, indent=2)
```

### Pattern 3: API Service

```python
from fastapi import FastAPI
from uas_implementation import load_agent

app = FastAPI()
specs = {
    "research": load_agent("research.uas.yaml"),
    "analyst": load_agent("analyst.uas.yaml")
}

@app.post("/agent/{agent_name}/execute")
async def execute_agent(agent_name: str, task: str):
    spec = specs[agent_name]
    # Execute using spec configuration
    result = execute_with_spec(spec, task)
    return {"result": result}
```

### Pattern 4: CLI Tool

```python
import click
from uas_implementation import load_agent

@click.command()
@click.argument('agent_file')
@click.argument('task')
def execute(agent_file, task):
    """Execute a task using an agent"""
    spec = load_agent(agent_file)
    result = execute_agent(spec, task)
    click.echo(result)

if __name__ == '__main__':
    execute()
```

Usage:
```bash
python agent_cli.py research_agent.uas.yaml "Research AI trends"
```

---

## Next Steps

1. **Read the Full Spec**: See `UniversalAgentSpecification.md`
2. **Try the Examples**: Run `python examples/test_loader.py`
3. **Create Your Agent**: Start with `examples/simple_agent.uas.yaml`
4. **Build Adapters**: Contribute framework adapters
5. **Share Agents**: Create reusable agent specifications

---

## FAQ

### Q: How is this different from existing frameworks?

**A:** UAS is **not a framework**. It's a specification format that works **with** existing frameworks. Think of it like JSON or YAML - it's a standard way to describe agents that any framework can understand.

### Q: Do I need to change my existing agents?

**A:** No! You can continue using CrewAI, Cline, etc. as normal. UAS is for when you want **portability** across frameworks.

### Q: What about framework-specific features?

**A:** The spec supports common features across frameworks. Framework-specific features can be added in the `deployment.environment` section or through custom adapters.

### Q: Is this production-ready?

**A:** This is a design proposal and reference implementation. The core concepts are sound, but you'd want to add:
- More robust error handling
- Comprehensive testing
- Additional framework adapters
- Validation tools
- Documentation

### Q: Can I contribute?

**A:** Absolutely! The biggest needs are:
1. More framework adapters (LangChain, Haystack, etc.)
2. Real-world agent examples
3. Deployment templates
4. Testing tools
5. Documentation

---

## Resources

- **Full Specification**: `UniversalAgentSpecification.md`
- **Research Report**: `AgentSpecResearch.md`
- **Examples**: `examples/` directory
- **Implementation**: `uas_implementation/` directory

---

**Universal Agent Specification v1.0**  
*Write once. Deploy anywhere. Build the agent internet.*
