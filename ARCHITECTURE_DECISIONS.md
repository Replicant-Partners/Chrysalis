# Chrysalis Architecture Decisions

This document records the canonical architectural choices made during the project cleanup (January 2026).

## Summary of Decisions

| Component | Canonical Choice | Deprecated/Alternative |
|-----------|------------------|------------------------|
| **UI Entrypoint** | 3-pane `ChrysalisWorkspace` with embedded canvas | Standalone `canvas-app/` |
| **Memory API** | `memory_system/api_server.py` (Rust-backed) | `memory_system/http_api.py` (bead-only) |
| **Universal Adapter** | Python `src/universal_adapter/` | TypeScript `src/adapters/universal/` |
| **LLM Provider** | Ollama (local) with OpenRouter fallback | Direct Anthropic/OpenAI APIs |

---

## 1. UI Architecture: Hybrid 3-Pane Workspace

**Decision**: The 3-pane `ChrysalisWorkspace` is the canonical web UI entrypoint, with the ReactFlow-based canvas app embedded in the center pane.

**Layout**:
```
┌─────────────┬─────────────────────┬─────────────┐
│  Left Chat  │   Canvas App        │ Right Chat  │
│  (Primary   │   (ReactFlow)       │ (Secondary  │
│   Agent)    │                     │  Agent)     │
└─────────────┴─────────────────────┴─────────────┘
```

**Files**:
- Entry point: `src/main.tsx`
- Workspace: `src/components/ChrysalisWorkspace/ChrysalisWorkspace.tsx`
- Embedded canvas: `src/canvas-app/CanvasApp.tsx` (with `embedded` prop)
- HTML: `index.html` → `/src/main.tsx`

**Rationale**: Provides a unified interface combining agent chat with visual canvas workspace, supporting the "commons" collaboration model.

---

## 2. Memory API: Rust-Backed Server

**Decision**: `memory_system/api_server.py` is the canonical memory API.

**Endpoints**:
- `/memory/*` - Primary routes
- `/memories/*` - Compatibility aliases for TypeScript clients
- `/beads/*` - Legacy compatibility

**Deprecated**: `memory_system/http_api.py` (marked with deprecation notice)

**Migration Path**:
```
Old: /beads/* (http_api.py)
New: /memory/* or /memories/* (api_server.py)
```

**Rationale**: The Rust-backed memory store provides better performance and richer features (semantic search, tiered memory) compared to the bead-only implementation.

---

## 3. Universal Adapter: Python Task Orchestration

**Decision**: The Python `src/universal_adapter/` is the canonical universal adapter.

### Comparison

| Feature | Python Adapter | TypeScript Adapter |
|---------|---------------|-------------------|
| **Purpose** | Task orchestration via Mermaid flows | Protocol translation between agent frameworks |
| **Core Abstraction** | State machine executor | LLM-delegated translator |
| **Input** | `task.json` with flow diagrams | Agent data + protocol specs |
| **Output** | Task execution result | Translated agent representation |
| **CLI** | Yes (`python -m universal_adapter`) | No |
| **API** | Yes (async/sync) | Factory function only |
| **Security** | Context-based permissions | None |

### Potential Integration

The TypeScript adapter's **protocol registry** (MCP, A2A, LangChain, CrewAI, etc.) could be ported to Python as a complementary module for agent interoperability:

```python
# Future: src/universal_adapter/protocols.py
PROTOCOL_REGISTRY = {
    'mcp': ProtocolSpec(name='Model Context Protocol', spec_url='...'),
    'a2a': ProtocolSpec(name='Agent-to-Agent Protocol', spec_url='...'),
    # ...
}
```

**Rationale**: The Python adapter is more mature with CLI, API, security contexts, and task library support. Protocol translation can be added as an extension.

---

## 4. LLM Provider: Ollama Default with Fallback

**Decision**: Ollama (local) is the default LLM provider for system agents, with configurable fallback to OpenRouter.

**Configuration**: `src/config/llm-providers.ts`

**Priority Order**:
1. **Ollama** (local, default) - `ministral-3:3b` recommended
2. **OpenRouter** (cloud fallback) - `anthropic/claude-3-haiku`
3. **HuggingFace** (optional)
4. **Direct APIs** (deprecated) - Anthropic, OpenAI

**Environment Variables**:
```bash
OLLAMA_BASE_URL=http://localhost:11434  # Default
LLM_PRIMARY_PROVIDER=ollama             # Override primary
LLM_FALLBACK_PROVIDER=openrouter        # Override fallback
LLM_DISABLE_FALLBACK=true               # Disable auto-fallback
OPENROUTER_API_KEY=...                  # Enable OpenRouter
```

**Rationale**: Local LLMs reduce latency, cost, and external dependencies for system agents. Sub-3GB models (ministral-3:3b, llama3.2, etc.) provide adequate capability for most agent tasks.

---

## Files Modified in Cleanup

### New Files
- `src/main.tsx` - New 3-pane workspace entry point
- `src/canvas-app/CanvasApp.tsx` - Embeddable canvas component
- `src/config/llm-providers.ts` - Unified LLM provider config
- `src/components/shared/tokens.ts` - UI design tokens
- `src/components/shared/index.ts` - Barrel export
- `src/components/AgentCanvas/index.ts` - Barrel export

### Modified Files
- `index.html` - Points to new entry point
- `src/components/ChrysalisWorkspace/ChrysalisWorkspace.tsx` - Added `centerContent` prop
- `src/components/ChrysalisWorkspace/types.ts` - Added `TrustLevel`, `centerContent`
- `src/terminal/protocols/index.ts` - Aligned types with actual usage
- `memory_system/api_server.py` - Added `/memories/*` compatibility routes
- `memory_system/http_api.py` - Added deprecation notice

---

## Next Steps

1. **Install dependencies**: `npm ci` to resolve TypeScript lint errors
2. **Verify build**: `npm run build` to confirm 3-pane UI compiles
3. **Audit dspy/semantic integration**: Identify gaps in learning harness integration
4. **Port protocol registry**: Consider adding protocol translation to Python adapter
5. **Remove dead code**: After validation, remove truly unused subsystems
