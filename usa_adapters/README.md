# uSA → Runtime Adapter Scaffold

Lightweight helpers to turn a Uniform Semantic Agent (uSA) into starter configs for common runtimes. These are **seeds**, not production emitters: they preserve identity/memory/tooling hints and produce minimal structures you can refine.

## Functions (Python)
- `usa_to_crewai(spec)` → CrewAI-style config seed (agent identity, tools, memory).
- `usa_to_openai_assistant(spec, model="gpt-4o-mini")` → OpenAI Assistant definition with function tools.
- `usa_to_cline_agent_plan(spec)` → Plan skeleton for Cline/Roo Code/KiloCode (tools, MCP servers, safety posture).
- `usa_to_langgraph_scaffold(spec)` → Node/state scaffold for LangGraph.
- `usa_to_elizaos_persona(spec)` → Persona + tools seed for ElizaOS.
- `usa_to_generic_summary(spec)` → Neutral summary for custom adapters.
- `eliza_persona_to_usa(persona)` → Lift an ElizaOS persona into a uSA scaffold.
- `crewai_agent_to_usa(agent)` → Lift a CrewAI agent dict into a uSA scaffold.

All functions accept either a uSA `AgentSpec` object (v1/v2) or a `dict` and return plain dictionaries for further adaptation.

## Usage
```python
from usa_implementation.loader import load_agent
from usa_adapters import usa_to_crewai, usa_to_openai_assistant

spec = load_agent("examples/memory_agent_structured.usa.yaml")

crewai_cfg = usa_to_crewai(spec)
assistant_cfg = usa_to_openai_assistant(spec, model="gpt-4o-mini")
```

## Notes & Safety
- Destructive actions are not emitted; adapters only describe identity/tools/memory.
- Treat outputs as drafts: choose models, wire real tool schemas, add policies, and validate before use.
- MCP servers in uSA `protocols` are surfaced for VS Code agents; confirm trust/keys separately.

## Future Work
- Emit full runtime configs (CrewAI YAML, OpenAI function schemas, VS Code settings).
- Add tests/goldens for example uSA files.
- Support richer memory mapping (episodic/semantic/procedural/core) to runtime-specific stores.
