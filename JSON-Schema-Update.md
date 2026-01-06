# Proposal: uSA Schema Update (GaryVision-Pruned Profile) for Chrysalis

Date: 2026-01-06  
Status: Proposal (from GaryVision integration work)  

## Executive Summary

We implemented a **pruned persona-first schema** for GaryVision agents and a deterministic lift into **Chrysalis uSA v2**. This work suggests a practical path for Chrysalis to formalize a lighter-weight, authorable “uSA Profile” that:

- reduces schema weight for hand-authored agents,
- removes deprecated constructs (notably belief buckets used for calibration),
- treats communication style as a subset of personality,
- collapses skills/knowledge/concepts into semantic memory,
- preserves project-specific semantics in a formal extension block,
- remains compatible with existing Chrysalis uSA by using a two-layer model:
  - **Profile** (identity + persona + memory + capabilities)
  - **Deployment envelope** (instances/sync/execution/protocols/crypto)

## What changed (conceptual)

### 1) Beliefs deprecated (removed from the authorable profile)

Chrysalis uSA v2 includes:
- `beliefs: { who, what, why, how, ... }` with conviction + privacy and revision history.

GaryVision has deprecated beliefs as a calibration mechanism in favor of an empirical “ground truth as a service” stance (resolution based on observed evidence rather than belief conviction). As a result:

- The **authorable schema** does **not** include belief buckets.
- When lifting to uSA v2 (which currently requires `beliefs`), we emit a minimal empty structure and record the policy in metadata:
  - `metadata.x_garyvision.beliefs_deprecated = true`

### 2) Communication collapsed into personality

We treat “communication style” as a personality trait. In the authorable profile:

- `personality.style` contains `tone`, `principles[]`, and optional `modes{}`.

When lifting to uSA v2:

- `communication.style.all` is populated from `personality.style.principles`.
- Optional mode lists map to `communication.style.<mode>`.

### 3) Skills + knowledge + concepts collapsed into semantic memory

Instead of separate `capabilities.learned_skills`, `knowledge.*`, and `memory.semantic` concepts:

- The authorable profile uses `semantic_memory.items[]` where each item is typed:
  - `knowledge|skill|concept|procedure|policy|note`

When lifting to uSA v2:

- we generate `knowledge.facts/topics/expertise/lore` as a best-effort partition of `semantic_memory.items[].content`.
- the canonical source remains `semantic_memory.items[]` (profile-level), not the derived partitions.

### 4) Rights normalized as capabilities (profile-level)

GaryVision historically uses “rights” for enforcement. The profile schema avoids “rights” terminology and uses:

- `capabilities.primary[]` (+ optional `capabilities.tools[]`)

At runtime, enforcement remains possible via system policy, but the portable spec language is capabilities-first.

### 5) Protocols treated as capabilities/tools

Protocol toggles can be interpreted as:
- capabilities (what the agent can do),
- tools (how it does it),
- or a deployment concern.

In the **profile**, we represent protocol enablement as a tool/capability hint if needed.
In the **uSA envelope**, we keep the existing `protocols` block for compatibility, but treat it as operational configuration.

### 6) Everything else becomes metadata / deployment envelope

The profile contains:
- identity/personality/capabilities/memory

The envelope contains:
- cryptographic identity details,
- instances,
- experience sync,
- execution,
- protocols,
- deployment config,
- evolution metadata.

## The schema we are using for GaryVision agents (“updated uSA”)

We are using a **two-layer standard**:

1) **Chrysalis Persona (Pruned) v0.1** — authorable profile format  
2) **Chrysalis uSA v2 (UniformSemanticAgentV2.ts)** — operational envelope output (generated deterministically from the profile)

### A) Chrysalis Persona (Pruned) v0.1 (authorable)

Location (canonical schema in GaryVision workspace):
- `GaryVision/Agents-Temp-Scratch/Chrysalis-Persona/schema.pruned.v0.1.json`

Key fields:

- `schema: { name:"chrysalis.persona", version:"0.1" }`
- `id`, `name`, `designation`, `bio`
- `personality: { traits[], values[], quirks[], style{ tone, principles[], modes? } }`
- `capabilities: { primary[], tools? }`
- `semantic_memory: { items[] }` (skills/knowledge/concepts/procedures/policies all here)
- `episodic_memory: { index[] }` (summaries + pointers)
- `metadata: { ... }` (project-specific)

This profile is intentionally small and stable for humans to edit and for systems to version-control.

### B) Chrysalis uSA v2 “Pruned-Profile Conventions” (generated)

We emit valid uSA v2 JSON with these conventions:

1) **Beliefs are present but empty/minimal**
```json
{
  "beliefs": { "who": [], "what": [], "why": [], "how": [] }
}
```

2) **Profile semantics preserved in `metadata.x_garyvision`**
```json
{
  "metadata": {
    "x_garyvision": {
      "source_persona_schema": { "name": "chrysalis.persona", "version": "0.1" },
      "source_persona_id": "milton",
      "ui": { "lane": "ops" },
      "beliefs_deprecated": true,
      "persona_metadata": { "...": "..." }
    }
  }
}
```

3) **Communication derived from personality style**
- `communication.style.all = personality.style.principles`

4) **Knowledge derived from semantic memory**
- `knowledge.facts/topics/expertise/lore` are derived; the original semantic items remain the authoritative source upstream.

5) **Protocols only enabled when explicitly signaled**
- e.g. if profile indicates MCP tool capability, we set `protocols.mcp.enabled=true` (otherwise default false).

## Why Chrysalis should formally adopt this

### Five Whys (root cause)

1. Why is uSA adoption slow in downstream projects?  
   Because authoring full uSA is heavy and mixes persona, deployment, and evolution concerns.
2. Why is mixing these concerns a problem?  
   Because most projects need a stable persona profile but have very different runtime envelopes.
3. Why can’t projects just ignore unused fields?  
   They can, but the “surface area” still increases cognitive load, validation burden, and drift risk.
4. Why does that matter systemically?  
   It discourages a shared portability spine—the core Chrysalis value proposition.
5. What’s the root cause?  
   Lack of an officially supported, minimal **profile** standard that can be deterministically lifted into the full operational uSA.

### Evolution over time (patterns view)

Projects evolve from:
- “single agent persona in a UI” → “multi-instance agent with sync/memory/fabric”

A profile/envelope split supports this evolution without rewriting the persona definition, and avoids schema churn in early phases.

## Proposed formalization in Chrysalis

### Proposal 1: Introduce “uSA Profile” as a first-class schema

Add to Chrysalis:
- `schemas/usa_profile.v0.1.json` (very close to the pruned persona schema)
- Documentation: “Profile vs Envelope”
- Converter: `usa_profile -> UniformSemanticAgentV2` (deterministic scaffold)

### Proposal 2: Deprecate beliefs as calibration

Keep `beliefs` in uSA for backward compatibility, but clarify in spec:
- belief buckets are optional and should not be used as the primary calibration substrate;
- prefer empirical sources + ground truth resolution mechanisms.

### Proposal 3: Standardize extension blocks

Adopt a convention:
- `metadata.x_<project>` blocks for reversible projection without polluting core schema.

This already exists implicitly in multiple places; formalizing it improves interoperability.

## Compatibility and migration

- Existing uSA v2 documents remain valid.
- New documents can be authored as profile-only and lifted into uSA v2 for execution.
- Tools/adapters can consume either:
  - `usa_profile` directly (for UI persona),
  - full uSA for runtime orchestration.

## Appendix: Current implementation references (GaryVision)

Generated uSA agents:
- `GaryVision/config/usa_agents/25er.usa.json`
- `GaryVision/config/usa_agents/105er.usa.json`
- `GaryVision/config/usa_agents/milton.usa.json`

Profile schema + seeds:
- `GaryVision/Agents-Temp-Scratch/Chrysalis-Persona/schema.pruned.v0.1.json`
- `GaryVision/Agents-Temp-Scratch/Chrysalis-Persona/*.persona.json`

Deterministic generators:
- `GaryVision/Agents-Temp-Scratch/tools/convert_to_chrysalis_persona.py`
- `GaryVision/Agents-Temp-Scratch/tools/convert_persona_to_usa_v2.py`

