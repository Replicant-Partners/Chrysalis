# Agent Specification Evolution – Reflection

## What we did
- Built a compound prompt that routes to multiple agent models (LangChain/LangGraph, VS Code agents, OpenAI Agents, CrewAI, ElizaOS, generic multi-agent) and now Uniform Semantic Agent (uSA).
- Added interrogatories to gather seeds (identity, goals, constraints, tools/MCP, memory, deployment/logging) with per-model nuances (CrewAI roles/handoffs, Eliza persona bounds, uSA MCP/memory architecture).
- Strengthened safety (anti-prompt-injection, block destructive commands, workspace boundaries).

## uSA alignment
- Treat uSA as the portable canonical: metadata, identity, capabilities (tools/reasoning), memory (working/episodic/semantic/procedural/core), protocols (MCP), policies, and YAML/JSON deliverable.
- Pull defaults from the structured memory examples (e.g., working/episodic/semantic/procedural/core, embeddings, vector store, operations).

## Observations on agent evolution
- Convergence on a few primitives: tool calling, retrieval/memory, policy/guardrails, logging/telemetry, and resumable state.
- Specifications are drifting toward portability (uSA-style) so agents can be projected onto many runtimes without losing identity or safety posture.
- Memory is becoming multi-layered (working + episodic + semantic + procedural + core), with policies for retention/forgetting/recap baked into the spec rather than bolted on later.
- Safety is moving from “best effort” text to enforceable allowlists/denylists and per-tool validation; expect tighter sandboxing and signed tool manifests.
- Evaluation is shifting from ad-hoc to built-in datasets/telemetry (LangSmith-style) with RAG faithfulness and regression baselines.
- Multi-agent systems trend toward clearer task graphs and ownership boundaries; handoffs and contracts matter as much as prompts.

## What to be ready for
- Adapter libraries that ingest a canonical spec (uSA) and emit configs for each runtime automatically.
- Stronger provenance/attestation for tools and data (signed MCP servers, verified datasets).
- Better long-horizon state: checkpointers and causal logs that survive agent restarts, plus incremental memory compaction.
- Integrated eval loops: every blueprint shipping with default tests/datasets and hooks for continuous regression.
- More opinionated safety: LLM-level red teaming plus runtime-level enforcement (rate limits, IO allowlists, secret redaction by default).

## Next steps (if we invest further)
- Implement a uSA→(CrewAI|Cline|OpenAI) adapter scaffold.
- Add default eval datasets/templates per blueprint type.
- Ship a minimal “safe tool manifest” schema reusable across runtimes (MCP-first).
