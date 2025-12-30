# Uniform Semantic Agent Bridge

**A framework-agnostic agent definition system that bridges CrewAI and ElizaOS**

---

## Overview

The Uniform Semantic Agent Bridge allows you to define AI agents once and deploy them to both CrewAI (task-oriented collaborative agents) and ElizaOS (character-driven conversational agents) frameworks. This approach treats agents as rich character profiles that transcend any single execution environment.

### The Problem

- **CrewAI** excels at task automation and multi-agent workflows
- **ElizaOS** excels at persistent personalities and conversational AI
- Defining the same agent in both systems requires duplicate work
- No easy way to share knowledge between frameworks

### The Solution

Define agents using a **Uniform Semantic Agent** format that captures:
- Rich personality and character traits
- Beliefs and mental models
- Communication styles
- Knowledge and capabilities
- Memory configuration

Then convert to either framework on demand.

---

## Key Concepts

### Uniform Semantic Agent

A framework-agnostic agent definition that includes:

```typescript
interface UniformSemanticAgent {
  identity: {
    name: string;
    designation: string;
    bio: string | string[];
  };
  personality: {
    core_traits: string[];
    values: string[];
    quirks: string[];
  };
  communication: {
    style: Record<string, string[]>;
    signature_phrases: string[];
  };
  capabilities: {
    primary: string[];
    domains: string[];
  };
  knowledge: {
    facts: string[];
    topics: string[];
    expertise: string[];
  };
  memory: MemoryConfig;
  beliefs: {
    who: Belief[];
    what: Belief[];
    why: Belief[];
    how: Belief[];
  };
}
```

### Agent Bridge

Converts Uniform Semantic Agents to framework-specific configurations:

```typescript
const bridge = new AgentBridge(universalAgent);

// Generate CrewAI configuration
const crewAI = bridge.toCrewAI();
const pythonCode = bridge.toCrewAIPython();

// Generate ElizaOS configuration
const elizaOS = bridge.toElizaOS();
const jsonCode = bridge.toElizaOSJSON();
```

### Shared Memory

Both frameworks can access the same knowledge base via vector databases:

```
┌─────────────┐
│  CrewAI     │──┐
│  Agent      │  │
└─────────────┘  │
                 │
                 ▼
          ┌─────────────┐
          │   Qdrant    │
          │   Vector    │
          │   Database  │
          └─────────────┘
                 ▲
                 │
┌─────────────┐  │
│  ElizaOS    │──┘
│  Agent      │
└─────────────┘
```

---

## Quick Start

### 1. Define Your Agent

```typescript
import { UniformSemanticAgent } from './universal_agent_types';

const myAgent: UniformSemanticAgent = {
  identity: {
    name: "Research Assistant",
    designation: "Senior Research Analyst",
    bio: "An experienced researcher..."
  },
  personality: {
    core_traits: ["thorough", "analytical"],
    values: ["accuracy", "comprehensiveness"],
    quirks: ["Always cites sources"]
  },
  // ... more fields
};
```

### 2. Convert to CrewAI

```typescript
import { AgentBridge } from './universal_agent_bridge';
import * as fs from 'fs';

const bridge = new AgentBridge(myAgent);
const pythonCode = bridge.toCrewAIPython();

fs.writeFileSync('./output/agent.py', pythonCode);
```

### 3. Convert to ElizaOS

```typescript
const bridge = new AgentBridge(myAgent);
const jsonCode = bridge.toElizaOSJSON();

fs.writeFileSync('./output/character.json', jsonCode);
```

---

## Project Structure

```
CharactersAgents/
├── universal_agent_types.ts          # Type definitions
├── universal_agent_bridge.ts         # Conversion logic
├── examples/
│   └── universal_agent_example.ts    # Usage examples
├── Replicants/                       # Existing character definitions
│   ├── legends/                      # Historical figures
│   ├── matrix/                       # Movie characters
│   └── sci-fi/                       # Sci-fi characters
├── CREWAI_VS_ELIZAOS_ANALYSIS.md    # Deep architectural analysis
├── IMPLEMENTATION_GUIDE.md           # Step-by-step guide
└── UNIVERSAL_AGENT_BRIDGE_README.md # This file
```

---

## Architecture Comparison

### CrewAI: Task-Oriented Collaboration

```python
# Agent has role, goal, backstory
agent = Agent(
    role="Researcher",
    goal="Uncover insights",
    backstory="Experienced analyst...",
    tools=[SearchTool()]
)

# Agents work on tasks
task = Task(
    description="Research AI trends",
    agent=agent
)

# Crews orchestrate agents
crew = Crew(agents=[agent], tasks=[task])
result = crew.kickoff()
```

**Key Features**:
- Task-centric execution
- Sequential or hierarchical processes
- Multi-agent coordination
- Tool-based capabilities

### ElizaOS: Character-Driven Interaction

```typescript
// Character has personality and style
const character: Character = {
  name: "Researcher",
  bio: "Experienced analyst...",
  personality: {
    traits: ["thorough", "analytical"]
  },
  plugins: ["@elizaos/plugin-search"]
}

// Runtime creates agent from character
const runtime = await createRuntime({ character });

// Agent responds to messages
const response = await runtime.processMessage(message);
```

**Key Features**:
- Message-centric interaction
- Event-driven architecture
- Plugin-based extensibility
- Persistent personality

---

## Key Differences

| Aspect | CrewAI | ElizaOS |
|--------|---------|---------|
| **Paradigm** | Task execution | Conversation |
| **Orchestration** | Crew → Task → Agent | Runtime → Message → Action |
| **Memory** | Crew-level | Agent-level |
| **Tools** | Tool objects | Plugin system (Actions/Providers) |
| **Best For** | Workflows, automation | Chat, social media, persistent agents |

---

## Conversion Mapping

### CrewAI ← Uniform Semantic Agent

```
identity.designation → role
capabilities.primary → goal (derived)
personality + bio → backstory
capabilities.tools → tools
beliefs (public) → system_prompt
```

### ElizaOS ← Uniform Semantic Agent

```
identity.name → name
identity.bio → bio
personality.core_traits → adjectives
knowledge.topics → topics
communication.style → style
capabilities → plugins (derived)
beliefs → beliefs (direct)
```

---

## Interoperability

### Not Directly Interoperable

CrewAI and ElizaOS **cannot run together** at runtime because:
1. Different execution models (task-based vs event-driven)
2. Different LLM interaction patterns
3. Different memory architectures
4. Different plugin systems

### Bridge Strategy

Use **configuration bridge**:

```
        Uniform Semantic Agent
              ↓
         ┌────┴────┐
         ↓         ↓
      CrewAI    ElizaOS
      (Tasks)   (Messages)
```

### Shared Knowledge

Both can access the same vector database:

```typescript
class SharedMemorySystem {
  async storeMemory(memory: UniversalMemory) {
    // Store in framework-agnostic format
    await vectorDB.upsert({
      embedding: memory.embedding,
      content: memory.content,
      metadata: memory.metadata
    });
  }
  
  async retrieveForCrewAI(query: string) {
    // Format for CrewAI context
  }
  
  async retrieveForElizaOS(query: string) {
    // Format for ElizaOS state
  }
}
```

---

## Use Cases

### 1. Multi-Environment Deployment

Deploy the same agent personality to:
- **CrewAI** for backend task automation
- **ElizaOS** for customer-facing chat interface

### 2. Research + Interaction

Use **CrewAI** for:
- Systematic research workflows
- Data analysis pipelines
- Report generation

Use **ElizaOS** for:
- Explaining research findings conversationally
- Answering questions about research
- Social media presence

### 3. Development + Production

- **Development**: Test agent personality in ElizaOS (quick iteration)
- **Production**: Deploy to CrewAI for robust task execution

---

## Advanced Features

### Custom Adapters

Override framework-specific settings:

```typescript
const agent: UniformSemanticAgent = {
  // ... standard fields ...
  adapters: {
    crewai: {
      agent: {
        max_iter: 30,
        temperature: 0.8
      },
      tools: [{
        name: 'CustomTool',
        import_path: 'my_tools.custom'
      }]
    },
    elizaos: {
      plugins: ['@custom/special-plugin'],
      settings: {
        model: 'gpt-4-turbo'
      }
    }
  }
};
```

### Memory Synchronization

```typescript
// Store in CrewAI
await sharedMemory.storeFromCrewAI({
  agentId: 'research_assistant',
  content: taskResult,
  type: 'task_completion'
});

// Retrieve in ElizaOS
const memories = await sharedMemory.retrieveForElizaOS(
  'research_assistant',
  query
);
```

---

## Examples in This Project

### Existing Character Definitions

The `Replicants/` directory contains rich character profiles that can be converted:

- **Ada Lovelace** (`legends/ada_lovelace.json`): First programmer
- **Ted Lasso** (`legends/ted_lasso.json`): Optimistic coach
- **Morpheus** (`matrix/morpheus.json`): Guide of consciousness

### Converting Existing Characters

```typescript
import { AgentConverter } from './universal_agent_bridge';
import adaLovelace from './Replicants/legends/ada_lovelace.json';

// Convert ElizaOS character to Universal
const universalAda = AgentConverter.fromElizaOS(adaLovelace);

// Now convert to CrewAI
const bridge = new AgentBridge(universalAda);
const crewAICode = bridge.toCrewAIPython();
```

---

## Documentation

### Main Documents

1. **[CREWAI_VS_ELIZAOS_ANALYSIS.md](./CREWAI_VS_ELIZAOS_ANALYSIS.md)**
   - Comprehensive architectural comparison
   - Deep dive into both frameworks
   - Design philosophy and rationale
   - 10 sections covering all aspects

2. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)**
   - Step-by-step implementation instructions
   - Setup and installation
   - Code examples and templates
   - Troubleshooting guide

3. **[universal_agent_types.ts](./universal_agent_types.ts)**
   - Complete TypeScript type definitions
   - Interface documentation
   - All type exports

4. **[universal_agent_bridge.ts](./universal_agent_bridge.ts)**
   - Bridge implementation
   - Conversion logic
   - Memory management
   - Utility functions

5. **[examples/universal_agent_example.ts](./examples/universal_agent_example.ts)**
   - Working code examples
   - Ada Lovelace as sample agent
   - Usage patterns

### Existing Bridge Implementations

The project already has some bridge code:

- **`Ludwig_eliza_bridge.py`**: ElizaOS → Ludwig thinking partners
- **`LeatherLadder_mcp_agent_mixin.py`**: MCP server integration

---

## Benefits

### 1. Single Source of Truth

Define character once, use everywhere:
- Consistent personality across frameworks
- Centralized character management
- Version-controlled agent definitions

### 2. Framework Flexibility

Switch or use both frameworks:
- Choose the best tool for each task
- Deploy to multiple environments
- Future-proof against framework changes

### 3. Rich Character Profiles

Go beyond basic role/goal:
- Deep personality definition
- Belief systems and mental models
- Communication styles
- Emotional ranges

### 4. Shared Knowledge

Unified memory system:
- Learn from both frameworks
- Consistent knowledge base
- Cross-framework context

---

## Limitations

### Not Runtime Interoperable

- Cannot run CrewAI and ElizaOS in the same process
- Need separate deployments
- Conversion is one-way (configuration time)

### Framework-Specific Features

Some features don't translate:
- CrewAI's hierarchical processes
- ElizaOS's evaluator system
- Platform-specific integrations

### Manual Maintenance

Requires:
- Keeping universal definitions updated
- Regenerating configs on changes
- Testing in both frameworks

---

## Future Enhancements

### Planned Features

1. **CLI Tool**: `agent-bridge convert --from universal --to crewai agent.json`
2. **Validation**: Schema validation for Uniform Semantic Agents
3. **Templates**: Pre-built agent templates
4. **Migration**: Convert existing CrewAI/ElizaOS agents to universal format
5. **Testing**: Automated testing in both frameworks

### Potential Research

1. **Runtime Bridge**: Experimental proxy layer
2. **Unified Tool System**: Tools that work in both frameworks
3. **Cross-Framework Learning**: Shared RL loop
4. **Personality Transfer**: Learning from interactions in both systems

---

## Getting Started

1. **Read the Analysis**: [CREWAI_VS_ELIZAOS_ANALYSIS.md](./CREWAI_VS_ELIZAOS_ANALYSIS.md)
2. **Follow the Guide**: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
3. **Run Examples**: Check `examples/universal_agent_example.ts`
4. **Convert Existing Characters**: Use the character converter
5. **Deploy**: Generate configs for your target framework

---

## Contributing

To add features:
1. Extend type definitions in `universal_agent_types.ts`
2. Update bridge logic in `universal_agent_bridge.ts`
3. Add examples
4. Document in the guides

---

## Conclusion

The Uniform Semantic Agent Bridge treats agents as **something bigger than either framework's stub** - persistent personalities with rich character definitions, deep knowledge, and consistent reasoning that can be instantiated in different execution environments.

This approach:
- ✅ Maintains consistency across frameworks
- ✅ Provides flexibility in deployment
- ✅ Enables shared knowledge
- ✅ Future-proofs agent definitions

Choose CrewAI for **task automation**, ElizaOS for **conversational AI**, or use **both** with the same agent personality.

---

## License

See project LICENSE file.

---

## Contact

For questions and support, refer to the main project repository.
