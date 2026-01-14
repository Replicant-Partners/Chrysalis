# Thread Continuation Prompt - Wiki Canvas Implementation

**Session:** January 14, 2026 (End of Day)  
**Thread Type:** Continuation - Wiki Canvas Implementation  
**Status:** 80% Complete, Ready for API Integration

---

## Prompt for New Thread

```
Continue implementation of the Wiki Canvas from where we left off.

## Context

We are implementing an 8-canvas MVP for Chrysalis Terminal UI. Wiki Canvas was just added as the 8th canvas type.

### Progress So Far

**Completed (4 of 8 canvases):**
1. ✅ Settings Canvas (Week 1)
2. ✅ Board Canvas (Week 2) 
3. ✅ Scrapbook Canvas (Week 3)
4. ✅ Research Canvas (Week 4)

**In Progress (Week 5):**
5. 🚧 Wiki Canvas - 80% complete (UI done, needs API integration)

**Remaining:**
6. Scenarios Canvas (Week 6)
7. Curation Canvas (Week 7)
8. Media Canvas (Week 8)

### Wiki Canvas Current Status

**What's Done:**
- ✅ Component structure created (5 files, ~485 LOC)
- ✅ UI layout complete
- ✅ Styles complete (100% design tokens)
- ✅ Type definitions
- ✅ Zustand store
- ✅ App integration
- ✅ MediaWiki iframe setup
- ✅ Background mode support
- ✅ Zep integration UI (toggle)

**What's Needed:**
1. **MediaWiki API Integration** (High Priority)
   - Implement actual API calls in `store.ts`
   - Create `mediawiki-api.ts` helper
   - Load/save/search functionality

2. **YJS Real-time Sync** (High Priority)
   - Add collaborative editing
   - Multi-user support
   - Similar to Board canvas pattern

3. **Zep Integration** (Medium Priority)
   - Implement sync to Zep knowledge graph
   - Create `zep-integration.ts`
   - Optional feature, can be deferred

4. **TypeScript Verification** (Immediate)
   - Run `npm run typecheck`
   - Fix any type errors
   - Verify build works

**Files Created:**
```
ui/src/components/WikiCanvas/
├── types.ts                    ✅ Complete
├── store.ts                    ⚠️ Has TODOs for API calls
├── WikiCanvas.tsx              ✅ Complete
├── WikiCanvas.module.css       ✅ Complete
└── index.ts                    ✅ Complete
```

**Files Modified:**
```
ui/docs/MVP_CANVAS_PLAN.md      ✅ Updated to 8 canvases
ui/src/App.tsx                  ✅ Wiki canvas integrated
ui/src/components/CanvasNavigator/CanvasNavigator.tsx  ✅ Type added
```

### Wiki Canvas Specifications

**Purpose:** Collaborative knowledge base for agents and humans using MediaWiki

**Key Features:**
- MediaWiki integration via iframe + API
- Agent collaborative editing
- Background operation mode (can run invisibly)
- Optional Zep knowledge graph integration
- Full wiki syntax support
- Version history
- Can serve as project knowledge base

**Integration Points:**
- **Agents:** Can read/write via MediaWiki API
- **Zep:** Optional sync to knowledge graph
- **Background Mode:** Can run invisibly, agents still access

**Current Implementation:**
- Iframe displays MediaWiki at `http://localhost:8080`
- View modes: Read, Edit, History
- Page navigation via title input
- Connection status indicator
- Zep toggle (UI only, not functional yet)

### Technical Stack

**Confirmed:**
- React + TypeScript
- Vite build system
- Zustand for local state
- YJS for real-time sync (to be added)
- CSS Modules with design tokens
- MediaWiki via iframe + API

**MediaWiki Setup:**
- Default: `http://localhost:8080`
- Needs CORS enabled for iframe
- API token for programmatic access
- Version 1.39+ recommended

### Architecture Reference

**Similar Patterns in Codebase:**
- Board Canvas: Uses YJS for real-time sync (`useReactFlowYJS.ts`)
- Research Canvas: Document editing and viewing
- Scrapbook Canvas: Media management

**YJS Pattern to Follow:**
```typescript
// See: ui/src/hooks/useReactFlowYJS.ts
// Add similar pattern for wiki pages
const yWikiPages = doc.getMap('wiki_pages');
```

## Tasks for This Thread

### 1. Verify Current Implementation (30 min)
- Run `npm run typecheck` 
- Run `npm run build`
- Fix any type errors
- Test wiki iframe loads

### 2. Implement MediaWiki API (4 hours)
Create `ui/src/components/WikiCanvas/mediawiki-api.ts`:
```typescript
// Helper functions for MediaWiki API
export async function getPage(wikiUrl: string, title: string) { ... }
export async function savePage(wikiUrl: string, title: string, content: string) { ... }
export async function searchPages(wikiUrl: string, query: string) { ... }
```

Update `ui/src/components/WikiCanvas/store.ts`:
- Replace TODO comments with actual API calls
- Add error handling
- Add loading states

### 3. Add YJS Real-time Sync (4 hours)
Create `ui/src/components/WikiCanvas/useWikiYJS.ts`:
- Follow pattern from `useReactFlowYJS.ts`
- Sync wiki pages via YJS
- Enable multi-user editing
- Handle conflicts

### 4. (Optional) Zep Integration (4 hours)
If time permits:
- Create `ui/src/components/WikiCanvas/zep-integration.ts`
- Implement sync to Zep knowledge graph
- Add configuration options

### 5. Testing (2 hours)
- Verify wiki loads in iframe
- Test page navigation
- Test view mode switching
- Test background mode
- Document any issues

## Reference Files

**Read These First:**
- `ui/docs/WIKI_CANVAS_IMPLEMENTATION_PROGRESS.md` - Current status
- `ui/docs/MVP_CANVAS_PLAN.md` - Overall plan (now 8 canvases)
- `ui/src/components/WikiCanvas/types.ts` - Type definitions
- `ui/src/hooks/useReactFlowYJS.ts` - YJS pattern to follow

**MediaWiki API Docs:**
- Action API: https://www.mediawiki.org/wiki/API:Main_page
- REST API: https://www.mediawiki.org/wiki/API:REST_API

**Zep Docs (if implementing):**
- Zep Knowledge Graph: https://docs.getzep.com/

## Expected Outcome

By end of thread:
- ✅ Wiki canvas fully functional
- ✅ MediaWiki API working
- ✅ YJS real-time sync enabled
- ✅ TypeScript clean
- ✅ Build successful
- (Optional) Zep integration started

**Ready to proceed?** Start with TypeScript verification, then MediaWiki API implementation.
```

---

## Quick Start for New Thread

1. **Verify Build:**
   ```bash
   cd ui && npm run typecheck && npm run build
   ```

2. **Check Wiki Canvas:**
   ```bash
   # Review implementation
   ls -la ui/src/components/WikiCanvas/
   
   # Check TODOs
   grep -r "TODO" ui/src/components/WikiCanvas/
   ```

3. **Read Progress Report:**
   ```bash
   cat ui/docs/WIKI_CANVAS_IMPLEMENTATION_PROGRESS.md
   ```

4. **Start Coding:**
   - Begin with `mediawiki-api.ts` implementation
   - Then add YJS sync
   - Test and iterate

---

**Handoff Complete**  
**Status:** Ready for new thread  
**Priority:** MediaWiki API → YJS Sync → Testing