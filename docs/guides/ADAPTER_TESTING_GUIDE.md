# Universal Adapter Testing Guide

Quick start guide for testing the Universal Adapter V2 with protocol translations.

## Prerequisites

1. **Start Ollama with ministral-3:3b**
   ```bash
   ollama run ministral-3:3b
   ```

2. **Start the Go LLM Gateway** (in another terminal)
   ```bash
   cd go-services
   go run cmd/gateway/main.go
   # Or if built: ./bin/gateway
   ```

3. **Verify Gateway is running**
   ```bash
   curl http://localhost:8080/health
   ```

## Quick Commands

### List All Available Protocols
```bash
npm run adapter:list
```

Shows all 11+ registered protocols (USA, MCP, A2A, ANP, LMOS, LangChain, CrewAI, OpenAI, AutoGen, ACP, ElizaOS).

### Run Interactive Demo
```bash
npm run adapter:demo
```

Runs 3 automated translation demos:
- USA → MCP
- CrewAI → A2A
- OpenAI → USA

### Translate Between Specific Protocols
```bash
npm run test:adapter -- --translate <source> <target>
```

**Examples:**
```bash
# Translate USA agent to MCP format
npm run test:adapter -- --translate usa mcp

# Translate CrewAI agent to A2A format
npm run test:adapter -- --translate crewai a2a

# Translate OpenAI assistant to USA format
npm run test:adapter -- --translate openai usa

# Translate MCP server to LangChain agent
npm run test:adapter -- --translate mcp langchain
```

### Morph Agent (Preserve Identity)
```bash
npm run test:adapter -- --morph <source> <target>
```

Morphing is a higher-fidelity translation that preserves:
- Agent identity (name, role, purpose)
- Capability equivalence
- Behavioral instructions
- State information

**Examples:**
```bash
# Morph USA agent to A2A format
npm run test:adapter -- --morph usa a2a

# Morph CrewAI agent to OpenAI assistant
npm run test:adapter -- --morph crewai openai
```

### View Cache Statistics
```bash
npm run test:adapter -- --stats
```

Shows:
- Spec cache size and hit rate
- Mapping cache size and usage
- Average confidence scores

## Available Example Agents

The test script includes 5 pre-built example agents:

| Key | Protocol | Description |
|-----|----------|-------------|
| `usa` | USA | Chrysalis native format with full capabilities |
| `crewai` | CrewAI | Data analyst agent with role/goal/backstory |
| `mcp` | MCP | File system server with tools and resources |
| `openai` | OpenAI | Customer support assistant |
| `a2a` | A2A | Translation service agent |

## Fun Translation Experiments

### Protocol Round-Trips
Test semantic preservation by translating back and forth:

```bash
# USA → MCP → USA
npm run test:adapter -- --translate usa mcp
npm run test:adapter -- --translate mcp usa

# CrewAI → A2A → CrewAI
npm run test:adapter -- --translate crewai a2a
npm run test:adapter -- --translate a2a crewai
```

### Cross-Framework Morphing
```bash
# Python CrewAI → JavaScript MCP
npm run test:adapter -- --morph crewai mcp

# OpenAI Assistants → CrewAI
npm run test:adapter -- --morph openai crewai

# USA → LangChain
npm run test:adapter -- --morph usa langchain
```

### Compare Translation vs Morphing
```bash
# Standard translation
npm run test:adapter -- --translate usa mcp

# Identity-preserving morph
npm run test:adapter -- --morph usa mcp
```

Morphing will provide a detailed report showing:
- Identity preservation status
- Capability count changes
- Instructions transfer status
- Data loss warnings
- Field transformations applied

## Understanding the Output

### Translation Result
```
✅ Translation Complete!

⏱️  Duration: 2453ms
🎯 Confidence: 87.5%
💾 Cache Hits: spec=true, mapping=false
✓ Verified (fidelity: 92.3%)

⚠️  Warnings:
  - Field 'personality' has no direct equivalent in target protocol

🔍 Unmapped Fields:
  - personality

📥 Translated Agent:
{
  // Translated agent JSON...
}
```

### Morphing Report
```
📊 Morphing Report:
  Identity Preserved: ✓
  Capabilities: 5 → 5
  Instructions Transferred: ✓
  State Preserved: ✓

🔧 Transformations:
  - tools: mapped
    capabilities.tools → tools
  - role: renamed
    identity.role → role
```

## Advanced Usage

### Custom Protocol Translation
If you want to test with a custom agent:

1. Edit `scripts/test-adapter.ts`
2. Add your agent to `EXAMPLE_AGENTS` object:
   ```typescript
   myagent: {
     protocol: 'langchain',
     agent: {
       // Your agent definition...
     }
   }
   ```
3. Run translation:
   ```bash
   npm run test:adapter -- --translate myagent mcp
   ```

### Direct Script Usage
For more control, run the script directly with tsx:

```bash
# Full help
tsx scripts/test-adapter.ts --help

# Short flags
tsx scripts/test-adapter.ts -l          # list
tsx scripts/test-adapter.ts -t usa mcp  # translate
tsx scripts/test-adapter.ts -m usa a2a  # morph
tsx scripts/test-adapter.ts -s          # stats
tsx scripts/test-adapter.ts -d          # demo
```

## Troubleshooting

### Gateway Connection Errors
```
❌ Translation failed:
fetch failed
```

**Solution:** Ensure Gateway is running on port 8080:
```bash
cd go-services
go run cmd/gateway/main.go
```

### Ollama Not Found
```
❌ Translation failed:
model not found
```

**Solution:** Start Ollama with the model:
```bash
ollama pull ministral-3:3b
ollama run ministral-3:3b
```

### JSON Parsing Errors
The adapter tries multiple strategies:
1. Direct JSON parse
2. Extract from markdown code blocks
3. Extract from nested response

If still failing, the LLM may need temperature adjustment in `gateway-bridge.ts`.

## Next Steps

1. **Try the demo first** to see how it works:
   ```bash
   npm run adapter:demo
   ```

2. **List protocols** to see all options:
   ```bash
   npm run adapter:list
   ```

3. **Experiment with translations** between different protocols

4. **Check the source code** at:
   - `scripts/test-adapter.ts` - Test script
   - `src/adapters/universal/gateway-bridge.ts` - Gateway integration
   - `src/adapters/universal/adapter-v2.ts` - Core adapter
   - `src/adapters/universal/registry-v2.ts` - Protocol registry

## Have Fun! 🎉

The Universal Adapter is designed to make protocol translation effortless. Experiment with different combinations and see how well the semantic mapping preserves agent identity and capabilities across frameworks!

For issues or suggestions, check the code or modify the test script to suit your needs.