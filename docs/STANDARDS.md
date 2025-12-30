# Documentation Standards

## Status Tags
- ✅ current
- 🔄 in-progress
- 📋 planned
- 🗄️ archived
- ⚠️ deprecated

## When to Update Docs
- Behavior/API/data model changes
- Deployment model changes (Go/MCP/embedded routing)
- Security/performance changes
- New features (OODA, emoji mode, Go gRPC services)

## Formatting
- Include title, version/date/status, purpose
- Mermaid for flows/data/component diagrams when clarifying
- Footnotes/links for major design decisions and dependencies
- Navigation links to related docs

## Structure
- README: overview, quick start, architecture link, index link
- ARCHITECTURE: scales, resolver, deployment models, sync, security
- STATUS: implementation checks, pending, metrics
- Directory README: purpose, contents, pointers to specs
- Index: current vs research vs archive

## Accuracy Discipline
- Reconcile against code before publishing
- Mark aspirational items as planned, not current
- Archive superseded docs, don’t delete useful history
