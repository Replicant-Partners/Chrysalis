# Chrysalis Terminal UI - Documentation

**Last Updated:** January 15, 2026  
**Status:** ✅ MVP Complete - Phase B Ready

---

## Quick Links

### Current Status
- 📊 **[CURRENT_STATUS.md](./CURRENT_STATUS.md)** - Authoritative project status ⭐
- 📈 **[DEVELOPMENT_PROGRESS_REPORT.md](./DEVELOPMENT_PROGRESS_REPORT.md)** - Comprehensive progress report
- 🔧 **[status/IMPLEMENTATION_STATUS.md](./status/IMPLEMENTATION_STATUS.md)** - Technical implementation details

### Architecture & Planning
- 🏗️ **[CHRYSALIS_TERMINAL_ARCHITECTURE.md](./CHRYSALIS_TERMINAL_ARCHITECTURE.md)** - System architecture
- 📋 **[MVP_CANVAS_PLAN.md](./MVP_CANVAS_PLAN.md)** - Canvas specifications
- 🎨 **[WIDGET_SYSTEM_PLAN.md](./WIDGET_SYSTEM_PLAN.md)** - Widget system design

### User Guides
- 📖 **[CANVAS_SYSTEM_USAGE_GUIDE.md](./CANVAS_SYSTEM_USAGE_GUIDE.md)** - Canvas usage guide
- 📦 **[CURATION_CANVAS_GUIDE.md](./CURATION_CANVAS_GUIDE.md)** - Curation canvas guide
- 🖥️ **[TERMINAL_PANE_ARCHITECTURE.md](./TERMINAL_PANE_ARCHITECTURE.md)** - Terminal architecture

---

## Project Status

### ✅ MVP Complete (100%)

All 10 planned canvas types are fully implemented and functional:

| Canvas | Status | Description |
|--------|--------|-------------|
| Settings | ✅ | API key management, encryption |
| Board | ✅ | ReactFlow workspace, YJS sync |
| Scrapbook | ✅ | Media collection, tagging |
| Research | ✅ | Hierarchical documents, wiki-links |
| Wiki | ✅ | MediaWiki integration |
| Terminal | ✅ | xterm.js terminal emulation |
| Browser | ✅ | Web browsing in iframe |
| Scenarios | ✅ | Future planning, 3 views |
| Curation | ✅ | Research library, graph viz |
| Media | ✅ | Image/audio/video editing |

**Total:** ~15,000 LOC, 60+ components, 0 TypeScript errors

### Next Phase: Integration & Polish

Phase B (2-3 weeks):
- Backend integration (Terminal WebSocket, Wiki auth)
- YJS real-time sync for new canvases
- Component integration (Grid, Infinite Scroll)
- Testing infrastructure (40% coverage target)

---

## Documentation Structure

### Primary Documents

📊 **Status & Progress**
- `CURRENT_STATUS.md` - Single source of truth for project status
- `DEVELOPMENT_PROGRESS_REPORT.md` - Detailed progress report
- `status/IMPLEMENTATION_STATUS.md` - Technical implementation tracking

🏗️ **Architecture & Design**
- `CHRYSALIS_TERMINAL_ARCHITECTURE.md` - Overall system architecture
- `MVP_CANVAS_PLAN.md` - Canvas type specifications
- `WIDGET_SYSTEM_PLAN.md` - Widget system design
- `TERMINAL_PANE_ARCHITECTURE.md` - Terminal architecture

📖 **User Documentation**
- `CANVAS_SYSTEM_USAGE_GUIDE.md` - How to use canvas system
- `CURATION_CANVAS_GUIDE.md` - Curation canvas user guide
- `README.md` - This file (documentation index)

### Archived Documents

📦 **Archive (2026-01)**
- `archive/2026-01/sessions/` - Development session summaries
- `archive/2026-01/verification/` - Code verification reports
- `archive/2026-01/interim/` - Interim planning documents
- `archive/2026-01/progress/` - Component migration tracking
- `archive/2026-01/clarification-sessions/` - Architecture clarifications

See [archive/2026-01/README.md](./archive/2026-01/README.md) for details.

### Specialized Documentation

📁 **Subdirectories**
- `api/` - API specifications
- `architecture/` - Architecture deep-dives
- `guides/` - Implementation guides

---

## For Developers

### Getting Started

1. **Read First:**
   - [CURRENT_STATUS.md](./CURRENT_STATUS.md) - Understand current state
   - [CHRYSALIS_TERMINAL_ARCHITECTURE.md](./CHRYSALIS_TERMINAL_ARCHITECTURE.md) - System architecture

2. **Implementation Reference:**
   - [MVP_CANVAS_PLAN.md](./MVP_CANVAS_PLAN.md) - Canvas specifications
   - [CANVAS_SYSTEM_USAGE_GUIDE.md](./CANVAS_SYSTEM_USAGE_GUIDE.md) - Usage patterns

3. **Build & Run:**
   ```bash
   cd ui
   npm install
   npm run dev       # Development server
   npm run build     # Production build
   npm run typecheck # Type checking
   ```

### Contributing

1. Follow existing patterns (see implemented canvases)
2. Use design tokens (no hardcoded values)
3. Maintain strict TypeScript compliance
4. Add tests for new features (Phase B onwards)

---

## Document Versioning

### Current (v2.0.0)
- **CURRENT_STATUS.md** - Authoritative status
- **DEVELOPMENT_PROGRESS_REPORT.md** - Progress report
- **MVP_CANVAS_PLAN.md** - Final specifications

### Superseded (Archived)
- All interim session summaries → archive/2026-01/sessions/
- All verification reports → archive/2026-01/verification/
- All thread continuations → archive/2026-01/interim/

See [Archived Documents](#archived-documents) section for details.

---

## FAQ

### Where is the current project status?
**[CURRENT_STATUS.md](./CURRENT_STATUS.md)** is the single source of truth.

### Where are the session summaries?
Archived in `archive/2026-01/sessions/`. Current status in CURRENT_STATUS.md.

### Where is the implementation status?
**[status/IMPLEMENTATION_STATUS.md](./status/IMPLEMENTATION_STATUS.md)** for technical details.  
**[CURRENT_STATUS.md](./CURRENT_STATUS.md)** for overview.

### How do I add a new canvas?
See **[MVP_CANVAS_PLAN.md](./MVP_CANVAS_PLAN.md)** for patterns and specifications.

### Where are the user guides?
- **[CANVAS_SYSTEM_USAGE_GUIDE.md](./CANVAS_SYSTEM_USAGE_GUIDE.md)** - General usage
- **[CURATION_CANVAS_GUIDE.md](./CURATION_CANVAS_GUIDE.md)** - Curation-specific

---

## Maintenance

### Documentation Updates

**When to Update:**
- After completing a development phase
- When architecture changes
- When adding/removing features
- Monthly review (minimum)

**What to Update:**
1. **CURRENT_STATUS.md** - Always reflect current state
2. **DEVELOPMENT_PROGRESS_REPORT.md** - After major milestones
3. **status/IMPLEMENTATION_STATUS.md** - After implementation changes

### Archive Policy

**When to Archive:**
- Session-specific documents after session complete
- Interim planning after plans finalized
- Verification reports after continuous verification established

**Where to Archive:**
- `archive/YYYY-MM/` - Monthly archives
- Include README.md explaining what's archived

---

## Support

### Internal Team
- Review current status documents
- Check architecture guides
- Refer to implementation patterns

### External Contributors
- Start with README.md (this file)
- Review CURRENT_STATUS.md
- Follow CONTRIBUTING.md (when available)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | Jan 15, 2026 | MVP complete, documentation consolidation |
| 1.2.0 | Jan 14, 2026 | Week 4-5 canvases complete |
| 1.1.0 | Jan 13, 2026 | Week 2-3 canvases complete |
| 1.0.0 | Jan 11, 2026 | Initial structure, Week 1 complete |

---

**Maintained By:** Development Team  
**Last Review:** January 15, 2026  
**Next Review:** After Phase B completion

---

*This README serves as the index to all Chrysalis Terminal UI documentation. For current project status, see [CURRENT_STATUS.md](./CURRENT_STATUS.md).*