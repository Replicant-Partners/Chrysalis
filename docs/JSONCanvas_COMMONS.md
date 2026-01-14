# ARCHIVED: JSONCanvas Commons Contract

**Status**: ARCHIVED (2026-01-14)  
**Superseded by**: React Flow implementation (see `docs/technology-assessments/react-flow-integration-guide.md`)

---

## Historical Context

This document described the JSONCanvas rendering contract that was planned but never implemented. The Chrysalis project has adopted React Flow as the production canvas solution.

## Original Contract (Historical Reference)

- JSONCanvas was planned as a shared rendering surface inside Chrysalis Terminal.
- The terminal was to persist JSON canvas documents; each document as a list of items with coordinates and metadata.
- JSONCanvas was to be responsible only for visualizing a provided document; it would not produce or mutate data.

### Original Rules (No Longer Applicable)

- JSONCanvas was to accept:
  - A JSON document describing items to render
  - Event handlers for user interactions

- JSONCanvas was forbidden to:
  - Own business logic
  - Directly mutate terminal state
  - Make network calls

### Migration Path

The terminal now provides YJS-synced state to React Flow Canvas for rendering.

**See**: 
- [React Flow Integration Guide](technology-assessments/react-flow-integration-guide.md)
- [Canvas Assessment](technology-assessments/canvas-visual-programming-assessment.md)