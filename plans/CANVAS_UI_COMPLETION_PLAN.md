# Canvas UI Completion Plan

## Scope and alignment
- Codebase modules: `src/components/ChrysalisWorkspace/`, `src/components/AgentCanvas/`, `src/components/shared/` (design tokens).
- UX requirements: three-frame workspace with a center canvas surface (see `src/components/ChrysalisWorkspace/ChrysalisWorkspace.tsx`).
- Design references: `docs/canvas-architecture.md`, `docs/CANVAS_DEVELOPMENT_PROTOCOL.md`, `docs/STATUS.md`, `canvas-type-notes.md`.

## Canonical Canvas Types

The 6 canvas types to implement:

1. **Settings** - System management: file locations, terminal config, cloud resources, LLM connections
2. **Agent** - Managing internal agents: store, revise, maintain, run teams of agents working on projects  
3. **Scrapbook** - Collecting material when organization is still being discovered; gathering, linking, grouping, sense-making
4. **Research** - Gathering with known domain and sense-making frameworks; structured information synthesis
5. **Wiki** - MediaWiki backend knowledgebase for storing structured explicit knowledge (for humans and AI agents)
6. **Terminal-Browser** - Combined canvas for teams coding/working with terminal and browser; study group model

## Canvas Implementation Status

| Canvas Type | Components | Data Sources | Design References | Status |
| --- | --- | --- | --- | --- |
| Settings | none | `BackendConnector` storage hooks | `docs/canvas-architecture.md` | incomplete |
| Agent | `src/components/AgentCanvas/*` | `src/terminal/protocols/*` | `canvas-type-notes.md` | incomplete (exists but not aligned to architecture) |
| Scrapbook | none | none | `docs/canvas-architecture.md`, `canvas-type-notes.md` | incomplete |
| Research | none | none | `docs/canvas-architecture.md`, `canvas-type-notes.md` | incomplete |
| Wiki | none | none | `docs/canvas-architecture.md`, `canvas-type-notes.md` | incomplete |
| Terminal-Browser | none | `TerminalPTYServer` WS | `docs/canvas-architecture.md` | incomplete |

## Definition of "complete" for a canvas type

Minimum bar to mark a canvas type as complete:
1. Spec coverage: user flows, widget allowlist, data model, and API contracts documented and approved.
2. UI/UX parity: layout, interactions, and visual design match design system tokens and UX spec (three-frame layout, toolbars, tabs, states).
3. Accessibility: keyboard navigation, focus order, ARIA labels, contrast compliance, and reduced-motion support.
4. Data + integration: persistence (save/load), event logging, and backend connections validated (LLM gateway, PTY, storage).
5. Tests: unit tests for registry/policies, integration tests for each canvas data source, and UI tests for core flows.
6. Documentation: developer docs, user docs, and release notes updated; troubleshooting and known limitations listed.

## Missing requirements, acceptance criteria, and blockers (per canvas)

Status for each canvas below assumes the "complete" definition above.

### Settings Canvas
- **Missing requirements**: widget definitions for key editor, API envelope, feature flags, budget controls, audit log; secret masking UX; settings persistence flows.
- **Acceptance criteria**: create/edit settings widgets, secrets masked by default, no secret values in logs, persistence round-trip works.
- **Blockers**: settings API contracts and design layouts not found; need security review for secret handling.

### Agent Canvas
- **Missing requirements**: proper widget registry integration, agent card widgets, connection visualization, alignment with infinite scroll architecture.
- **Acceptance criteria**: add/move/resize agent cards, visualize connections, save/restore agent teams, integrate with memory stack and wiki.
- **Blockers**: need to align existing AgentCanvas with BaseCanvas architecture and widget registry system.

### Scrapbook Canvas
- **Missing requirements**: canvas component, widgets for collecting/linking/grouping material, note attachment, query/reflection tools.
- **Acceptance criteria**: drop/link content, create groups/associations, attach notes, query and reorganize collections, persist.
- **Blockers**: scrapbook data model and sense-making widget specs not defined.

### Research Canvas
- **Missing requirements**: canvas component, source widgets, synthesis widgets, citations model, structured gathering tools.
- **Acceptance criteria**: add sources, annotate/synthesize with known frameworks, persist research artifacts.
- **Blockers**: research data model and synthesis widget specs not found.

### Wiki Canvas
- **Missing requirements**: canvas component, MediaWiki backend integration, content node types, navigation model.
- **Acceptance criteria**: create pages, link nodes, persist to MediaWiki backend, serve as agent knowledgebase.
- **Blockers**: MediaWiki integration architecture and wiki content model not defined.

### Terminal-Browser Canvas
- **Missing requirements**: combined terminal/browser widget implementations, xterm.js integration, sandboxed iframe implementation.
- **Acceptance criteria**: terminal sessions + browser tabs render and work together, team collaboration features, persistence.
- **Blockers**: combined terminal-browser widget specs and integration architecture not defined.

## Dependency-aware task list (prioritized)

Priority is based on user impact and technical dependency ordering.

1. **Define BaseCanvas architecture and widget registry system**
   - Owner: Tech Lead
   - Estimate: 2-3 days
   - Dependency: none

2. **Integrate chosen canvas system into the three-frame workspace**
   - Owner: Frontend Lead
   - Estimate: 2-4 days
   - Dependency: Task 1

3. **Define and document canvas API contracts (settings, storage, terminal, browser)**
   - Owner: Backend Lead
   - Estimate: 3-5 days
   - Dependency: Task 1

4. **Implement shared canvas data source + persistence (save/load)**
   - Owner: Frontend Engineer
   - Estimate: 4-6 days
   - Dependency: Task 3

5. **Complete Settings canvas widgets with secret handling**
   - Owner: Frontend Engineer + Security reviewer
   - Estimate: 4-6 days
   - Dependency: Tasks 2-4

6. **Align and complete Agent canvas with widget registry**
   - Owner: Frontend Engineer
   - Estimate: 3-5 days
   - Dependency: Tasks 2-4

7. **Complete Terminal-Browser canvas integration**
   - Owner: Frontend Engineer + Backend Engineer
   - Estimate: 4-6 days
   - Dependency: Tasks 2-4

8. **Implement remaining canvases (Scrapbook, Research, Wiki)**
   - Owner: Frontend Team
   - Estimate: 2-3 weeks
   - Dependency: Tasks 2-4 plus per-canvas specs

9. **Add tests (unit + integration + UI) and a11y verification**
   - Owner: QA Lead
   - Estimate: 1-2 weeks
   - Dependency: Tasks 4-8

10. **Update documentation and release notes**
    - Owner: Tech Writer + Tech Lead
    - Estimate: 2-3 days
    - Dependency: Tasks 4-9

## Execution guidance (stepwise with deliverables)

1. **Inventory + map**
   - Deliverables: updated canvas inventory table, list of gaps and blockers.

2. **Requirements + blockers per canvas**
   - Deliverables: acceptance criteria per canvas, dependency list, risk register.

3. **Backlog tasks with estimates and owners**
   - Deliverables: backlog file updated, dependency graph.

4. **Implementation (incremental commits)**
   - Deliverables: new/updated canvas components, widgets, and integration wiring.

5. **Tests and manual verification**
   - Deliverables: test suite updates, manual QA checklist and results.

6. **Docs + completion report**
   - Deliverables: docs updates, release notes, final completion report with risks.

## Required inputs (to unblock implementation)

- Canonical UX spec for each canvas type and the three-frame workspace.
- Design files (Figma or equivalent) for canvas layouts and widgets.
- API contracts for settings, storage, browser, terminal, and widget packages.
- Widget specifications for each canvas type with allowlists.
- Ownership assignments and timelines for each canvas type.

## Expected outputs when complete

- Updated canvas components for all 6 canvas types with widget implementations.
- Integration into the three-frame workspace and data persistence.
- Automated tests (unit, integration, UI) and a11y verification results.
- Updated docs and release notes, plus a completion report and risk list.