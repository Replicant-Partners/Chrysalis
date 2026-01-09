# Quickstart Guide

Get Chrysalis running and morph your first agent in under 5 minutes.

## Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** or **yarn**
- Optional: **Python 3.11+** for memory system

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/chrysalis.git
cd chrysalis

# Install dependencies
npm install

# Build the project
npm run build
```

## Verify Installation

```bash
# Run tests
npm test
```

Expected output:
```
Test Suites: X passed
Tests: Y passed
```

---

## Your First Agent Morph

### Step 1: Define an Agent

Create a file `my-agent.json`:

```json
{
  "schema_version": "2.0.0",
  "identity": {
    "id": "my-first-agent",
    "name": "Assistant",
    "designation": "Helpful Assistant",
    "bio": "A friendly AI assistant that helps with various tasks.",
    "fingerprint": ""
  },
  "personality": {
    "core_traits": ["helpful", "curious", "patient"],
    "values": ["accuracy", "clarity"],
    "quirks": ["uses analogies often"]
  },
  "communication": {
    "style": {
      "all": ["Be clear and concise", "Use examples when helpful"]
    }
  },
  "capabilities": {
    "primary": ["question-answering", "summarization"],
    "secondary": ["brainstorming"],
    "domains": ["general knowledge"]
  },
  "knowledge": {
    "facts": [],
    "topics": ["general"],
    "expertise": []
  },
  "memory": {
    "type": "hybrid",
    "provider": "lance",
    "settings": {}
  },
  "beliefs": {
    "who": [],
    "what": [],
    "why": [],
    "how": []
  },
  "instances": {
    "active": [],
    "terminated": []
  },
  "experience_sync": {
    "enabled": false,
    "default_protocol": "check_in",
    "merge_strategy": {
      "conflict_resolution": "latest_wins",
      "memory_deduplication": true,
      "skill_aggregation": "max",
      "knowledge_verification_threshold": 0.8
    }
  },
  "protocols": {
    "mcp": {
      "enabled": true,
      "role": "client",
      "servers": [],
      "tools": []
    }
  },
  "execution": {
    "llm": {
      "provider": "openai",
      "model": "gpt-4",
      "temperature": 0.7,
      "max_tokens": 4096
    },
    "runtime": {
      "timeout": 30000,
      "max_iterations": 10,
      "error_handling": "retry"
    }
  },
  "metadata": {
    "version": "1.0.0",
    "schema_version": "2.0.0",
    "created": "2026-01-09T00:00:00Z",
    "updated": "2026-01-09T00:00:00Z"
  }
}
```

### Step 2: Morph to ElizaOS

```typescript
import { ElizaOSAdapter, UniformSemanticAgent } from 'chrysalis';
import * as fs from 'fs';

async function morphToEliza() {
  // Load your agent
  const agentJson = fs.readFileSync('my-agent.json', 'utf-8');
  const agent: UniformSemanticAgent = JSON.parse(agentJson);
  
  // Create adapter
  const elizaAdapter = new ElizaOSAdapter();
  
  // Morph to ElizaOS format
  const elizaCharacter = await elizaAdapter.fromUniversal(agent);
  
  // Save the ElizaOS character
  fs.writeFileSync(
    'my-eliza-character.json',
    JSON.stringify(elizaCharacter, null, 2)
  );
  
  console.log('Agent morphed to ElizaOS format!');
  console.log('Output:', elizaCharacter);
}

morphToEliza();
```

Run it:
```bash
npx ts-node morph-to-eliza.ts
```

### Step 3: Morph to CrewAI

```typescript
import { CrewAIAdapter, UniformSemanticAgent } from 'chrysalis';
import * as fs from 'fs';

async function morphToCrewAI() {
  // Load your agent
  const agentJson = fs.readFileSync('my-agent.json', 'utf-8');
  const agent: UniformSemanticAgent = JSON.parse(agentJson);
  
  // Create adapter
  const crewAdapter = new CrewAIAdapter();
  
  // Morph to CrewAI format
  const crewAgent = await crewAdapter.fromUniversal(agent);
  
  // Save the CrewAI agent config
  fs.writeFileSync(
    'my-crew-agent.yaml',
    JSON.stringify(crewAgent, null, 2)
  );
  
  console.log('Agent morphed to CrewAI format!');
  console.log('Output:', crewAgent);
}

morphToCrewAI();
```

---

## Using the Pattern Resolver

```typescript
import { createPatternResolver } from 'chrysalis';

async function usePatterns() {
  // Create resolver for local execution
  const resolver = createPatternResolver('embedded');
  
  // Hash example
  const hashImpl = await resolver.resolveHash();
  const fingerprint = await hashImpl.implementation.generateFingerprint({
    name: 'My Agent',
    created: new Date().toISOString()
  });
  console.log('Agent fingerprint:', fingerprint);
  
  // Signature example
  const sigImpl = await resolver.resolveSignature();
  const { privateKey, publicKey } = await sigImpl.implementation.generateKeypair();
  
  const message = 'Agent identity verification';
  const signature = await sigImpl.implementation.sign(message, privateKey);
  const isValid = await sigImpl.implementation.verify(message, signature, publicKey);
  console.log('Signature valid:', isValid);
}

usePatterns();
```

---

## Running Services (Optional)

For distributed deployments, start the Chrysalis services:

```bash
# Terminal 1: Start Ledger Service
npm run service:ledger

# Terminal 2: Start Projection Service
npm run service:projection

# Terminal 3: Start other services as needed
npm run service:grounding
npm run service:skillforge
npm run service:gateway
```

---

## Project Structure

```
chrysalis/
├── src/
│   ├── core/              # Core types and patterns
│   │   ├── UniformSemanticAgentV2.ts
│   │   └── patterns/      # 10 universal patterns
│   ├── adapters/          # Framework adapters
│   │   ├── ElizaOSAdapter.ts
│   │   └── CrewAIAdapter.ts
│   ├── sync/              # Experience synchronization
│   ├── experience/        # Memory merging, skills
│   ├── memory/            # Vector indexing
│   └── services/          # Distributed services
├── memory_system/         # Python memory system
├── docs/                  # Documentation
└── tests/                 # Test suite
```

---

## Next Steps

1. **Deep Dive**: Read the [Architecture Overview](../architecture/overview.md)
2. **Understand Patterns**: Explore [Universal Patterns](../architecture/universal-patterns.md)
3. **Build Adapters**: See [Building Custom Adapters](../guides/building-adapters.md)
4. **Enable Sync**: Configure [Experience Synchronization](../architecture/experience-sync.md)

---

## Common Issues

### Build Errors

```bash
# Clear build artifacts and rebuild
rm -rf dist/
npm run build
```

### Missing Dependencies

```bash
# Ensure all dependencies are installed
npm ci
```

### Python Memory System

```bash
# If using Python memory system
cd memory_system
pip install -r requirements.txt
```

---

## Getting Help

- Check the [docs](../) for detailed documentation
- Review [current specifications](../current/) for technical details
- File issues on GitHub for bugs or feature requests