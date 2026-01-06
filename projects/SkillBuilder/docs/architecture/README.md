# SkillBuilder Architecture Specifications

This directory contains the formal specifications for the SkillBuilder system, documenting the current component designs, API contracts, and data models.

## 🏗️ Contents

- [Architecture Overview](overview.md): System philosophy, multi-language flow (Go search + RRF hybrid, Clojure synthesis, Python orchestration), and system diagram.
- [CLI Flow](cli-flow.md): End-to-end CLI decision flow, flags (hybrid search, batch-merge, cluster-model), and failure branches.
- [Data Models & Contracts](data-models.md): Immutable value objects, Schema.org alignment, and output artifact schemas.
- [Security & Safety](security.md): Defense-in-depth model, source-level sanitization, and secrets redaction.
- [Observability](observability.md): Telemetry lifecycle, emitted fields, and JSONL paths.
- [Semantic Merge](semantic-merge.md): RDF-style atomization, clustering, and batch-merge alignment.

Diagrams live inline in each page (Mermaid) to keep the specs close to the flows they describe.
