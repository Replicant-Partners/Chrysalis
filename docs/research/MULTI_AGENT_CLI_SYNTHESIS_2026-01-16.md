# Multi-Agent CLI/Chat Interface Synthesis Report

**Date:** January 16, 2026
**Author:** Research Agent
**Status:** Final Synthesis

---

## Executive Summary

This report synthesizes research across **30+ active projects** in multi-agent chat interfaces, CLI-based AI interactions, and orchestration patterns. Two key projects emerged as prime candidates for semantic recombination:

| Project | Strengths | Gaps |
|---------|-----------|------|
| **OpenHands V1 SDK** | Meta-cognitive (condensers, stuck detection, critics), delegation | No CLI wrapping, single-model focus |
| **AgentPipe** | Multi-CLI wrapping, orchestration modes, middleware, streaming | No condensers, no stuck detection, no critics |

**Key Insight:** These projects are **complementary, not competing**. Combining OpenHands V1's meta-cognitive capabilities with AgentPipe's multi-CLI orchestration creates a "supercharged" multi-agent system.

---

## Part 1: Landscape Analysis

### Category A: Multi-Agent Orchestration (High Activity)

| Project | Stars | Language | Key Pattern | Activity |
|---------|-------|----------|-------------|----------|
| AgentPipe | 56 | Go | CLI wrapper orchestration | Very High |
| OpenHands V1 SDK | Internal/New | Python | Meta-cognitive agents | Very High |
| AutoGen | 37K+ | Python | Conversation patterns | High |
| CrewAI | 25K+ | Python | Role-based crews | High |
| LangGraph | 8K+ | Python | Graph-based workflows | High |

### Category B: CLI-Based AI Tools

| Project | Approach | Integration Model |
|---------|----------|-------------------|
| Claude CLI | Native | Stdin/stdout |
| Gemini CLI | Native | Stdin/stdout |
| Codex CLI | Native | `codex exec` subcommand |
| Cursor Agent | IDE | JSON streaming |
| Amp CLI | Native | Thread-based |
| Qoder CLI | Native | `--print` mode |

### Category C: Terminal UI Frameworks

| Framework | Language | Relevance |
|-----------|----------|-----------|
| xterm.js | TypeScript | Web terminal |
| Bubble Tea | Go | AgentPipe uses |
| Rich | Python | OpenHands uses |

---

## Part 2: OpenHands V1 SDK Deep Dive (Active Code)

### 2.1 Core Architecture

```
openhands-sdk/openhands/sdk/
├── agent/
│   ├── agent.py          # Agent abstraction
│   └── prompts/          # Model-specific prompts (Claude, Gemini, GPT-5!)
├── context/
│   ├── condenser/        # Context compression
│   │   ├── llm_summarizing_condenser.py
│   │   ├── pipeline_condenser.py
│   │   └── no_op_condenser.py
│   └── skills/           # Skill management with triggers
├── conversation/
│   ├── stuck_detector.py # Loop detection (V1!)
│   ├── event_store.py    # Event persistence
│   └── secret_registry.py
└── critic/
    └── impl/
        ├── agent_finished.py
        └── empty_patch.py
```

### 2.2 Key Capabilities

#### Condenser System (Context Compression)
```python
class LLMSummarizingCondenser:
    """Uses LLM to summarize long context"""

class PipelineCondenser:
