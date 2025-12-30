# Universal Agent Specification - Examples

This directory contains practical examples showing how to use the Universal Agent Specification (UAS) system.

## Quick Start

### 1. Define Your Agent Once

Create a `.uas.yaml` file:

```yaml
# my_agent.uas.yaml
apiVersion: uas/v1
kind: Agent

metadata:
  name: my-research-agent
  version: 1.0.0

identity:
  role: Research Assistant
  goal: Help users find information

capabilities:
  tools:
    - name: web_search
      protocol: mcp
      config:
        server: brave-search

protocols:
  mcp:
    enabled: true
    role: client
    servers:
      - name: brave-search
        command: npx
        args: ["-y", "@modelcontextprotocol/server-brave-search"]

execution:
  llm:
    provider: openai
    model: gpt-4-turbo-preview
    temperature: 0.3

deployment:
  context: api
```

### 2. Deploy Anywhere

```python
from uas_implementation import load_agent

# Load once
spec = load_agent("my_agent.uas.yaml")

# Deploy to CrewAI
crewai_agent = deploy_to_crewai(spec)

# Or deploy to Cline
cline_config = deploy_to_cline(spec)

# Or deploy as API
api_server = deploy_as_api(spec)
```

## Examples in This Directory

1. **`simple_agent.uas.yaml`** - Basic research agent
2. **`test_loader.py`** - Test the loader functionality
3. **`deploy_to_crewai.py`** - Deploy to CrewAI framework
4. **`deploy_to_api.py`** - Deploy as FastAPI service
5. **`multi_deployment.py`** - Deploy to multiple contexts

## Running Examples

```bash
# Test the loader
python test_loader.py

# Deploy to CrewAI
python deploy_to_crewai.py

# Run as API service
python deploy_to_api.py
```

## Agent Specification Format

See `UniversalAgentSpecification.md` in the parent directory for complete documentation.
