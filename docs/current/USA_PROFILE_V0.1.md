# uSA Profile v0.1 (Authorable) — Profile/Envelope Split

This document formalizes the **authorable** “profile” layer referenced by `JSON-Schema-Update.md`.

## Purpose

Provide a small, stable, human-editable agent definition that can be deterministically lifted into the operational uSA envelope (`UniformSemanticAgentV2`) used by Chrysalis runtime services.

## Scope (Profile)

Profile contains only:
- identity (stable identifier, name/designation)
- persona (personality traits + style)
- capabilities (primary + tools)
- episodic memory index (summaries + pointers)
- semantic memory items (canonical durable substrate)
- metadata extensions (`metadata.x_<project>`)

Profile explicitly excludes:
- instance deployment metadata
- sync configuration
- protocol/network wiring
- crypto/network identity plumbing
- belief buckets as a truth calibration mechanism

## Beliefs (Deprecated)

Beliefs are deprecated as a calibration mechanism.

If an operational envelope requires a `beliefs` field for compatibility, lift implementations SHOULD:
- emit an empty/minimal `beliefs` structure, and
- record the policy in metadata (e.g., `metadata.x_<project>.beliefs_deprecated = true`).

Calibration and reconciliation are anchored in empirical grounding services and verifiable commitments (e.g., KnowledgeBuilder evidence + Hedera/ledger semantics).

## Semantic Memory Items (Canonical)

`semantic_memory.items[]` is the canonical substrate and may include:
- skills
- knowledge
- procedures/workflows/tasks
- policies
- notes

Any “knowledge partitions” in the envelope are derived views.

## Deterministic Lift

A deterministic lift `usa_profile.v0.1 → UniformSemanticAgentV2` must:
- preserve profile semantics via `metadata.x_<project>`
- derive communication from personality style when needed
- populate envelope-only blocks (instances/sync/protocols) from deployment config, not from profile
