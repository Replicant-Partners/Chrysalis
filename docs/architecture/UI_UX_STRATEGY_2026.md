# Chrysalis UI/UX Strategy: The Unified Interface

**Date**: 2026-01-16
**Status**: Proposed
**Context**: Post-Consolidation (UnifiedAdapter V2)

## 1. Executive Summary

### Objective
Design a resilient, adaptive UI/UX strategy that leverages the new `UnifiedAdapter` architecture to provide a seamless interface for multi-agent orchestration. The goal is to decouple the frontend from specific agent frameworks (ElizaOS, CrewAI) and instead render interactions based on the abstract `UniversalMessage` protocol.

### Context
The backend has migrated to a semantic, LLM-driven adapter layer (`src/adapters/universal/`). Legacy hardcoded adapters have been removed. The UI must now interact with the system via the `UnifiedAdapter` interface, treating all agents as "Universal Agents" with varying capabilities defined by the `registry-v2.ts`.

### Success Criteria
1.  **Protocol Agnosticism**: The UI renders agent messages correctly regardless of the underlying framework (MCP, A2A, etc.).
2.  **Trust Visualization**: Users can instantly distinguish between System, Internal, and External agents via visual cues.
3.  **Ada Integration**: The System Agent (Ada) actively manages the workspace, proposing layouts and guiding onboarding.

## 2. Agent Interaction Taxonomy & Trust Modeling

We define three tiers of agents, each with distinct UI representations and permission models.

### Tier 1: External Agents (The "Guest")
*   **Definition**: Third-party agents (e.g., a generic "ResearchAgent" from a marketplace) or agents connecting via untrusted protocols.
*   **Trust Level**: Low.
*   **UI Representation**:
    *   **Visual**: Distinct border (e.g., dashed orange), "Guest" badge.
    *   **Isolation**: Rendered in a sandboxed iframe or separate webview.
*   **Interaction Rules**:
    *   **Explicit Approval**: Every tool execution requires a user confirmation modal.
    *   **Data Access**: Read-only access to specific, user-selected context.
    *   **Inter-Agent**: Cannot directly message Internal/System agents; must route through User or Ada.

### Tier 2: Internal Agents (The "Staff")
*   **Definition**: Domain-specific agents instantiated by Chrysalis (e.g., "Coder", "Debugger", "Architect").
*   **Trust Level**: High (Scoped).
*   **UI Representation**:
    *   **Visual**: Solid standard border (e.g., blue/brand color).
    *   **Integration**: Embedded directly in the workspace layout.
*   **Interaction Rules**:
    *   **Audit Logging**: Actions are logged but don't require blocking approval (unless critical).
    *   **Data Access**: Full access to the current project/workspace.
    *   **Inter-Agent**: Can communicate with other Internal agents freely.

### Tier 3: System Agent (Ada) (The "Manager")
*   **Definition**: The root orchestrator and user's primary interface assistant.
*   **Trust Level**: Root.
*   **UI Representation**:
    *   **Visual**: Chromeless, omnipresent (e.g., floating command bar or status line).
    *   **Capabilities**: Can modify the UI layout, open/close panels, and highlight elements.
*   **Interaction Rules**:
    *   **Governance**: Intercepts requests from External agents and presents them to the user.
    *   **Evolution**: Proposes UI changes based on workflow (e.g., "You seem to be debugging, shall I open the Log View?").

## 3. 'Ada' System Agent Specification

Ada is not just a chatbot; she is the **Interface Controller**.

### 3.1 Responsibilities
1.  **Onboarding & Tutorials**:
    *   Ada detects first-time usage of specific features.
    *   *Action*: Overlays a non-intrusive guide or highlights the relevant UI element.
    *   *Trigger*: `UniversalMessage` with type `tutorial_step`.

2.  **UI Evolution (Adaptive Layouts)**:
    *   Ada monitors user activity (e.g., switching between code and terminal).
    *   *Action*: Proposes a layout shift (e.g., "Switch to Debug Mode?").
    *   *Mechanism*: Sends a `ui_command` payload to the frontend.

3.  **Governance (The Gatekeeper)**:
    *   When an External Agent requests a sensitive action (e.g., file write), the request is routed to Ada.
    *   *Action*: Ada renders a "Permission Request" card in the chat stream.
    *   *Outcome*: User clicks "Approve" -> Ada signals the adapter to proceed.

### 3.2 Interface Definition
Ada communicates with the frontend via a specialized MCP protocol extension:

```typescript
interface AdaUICommand {
  type: 'ui_modification';
  action: 'open_panel' | 'close_panel' | 'highlight' | 'show_modal';
  target: string; // Component ID
  params?: Record<string, any>;
}
```

## 4. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
*   **Task 1.1**: Define `UniversalMessage` types in the frontend codebase to match `src/adapters/universal/types.ts`.
*   **Task 1.2**: Implement the **Trust Visualizer** component—a wrapper that applies styles based on Agent Tier.
*   **Task 1.3**: Build the **Unified Chat Interface** that can render text, markdown, and tool calls from the `UnifiedAdapter`.

### Phase 2: Ada & Governance (Weeks 3-4)
*   **Task 2.1**: Implement the `AdaClient` in the frontend to handle `ui_modification` messages.
*   **Task 2.2**: Create the **Permission Modal** system for External Agent requests.
*   **Task 2.3**: Wire up the `SystemAgentChatService` to the frontend `AdaClient`.

### Phase 3: Advanced Interactions (Weeks 5-6)
*   **Task 3.1**: Implement **Drag-and-Drop Agent Orchestration** (visually connecting agents to form a pipeline).
*   **Task 3.2**: Integrate the **Mermaid Renderer** to visualize the `FlowGraph` executed by the Python engine.
*   **Task 3.3**: Add **Real-time State Visualization** (showing loop counters/variables from the Python executor).

### Available Tools & Resources
*   **MCP Servers**: Use `filesystem` to scaffold components, `postgres` (if available) for persisting user preferences.
*   **Backend**: `src/adapters/universal/adapter-v2.ts` provides the semantic data.
*   **Reasoning**: `src/universal_adapter/flow/` provides the execution state to visualize.
