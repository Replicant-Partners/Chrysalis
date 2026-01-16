# Chrysalis Documentation Inventory

**Date**: January 16, 2026
**Purpose**: Comprehensive inventory for documentation review and cleanup

---

## Inventory Summary

| Category | Count | Status |
|----------|-------|--------|
| Root-level MD files | 14 | Needs review |
| docs/ active | ~60 | Mixed quality |
| docs/archive/ | ~40 | Properly archived |
| plans/ | 22 | Some need archiving |
| Borrowed_Ideas/ | 7 | Integration research |
| Project-specific | ~50 | Scattered |

---

## Classification

### ✅ KEEP - Active & Current

| Document | Location | Purpose | Last Updated |
|----------|----------|---------|--------------|
| README.md | Root | Project overview | 2026-01-15 |
| ARCHITECTURE.md | Root | System design | 2026-01-15 |
| CONTRIBUTING.md | Root | Contribution guidelines | Current |
| docs/STATUS.md | docs/ | Implementation status | 2026-01-15 |
| docs/INDEX.md | docs/ | Navigation hub | 2026-01-15 |
| docs/CONFIGURATION.md | docs/ | Environment vars | Current |
| memory_system/README.md | memory_system/ | Python package | Current |
| go-services/README.md | go-services/ | Go services | Current |

### 🔄 REVIEW - May Need Updates

| Document | Issue | Action |
|----------|-------|--------|
| MCP_DECISION_GUIDE.md | Root level, should be in docs/guides/ | Move |
| MCP_SERVER_GUIDE.md | Root level, should be in docs/guides/ | Move |
| CODE_REVIEW_CHECKLIST.md | Root level, should be in docs/quality/ | Move |
| AGENT.md | Content unclear | Review content, archive or move |
| docs/canvas-architecture.md | New canvas system built, may conflict | Reconcile |
| docs/guides/* | Contains both new canvas guides and old guides | Organize |

### 📁 ARCHIVE - Session/Historical

| Document | Reason |
|----------|--------|
| CODE_REVIEW_REPORT_2026-01-14.md | Historical report |
| DEPLOYMENT_SUCCESS.md | Historical milestone |
| README_INVESTMENT_AGENTS.md | Separate project |
| SHARE_WITH_TEAM.md | Communication artifact |
| DEBATE_SYSTEM_OVERVIEW.md | Historical research |
| DEBATE_SYSTEM_OVERVIEW_EN.md | Translation of above |
| WARP.md | Historical/unclear |
| plans/SESSION_SUMMARY_2026-01-15.md | Session log |
| plans/FINAL_SESSION_SUMMARY_2026-01-15.md | Session log |
| plans/IMPLEMENTATION_PROGRESS_2026-01-15.md | Session progress |
| plans/DOCUMENTATION_REVIEW_PLAN_2026-01-15.md | Completed plan |
| plans/USER_TESTING_READINESS_PLAN_2026-01-15.md | Completed plan |
| plans/Superficial-Pattern-Report.md | Superseded by comprehensive |
| docs/CANVAS_SESSION_SUMMARY_2026-01-15.md | Session log |
| docs/DOCUMENTATION_REVIEW_REPORT_2026-01-15.md | Session report |

### 🔗 INTEGRATE - Borrowed Ideas

| Document | Target | Action |
|----------|--------|--------|
| Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md | docs/architecture/ | Extract relevant parts, archive rest |
| Borrowed_Ideas/AGENT_JOBS_AND_CONVERSATIONS.md | docs/architecture/ | Extract relevant parts, archive rest |
| Borrowed_Ideas/JOBS_EVENTS_SCHEMA_PROPOSAL.md | docs/specs/ | Move as spec |
| Borrowed_Ideas/Shared-Conversational-Middleware-Research.md | docs/research/ | Move as research |
| Borrowed_Ideas/*.md | docs/archive/ | Archive after integration |

### ❓ UNCLEAR - Needs Content Review

| Document | Issue |
|----------|-------|
| docs/AGENTIC_ARCHITECTURE_ANALYSIS_2026.md | Duplicate of research? |
| docs/AGENTIC_MEMORY_DESIGN.md | Current or superseded? |
| docs/JSONCanvas_COMMONS.md | Old canvas system? |
| docs/micro-vm-canvas-specification.md | Implemented? |
| docs/FRONTEND_THREE_FRAME_FIVE_CANVAS_SPEC.md | Current UI design? |
| docs/builder-ecosystem-modernization-plan.md | Active plan? |

---

## Plans Folder Analysis

### Active Plans (Keep)

| Plan | Status | Notes |
|------|--------|-------|
| NEXT_STEPS_2026-01-15.md | Active | Engineering roadmap |
| adaptive-llm-layer-prompts-and-connectors.md | Active | LLM design |
| ERROR_CONSOLIDATION_PLAN.md | Active | Error handling |
| P2_CODE_QUALITY_REFACTORING_PLAN.md | Active | Refactoring |
| system-agents-layer-completion.md | Active | System agents |
| SYSTEM_AGENT_MIDDLEWARE_ARCHITECTURE.md | Active | Architecture spec |
| SYSTEM_AGENT_MIDDLEWARE_TASK_PLAN.md | Active | Task tracking |

### Research/Design (Keep as Reference)

| Plan | Status | Notes |
|------|--------|-------|
| agentic-frameworks-network-protocols-research.md | Research | Network protocols |
| ai-led-adaptive-maintenance-system-spec.md | Specification | AI maintenance |
| phase-1a-enhanced-type-system-spec.md | Specification | Type system |
| persona-layer-and-linkage.md | Design | Persona system |

### Archive Candidates

| Plan | Reason |
|------|--------|
| CHRYSALIS_COMPREHENSIVE_PATTERN_ANALYSIS.md | Reference doc, move to docs/research/ |
| CHRYSALIS_PATTERN_REPORT.md | Superseded by comprehensive |
| chrysalis-integration-platform-implementation-plan.md | Vague, needs review |
| CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md | Process doc, archive |
| SESSION_SUMMARY_*.md | Session logs |
| FINAL_SESSION_SUMMARY_*.md | Session logs |
| IMPLEMENTATION_PROGRESS_*.md | Session progress |
| DOCUMENTATION_REVIEW_PLAN_*.md | Completed |
| USER_TESTING_READINESS_PLAN_*.md | Completed |
| Superficial-Pattern-Report.md | Superseded |

---

## Duplicate/Conflicting Content

### Canvas Architecture

| Document | Content | Status |
|----------|---------|--------|
| docs/canvas-architecture.md | Old canvas wireframe | Outdated |
| src/canvas/react/demo/ | New canvas implementation | Current |
| docs/guides/WIDGET_DEVELOPER_GUIDE.md | New widget system | Current |
| docs/guides/CANVAS_TYPE_EXTENSION_GUIDE.md | New canvas types | Current |
| docs/CANVAS_DEVELOPMENT_PROTOCOL.md | Development process | Current |
| docs/JSONCanvas_COMMONS.md | Old JSON Canvas | Outdated |

**Action**: Archive old canvas docs, keep new guides.

### Pattern Analysis

| Document | Content | Status |
|----------|---------|--------|
| plans/CHRYSALIS_COMPREHENSIVE_PATTERN_ANALYSIS.md | Full analysis | Current |
| plans/CHRYSALIS_PATTERN_REPORT.md | Summary report | Superseded |
| plans/Superficial-Pattern-Report.md | Initial draft | Superseded |

**Action**: Keep comprehensive, archive others.

### Session Summaries (Multiple)

| Document | Notes |
|----------|-------|
| plans/SESSION_SUMMARY_2026-01-15.md | Session 1 |
| plans/FINAL_SESSION_SUMMARY_2026-01-15.md | Final session |
| docs/CANVAS_SESSION_SUMMARY_2026-01-15.md | Canvas session |
| docs/DOCUMENTATION_REVIEW_REPORT_2026-01-15.md | Doc review |

**Action**: Archive all session summaries to docs/archive/sessions/.

---

## Recommended Structure

```
Chrysalis/
├── README.md                    # Project overview
├── ARCHITECTURE.md              # System design
├── CONTRIBUTING.md              # Contribution guidelines
│
├── docs/
│   ├── INDEX.md                 # Navigation hub
│   ├── STATUS.md                # Implementation status (SSOT)
│   ├── CONFIGURATION.md         # Environment variables
│   │
│   ├── architecture/            # Architecture deep-dives
│   │   ├── system-overview.md
│   │   ├── memory-system.md
│   │   ├── canvas-system.md     # NEW: consolidate canvas docs
│   │   └── system-agents.md     # NEW: from Borrowed_Ideas
│   │
│   ├── guides/                  # How-to guides
│   │   ├── QUICK_START.md
│   │   ├── WIDGET_DEVELOPER_GUIDE.md
│   │   ├── CANVAS_TYPE_EXTENSION_GUIDE.md
│   │   ├── WIDGET_PUBLISHING_GUIDE.md
│   │   ├── MCP_DECISION_GUIDE.md     # MOVE from root
│   │   └── MCP_SERVER_GUIDE.md       # MOVE from root
│   │
│   ├── api/                     # API documentation
│   │
│   ├── specs/                   # Technical specifications
│   │   └── JOBS_EVENTS_SCHEMA.md    # FROM Borrowed_Ideas
│   │
│   ├── research/                # Research foundation
│   │   ├── universal-patterns/
│   │   ├── PATTERN_ANALYSIS.md      # FROM plans
│   │   └── scm-middleware.md        # FROM Borrowed_Ideas
│   │
│   ├── quality/                 # Quality docs
│   │   └── CODE_REVIEW_CHECKLIST.md # MOVE from root
│   │
│   └── archive/                 # Historical docs
│       ├── README.md            # Archive index
│       ├── sessions/            # Session logs
│       ├── reports/             # Historical reports
│       └── *.md                 # Other archived docs
│
├── plans/
│   ├── README.md                # Plans index
│   └── [active plans only]
│
├── memory_system/
│   └── README.md                # Python package docs
│
└── go-services/
    └── README.md                # Go services docs
```

---

## Action Items

### Immediate (This Session)

1. [ ] Move session summaries to archive
2. [ ] Move root-level guides to docs/guides/
3. [ ] Archive superseded pattern reports
4. [ ] Consolidate Borrowed_Ideas content
5. [ ] Update INDEX.md with new locations
6. [ ] Verify all links after moves

### Short-term

1. [ ] Reconcile old vs new canvas documentation
2. [ ] Review and update ARCHITECTURE.md
3. [ ] Add "last updated" to all active docs
4. [ ] Create docs/architecture/canvas-system.md
5. [ ] Create docs/architecture/system-agents.md

### Medium-term

1. [ ] Full content review of unclear docs
2. [ ] Mermaid diagram audit and fixes
3. [ ] Cross-reference verification
4. [ ] Archive cleanup (remove redundant)

---

**Next Step**: Execute archiving and reorganization
