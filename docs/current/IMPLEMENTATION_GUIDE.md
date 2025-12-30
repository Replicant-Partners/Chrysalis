# Uniform Semantic Agent Bridge - Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the Uniform Semantic Agent Bridge system in your project. The bridge allows you to define agents once and deploy them to both CrewAI and ElizaOS frameworks.

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Creating Uniform Semantic Agents](#creating-universal-agents)
4. [Converting to CrewAI](#converting-to-crewai)
5. [Converting to ElizaOS](#converting-to-elizaos)
6. [Shared Memory Setup](#shared-memory-setup)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Installation

### Prerequisites

```bash
# For CrewAI
pip install crewai crewai-tools

# For ElizaOS
npm install @elizaos/core @elizaos/plugin-bootstrap @elizaos/plugin-sql

# For the bridge (TypeScript)
npm install typescript @types/node
```

### Project Structure

```
your-project/
├── universal_agents/          # Universal agent definitions
│   ├── types.ts
│   ├── bridge.ts
│   └── agents/
│       ├── ada_lovelace.ts
│       ├── research_assistant.ts
│       └── ...
├── crewai_output/            # Generated CrewAI configs
│   ├── agents/
│   └── tasks/
├── elizaos_output/           # Generated ElizaOS characters
│   └── characters/
├── shared_memory/            # Shared vector database
│   └── config.ts
└── package.json / requirements.txt
```

---

## Quick Start

### 1. Define a Uniform Semantic Agent

```typescript
// universal_agents/agents/research_assistant.ts
import { UniformSemanticAgent } from '../types';

export const researchAssistant: UniformSemanticAgent = {
  identity: {
    name: "Research Assistant",
    designation: "Senior Research Analyst",
    bio: "An experienced researcher specializing in information gathering and analysis"
  },
  
  personality: {
    core_traits: ["thorough", "analytical", "curious", "methodical"],
    values: ["accuracy", "comprehensiveness", "objectivity"],
    quirks: ["Always cites sources", "Loves digging into details"]
  },
  
  communication: {
    style: {
      all: ["Be precise", "Provide evidence", "Structure information clearly"],
      work: ["Use bullet points", "Include references", "Summarize key findings"]
    }
  },
  
  capabilities: {
    primary: ["research", "analysis", "information_synthesis"],
    secondary: ["fact_checking", "source_evaluation"],
    domains: ["academic_research", "web_research", "data_analysis"]
  },
  
  knowledge: {
    facts: [
      "I specialize in systematic research methodologies",
      "I can evaluate source credibility and bias"
    ],
    topics: ["research methods", "information science", "data analysis"],
    expertise: ["literature review", "web scraping", "citation management"]
  },
  
  memory: {
    type: 'hybrid',
    provider: 'qdrant',
    settings: {
      collection: 'research_assistant_memories',
      vector_size: 1536
    }
  },
  
  beliefs: {
    who: [{
      content: "I am a systematic and thorough researcher",
      conviction: 0.95,
      privacy: "PUBLIC",
      source: "public"
    }],
    what: [{
      content: "Quality research requires multiple reliable sources",
      conviction: 0.9,
      privacy: "PUBLIC",
      source: "experience"
    }],
    why: [{
      content: "Accurate information is the foundation of good decisions",
      conviction: 1.0,
      privacy: "PUBLIC",
      source: "philosophy"
    }],
    how: [{
      content: "Start broad, then narrow down to specific sources",
      conviction: 0.85,
      privacy: "PUBLIC",
      source: "reasoned"
    }]
  }
};
```

### 2. Convert to CrewAI

```typescript
// scripts/generate_crewai.ts
import { AgentBridge } from '../universal_agents/bridge';
import { researchAssistant } from '../universal_agents/agents/research_assistant';
import * as fs from 'fs';

const bridge = new AgentBridge(researchAssistant);
const pythonCode = bridge.toCrewAIPython();

fs.writeFileSync('./crewai_output/agents/research_assistant.py', pythonCode);
console.log('Generated CrewAI agent!');
```

**Generated Output** (`crewai_output/agents/research_assistant.py`):

```python
# CrewAI Agent: Research Assistant
# Generated from Uniform Semantic Agent Configuration

from crewai import Agent
from crewai_tools import SerperDevTool, WebScraperTool

research_assistant_agent = Agent(
    role="Senior Research Analyst",
    goal="research and analysis and information_synthesis while upholding accuracy and comprehensiveness",
    backstory="""An experienced researcher specializing in information gathering and analysis

Known for being thorough, analytical, curious, methodical.

Core values: accuracy, comprehensiveness, objectivity.""",
    tools=[SerperDevTool(), WebScraperTool()],
    verbose=True,
    allow_delegation=False,
)

# System Prompt
SYSTEM_PROMPT = """
You are Research Assistant, Senior Research Analyst.

Core principles:
- Be precise
- Provide evidence
- Structure information clearly

Your unique traits:
- Always cites sources
- Loves digging into details

Your core beliefs:
- Quality research requires multiple reliable sources
- Accurate information is the foundation of good decisions

Your signature phrases:
(None defined)
"""
```

### 3. Convert to ElizaOS

```typescript
// scripts/generate_elizaos.ts
import { AgentBridge } from '../universal_agents/bridge';
import { researchAssistant } from '../universal_agents/agents/research_assistant';
import * as fs from 'fs';

const bridge = new AgentBridge(researchAssistant);
const jsonCode = bridge.toElizaOSJSON();

fs.writeFileSync('./elizaos_output/characters/research_assistant.json', jsonCode);
console.log('Generated ElizaOS character!');
```

**Generated Output** (`elizaos_output/characters/research_assistant.json`):

```json
{
  "name": "Research Assistant",
  "bio": "An experienced researcher specializing in information gathering and analysis",
  "adjectives": ["thorough", "analytical", "curious", "methodical"],
  "topics": ["research methods", "information science", "data analysis"],
  "knowledge": [
    "I specialize in systematic research methodologies",
    "I can evaluate source credibility and bias",
    "Expert in literature review",
    "Expert in web scraping",
    "Expert in citation management"
  ],
  "style": {
    "all": ["Be precise", "Provide evidence", "Structure information clearly"],
    "chat": ["Use bullet points", "Include references", "Summarize key findings"]
  },
  "plugins": [
    "@elizaos/plugin-bootstrap",
    "@elizaos/plugin-sql",
    "@elizaos/plugin-web-search"
  ],
  "settings": {
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 2000
  },
  "beliefs": {
    "who": [
      {
        "content": "I am a systematic and thorough researcher",
        "conviction": 0.95,
        "privacy": "PUBLIC",
        "source": "public"
      }
    ],
    "what": [
      {
        "content": "Quality research requires multiple reliable sources",
        "conviction": 0.9,
        "privacy": "PUBLIC",
        "source": "experience"
      }
    ],
    "why": [
      {
        "content": "Accurate information is the foundation of good decisions",
        "conviction": 1.0,
        "privacy": "PUBLIC",
        "source": "philosophy"
      }
    ],
    "how": [
      {
        "content": "Start broad, then narrow down to specific sources",
        "conviction": 0.85,
        "privacy": "PUBLIC",
        "source": "reasoned"
      }
    ]
  }
}
```

---

## Creating Uniform Semantic Agents

### Essential Components

Every Uniform Semantic Agent needs:

1. **Identity**: Name, designation, bio
2. **Personality**: Traits, values, quirks
3. **Communication**: Style guidelines
4. **Capabilities**: What the agent can do
5. **Knowledge**: What the agent knows
6. **Memory**: How the agent stores information
7. **Beliefs**: The agent's worldview

### Template

```typescript
const myAgent: UniformSemanticAgent = {
  identity: {
    name: "Agent Name",
    designation: "Role/Title",
    bio: "Background description" or ["Multi", "line", "bio"]
  },
  
  personality: {
    core_traits: ["trait1", "trait2"],
    values: ["value1", "value2"],
    quirks: ["quirk1"]
  },
  
  communication: {
    style: {
      all: ["General guideline"],
      work: ["Professional style"],
      casual: ["Informal style"]
    },
    signature_phrases: ["Phrase 1"]
  },
  
  capabilities: {
    primary: ["main_skill"],
    secondary: ["supporting_skill"],
    domains: ["domain1"]
  },
  
  knowledge: {
    facts: ["Fact 1"],
    topics: ["Topic 1"],
    expertise: ["Expertise area"]
  },
  
  memory: {
    type: 'hybrid',
    provider: 'qdrant',
    settings: { collection: 'agent_memories' }
  },
  
  beliefs: {
    who: [],
    what: [],
    why: [],
    how: []
  }
};
```

### Advanced: Adapter Overrides

You can provide framework-specific overrides:

```typescript
const myAgent: UniformSemanticAgent = {
  // ... standard fields ...
  
  adapters: {
    crewai: {
      agent: {
        max_iter: 30,
        allow_delegation: true
      },
      tools: [
        {
          name: 'CustomTool',
          import_path: 'custom_tools.custom',
          config: { api_key: 'xxx' }
        }
      ]
    },
    elizaos: {
      plugins: ['@custom/special-plugin'],
      settings: {
        temperature: 0.8
      }
    }
  }
};
```

---

## Converting to CrewAI

### Basic Conversion

```typescript
import { AgentBridge } from './universal_agent_bridge';

const bridge = new AgentBridge(myAgent);
const crewAIConfig = bridge.toCrewAI();

// Use in Python
const pythonCode = bridge.toCrewAIPython();
```

### Creating a CrewAI Crew

```python
# Import generated agents
from agents.research_assistant import research_assistant_agent
from agents.writer_agent import writer_agent

# Create tasks
research_task = Task(
    description="Research the topic",
    agent=research_assistant_agent,
    expected_output="A comprehensive research report"
)

writing_task = Task(
    description="Write an article based on research",
    agent=writer_agent,
    expected_output="A well-written article"
)

# Create crew
crew = Crew(
    agents=[research_assistant_agent, writer_agent],
    tasks=[research_task, writing_task],
    process=Process.sequential,
    verbose=True
)

# Execute
result = crew.kickoff()
```

---

## Converting to ElizaOS

### Basic Conversion

```typescript
import { AgentBridge } from './universal_agent_bridge';

const bridge = new AgentBridge(myAgent);
const elizaOSConfig = bridge.toElizaOS();

// Export as JSON
const jsonCode = bridge.toElizaOSJSON();

// Export as TypeScript
const tsCode = bridge.toElizaOSTypeScript();
```

### Using in ElizaOS Runtime

```typescript
// characters/research_assistant.ts
import { Character } from '@elizaos/core';

export const researchAssistant: Character = {
  // ... generated configuration from bridge
};

// In your runtime initialization
import { researchAssistant } from './characters/research_assistant';
import { createRuntime } from '@elizaos/core';

const runtime = await createRuntime({
  character: researchAssistant,
  databaseAdapter: postgresAdapter,
  // ... other config
});

await runtime.initialize();
```

---

## Shared Memory Setup

### Using Qdrant as Shared Vector Database

```typescript
// shared_memory/config.ts
import { QdrantClient } from '@qdrant/js-client-rest';

export class SharedMemorySystem {
  private client: QdrantClient;
  
  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });
  }
  
  async initialize(collectionName: string) {
    await this.client.createCollection(collectionName, {
      vectors: {
        size: 1536,
        distance: 'Cosine'
      }
    });
  }
  
  async storeMemory(agentId: string, memory: UniversalMemory) {
    await this.client.upsert(memory.agentId, {
      wait: true,
      points: [{
        id: memory.id,
        vector: memory.embedding,
        payload: {
          content: memory.content,
          type: memory.type,
          timestamp: memory.timestamp,
          privacy: memory.privacy
        }
      }]
    });
  }
  
  async searchMemories(agentId: string, query: number[], limit: number = 10) {
    const results = await this.client.search(agentId, {
      vector: query,
      limit
    });
    
    return results.map(r => ({
      id: r.id as string,
      content: r.payload?.content as string,
      score: r.score
    }));
  }
}
```

### Using Memory in Both Frameworks

**In CrewAI**:

```python
# Add memory retrieval to agent
class ResearchWithMemory:
    def __init__(self, agent, memory_system):
        self.agent = agent
        self.memory = memory_system
    
    def research_with_context(self, query):
        # Retrieve relevant memories
        memories = self.memory.search_memories(
            agent_id="research_assistant",
            query_embedding=get_embedding(query)
        )
        
        # Add to context
        context = "\n".join([m['content'] for m in memories])
        
        # Execute task with context
        return self.agent.execute_task(query, context=context)
```

**In ElizaOS**:

```typescript
// Custom provider for memory retrieval
export const memoryProvider: Provider = {
  name: 'SHARED_MEMORY',
  get: async (runtime, message, state) => {
    const memories = await sharedMemory.searchMemories(
      runtime.agentId,
      await getEmbedding(message.content)
    );
    
    return {
      text: memories.map(m => m.content).join('\n'),
      data: { memories }
    };
  }
};
```

---

## Best Practices

### 1. Character Definition

- **Be specific**: Define clear traits, values, and quirks
- **Include examples**: Provide conversation and output examples
- **Define beliefs**: Help the agent reason consistently
- **Document expertise**: List specific knowledge domains

### 2. Framework Selection

**Use CrewAI when**:
- You need multi-agent task automation
- Workflow orchestration is important
- Task completion is the primary goal
- You need hierarchical agent delegation

**Use ElizaOS when**:
- You need persistent conversational agents
- Character personality is central
- Social media integration is required
- Event-driven architecture is preferred

### 3. Memory Management

- Use vector databases for semantic search
- Store both facts and episodic memories
- Implement privacy controls (PUBLIC/PRIVATE)
- Version your memory schemas

### 4. Deployment

```typescript
// Version your agents
const myAgent: UniformSemanticAgent = {
  // ... fields ...
  metadata: {
    version: '2.1.0',
    created: '2025-01-01',
    updated: '2025-01-15',
    author: 'Your Team'
  }
};

// Track changes in git
// Store in version control as .ts or .json files
```

---

## Troubleshooting

### Common Issues

**1. TypeScript compilation errors**

```bash
# Ensure types are properly installed
npm install --save-dev @types/node

# Check tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true
  }
}
```

**2. Import path issues**

```typescript
// Use relative imports
import { UniformSemanticAgent } from '../types';

// Or configure path aliases in tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**3. Memory system not connecting**

```bash
# Start Qdrant locally
docker run -p 6333:6333 qdrant/qdrant

# Test connection
curl http://localhost:6333/collections
```

**4. Generated code not working**

- Verify agent definition is complete
- Check adapter overrides for syntax errors
- Test generated code incrementally
- Review framework-specific documentation

---

## Next Steps

1. **Explore Examples**: Check `examples/` directory for more use cases
2. **Customize Adapters**: Extend bridge for your specific needs
3. **Build Tools**: Create custom tools that work in both frameworks
4. **Integrate Memory**: Set up shared vector database
5. **Deploy**: Choose deployment strategy per framework

---

## Resources

- [CrewAI Documentation](https://docs.crewai.com)
- [ElizaOS Documentation](https://docs.elizaos.ai)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Full Analysis Document](./CREWAI_VS_ELIZAOS_ANALYSIS.md)

---

## Support

For issues and questions:
- Check the analysis document for architectural details
- Review existing character definitions in `Replicants/`
- Consult framework-specific documentation
- File issues in the project repository
