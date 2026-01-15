# Canvas Runners-Up - Additional Mode Proposals

**Version:** 1.0  
**Date:** January 14, 2026  
**Context:** Supplementary to CANVAS_MODE_ANALYSIS_AND_PROPOSALS.md

---

## Overview

During the analysis and design process, several additional canvas types were identified and seriously considered. This document captures the "runners-up" - canvas modes that have strong use cases but were deprioritized in favor of Knowledge, Project, and Schedule canvases.

These modes remain viable candidates for future implementation based on user demand and workflow patterns.

---

## 1. Data Canvas (Analytics & Exploration)

**Status**: Mentioned in architecture, not yet specified  
**Priority**: High (4th in line)  
**Complexity**: High

### What It Almost Was

A dedicated workspace for data analysis, visualization, and exploration - essentially a "data science workbench" inside Chrysalis.

### Purpose & Scope

**Primary Purpose**: Import, analyze, visualize, and manipulate datasets with agent assistance

**Would Include**:
- Dataset import (CSV, JSON, Parquet, SQL databases)
- Data preview and schema inspection
- Pandas/SQL-like transformations via agents
- Interactive visualizations (charts, graphs, heatmaps)
- Jupyter-style notebook cells
- Data export and reporting

**Would Exclude**:
- Heavy ML training (use external tools, import results)
- Real-time streaming analytics (not the focus)
- Large-scale data warehousing

### Why It Almost Made It

**Strong Use Cases**:
```
Persona: Data Analyst
Workflow:
1. Import sales.csv dataset
2. Ask agent "show me top 10 products by revenue"
3. Agent generates pandas code, runs analysis
4. Visualize results as bar chart
5. Export insights to Knowledge Canvas
```

**Architectural Fit**:
- Aligns with existing canvas patterns (accept/reject types)
- Natural agent integration (code generation, analysis)
- Clear boundaries (data-focused, not document-focused)

**Evidence from Documents**:
- Architecture spec mentions "Data Canvas" accepting `.csv`, `.json`, `.parquet`, `.db`
- Widgets: "Pandas, Jupyter, SQL tools"
- Clear type system already defined

### Why It Didn't Make Top 3

**1. Implementation Complexity**
- Requires backend compute environment (Python/Pandas runtime)
- Code execution sandbox needed for security
- Complex state management (data + code + results)
- Heavy dependencies (Jupyter kernel, plotting libraries)

**2. Overlaps with Other Solutions**
- Jupyter Notebook already solves this well
- Could be a Board Canvas with specialized widgets instead
- Users may prefer dedicated tools (Tableau, Excel)

**3. Narrower User Base**
- Not every user needs data analysis
- Knowledge, Project, Schedule are more universally needed
- Data work often happens outside Chrysalis, results imported

**4. Backend Coordination Required**
- Needs Python backend service
- Security concerns with arbitrary code execution
- Resource management (memory, CPU for large datasets)

### If We Built It

**Timeline**: 4-5 weeks  
**Team**: 2 developers (1 frontend, 1 backend for Jupyter integration)  
**Dependencies**: Jupyter kernel integration, plotting library (Plotly/Recharts)

**Key Features**:
```typescript
interface DataCanvas {
  datasets: ImportedDataset[];
  notebooks: NotebookCell[];  // Code + output cells
  visualizations: Chart[];
  transformations: DataTransformation[];
}

interface NotebookCell {
  id: string;
  type: 'code' | 'markdown' | 'sql';
  content: string;
  output: CellOutput;
  executionCount: number;
}
```

**Agent Role**:
- Generate analysis code from natural language
- Suggest visualizations
- Detect data quality issues
- Auto-clean datasets (handle nulls, duplicates)

---

## 2. Review Canvas (Collaborative Feedback)

**Status**: Identified in gap analysis, not documented  
**Priority**: Medium (5th in line)  
**Complexity**: Medium

### What It Almost Was

A structured workspace for review cycles, feedback collection, and approval workflows - like GitHub Pull Requests for any artifact type.

### Purpose & Scope

**Primary Purpose**: Facilitate structured review and approval processes for artifacts from any canvas

**Would Include**:
- Review requests (document, design, code, etc.)
- Inline comments and annotations
- Approval/rejection workflow
- Version comparison (diff view)
- Review checklist templates
- Status tracking (pending, in-review, approved, changes-requested)

**Would Exclude**:
- Version control system (not Git replacement)
- Code compilation/testing (use external CI/CD)
- Complex approval chains (keep simple)

### Why It Almost Made It

**Strong Use Cases**:
```
Persona: Content Team Lead
Workflow:
1. Writer creates document in Knowledge Canvas
2. Submits for review in Review Canvas
3. Editor adds inline comments
4. Agent checks grammar, suggests improvements
5. Writer addresses feedback
6. Editor approves, document published
```

**Architectural Fit**:
- Works across all canvas types (universal overlay)
- Clear agent role (automated checks, suggestions)
- Supports collaboration patterns

**Market Validation**:
- Figma comments, Google Docs suggestions, GitHub PR reviews all prove demand
- Review workflows are universal across domains

### Why It Didn't Make Top 3

**1. Can Be Achieved with Existing Patterns**
- Comments can be added to any artifact via extensions
- Approval can be a status field in Project Canvas
- Version comparison can be a utility, not a full canvas

**2. Orthogonal to Canvas Paradigm**
- More of a "mode overlay" than a canvas type
- Could be a feature across all canvases rather than its own canvas
- Review pane could be sidebar, not center canvas

**3. Lower Priority Than Core Workflows**
- Knowledge, Project, Schedule are daily drivers
- Review is episodic (not constant)
- Can be manually coordinated initially

**4. Complex State Management**
- Tracking comments across artifact versions is hard
- Diff visualization depends on artifact type
- Approval workflows can get complex quickly

### If We Built It

**Timeline**: 3 weeks  
**Team**: 1-2 developers  
**Dependencies**: Diff library (for comparison), comment threading system

**Possible Approach**: Not a full canvas, but a **Review Sidebar** that attaches to any canvas:

```typescript
interface ReviewSidebar {
  artifactId: string;
  artifactType: CanvasType;
  reviewThread: {
    status: 'pending' | 'in-review' | 'approved' | 'rejected';
    reviewers: string[];
    comments: Comment[];
    checklist: ChecklistItem[];
    history: ReviewEvent[];
  };
}

interface Comment {
  id: string;
  author: string;
  content: string;
  position?: Position; // For inline comments
  resolved: boolean;
  replies: Comment[];
}
```

**Agent Role**:
- Automated checks (grammar, style, completeness)
- Suggest reviewers based on expertise
- Summarize feedback for author
- Detect when all feedback addressed

---

## 3. Meme Canvas (Rapid Media Remix)

**Status**: Listed in CanvasNavigator, no specification  
**Priority**: Low (novelty feature)  
**Complexity**: Low

### What It Almost Was

A playful, lightweight canvas for creating memes, quick graphics, and social media content - think Canva but inside Chrysalis.

### Purpose & Scope

**Primary Purpose**: Quick visual content creation with templates and AI assistance

**Would Include**:
- Meme templates (image + text overlays)
- Drag-and-drop text positioning
- Font selection and styling
- Image filters and effects
- AI background removal
- Quick export (PNG, social media formats)

**Would Exclude**:
- Professional graphic design (use Figma/Canva)
- Video memes (use Remixer Canvas)
- Animation (too complex)

### Why It Almost Made It

**Fun Factor**:
- Adds personality to Chrysalis
- Low-stakes creativity encourages exploration
- Memes are universal language

**Quick Wins**:
- Simple implementation (HTML canvas + text overlays)
- Clear, limited scope
- Immediate gratification

**Agent Opportunities**:
- Suggest meme templates based on context
- Generate captions using LLM
- Auto-crop images for optimal meme format

### Why It Didn't Make Top 3

**1. Narrow Use Case**
- Not a core knowledge work activity
- Fun but not essential
- Better served by existing tools (Canva, Figma, Photopea)

**2. Feature Creep Risk**
- "Can you add..." requests could spiral
- Overlaps with Remixer Canvas (AI image generation)
- Scrapbook Canvas can store memes

**3. Low ROI**
- Development time better spent on core workflows
- Doesn't differentiate Chrysalis
- Novelty may wear off quickly

**4. Maintenance Burden**
- Templates need updating (meme formats change)
- Font licensing issues
- Social media format changes require updates

### If We Built It (Low Priority)

**Timeline**: 1 week (intentionally simple)  
**Team**: 1 developer  
**Approach**: Minimal viable meme creator

```typescript
interface MemeCanvas {
  template: MemeTemplate;
  image: string;
  topText: string;
  bottomText: string;
  fontSize: number;
  fontFamily: string;
}

interface MemeTemplate {
  id: string;
  name: string;
  imageUrl: string;
  topTextPosition: Position;
  bottomTextPosition: Position;
}
```

**Keep It Simple**:
- 20 classic meme templates (Drake, Distracted Boyfriend, etc.)
- Two text inputs (top, bottom)
- Basic styling (font, size, color)
- Export as PNG
- No complex effects, keep it lightweight

---

## 4. Video Canvas (Timeline Editor)

**Status**: Listed in CanvasNavigator, implied in Remixer  
**Priority**: Medium (6th in line)  
**Complexity**: Very High

### What It Almost Was

A full video editing workspace with timeline, clips, transitions, and effects - essentially a simplified Premiere/Final Cut inside Chrysalis.

### Purpose & Scope

**Primary Purpose**: Edit video content with AI assistance for cutting, transitions, and effects

**Would Include**:
- Video timeline editor
- Clip trimming and arrangement
- Transitions and effects
- Audio track management
- Text overlays and captions
- AI auto-cut (remove silence, filler words)
- Export to MP4/WebM

**Would Exclude**:
- Professional color grading (too complex)
- Multi-cam editing (too advanced)
- 3D effects (out of scope)

### Why It Almost Made It

**Strong Demand**:
- Video is critical medium for modern communication
- AI-assisted editing is emerging trend (Descript, Runway)
- Natural progression from Storyboard Canvas

**Agent Superpowers**:
```
User: "Remove all the 'ums' and silent pauses"
Agent: *analyzes audio, auto-cuts silent segments*

User: "Add captions with timestamps"
Agent: *transcribes speech, generates SRT, burns into video*

User: "Make this clip more engaging"
Agent: *suggests cuts, transitions, background music*
```

**Market Validation**:
- Descript proves demand for AI video editing
- Runway Gen-2 shows AI video generation works
- TikTok/Reels popularity shows short-form video demand

### Why It Didn't Make Top 3

**1. Extreme Complexity**
- Video encoding/decoding is CPU/GPU intensive
- Timeline UI is notoriously complex
- Browser video APIs have limitations
- Need backend video processing service

**2. Performance Challenges**
- Large video files (hundreds of MB to GB)
- Real-time preview requires optimization
- Export encoding is slow
- Browser memory constraints

**3. Better Alternatives Exist**
- Premiere, Final Cut, DaVinci Resolve are mature
- Descript already does AI-assisted editing well
- CapCut is free and good enough for most

**4. Overlaps with Other Canvases**
- Storyboard Canvas handles narrative structure
- Remixer Canvas handles AI video generation
- Video editing could be external, import result to Scrapbook

**5. Massive Scope**
- Would take 2-3 months to build properly
- Requires video processing backend (FFmpeg)
- Ongoing maintenance for codecs, formats
- Cross-browser compatibility nightmares

### If We Built It (Future, Ambitious)

**Timeline**: 8-10 weeks  
**Team**: 3 developers (frontend, backend video processing, AI integration)  
**Dependencies**: FFmpeg, video.js or similar player, backend encoding service

**Phased Approach**:
```
Phase 1 (MVP): Simple trimming and concatenation
├── Upload video clips
├── Trim start/end points
├── Arrange clips on timeline
└── Export as single video

Phase 2: Transitions and effects
├── Fade in/out
├── Cross-dissolve
├── Basic color correction
└── Text overlays

Phase 3: AI features
├── Auto-remove silence (speech detection)
├── Auto-caption (speech-to-text)
├── Scene detection and auto-cut
└── Background music suggestions
```

**Realistic Assessment**: Probably better to integrate with Runway, Descript, or similar via API rather than building from scratch.

---

## 5. Agent Orchestration Canvas

**Status**: Identified in gap analysis  
**Priority**: Low (specialized use case)  
**Complexity**: High

### What It Almost Was

A visual programming environment for designing complex multi-agent workflows - like n8n or Zapier but for AI agents.

### Purpose & Scope

**Primary Purpose**: Visually design and orchestrate multi-agent workflows with conditional logic, loops, and parallel execution

**Would Include**:
- Flow-based visual programming (nodes = agents/actions)
- Trigger conditions (events, schedules, webhooks)
- Decision nodes (if/else logic)
- Loop nodes (iterate over data)
- Parallel execution branches
- Agent chaining (output of one → input of next)
- Debugging and logging

**Would Exclude**:
- Low-level coding (use Board Canvas with Code widgets)
- Non-agent workflows (use general automation tools)

### Why It Almost Made It

**Power User Appeal**:
```
Example: Automated research workflow
┌─────────────┐
│  Trigger    │ Every Monday 9am
└──────┬──────┘
       │
┌──────▼──────┐
│ Research    │ Find papers on topic X
│ Agent       │
└──────┬──────┘
       │
┌──────▼──────┐
│ Decision    │ If > 5 papers found
└──┬───────┬──┘
   │       │
   │Yes    │No
   │       │
┌──▼───┐ ┌─▼──────┐
│Summary│ │ Alert  │
│Agent  │ │ (skip) │
└───┬───┘ └────────┘
    │
┌───▼────┐
│ Email  │ Send summary
│ Agent  │
└────────┘
```

**Advanced Coordination**:
- Handle complex multi-agent scenarios
- Reusable workflow templates
- Clear visualization of agent dependencies

**Agent Registry Connection**:
- Uses agents defined in Agent Registry
- Orchestrates their collaboration
- Monitors execution and errors

### Why It Didn't Make Top 3

**1. Niche Use Case**
- Most users don't need this level of orchestration
- Agent Registry + chat commands handle 80% of cases
- Only power users would use this regularly

**2. Complexity Overload**
- Steep learning curve (like programming)
- Visual complexity can be overwhelming
- Debugging distributed agent workflows is hard

**3. Overlaps with Existing Patterns**
- Project Canvas handles task dependencies
- Schedule Canvas handles timing
- Agent Registry handles agent configuration
- Chat handles simple agent invocation

**4. Maintenance Burden**
- Workflow execution engine is complex
- Error handling across agents is tricky
- State management for long-running workflows
- Version control for workflows

**5. Better Alternatives**
- n8n, Zapier, Make.com already do this well
- Could integrate with them via API
- Not core to Chrysalis value proposition

### If We Built It (Advanced Feature)

**Timeline**: 6-8 weeks  
**Team**: 2 developers (workflow engine, UI)  
**Approach**: Flow-based programming with React Flow

```typescript
interface OrchestratorCanvas {
  workflow: WorkflowDefinition;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  executions: WorkflowExecution[];
}

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'agent' | 'decision' | 'loop' | 'parallel' | 'action';
  config: NodeConfig;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  nodeStates: Record<string, NodeExecutionState>;
  logs: LogEntry[];
}
```

**Realistic Assessment**: This is a "nice to have" for 1-2% of power users. Defer until user demand proves the need.

---

## Summary: Prioritization Rationale

### Top 3 (Proposed for Implementation)

1. **Knowledge Canvas** - Universal need, clear boundaries, high ROI
2. **Project Canvas** - Coordination is core value, fills major gap
3. **Schedule Canvas** - Temporal dimension missing, complements Project

### Next 3 (Strong Candidates for Future)

4. **Data Canvas** - High value but high complexity, defer until backend ready
5. **Review Canvas** - Could be feature not canvas, evaluate as sidebar first
6. **Video Canvas** - High demand but extreme scope, consider external integrations

### Novelty/Niche (Low Priority)

7. **Meme Canvas** - Fun but not essential, easy to add later as lightweight feature
8. **Agent Orchestration** - Power user feature, wait for demand signal

---

## Decision Criteria Used

**For Inclusion in Top 3**:
✅ Fills identified gap in user workflows  
✅ Clear, bounded scope (won't feature creep)  
✅ Feasible within 3-week timeline  
✅ Universal applicability (not niche)  
✅ Natural agent integration  
✅ Leverages existing patterns  

**For Deferral**:
❌ High implementation complexity  
❌ Overlaps with existing canvas or external tools  
❌ Narrow user base  
❌ Requires significant backend work  
❌ Maintenance burden outweighs benefits  
❌ "Nice to have" vs "need to have"  

---

## Recommendation

**Immediate**: Implement Knowledge, Project, Schedule canvases as proposed

**Next Phase (6-12 months)**: Evaluate Data Canvas and Review Canvas based on:
- User feedback on initial three canvases
- Backend infrastructure readiness (Jupyter integration)
- Observed usage patterns

**Future**: Video Canvas and Agent Orchestration are ambitious features that may warrant separate product decisions

**Never**: Meme Canvas remains a "fun Easter egg" possibility but shouldn't be a roadmap priority

---

**End of Document**

**Version**: 1.0  
**Related**: CANVAS_MODE_ANALYSIS_AND_PROPOSALS.md  
**Next**: User research to validate prioritization assumptions