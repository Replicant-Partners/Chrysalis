# ACP Protocol and Multi-Agent System Synthesis

**Date:** January 16, 2026
**Purpose:** Strategic synthesis of ACP, OpenHands V1, AgentPipe, and multi-agent CLI research

---

## Executive Summary

**ACP (Agent Client Protocol)** has emerged as THE industry standard for code editor ↔ AI agent communication, effectively superseding standalone CLI orchestration tools like AgentPipe. This document synthesizes research findings and provides strategic recommendations for Chrysalis.

---

## Part 1: ACP - The New Standard

### What is ACP?

ACP (Agent Client Protocol) is an open standard created by **Zed** that standardizes communication between:
- **Clients**: Code editors (VS Code, Zed, Emacs, Unity, etc.)
- **Agents**: AI coding agents (Claude Code, OpenCode, Gemini, Codex, etc.)

**Official Resources:**
- Website: https://agentclientprotocol.com
- GitHub: github.com/agentclientprotocol
- Schema: `schema/schema.json`

### ACP Protocol Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ACP PROTOCOL                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TRANSPORT: ndjson (newline-delimited JSON) over stdio              │
│                                                                     │
│  ┌─────────────────────── CAPABILITIES ─────────────────────────┐   │
│  │                                                               │   │
│  │  • MCP Integration (http, sse)                               │   │
│  │  • Prompt: audio, image, embeddedContext                     │   │
│  │  • Session: load, save, modes, models                        │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────── AGENT → CLIENT REQUESTS ───────────────────────┐   │
│  │                                                               │   │
│  │  • WriteTextFileRequest / ReadTextFileRequest                │   │
│  │  • CreateTerminalRequest / TerminalOutputRequest             │   │
│  │  • WaitForTerminalExitRequest / KillTerminalCommandRequest   │   │
│  │  • ReleaseTerminalRequest                                    │   │
│  │  • RequestPermissionRequest (user consent)                   │   │
│  │  • ExtRequest (extensibility)                                │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────── NOTIFICATIONS ────────────────────────────────┐   │
│  │                                                               │   │
│  │  • SessionNotification (streaming updates)                   │   │
│  │  • ToolCall updates with status: running/success/failed     │   │
│  │  • ExtNotification (extensibility)                          │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Official SDK Languages

| Language | Package | Status |
|----------|---------|--------|
| TypeScript | `@agentclientprotocol/sdk` | ✅ Official |
| Python | `python-sdk` | ✅ Official |
| Rust | `agent-client-protocol` | ✅ Official |
| Kotlin | `acp-kotlin` | ✅ Official |
| Java | `java-sdk` | ✅ Official |
| Emacs Lisp | `acp.el` | 🔧 Community |

### ACP Agent Registry

Official agents in `agentclientprotocol/registry`:

| Agent | Provider | Command |
|-------|----------|---------|
| `opencode` | SST | `./opencode acp` |
| `codex-acp` | OpenAI | `./codex acp` |
| `gemini` | Google | `./gemini acp` |
| `qwen-code` | Alibaba | `./qwen-code acp` |
| `mistral-vibe` | Mistral | `./mistral acp` |
| `auggie` | Auggie | `./auggie acp` |

Agents enter ACP mode with the `acp` CLI flag.

### ACP Clients (Editors)

| Client | Platform | Status |
|--------|----------|--------|
| **Zed** | Desktop | Built-in |
| **VS Code ACP** (omercnet) | VS Code | Extension |
| **Nexus ACP** (cosmos-vibe) | VS Code | Extension (multi-tab) |
| **UnityAgentClient** | Unity | Asset |
| **acp.el** | Emacs | Package |

---

## Part 2: Why AgentPipe May Be Declining

AgentPipe's approach (CLI-level orchestration) is being superseded by:

1. **ACP standardization**: Single protocol for all editors ↔ agents
2. **Native editor integration**: Chat panes IN editors, not external CLIs
3. **First-party support**: Claude Code, Gemini, etc. implementing ACP directly
4. **Terminal abstraction**: ACP handles terminal via `CreateTerminalRequest`

### AgentPipe's Remaining Value

AgentPipe still offers:
- Multi-agent orchestration (round-robin, reactive, free-form modes)
- Rate limiting per agent
- Middleware chain for message processing
- Prometheus metrics

These could be **overlaid on ACP** as an orchestration layer.

---

## Part 3: OpenHands V1 SDK - Meta-Cognitive Capabilities

OpenHands V1 SDK (`github.com/OpenHands/software-agent-sdk`) provides battle-tested components that can enhance ANY agent system:

### Extractable Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Condenser** | `openhands-sdk/context/condenser/` | Context compression (9 strategies + pipeline) |
| **StuckDetector** | `openhands-sdk/conversation/stuck_detector.py` | Loop detection (5 patterns) |
| **Critic** | `openhands-sdk/critic/` | Self-evaluation (agent_finished, empty_patch) |
| **Delegate** | `openhands-tools/delegate/` | Multi-agent task delegation |
| **TaskTracker** | `openhands-tools/task_tracker/` | Task list management |
| **Skills** | `openhands-sdk/context/skills/` | Skill/plugin system |

### OpenHands Condenser Strategies

```
openhands-sdk/context/condenser/
├── base.py                    # Base interface
├── llm_summarizing_condenser.py   # LLM-based summarization
├── no_op_condenser.py             # Passthrough
└── pipeline_condenser.py          # Chain multiple condensers
```

### OpenHands Delegation Pattern

```python
# From examples/01_standalone_sdk/25_agent_delegation.py
register_tool("DelegateTool", DelegateTool)
tools = get_default_tools()
tools.append(Tool(name="DelegateTool"))

main_agent = Agent(llm=llm, tools=tools)
conversation = Conversation(
    agent=main_agent,
    visualizer=DelegationVisualizer(name="Delegator"),
)
conversation.send_message("Plan a trip with two sub-agents...")
conversation.run()  # Spawns sub-agents in parallel!
```

---

## Part 4: Strategic Synthesis for Chrysalis

### Option A: Chrysalis as ACP Client

Chrysalis could implement an ACP client that:
1. Connects to multiple ACP agents (Claude, Gemini, OpenCode)
2. Provides unified chat interface
3. Adds multi-agent orchestration ABOVE ACP
4. Injects OpenHands capabilities (condenser, stuck detection)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CHRYSALIS ACP ORCHESTRATOR                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────── META-COGNITIVE LAYER (OpenHands) ────────────┐    │
│  │  Condenser | StuckDetector | Critic | TaskTracker          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌────────────── ORCHESTRATION LAYER ─────────────────────────┐    │
│  │  Round-Robin | Reactive | FreeForm | Rate Limiting         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌────────────── ACP CLIENT LAYER ────────────────────────────┐    │
│  │                                                              │    │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │    │
│  │   │ Claude  │  │ OpenCode│  │ Gemini  │  │ Codex   │       │    │
│  │   │  ACP    │  │  ACP    │  │  ACP    │  │  ACP    │       │    │
│  │   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │    │
│  │        │            │            │            │             │    │
│  │   [ndjson/stdio]  [ndjson/stdio] [...]       [...]         │    │
│  │                                                              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Option B: Chrysalis as ACP Agent

Chrysalis could expose our agents AS ACP agents:
1. Implement ACP server mode in our agents
2. Register in ACP registry
3. Allow any ACP client (VS Code, Zed, Emacs) to connect

### Option C: Hybrid - Chrysalis Nexus

Combine both:
1. **Chrysalis Core** exposes as ACP agent
2. **Chrysalis Orchestrator** connects to external ACP agents
3. **Chrysalis Meta** provides OpenHands capabilities to all

---

## Part 5: Implementation Recommendations

### Priority 1: ACP TypeScript SDK Integration

```bash
npm install @agentclientprotocol/sdk
```

Create `src/acp/` module:
```
src/acp/
├── client.ts         # ACPClient wrapper
├── agent.ts          # ACP agent abstraction
├── registry.ts       # Agent registry integration
└── types.ts          # ACP types
```

### Priority 2: OpenHands Capabilities Port

Port key OpenHands patterns to TypeScript:
```
src/metacognitive/
├── condenser/
│   ├── base.ts
│   ├── llm-summarizing.ts
│   └── pipeline.ts
├── stuck-detector.ts
├── critic.ts
└── task-tracker.ts
```

### Priority 3: Multi-Agent Orchestration

Build orchestration above ACP:
```
src/orchestrator/
├── multi-agent.ts     # Multiple ACP agent management
├── delegation.ts      # Task delegation patterns
├── consensus.ts       # Multi-agent consensus
└── visualization.ts   # Conversation visualization
```

---

## Part 6: Key Insights

### ACP is Related to MCP, Not Competing

- **MCP (Model Context Protocol)**: Tool ↔ Model communication
- **ACP (Agent Client Protocol)**: Editor ↔ Agent communication
- ACP includes MCP as a capability (`mcpCapabilities`)

### The Ecosystem is Consolidating

```
Editor (VS Code, Zed)
    │
    └──▶ ACP ──▶ Agent (Claude, OpenCode)
                    │
                    └──▶ MCP ──▶ Tools (search, files)
```

### Multi-Agent is the Next Frontier

OpenHands' delegation pattern shows the future:
- Main agent spawns sub-agents
- Sub-agents work in parallel
- Main agent synthesizes results
- Cost tracking per sub-agent

---

## Conclusion

1. **ACP is the new standard** - Adopt it for editor integration
2. **OpenHands provides meta-cognition** - Port condenser, stuck detection, critics
3. **AgentPipe concepts are valuable** - Multi-agent orchestration ABOVE ACP
4. **Chrysalis opportunity** - Be the meta-cognitive layer that enhances ANY ACP agent

The winning strategy is **ACP + OpenHands meta-cognition + multi-agent orchestration**.

---

## Next Steps

1. [ ] Install ACP TypeScript SDK
2. [ ] Create minimal ACP client connecting to OpenCode
3. [ ] Port OpenHands condenser to TypeScript
4. [ ] Port stuck detector to TypeScript
5. [ ] Build multi-agent orchestration layer
6. [ ] Create Chrysalis ACP agent for registry
7. [ ] Build VS Code extension using Nexus as reference
