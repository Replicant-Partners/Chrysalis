# Agent Canvas: Detailed Specification

**Date:** 2026-01-18  
**Source:** User-provided comprehensive specification  
**Scope:** Dual-mode agent management system

---

## System Architecture Overview

**Dual-Mode System:**
- **AgentBuilder Mode:** Exclusive agent creation environment (guards prevent canvas access during construction)
- **AgentCanvas Mode:** Operational environment for existing agents (orchestration + interaction)

**Strict Separation of Concerns:**
- Agent instantiation → AgentBuilder only
- Agent orchestration → AgentCanvas only
- No agent creation in canvas (enforced architecturally)

---

## Core Data Model (Tasks 1-3)

### Task 1: PersonaJSON Schema

```typescript
interface PersonaJSON {
  // Agent Identity
  identity: {
    id: string;
    name: string;
    displayName: string;
    description: string;
    avatar?: string;
  };
  
  // Agent Capabilities  
  capabilities: {
    skills: Skill[];
    tools: ToolDefinition[];
    maxConcurrency?: number;
  };
  
  // Configuration
  config: {
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
  
  // Metadata
  metadata: {
    createdAt: number;
    modifiedAt: number;
    version: string;
    tags?: string[];
  };
}
```

### Task 2: MemoryStack System

```typescript
interface MemoryStackConnection {
  stackId: string;
  stackName: string;
  connectionState: 'connected' | 'disconnected' | 'error';
  
  // Connection protocols
  protocols: {
    read: boolean;
    write: boolean;
    subscribe: boolean;
  };
  
  // Data persistence
  persistence: {
    backend: 'fireproof' | 'sqlite' | 'custom';
    syncEnabled: boolean;
  };
  
  // Agent-to-memory binding
  bindings: {
    agentId: string;
    accessLevel: 'read' | 'read-write' | 'admin';
    namespaces: string[]; // Memory partitions this agent can access
  };
}
```

### Task 3: Agent Lifecycle State Machine

```typescript
type AgentState = 'created' | 'stopped' | 'running' | 'auto-run' | 'error';

interface AgentLifecycle {
  currentState: AgentState;
  previousState?: AgentState;
  stateHistory: StateTransition[];
  
  // Transition rules
  canTransition(from: AgentState, to: AgentState): boolean;
  
  // Persistence
  persistState(): Promise<void>;
  restoreState(): Promise<AgentState>;
}

// Valid transitions:
// created → stopped (initial setup complete)
// stopped → running (user activates agent)
// running → stopped (user deactivates)
// stopped → auto-run (user enables auto-start)
// auto-run → running (canvas opens, agent auto-starts)
// running → error (execution failure)
// error → stopped (user acknowledges error)
```

---

## Data Persistence Layer (Tasks 4-7)

### Task 4: Agent Storage Service

```typescript
interface AgentStorageService {
  // CRUD operations
  create(agent: PersonaJSON): Promise<string>; // Returns agentId
  read(agentId: string): Promise<PersonaJSON>;
  update(agentId: string, changes: Partial<PersonaJSON>): Promise<void>;
  delete(agentId: string): Promise<void>;
  
  // Data integrity
  validate(agent: PersonaJSON): ValidationResult;
  checkIntegrity(): Promise<IntegrityReport>;
}
```

### Task 5: Batch Import Pipeline

```typescript
interface BatchImportPipeline {
  // Ingestion
  ingest(source: ExternalAgentFormat): Promise<PersonaJSON[]>;
  
  // Schema transformation
  transform(external: unknown, format: AgentFormat): PersonaJSON;
  
  // Validation
  validate(agents: PersonaJSON[]): ValidationResult[];
  
  // Bulk persistence
  bulkPersist(agents: PersonaJSON[]): Promise<ImportResult>;
}

type AgentFormat = 'cline' | 'openai-assistant' | 'langchain' | 'custom';

interface ImportResult {
  successful: string[]; // Agent IDs
  failed: { agent: PersonaJSON; error: string }[];
  duplicates: string[]; // Agent names that already exist
}
```

### Task 6: Agent Retrieval Service

```typescript
interface AgentRetrievalService {
  // Lookup by name
  findByName(name: string): Promise<PersonaJSON | null>;
  findByNamePattern(pattern: RegExp): Promise<PersonaJSON[]>;
  
  // Filtering
  filterByCapability(capability: string): Promise<PersonaJSON[]>;
  filterByTag(tag: string): Promise<PersonaJSON[]>;
  filterByState(state: AgentState): Promise<PersonaJSON[]>;
  
  // Efficient operations
  listAll(pagination?: PaginationOptions): Promise<PersonaJSON[]>;
  search(query: SearchQuery): Promise<PersonaJSON[]>;
}
```

### Task 7: MemoryStack Management

```typescript
interface MemoryStackManagement {
  // Stack lifecycle
  createStack(config: StackConfig): Promise<string>; // Returns stackId
  deleteStack(stackId: string): Promise<void>;
  
  // Assignment
  assignToAgent(stackId: string, agentId: string): Promise<void>;
  unassignFromAgent(stackId: string, agentId: string): Promise<void>;
  
  // Operations
  getStackForAgent(agentId: string): Promise<MemoryStackConnection>;
  listStacks(): Promise<MemoryStackConnection[]>;
}
```

---

##  Core Architectural Components  (Tasks 8-12)

### Task 8: AgentBuilder Mode

```typescript
// Mode implementation
interface AgentBuilderMode {
  // Isolation enforcement
  preventCanvasAccess: boolean; // Always true during construction
  
  // Creation workflow
  createAgent(): Promise<PersonaJSON>;
  validateAgent(agent: PersonaJSON): ValidationResult;
  save Agent(agent: PersonaJSON): Promise<string>;
  
  // Guards
  canSwitchToCanvas(): boolean; // False if agent construction incomplete
}
```

### Task 9: Hypercard Component

```typescript
interface HypercardComponent {
  // Composite pattern
  agentId: string;
  metadata: {
    name: string;
    memoryStack: string;
    state: AgentState;
  };
  
  // Control surfaces
  controls: {
    onOffToggle: ToggleControl;
    chatExpander: ExpanderControl;
    personaEditor: EditorControl;
  };
  
  // Interaction interfaces
  interfaces: {
    editPersona(): void;
    toggleState(): void;
    openChat(): void;
    showMemoryStack(): void;
  };
}
```

### Task 10: PersonaJSON Editor Module

```typescript
interface PersonaJSONEditor {
  // Window pattern
  windowType: 'popup' | 'child-window' | 'modal';
  mode: 'non-modal'; // Can interact with canvas while editing
  
  // Real-time validation
  validate(json: PersonaJSON): ValidationResult;
  onValidationError(callback: (errors: string[]) => void): void;
  
  // Save operations
  save(json: PersonaJSON): Promise<void>;
  saveAndClose(): Promise<void>;
  discard(): void;
}
```

### Task 11: Agent State Management

```typescript
interface AgentStateManagement {
  // Runtime state
  getCurrentState(agentId: string): AgentState;
  transitionTo(agentId: string, newState: AgentState): Promise<void>;
  
  // Event emission
  onStateChange(callback: (agentId: string, oldState: AgentState, newState: AgentState) => void): void;
  
  // Persistence
  persistState(agentId: string): Promise<void>;
  restoreState(agentId: string): Promise<AgentState>;
}
```

### Task 12: MemoryStack Connection Display

```typescript
interface MemoryStackConnectionDisplay {
  // Visual indication
  showConnection(stackInfo: MemoryStackConnection): ReactElement;
  
  // Status visualization
  renderStatus(state: 'connected' | 'disconnected' | 'error'): ReactElement;
  
  // Navigational affordances
  onClickStack(stackId: string): void; // Navigate to memory stack details
  showStackPreview(stackId: string): ReactElement; // Tooltip/preview
}
```

---

## User Interface Layer (Tasks 13-17)

### Task 13: On/Off Slider Toggle

```typescript
interface OnOffSliderControl {
  // Positioning
  position: 'upper-right'; // Fixed position in Hypercard
  
  // State management
  wired: AgentStateManagement;
  
  // Operations
  onToggle(): Promise<void>; // Calls stateManagement.transitionTo()
  
  // Visual feedback
  showLoading: boolean;
  showError: (error: string) => void;
}
```

### Task 14: Expandable Chat Window

```typescript
interface ExpandableChatWindow {
  // Trigger control
  trigger: {
    element: 'down-arrow';
    position: 'lower-left'; // Fixed position in Hypercard
  };
  
  // Expansion model
  expandsInto: 'hypercard-body';
  collapsed: boolean;
  
  // Direct agent communication
  sendMessage(text: string): Promise<string>;
  onAgentResponse(callback: (response: string) => void): void;
}
```

### Task 15: Chat Roll-Up Animation

```typescript
interface ChatRollUpAnimation {
  // Animation sequence
  animationType: 'slide-up' | 'fade-in' | 'expand';
  duration: number; // milliseconds
  easing: 'ease-in-out';
  
  // Interaction model
  expandChat(): Promise<void>;
  collapseChat(): Promise<void>;
  toggleChat(): Promise<void>;
}
```

### Task 16: Visual State Indicators

```typescript
interface HypercardStateIndicators {
  // Operational status
  running: {
    color: 'green';
    icon: 'play';
    pulse: boolean;
  };
  stopped: {
    color: 'gray';
    icon: 'stop';
  };
  error: {
    color: 'red';
    icon: 'warning';
    showMessage: string;
  };
  
  // Connection health
  memoryConnected: { color: 'blue'; icon: 'database'; };
  memoryDisconnected: { color: 'orange'; icon: 'database-off'; };
  
  // Interaction availability
  chatAvailable: boolean;
  editingDisabled: boolean;
}
```

### Task 17: Memory Stack Visualization

```typescript
interface MemoryStackVisualization {
  // Navigational elements
  stackLink: {
    onClick: () => void; // Navigate to stack details
    tooltip: string; // Stack name + size
  };
  
  // Inspection affordances
  showStackSize(): ReactElement;
  showLastSync(): ReactElement;
  showNamespaces(): ReactElement;
  
  // Intuitive indicators
  healthIndicator: 'connected' | 'syncing' | 'error';
}
```

---

## Integration Layer (Tasks 18-22)

### Task 18: Hypercard ↔ PersonaJSON Editor

```typescript
interface HypercardEditorIntegration {
  // Bidirectional data flow
  onEditorSave(callback: (updatedPersona: PersonaJSON) => void): void;
  syncToEditor(persona: PersonaJSON): void;
  
  // Change propagation
  propagateChanges(changes: Partial<PersonaJSON>): void;
  
  // Conflict resolution
  resolveEditConflict(localVersion: PersonaJSON, remoteVersion: PersonaJSON): PersonaJSON;
}
```

### Task 19: Slider ↔ Runtime System

```typescript
interface SliderRuntimeIntegration {
  // Control wiring
  onSliderToggle(callback: (newState: boolean) => Promise<void>): void;
  
  // Operation handling
  startAgent(agentId: string): Promise<void>;
  stopAgent(agentId: string): Promise<void>;
  
  // Error handling
  onStartFailure(callback: (error: AgentRuntimeError) => void): void;
  
  // State synchronization
  syncSliderState(agentState: AgentState): void;
}
```

### Task 20: Chat Window ↔ Agent Service

```typescript
interface ChatWindowAgentIntegration {
  // Message routing
  routeMessage(agentId: string, message: string): Promise<string>;
  
  // Response handling
  onAgentResponse(handler: ResponseHandler): Unsubscribe;
  
  // Conversation state
  getConversationHistory(agentId: string): Promise<ChatMessage[]>;
  clearConversation(agentId: string): Promise<void>;
}
```

### Task 21: Auto-Run On Open Feature

```typescript
interface AutoRunFeature {
  // Configuration persistence
  enableAutoRun(agentId: string): Promise<void>;
  disableAutoRun(agentId: string): Promise<void>;
  isAutoRunEnabled(agentId: string): Promise<boolean>;
  
  // Startup sequencing
  onCanvasInit(callback: () => Promise<void>): void;
  startAutoRunAgents(): Promise<AgentStartResult[]>;
  
  // Startup ordering
  getStartupSequence(): Promise<string[]>; // Agent IDs in start order
}
```

### Task 22: Agent-Canvas Association

```typescript
interface AgentCanvasAssociation {
  // Association management
  addToCanvas(agentId: string, canvasId: string): Promise<void>;
  removeFromCanvas(agentId: string, canvasId: string): Promise<void>;
  
  // Canvas-specific config
  setCanvasConfig(agentId: string, canvasId: string, config: CanvasConfig): Promise<void>;
  getCanvasConfig(agentId: string, canvasId: string): Promise<CanvasConfig>;
  
  // Layout persistence
  saveLayout(canvasId: string, layout: HypercardLayout[]): Promise<void>;
  restoreLayout(canvasId: string): Promise<HypercardLayout[]>;
}
```

---

## AgentCanvas Operational Environment (Tasks 23-26)

### Task 23: Agent Canvas View

```typescript
interface AgentCanvasView {
  // Workspace
  canvas: ReactFlowInstance;
  
  // Multi-agent support
  displayedAgents: Map<string, HypercardComponent>;
  maxAgents?: number;
  
  // Spatial arrangement
  arrangeAgents(layout: 'grid' | 'freestyle' | 'hierarchy'): void;
  
  // State monitoring
  monitorAllAgents(): AgentStateMap;
}
```

### Task 24: Add Agent By Name

```typescript
interface AddAgentByName {
  // Agent selection
  searchAgents(query: string): Promise<PersonaJSON[]>;
  selectAgent(agentId: string): Promise<void>;
  
  // Instantiation
  instantiateHypercard(agentId: string, position: Position): Promise<HypercardComponent>;
  
  // Canvas integration
  addToCanvas(hypercard: HypercardComponent): void;
}
```

### Task 25: Agent Selection & Filtering

```typescript
interface AgentSelectionInterface {
  // Search
  searchByName(query: string): Promise<PersonaJSON[]>;
  
  // Filter
  filterByCapability(capability: string): Promise<PersonaJSON[]>;
  filterByTag(tag: string): Promise<PersonaJSON[]>;
  filterByMemoryStack(stackId: string): Promise<PersonaJSON[]>;
  
  // Browse
  browseByCategory(category: string): Promise<PersonaJSON[]>;
  getAllAgents(pagination?: PaginationOptions): Promise<PersonaJSON[]>;
}
```

### Task 26: Multi-Agent Management

```typescript
interface MultiAgentManagement {
  // Arrangement
  arrangeGrid(): void;
  arrangeFreeform(): void;
  group(agentIds: string[], groupName: string): Promise<void>;
  
  // State monitoring
  getStates(agentIds: string[]): Map<string, AgentState>;
  monitorHealth(agentIds: string[]): HealthStatus[];
  
  // Batch operations
  startAll(agentIds: string[]): Promise<StartResult[]>;
  stopAll(agentIds: string[]): Promise<void>;
  updateAll(agentIds: string[], changes: Partial<PersonaJSON>): Promise<void>;
}
```

---

## Ada System Agent Subsystem (Tasks 27-30)

### Task 27: Ada Conversational Interface

```typescript
interface AdaSystemAgent {
  // NLU for agent operations
  understandCommand(userInput: string): Promise<AgentCommand>;
  
  // Command execution
  executeCommand(cmd: AgentCommand): Promise<CommandResult>;
  
  // Conversational responses
  respond(result: CommandResult): string;
}

type AgentCommand =
  | { type: 'show-agent'; agentName: string }
  | { type: 'start-agent'; agentId: string }
  | { type: 'list-agents'; filter?: AgentFilter }
  | { type: 'help'; topic?: string };
```

### Task 28: Natural Language Command Processing

```typescript
interface NLCommandProcessor {
  // Canvas manipulation
  parseCanvasCommand(input: string): CanvasOperation;
  
  // Examples:
  // "Show me all my research agents" → list and display filtered agents
  // "Start the data analysis team" → activate agent group
  // "Add Alice to this canvas" → find and instantiate Alice hypercard
  
  // Execution
  executeOperation(op: CanvasOperation): Promise<OperationResult>;
}
```

### Task 29: Onboarding Flow with Ada

```typescript
interface AdaOnboardingFlow {
  // Interactive guidance
  startOnboarding(): Promise<void>;
  
  // Contextual assistance
  provideContextualHelp(context:  OnboardingContext): string;
  
  // Feature discovery
  introduceFeature(feature: FeatureName): void;
  demoFeature(feature: FeatureName): Promise<void>;
  
  // Progress tracking
  getOnboardingProgress(): OnboardingProgress;
}
```

### Task 30: UI Assistance Commands

```typescript
interface AdaUIAssistance {
  // Help requests
  handleHelpRequest(topic: string): Promise<HelpResponse>;
  
  // Capability discovery
  discoverCapabilities(): CapabilityTree;
  explainCapability(capability: string): string;
  
  // Guided support
  guideThroughOperation(operation: ComplexOperation): AsyncIterator<GuidanceStep>;
  
  // Command routing
  routeToAda(userInput: string): Promise<AdaResponse>;
}
```

---

## Implementation Dependency Graph

```mermaid
graph TD
    T1[Task 1: PersonaJSON Schema]
    T2[Task 2: MemoryStack System]
    T3[Task 3: Lifecycle State Machine]
    T4[Task 4: Agent Storage]
    T5[Task 5: Batch Import]
    T6[Task 6: Agent Retrieval]
    T7[Task 7: MemoryStack Management]
    T8[Task 8: AgentBuilder Mode]
    T9[Task 9: Hypercard Component]
    T10[Task 10: PersonaJSON Editor]
    T11[Task 11: State Management]]
    T12[Task 12: MemoryStack Display]
    T13[Task 13: On/Off Slider]
    T14[Task 14: Chat Window]
    T15[Task 15: Chat Animation]
    T16[Task 16: State Indicators]
    T17[Task 17: MemoryStack Viz]
    T18[Task 18: Hypercard-Editor Integration]
    T19[Task 19: Slider-Runtime Integration]
    T20[Task 20: Chat-Agent Integration]
    T21[Task 21: Auto-Run Feature]
    T22[Task 22: Agent-Canvas Association]
    T23[Task 23: Canvas View]
    T24[Task 24: Add Agent By Name]
    T25[Task 25: Selection & Filtering]
    T26[Task 26: Multi-Agent Management]
    T27[Task 27: Ada Interface]
    T28[Task 28: NL Command Processing]
    T29[Task 29: Ada Onboarding]
    T30[Task 30: Ada UI Assistance]
    
    T1 --> T4
    T1 --> T5
    T1 --> T6
    T2 --> T7
    T2 --> T12
    T3 --> T11
    T4 --> T5
    T4 --> T6
    T1 --> T9
    T3 --> T9
    T9 --> T10
    T9 --> T13
    T9 --> T14
    T11 --> T13
    T14 --> T15
    T9 --> T16
    T12 --> T17
    T10 --> T18
    T13 --> T19
    T14 --> T20
    T11 --> T21
    T9 --> T22
    T9 --> T23
    T6 --> T24
    T6 --> T25
    T23 --> T26
    T20 --> T27
    T27 --> T28
    T27 --> T29
    T27 --> T30
```

---

## Summary

**Agent Canvas Scope:** 30 implementation tasks organized into:
- Data Model (3 tasks)
- Persistence Layer (4 tasks)
- Core Components (5 tasks)
- UI Layer (5 tasks)
- Integration (5 tasks)
- Operational Environment (4 tasks)
- Ada System Agent (4 tasks)

**Key Architectural Decisions:**
- Strict separation: AgentBuilder (creation) vs. AgentCanvas (orchestration)
- Hypercard pattern for agent representation
- Composite UI: Toggle + Chat + Editor + Memory display
- Ada integration for natural language agent management
- Auto-run capability with startup sequencing

**Next Steps:** Incorporate into overall Canvas implementation roadmap

---

*Specification captured from user ground truth input on 2026-01-18*
