# Scavenger Review Process (Chrysalis)

Purpose: systematically review cross-repo ideas from `reports/scavenger_report.md`, extract lessons, and translate them into actionable design/code changes for Chrysalis without blindly copying code.

## Scope & Sources
- Repos: SkyPony, SkyPrompt, SkyManager, SemanticLadder, KiloCodeSky, Skyhook, PonyWaveTerm, SkyWaveTerm, code-mode-mcp, contextstream-mcp, design_patterns_mcp (adjust list as needed).
- Focus themes: MCP patterns, distributed sync/gossip, CRDTs, embeddings/vector indexes, observability, approval/rollback safety, terminal/CLI UX.

## Per-Item Workflow
1) **Select target**: pick one repo/pattern from the inventory; record why it matters to Chrysalis (component + hypothesis).
2) **License check**: note license and any constraints (code reuse vs concept-only).
3) **Locate artifacts**:
   - Follow paths/keywords from `scavenger_report.md`.
   - Add any new hits (keep snippet path+line for traceability).
4) **Digest & questions**:
   - Summarize the pattern (what problem it solves, how it works, trade-offs).
   - Capture open questions and assumptions relative to Chrysalis (compatibility with MCP fabric, memory, sync, observability).
5) **Compare to Chrysalis**:
   - Map to existing code: e.g., PatternResolver, memory merging, ingest sanitizer, observability SSE, sync adapters, MCP adapters.
   - Identify conflicts/gaps (e.g., threading model, approval flow, rate limits, embedding pipelines).
6) **Decide action**:
   - Options: adopt pattern (conceptual), prototype (short spike), backlog (someday), or reject (with reason).
   - If code reuse allowed, outline minimal, license-compliant adaptation.
7) **Create deltas**:
   - File findings in `reports/scavenger_findings.md` (see template below).
   - If action needed now: open a TODO/backlog entry (e.g., in `STATUS.md` or a tracked issue) and link to finding.

## Findings Template (append per item)
```
## <Repo/Pattern Name>
- Why it matters: <1-2 lines>
- Artifacts: <paths/lines>
- Summary: <how it works, constraints>
- Fit to Chrysalis: <interfaces it touches; risks>
- Decision: adopt | prototype | backlog | reject (why)
- Next actions: <specific tasks, owners if known>
```

## Review Order (suggested)
1) SkyPony: approval/rollback, async command flow, resource limits → map to sync adapters + ingest guard/rate limits.
2) SkyPrompt: embedding export/presets, windowed context → compare to Chrysalis embedding + memory ingestion.
3) SkyManager: MCP registry/pooling → evaluate for fabric adapters and MCP client connection roadmap.
4) SemanticLadder: Qdrant/embedding defaults/tests → benchmark against current VectorIndex factory.
5) KiloCodeSky: guardrails/rollback → apply to sync/merge safety and experience sync error handling.
6) PonyWaveTerm/SkyWaveTerm: SSE/UI event handling → inform observability dashboard beyond Voyeur SSE.
7) code-mode-mcp/contextstream-mcp/design_patterns_mcp: MCP tool patterns → align with MCP layer and tool taxonomy.
8) Skyhook: CLI/terminal safety → apply to Chrysalis CLI/tooling UX.

## Execution Notes
- Keep review offline and deterministic (no remote LLM calls).
- Respect licenses; prefer conceptual adoption unless license is permissive and compatible.
- Limit time per item; capture partial notes rather than blocking on deep dives.
- After each item, update `reports/scavenger_findings.md` and add any backlog tasks to `STATUS.md` or tracking system.
