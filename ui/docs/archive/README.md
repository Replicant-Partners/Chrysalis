# Chrysalis Terminal UI - Archive

**⚠️ This directory contains historical, non-current documentation**

The materials in this archive are preserved for reference only. They represent past discussions, planning sessions, and progress logs that are no longer active guidance.

**For current documentation**, see [ui/docs/README.md](../README.md)

---

## What's Archived Here

### 2026-01 (January 2026)

#### Clarification Sessions
- [ARCHITECTURE_CLARIFICATIONS_SESSION_2026-01-10.md](./2026-01/clarification-sessions/ARCHITECTURE_CLARIFICATIONS_SESSION_2026-01-10.md)
  - Q&A session resolving architecture ambiguities
  - Led to updates in main architecture spec
  - **Status:** Superseded by CHRYSALIS_TERMINAL_ARCHITECTURE.md v1.1.0

- [ARCHITECTURE_CLARIFICATIONS_COMPLETE.md](./2026-01/clarification-sessions/ARCHITECTURE_CLARIFICATIONS_COMPLETE.md)
  - Complete summary of clarification session
  - All insights integrated into active docs
  - **Status:** Reference only

#### Progress Logs  
- [COMPONENT_MIGRATION_PROGRESS.md](./2026-01/progress/COMPONENT_MIGRATION_PROGRESS.md)
  - Historical log of Phase 3 component migration
  - Tracks day-by-day progress (January 2026)
  - **Status:** Replaced by [Implementation Status](../status/IMPLEMENTATION_STATUS.md)

---

## Archive Organization

```
archive/
├── README.md (this file)
└── 2026-01/
    ├── clarification-sessions/
    │   ├── ARCHITECTURE_CLARIFICATIONS_SESSION_2026-01-10.md
    │   └── ARCHITECTURE_CLARIFICATIONS_COMPLETE.md
    └── progress/
        └── COMPONENT_MIGRATION_PROGRESS.md
```

---

## Why These Are Archived

### Clarification Sessions
- **Value:** Show the reasoning behind architectural decisions
- **Archived because:** All insights have been integrated into the active architecture spec
- **Use for:** Understanding the "why" behind design choices if the active docs don't explain them

### Progress Logs
- **Value:** Historical record of implementation work
- **Archived because:** Git history and commit messages provide better chronological tracking
- **Use for:** Understanding implementation timeline if needed for retrospectives

---

## Using Archived Materials

### ✅ Good Uses
- Understanding historical context for a design decision
- Researching why a specific approach was chosen
- Learning about past challenges and their solutions
- Preparing retrospectives or postmortems

### ❌ Bad Uses
- Treating as current implementation guidance
- Using for development decisions (use active docs instead)
- Citing in new documentation (cite the active docs that incorporated these insights)
- Sharing with new team members as onboarding (use active docs)

---

## Active Documentation

**Always refer to active documentation for current guidance:**

- [UI Documentation Hub](../README.md)
- [Terminal Architecture](../CHRYSALIS_TERMINAL_ARCHITECTURE.md)
- [Component Architecture](../architecture/COMPONENT_ARCHITECTURE.md)
- [Implementation Status](../status/IMPLEMENTATION_STATUS.md)

---

## Archive Policy

### What Gets Archived

**Automatically archived:**
- Progress reports and status diaries (after integration into status doc)
- Planning session notes (after integration into specs)
- Historical Q&A sessions (after integration into architecture docs)
- Superseded specification versions (when major revision occurs)

**Never archived:**
- Active specifications
- Current implementation status
- Developer guides
- API documentation
- Design system documentation

### Retention

- Archives are kept indefinitely (Git provides storage)
- No automatic deletion
- Periodic review for relevance (annual)

### File Naming

Archived files use original names with context:
- Prefix with date if not in filename: `2026-01-10-original-name.md`
- Organize in dated subdirectories: `2026-01/category/`
- Preserve original structure when moving entire directories

---

## Git History

Remember: **Git commit history is the ultimate archive**

The archive/ directory supplements Git history by:
- Grouping related historical documents
- Providing narrative context
- Making past work discoverable
- Explaining what was superseded and why

For detailed change history, use `git log` and `git blame`.

---

## Questions About Archived Materials

If you're unsure whether archived material is still relevant:

1. **Check the active docs first** - The insight may be integrated there
2. **Check Git history** - See when the file was archived and why
3. **Ask the team** - Someone may remember the context
4. **Cross-reference** - Look for mentions in active docs

---

**Archive Maintainer:** Chrysalis UI Team  
**Last Updated:** January 10, 2026  
**Archive Started:** January 10, 2026

---

**Navigation:** [UI Docs](../README.md) | [Project Root](../../../)