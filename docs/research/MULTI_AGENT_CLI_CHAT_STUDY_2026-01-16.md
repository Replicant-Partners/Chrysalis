# Multi-Agent AI/LLM Chat & CLI Interaction Patterns Study

**Date:** January 16, 2026
**Research Method:** GitHub MCP queries, commit analysis, architecture deep-dives
**Criteria:** Active projects (10+ commits in last 2 months, 50+ stars)

---

## Executive Summary

This study systematically analyzed multi-agent and multi-user AI chat/CLI interaction patterns across GitHub. The key finding is that **true multi-agent visible conversation interfaces are rare and emerging**, with **AgentPipe** (56★) being the only actively-developed project enabling Claude/Codex/Cursor/Gemini to work together in shared terminal rooms.

Meanwhile, single-agent chat panes dominate the ecosystem (Open WebUI: 120k★, Lobe Chat: 70k★), and major multi-agent frameworks like AutoGen (53k★) and MetaGPT (63k★) have stalled development.

---

## Classification of Projects by Interaction Pattern

### Category 1: Multi-Agent CLI/TUI (Emerging - Your Use Case)

| Project | Stars | Commits (2 mo) | Key Features |
|---------|-------|----------------|--------------|
| **AgentPipe** | 56 | 25 ✅ | **Multiple CLIs (Claude/Codex/Cursor/Gemini) in shared TUI rooms**, 3 conversation modes |
| **CCManager** | 754 | 30 ✅ | Session manager for 7+ AI coding CLIs |
| **PAL MCP Server** | 10.8k | 30+ ✅ | Multiple models (Claude/Gemini/Codex) working as ONE unified backend |

### Category 2: Traditional Chat Panes (Dominant Pattern - Single Agent)

| Project | Stars | Commits (2 mo) | Pattern |
|---------|-------|----------------|---------|
| **Open WebUI** | 120k | 30+ ✅ | Single-agent chat, plugins, RAG |
| **Lobe Chat** | 70k | 30+ ✅ | Single-agent, MCP marketplace |
| **OpenHands** | 66.7k | 30 ✅ | Single-agent GUI + CLI, like Devin |
| **Cline** | 57k | Active | IDE single-agent, file/terminal control |
| **Aider** | 40k | 22 ✅ | Terminal single-agent pair programming |

### Category 3: Multi-Agent Frameworks (Mixed Activity)

| Project | Stars | Commits (2 mo) | Status |
|---------|-------|----------------|--------|
| **CrewAI** | 42.7k | 30 ✅ | Role-based agents, active framework |
| **agno** | 37k | 30 ✅ | Build/run multi-agent systems |
| **wshobson/agents** | 25.5k | 30 ✅ | Multi-agent for Claude Code |
| **agency-swarm** | 3.9k | 30 ✅ | Reliable multi-agent orchestration |
| **Rowboat** | 4.3k | 30 ✅ | Background scheduled agents |

### Category 4: STALLED Multi-Agent Projects

| Project | Stars | Commits (2 mo) | Status |
|---------|-------|----------------|--------|
| **AutoGen (Microsoft)** | 53.5k | 0 ❌ | **STALLED** |
| **MetaGPT** | 63k | 0 ❌ | **STALLED** |
| **IoA (OpenBMB)** | 791 | 0 ❌ | INACTIVE |
| **aibitat** | 148 | 0 ❌ | INACTIVE |

---

## AgentPipe Deep Dive: The Multi-Agent CLI Architecture

AgentPipe is the **only active project** implementing the exact pattern you described: "Claude and Codex and Cursor and Cline all in a terminal window together hacking away at different approaches."

### Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│                  ORCHESTRATOR                   │
│  - Round-robin / Reactive / Free-form modes     │
│  - Per-agent rate limiting (token bucket)       │
│  - Retry with exponential backoff               │
│  - Prometheus metrics                           │
│  - Bridge emitter for TUI updates               │
└─────────────────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐
    │ Claude  │  │ Codex   │  │ Cursor  │  ...
    │ Adapter │  │ Adapter │  │ Adapter │
    └────┬────┘  └────┬────┘  └────┬────┘
         │            │            │
    ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
    │ claude  │  │ codex   │  │ cursor  │
    │  CLI    │  │  CLI    │  │  CLI    │
    │(os/exec)│  │(os/exec)│  │(os/exec)│
    └─────────┘  └─────────┘  └─────────┘
```

### How CLI Adapters Work

1. **Initialize**: Find CLI binary in PATH via `exec.LookPath()`
2. **HealthCheck**: Run `cli --version` to verify working
3. **SendMessage**:
   - Filter relevant messages from conversation
   - Build prompt from history
   - Execute CLI via `os/exec`, pass prompt via stdin
   - Capture stdout + duration/token metrics
4. **Metrics**: Track tokens, cost, duration per response

### Conversation Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `round-robin` | Fixed circular order | Fair turn-taking |
| `reactive` | Random, no same agent twice | Dynamic debate |
| `free-form` | All agents participate when relevant | Open collaboration |

### Key Code Structures

```go
// Message tracks who said what with metrics
type Message struct {
    AgentID   string
    AgentName string
    AgentType string  // "claude", "gemini", "qoder"
    Content   string
    Metrics   *ResponseMetrics
}

// Per-response tracking
type ResponseMetrics struct {
    Duration     time.Duration
    InputTokens  int
    OutputTokens int
    Model        string
    Cost         float64
}
```

---

## Comparative Analysis: Multi-Agent CLI vs Chat Panes

### Why Chat Panes Dominate (120k+ stars)

1. **Simpler mental model** - One assistant, one conversation
2. **Lower latency** - No coordination overhead
3. **Easier to build** - No orchestration complexity
4. **Clear accountability** - One agent = one response

### Why Multi-Agent CLI Could Outperform

1. **Diverse perspectives** - Different models have different strengths
2. **Debate improves quality** - Cross-checking reduces hallucinations
3. **Parallel exploration** - Try multiple approaches simultaneously
4. **Cost arbitrage** - Mix expensive (Claude) with cheap (Qwen) as needed
5. **Developer ergonomics** - Terminal-native, git-aware, scriptable

### Trade-offs

| Aspect | Chat Pane | Multi-Agent CLI |
|--------|-----------|-----------------|
| **Complexity** | Low | High |
| **Latency** | Low | Higher (coordination) |
| **Cost** | Predictable | Variable (multiple agents) |
| **Quality** | Single viewpoint | Multiple viewpoints |
| **Debugging** | Simple | Complex (who said what) |
| **Scalability** | Limited | Can add more agents |

---

## Why AutoGen and MetaGPT Stalled (Five Whys Analysis)

### Why #1: Why did commits stop?
- Both had rapid growth phase, then plateau

### Why #2: Why plateau?
- **Complexity barrier** - Multi-agent conversations are hard to make work reliably
- **UX challenge** - Showing multi-agent conversations to users is confusing
- **Debugging nightmare** - When agents loop or contradict, hard to fix

### Why #3: Why is multi-agent UX hard?
- No established UI patterns for showing parallel conversations
- Users expect single-agent mental model
- Cost unpredictability with multiple agents

### Why #4: Why no established patterns?
- The space is new (2023-2024 was the exploration phase)
- Different use cases need different patterns (debate vs collaboration vs orchestration)
- Tools evolving faster than UX research

### Why #5: Root cause?
- **Multi-agent AI is a paradigm shift** that requires new interaction patterns
- Chat panes are familiar (messaging apps) but multi-agent needs new metaphors
- AgentPipe's "room" metaphor with TUI is one attempt at solving this

---

## Recommendations: Multi-Agent CLI in xterm.js

### Could it outperform traditional chat panes?

**YES, for specific use cases:**

1. **Code review** - Multiple agents check each other's work
2. **Problem-solving** - Different models explore different approaches
3. **Research** - Agents with different knowledge bases contribute
4. **Cost optimization** - Route simple tasks to cheap models, complex to expensive

### Architectural Recommendations

Based on AgentPipe's proven patterns:

1. **Adapter Pattern** - Wrap each CLI (Claude, Codex, Cursor, etc.) with common interface
2. **Process Spawning** - Use `os/exec` or equivalent to run CLIs
3. **Rate Limiting** - Per-agent token bucket to prevent cost explosion
4. **Metrics** - Track tokens/cost/duration per agent per response
5. **Conversation Modes** - Support round-robin, reactive, free-form
6. **Middleware** - Extensible message processing pipeline
7. **Real-time Updates** - Event emitter for xterm.js display

### xterm.js Integration Points

```
┌─────────────────────────────────────────┐
│              xterm.js Window            │
│  ┌─────────────────────────────────────┐│
│  │ [Alice (claude)] I think we should  ││
│  │ approach this by...                 ││
│  │                                     ││
│  │ [Bob (gemini)] Actually, consider   ││
│  │ an alternative...                   ││
│  │                                     ││
│  │ [Carol (codex)] Here's code for     ││
│  │ both approaches:                    ││
│  └─────────────────────────────────────┘│
│  [ Metrics: 3 turns | $0.02 | 1.2s avg ]│
│  > User input: ________________________ │
└─────────────────────────────────────────┘
```

### Thinking/Reasoning Pattern Injection

Your idea about "forcing thinking and reasoning patterns onto LLM models to steer them" can be implemented via:

1. **System prompts per agent** - Include CoT instructions
2. **Middleware transforms** - Add "Let's think step by step" prefix
3. **Role constraints** - "You are the critical reviewer, find flaws"
4. **Agent personas** - Different agents have different reasoning styles:
   - "Factual Analyst" - Focuses on evidence
   - "Devil's Advocate" - Challenges assumptions
   - "Creative Explorer" - Proposes alternatives
   - "Synthesizer" - Combines viewpoints

---

## Key Findings Summary

1. **AgentPipe** (56★, 25 commits) is the **only active multi-agent CLI room** project
2. **Chat panes dominate** but are single-agent (Open WebUI 120k, Lobe Chat 70k)
3. **Major frameworks stalled** - AutoGen (53k) and MetaGPT (63k) have 0 recent commits
4. **OpenHands** (66.7k) is excellent but single-agent
5. **Architecture proven** - AgentPipe shows viable pattern: process spawning + orchestrator + TUI

---

## Sources

| Project | URL | Stars | Activity |
|---------|-----|-------|----------|
| AgentPipe | github.com/kevinelliott/agentpipe | 56 | ✅ Active |
| CCManager | github.com/kbwo/ccmanager | 754 | ✅ Active |
| PAL MCP Server | github.com/BeehiveInnovations/pal-mcp-server | 10.8k | ✅ Active |
| Open WebUI | github.com/open-webui/open-webui | 120k | ✅ Active |
| Lobe Chat | github.com/lobehub/lobe-chat | 70k | ✅ Active |
| OpenHands | github.com/All-Hands-AI/OpenHands | 66.7k | ✅ Active |
| CrewAI | github.com/crewAIInc/crewAI | 42.7k | ✅ Active |
| agno | github.com/agno-agi/agno | 37k | ✅ Active |
| AutoGen | github.com/microsoft/autogen | 53.5k | ❌ Stalled |
| MetaGPT | github.com/FoundationAgents/MetaGPT | 63k | ❌ Stalled |

---

## Conclusion

A multi-agent CLI mode in xterm.js **could outperform traditional chat panes** for collaborative coding, research, and problem-solving tasks. The key is:

1. **Use AgentPipe's architecture** as a reference
2. **Focus on developer-centric use cases** where multiple perspectives add value
3. **Implement thinking/reasoning injection** via system prompts and middleware
4. **Provide clear cost/performance metrics** per agent
5. **Support flexible conversation modes** (debate, collaboration, orchestration)

The space is wide open - major frameworks have stalled, and AgentPipe at only 56 stars represents an underexplored opportunity.
