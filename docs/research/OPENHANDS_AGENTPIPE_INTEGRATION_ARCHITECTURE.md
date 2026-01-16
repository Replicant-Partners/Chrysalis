# OpenHands + AgentPipe Integration Architecture

**Date:** January 16, 2026
**Goal:** Semantic recombination of OpenHands capabilities into AgentPipe's multi-agent CLI architecture

---

## Executive Summary

This document proposes injecting **OpenHands meta-cognitive capabilities** into **AgentPipe's multi-agent orchestration** to create a "supercharged" multi-agent CLI system. The key insight is that OpenHands has battle-tested components for self-evaluation, context management, loop detection, and MCP integration that can be extracted and applied to ANY agent CLI wrapper.

---

## Extractable OpenHands Capabilities

### 1. **Critic System** (openhands/critic/)

**What it does:** Evaluates agent outputs against criteria

```
openhands/critic/
├── base.py          # BaseCritic interface
└── finish_critic.py # Checks if agent completed task properly
```

**Key Pattern:**
```python
class BaseCritic:
    def evaluate(events: list[Event], git_patch: str | None) -> CriticResult

CriticResult = {score: float, message: str}
```

**How to inject into AgentPipe:**
- Add `CriticAdapter` to AgentPipe's middleware chain
- After each agent response, run critic evaluation
- Use score to decide: accept, reject, or ask for revision
- Multi-agent twist: Have different agents critique each other's work

---

### 2. **Condenser System** (openhands/memory/condenser/)

**What it does:** Compresses conversation context to fit token limits

```
openhands/memory/condenser/
├── condenser.py
└── impl/
    ├── llm_summarizing_condenser.py      # LLM-based summarization
    ├── llm_attention_condenser.py        # Attention-based filtering
    ├── conversation_window_condenser.py  # Sliding window
    ├── recent_events_condenser.py        # Keep N recent events
    ├── amortized_forgetting_condenser.py # Gradual memory decay
    ├── observation_masking_condenser.py  # Mask verbose outputs
    ├── structured_summary_condenser.py   # Structured summaries
    └── pipeline.py                       # Chain condensers together!
```

**How to inject into AgentPipe:**
- Create `CondenserMiddleware` that runs before `SendMessage()`
- Chain multiple condensers: `recent + attention + summarize`
- Multi-agent bonus: Condense per-agent context separately
- Critical for multi-agent where context accumulates 3-4x faster!

**Example Pipeline:**
```
raw_history → RecentEvents(50) → AttentionFilter → LLMSummarize → compressed
```

---

### 3. **StuckDetector** (openhands/controller/stuck.py)

**What it does:** Detects when agent is looping or stuck

```python
class StuckDetector:
    @dataclass
    class StuckAnalysis:
        loop_type: str
        loop_repeat_times: int
        loop_start_idx: int

    def is_stuck(headless_mode: bool = True) -> bool
```

**Loop Detection Patterns:**
- Syntax error loops (same error repeated)
- Action-observation repetition
- No-progress cycles

**How to inject into AgentPipe:**
- Add `StuckMiddleware` after each agent turn
- If agent stuck 3+ times → switch to different agent
- If all agents stuck → escalate to user
- Multi-agent advantage: Stuck agent can be helped by others!

---

### 4. **MCP Client** (openhands/mcp/)

**What it does:** Connects to MCP servers for tool access

```
openhands/mcp/
├── client.py         # MCP client implementation
├── tool.py           # Tool abstraction
└── error_collector.py
```

**How to inject into AgentPipe:**
- Add MCP tool server configuration per agent
- Share expensive tools (like search) across agents
- Route tool calls to appropriate MCP servers
- Track tool usage metrics per agent

---

### 5. **Memory System** (openhands/memory/)

**What it does:** Persistent conversation and knowledge memory

```
openhands/memory/
├── memory.py             # Base memory abstraction
├── conversation_memory.py # Conversation history
└── view.py               # Memory retrieval views
```

**How to inject into AgentPipe:**
- Add persistent memory file per conversation
- Memory shared across all agents in room
- Resume conversations after restart
- AgentPipe already has this (saves to ~/.agentpipe/chats/)

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ENHANCED AGENTPIPE ORCHESTRATOR                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────── MIDDLEWARE CHAIN ────────────────────┐   │
│  │                                                              │   │
│  │  ┌──────────┐  ┌───────────┐  ┌────────┐  ┌─────────────┐   │   │
│  │  │ Condenser│→ │   Stuck   │→ │ Critic │→ │   Logger    │   │   │
│  │  │ Pipeline │  │ Detector  │  │ Eval   │  │  (existing) │   │   │
│  │  └──────────┘  └───────────┘  └────────┘  └─────────────┘   │   │
│  │      ↑              ↑              ↑                        │   │
│  │   OpenHands      OpenHands     OpenHands                    │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────── MCP TOOL LAYER (OpenHands) ────────────────┐  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │  │
│  │  │  MCP Search  │  │  MCP Files   │  │  MCP Git     │        │  │
│  │  │  (Tavily)    │  │  (Filesystem)│  │  (GitHub)    │        │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────── AGENT ADAPTERS ─────────────────────────┐   │
│  │                                                              │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │   │
│  │  │ Claude  │  │ Codex   │  │ Cursor  │  │ Gemini  │        │   │
│  │  │Adapter+│  │Adapter+│  │Adapter+│  │Adapter+│        │   │
│  │  │ +Critic │  │ +Critic │  │ +Critic │  │ +Critic │        │   │
│  │  │+Condense│  │+Condense│  │+Condense│  │+Condense│        │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │   │
│  │       │            │            │            │              │   │
│  │  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐        │   │
│  │  │ claude  │  │ codex   │  │ cursor  │  │ gemini  │        │   │
│  │  │  CLI    │  │  CLI    │  │  CLI    │  │  CLI    │        │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Condenser Integration (High Impact)

**Why first:** Multi-agent conversations hit context limits 3-4x faster

**Steps:**
1. Port OpenHands condenser interface to Go
2. Implement `RecentEventsCondenser` (simplest)
3. Add `CondenserMiddleware` before `buildPrompt()` in adapters
4. Test with 3-agent conversations

**Go Interface:**
```go
type Condenser interface {
    Condense(messages []agent.Message, maxTokens int) []agent.Message
}

type CondenserPipeline struct {
    condensers []Condenser
}

func (p *CondenserPipeline) Condense(messages []agent.Message, maxTokens int) []agent.Message {
    result := messages
    for _, c := range p.condensers {
        result = c.Condense(result, maxTokens)
    }
    return result
}
```

### Phase 2: StuckDetector Integration (Critical)

**Why second:** Loop detection prevents runaway costs and wasted time

**Steps:**
1. Port StuckDetector logic to Go
2. Add to orchestrator loop after each agent turn
3. On stuck detection:
   - Switch to different agent
   - If all stuck → pause and ask user
4. Log stuck events for analysis

**Go Interface:**
```go
type StuckDetector struct {
    RecentActions []Message
    RepeatThreshold int
}

func (s *StuckDetector) IsStuck() *StuckAnalysis {
    // Check for repeated actions/outputs
    // Return analysis if stuck
}

type StuckAnalysis struct {
    LoopType string
    RepeatCount int
    StartIndex int
}
```

### Phase 3: Critic Integration (Quality)

**Why third:** Self-evaluation improves output quality

**Steps:**
1. Implement `BaseCritic` interface in Go
2. Create `FinishCritic` and `CodeCritic`
3. Add `CriticMiddleware` after agent response
4. Use scores for:
   - Accept/reject responses
   - Select "best" response when multiple agents answer

**Go Interface:**
```go
type Critic interface {
    Evaluate(messages []agent.Message, context CriticContext) CriticResult
}

type CriticResult struct {
    Score float64
    Message string
    Suggestions []string
}

// Multi-agent: agents can critique each other
type CrossAgentCritic struct {
    CriticAgentID string
}
```

### Phase 4: MCP Tool Sharing

**Why fourth:** Expensive tools like search should be shared

**Steps:**
1. Add MCP client config to AgentPipe
2. Configure tool servers at orchestrator level (not per-agent)
3. Route tool calls through central dispatcher
4. Track tool usage per agent for cost attribution

---

## Multi-Agent Specific Enhancements

### Cross-Agent Critique

**Pattern:** Have agents critique each other's work
```
Agent A (Claude): Proposes solution
Agent B (Gemini): Reviews and critiques
Agent A (Claude): Revises based on critique
```

### Stuck Handoff

**Pattern:** When one agent is stuck, hand off to another
```
Agent A stuck after 3 attempts
→ Pass context + stuck analysis to Agent B
→ Agent B tries different approach
→ If B also stuck → user intervention
```

### Context Condensation Per Agent

**Pattern:** Each agent gets condensed context tailored to their role
```
Agent A (Architect): Gets high-level context
Agent B (Implementer): Gets detailed recent context
Agent C (Reviewer): Gets summary + recent changes only
```

---

## Expected Benefits

| Capability | Benefit | Impact |
|------------|---------|--------|
| Condensers | 3-4x longer conversations | High |
| StuckDetector | Prevent runaway loops | Critical |
| Critics | Better output quality | Medium |
| MCP Tools | Shared expensive capabilities | Medium |
| Cross-Agent Critique | Error reduction | High |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Latency from middleware | Make condensers/critics async or cached |
| Go ↔ Python interop for OpenHands | Port key algorithms to Go, or use subprocess |
| Over-engineering | Start with Phase 1-2, validate before adding more |
| OpenHands V0→V1 migration | Use patterns/concepts, not direct code ports |

---

## Conclusion

OpenHands provides battle-tested meta-cognitive components that can supercharge AgentPipe's multi-agent CLI system:

1. **Condensers** solve the context explosion problem in multi-agent
2. **StuckDetector** prevents expensive infinite loops
3. **Critics** enable self-evaluation and cross-agent review
4. **MCP integration** enables shared tool access

The semantic recombination creates something neither project has alone: **a multi-agent conversation system with industrial-grade context management and self-correction capabilities**.

---

## Next Steps

1. [ ] Fork/clone both repos locally
2. [ ] Prototype Phase 1 condenser in AgentPipe
3. [ ] Benchmark context savings in 3-agent conversation
4. [ ] Implement stuck detection (Phase 2)
5. [ ] Test full integration with real coding task
