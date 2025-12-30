# Documentation Standards (Chrysalis)

## Goals
- Accurate to code as shipped (no aspirational claims without labels).
- Complete on core surfaces (architecture, memory, sync, security, observability).
- Clear and navigable with diagrams and links.
- Maintainable via triggers and ownership.

## Structure
- `docs/current/` — canonical specs and guides (kept in sync with code).
- `docs/research/` — background papers/derivations; mark as non-normative.
- `docs/archive/` — historical; prefix titles with `[ARCHIVE]`.
- Directory READMEs describe purpose/content.

## Required Sections (major docs)
1) Header: title, version, date, status.  
2) Purpose and scope (what/why).  
3) Navigation links to related docs.  
4) Main content with diagrams where applicable.  
5) Implementation reality (what exists vs planned), with status icons.  
6) References/citations (papers, links, code files).  
7) Last updated + owners.

## Diagrams
- Use Mermaid; include for interaction patterns, data flows, object models, and sync/memory pipelines.
- Keep diagrams updated when code changes; note the source file(s) they reflect.

## Status & Accuracy
- Use ✅ implemented, 🔄 in progress, 📋 planned, 🗄️ archive, ⚠️ deprecated.
- Specs must reflect current code; if future work is described, label clearly and link to issues/roadmap.

## Update Triggers
- Code changes to APIs, data models, config, security, performance, or observability → update corresponding docs in `docs/current/`.
- New features → add to README navigation and STATUS.md with verification notes.
- Breaking changes → update quick start and architecture docs.

## Formatting
- Markdown, ASCII only unless essential.  
- Footnotes or inline links for citations; include URLs or paper references.  
- Tables for options/config; bullets for steps.

## Review & Ownership
- PRs touching core modules should update or confirm relevant docs.  
- Maintain a single source of truth: conflicting docs must be reconciled or archived.  
- Quarterly sweep: verify specs vs code, update STATUS and DOC index.

## Security & Privacy
- Document sanitization, trust tiers, and transport requirements.  
- Avoid embedding secrets; redact sensitive examples.  
- Note optional telemetry/metrics and default-off behaviors.
