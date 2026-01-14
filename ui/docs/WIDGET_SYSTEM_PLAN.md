# Canvas Widget System - Universal Adapter Architecture

**Version:** 1.0  
**Date:** January 14, 2026  
**Status:** Design Specification

---

## Executive Summary

This document specifies the widget and plugin architecture for Chrysalis Terminal canvases, leveraging the **Universal LLM-Powered Adapter** pattern to enable dynamic integration of external services, MCPs, and third-party plugins without hand-coded adapters.

### Key Innovation

Instead of writing custom widget adapters for each service (Runway, DALL-E, Jupyter, etc.), we use an **LLM-powered Widget Registry** that:

1. Widget providers register their service via a specification URL
2. LLM interprets the spec and generates integration code on-demand
3. Canvas types declare which widget capabilities they support
4. Widgets auto-adapt to canvas constraints and interaction patterns

---

## Table of Contents

1. [Widget Concepts & Definitions](#1-widget-concepts--definitions)
2. [Universal Widget Adapter Architecture](#2-universal-widget-adapter-architecture)
3. [Widget Registry System](#3-widget-registry-system)
4. [Canvas-Widget Integration](#4-canvas-widget-integration)
5. [MCP Integration Strategy](#5-mcp-integration-strategy)
6. [Widget Lifecycle](#6-widget-lifecycle)
7. [Implementation Phases](#7-implementation-phases)
8. [Security & Sandboxing](#8-security--sandboxing)

---

## 1. Widget Concepts & Definitions

### 1.1 What is a Widget?

A **widget** is a self-contained UI component that:
- Connects to an external service or data source
- Provides interactive functionality within a canvas
- May render custom UI or use canvas-native visualization
- Operates within canvas-defined constraints and permissions

**Not a Widget**:
- Static UI components (buttons, cards, etc.) - these are design system components
- Canvas-native nodes (agent nodes, file nodes) - these are built-in node types
- Full applications - widgets are constrained to canvas boundaries

### 1.2 Widget Categories

```typescript
type WidgetCategory = 
  | 'visualization'    // Charts, graphs, dashboards
  | 'media'            // Video/audio/image players and editors
  | 'data'             // Data grids, tables, query interfaces
  | 'ai-generation'    // AI service integrations (Runway, DALL-E, etc.)
  | 'document'         // Document viewers/editors (PDF, Markdown, etc.)
  | 'communication'    // Chat widgets, video conferencing
  | 'development'      // Code editors, terminals, notebooks
  | 'productivity'     // Calendars, timers, task lists
  | 'custom';          // User-defined widgets
```

### 1.3 Widget Scopes

**Universal Widgets**: Work in any canvas type
- Example: Markdown viewer, code syntax highlighter, timer

**Canvas-Specific Widgets**: Only work in certain canvas types
- Example: AI generation widgets (Remixer Canvas only)
- Example: Data query widgets (Data Canvas, Curation Canvas)

**Node-Embedded Widgets**: Render inside React Flow nodes
- Example: Mini charts in Board Canvas nodes
- Example: File previews in document nodes

---

## 2. Universal Widget Adapter Architecture

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    UNIVERSAL WIDGET ADAPTER SYSTEM                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      WIDGET REGISTRY                             │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │ Widget ID    │ Specification URL                          │  │  │
│  │  ├──────────────┼────────────────────────────────────────────┤  │  │
│  │  │ runway-gen2  │ https://api.runwayml.com/widget-spec.json  │  │  │
│  │  │ dalle-3      │ https://api.openai.com/widgets/dalle3.json │  │  │
│  │  │ jupyter      │ https://jupyter.org/widget-spec/v1.json    │  │  │
│  │  │ plotly       │ https://plotly.com/widget-spec.json        │  │  │
│  │  │ mcp-*        │ dynamic://mcp/[server-name]/capabilities   │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                               │                                         │
│  ┌───────────────────────────▼────────────────────────────────────┐    │
│  │                    LLM WIDGET ADAPTER                          │    │
│  │  ┌────────────────────────────────────────────────────────┐   │    │
│  │  │              SPEC INTERPRETER                          │   │    │
│  │  │  • Parse widget specification (JSON Schema/OpenAPI)    │   │    │
│  │  │  • Identify required props and callbacks               │   │    │
│  │  │  • Determine canvas compatibility                      │   │    │
│  │  │  • Generate React component wrapper                    │   │    │
│  │  └────────────────────────────────────────────────────────┘   │    │
│  │  ┌────────────────────────────────────────────────────────┐   │    │
│  │  │              INTEGRATION GENERATOR                     │   │    │
│  │  │  • Map widget API to canvas interaction model          │   │    │
│  │  │  • Generate event handlers (onClick, onData, etc.)     │   │    │
│  │  │  • Create state management bridge                      │   │    │
│  │  │  • Handle authentication and permissions               │   │    │
│  │  └────────────────────────────────────────────────────────┘   │    │
│  │  ┌────────────────────────────────────────────────────────┐   │    │
│  │  │              CANVAS ADAPTER                            │   │    │
│  │  │  • Wrap widget for specific canvas type               │   │    │
│  │  │  • Apply canvas constraints (size, permissions)        │   │    │
│  │  │  • Handle canvas-specific events (resize, focus)       │   │    │
│  │  │  • Manage widget lifecycle in canvas                   │   │    │
│  │  └────────────────────────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                               │                                         │
│  ┌───────────────────────────▼────────────────────────────────────┐    │
│  │                    WIDGET INSTANCE                             │    │
│  │  • Rendered React component                                    │    │
│  │  • Connected to external service                               │    │
│  │  • Operating within canvas constraints                         │    │
│  │  • Synchronized via YJS (if collaborative)                     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Interfaces

```typescript
/**
 * Widget Specification (provided by widget authors)
 */
interface WidgetSpec {
  // Metadata
  id: string;                           // Unique identifier
  name: string;                         // Human-readable name
  version: SemanticVersion;             // SemVer
  category: WidgetCategory;
  
  // Specification URL
  specUrl: string;                      // JSON Schema, OpenAPI, or custom spec
  
  // Canvas compatibility
  canvasTypes: CanvasType[] | 'all';    // Which canvases support this widget
  
  // Component rendering
  component: {
    type: 'iframe' | 'react' | 'web-component' | 'custom';
    url?: string;                       // For iframe/web-component
    module?: string;                    // For react (ESM module URL)
    fallback?: string;                  // Fallback component if load fails
  };
  
  // API integration
  api?: {
    baseUrl: string;
    authentication: 'api-key' | 'oauth' | 'none';
    endpoints: ApiEndpoint[];
  };
  
  // Required props (inputs to widget)
  props: PropDefinition[];
  
  // Emitted events (outputs from widget)
  events: EventDefinition[];
  
  // Permissions required
  permissions: Permission[];
  
  // Resource constraints
  constraints?: {
    maxWidth?: number;
    maxHeight?: number;
    maxMemoryMB?: number;
    requiresGPU?: boolean;
  };
  
  // Trust level
  trustLevel: 'internal' | 'verified' | 'community' | 'experimental';
  
  // Provider info
  provider: {
    name: string;
    url: string;
    supportEmail?: string;
  };
}

/**
 * Widget Instance (created when widget is added to canvas)
 */
interface WidgetInstance {
  id: string;                           // Unique instance ID
  widgetId: string;                     // Reference to WidgetSpec
  canvasId: string;                     // Which canvas this widget is in
  
  // Instance configuration
  config: {
    props: Record<string, any>;         // Configured prop values
    position?: { x: number; y: number }; // For node-embedded widgets
    size?: { width: number; height: number };
  };
  
  // Instance state
  state: {
    status: 'initializing' | 'ready' | 'error' | 'suspended';
    error?: string;
    lastActive: Date;
  };
  
  // Permissions (may be subset of requested)
  grantedPermissions: Permission[];
  
  // Created by
  createdBy: string;                    // User or agent ID
  createdAt: Date;
}

/**
 * Widget Registry Interface
 */
interface WidgetRegistry {
  /**
   * Register a widget by specification URL
   */
  register(specUrl: string): Promise<WidgetSpec>;
  
  /**
   * Get widget specification
   */
  getSpec(widgetId: string): WidgetSpec | undefined;
  
  /**
   * List widgets compatible with canvas type
   */
  getCompatibleWidgets(canvasType: CanvasType): WidgetSpec[];
  
  /**
   * Search widgets by category or keyword
   */
  search(query: WidgetSearchQuery): WidgetSpec[];
  
  /**
   * Refresh widget spec from URL
   */
  refresh(widgetId: string): Promise<void>;
  
  /**
   * Unregister a widget
   */
  unregister(widgetId: string): void;
}

/**
 * Widget Adapter Interface
 */
interface WidgetAdapter {
  /**
   * Interpret widget spec and generate integration code
   */
  interpretSpec(spec: WidgetSpec): Promise<InterpretationResult>;
  
  /**
   * Generate React component wrapper for widget
   */
  generateComponent(
    spec: WidgetSpec,
    canvasType: CanvasType
  ): Promise<ReactComponent>;
  
  /**
   * Validate widget compatibility with canvas
   */
  validateCompatibility(
    spec: WidgetSpec,
    canvasType: CanvasType
  ): CompatibilityResult;
  
  /**
   * Map widget events to canvas actions
   */
  mapEvents(
    spec: WidgetSpec,
    canvasActions: CanvasActionRegistry
  ): EventMapping[];
}

/**
 * Prop and Event Definitions
 */
interface PropDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function';
  required: boolean;
  description: string;
  default?: any;
  validation?: JsonSchema;
}

interface EventDefinition {
  name: string;
  description: string;
  payload: JsonSchema;
}

interface Permission {
  type: 'network' | 'storage' | 'camera' | 'microphone' | 'clipboard' | 'notifications';
  scope?: string; // e.g., 'https://api.example.com/*'
  rationale: string; // Why this permission is needed
}
```

### 2.3 LLM-Powered Spec Interpretation

```typescript
/**
 * LLM Widget Interpreter - Understands widget specs and generates integrations
 */
class LLMWidgetInterpreter {
  constructor(
    private llmProvider: LLMProvider,
    private cache: InterpretationCache
  ) {}

  /**
   * Interpret widget specification and generate integration code
   */
  async interpretSpec(spec: WidgetSpec): Promise<InterpretationResult> {
    // Check cache first
    const cached = this.cache.get(spec.id, spec.version);
    if (cached) return cached;
    
    // Fetch full spec from URL
    const fullSpec = await this.fetchSpec(spec.specUrl);
    
    // Build interpretation prompt
    const prompt = this.buildInterpretationPrompt(spec, fullSpec);
    
    // Execute LLM reasoning
    const response = await this.llmProvider.complete(prompt, {
      maxTokens: 8192,
      temperature: 0.1,  // Low temp for deterministic code generation
      responseFormat: 'json'
    });
    
    // Validate generated integration
    const validated = await this.validateIntegration(response.result);
    
    // Cache successful interpretation
    if (validated.valid) {
      this.cache.store(spec.id, spec.version, validated.result);
    }
    
    return validated.result;
  }

  /**
   * Build LLM prompt for widget interpretation
   */
  private buildInterpretationPrompt(
    spec: WidgetSpec,
    fullSpec: any
  ): string {
    return `
You are a widget integration expert for the Chrysalis Terminal canvas system.
Interpret the following widget specification and generate integration code.

## Widget Specification
\`\`\`json
${JSON.stringify(fullSpec, null, 2)}
\`\`\`

## Canvas Integration Points
Available canvas actions:
- createNode(type, data): Create a new node
- updateNode(id, data): Update node data
- deleteNode(id): Delete a node
- emitEvent(type, payload): Emit canvas event
- queryData(query): Query canvas data
- updateState(key, value): Update widget state

Available canvas props:
- canvasId: Current canvas ID
- canvasType: Canvas type (board, scrapbook, research, etc.)
- permissions: Granted permissions
- theme: Current theme settings
- onResize: Canvas resize callback

## Task
Generate:
1. React component wrapper code
2. Prop mapping (widget props → canvas props)
3. Event mapping (widget events → canvas actions)
4. State management integration
5. Error handling and fallbacks
6. Type definitions (TypeScript)

## Response Format
Return JSON with:
- componentCode: React component code (TypeScript)
- propMappings: Array of {widgetProp, canvasProp, transform}
- eventMappings: Array of {widgetEvent, canvasAction, transform}
- stateSchema: JSON Schema for widget state
- dependencies: Array of required npm packages
- warnings: Any compatibility issues
`;
  }
}
```

---

## 3. Widget Registry System

### 3.1 Widget Registration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  WIDGET REGISTRATION FLOW                        │
└─────────────────────────────────────────────────────────────────┘

1. Widget Provider publishes spec
   │
   └─→ https://provider.com/widgets/my-widget/spec.json
       {
         "id": "my-widget",
         "name": "My Awesome Widget",
         "specUrl": "https://provider.com/widgets/my-widget/spec.json",
         "component": {
           "type": "react",
           "module": "https://cdn.provider.com/my-widget@1.0.0.js"
         },
         "canvasTypes": ["board", "scrapbook"],
         ...
       }

2. User/Admin registers widget in Chrysalis
   │
   └─→ Settings > Widgets > Add Widget
       - Enter spec URL
       - Review permissions
       - Approve installation

3. Widget Registry fetches and validates spec
   │
   ├─→ Fetch spec from URL
   ├─→ Validate JSON Schema
   ├─→ Check security constraints
   └─→ Store in registry

4. LLM interprets spec and generates integration
   │
   ├─→ Parse widget API
   ├─→ Generate React wrapper
   ├─→ Map events to canvas actions
   └─→ Cache interpretation

5. Widget becomes available in compatible canvases
   │
   └─→ Shows in widget palette
       User can add to canvas
```

### 3.2 Widget Registry Implementation

```typescript
/**
 * Widget Registry - Manages registered widgets
 */
class WidgetRegistryImpl implements WidgetRegistry {
  private specs: Map<string, WidgetSpec> = new Map();
  private interpreter: LLMWidgetInterpreter;
  private loader: SpecLoader;

  constructor(interpreter: LLMWidgetInterpreter, loader: SpecLoader) {
    this.interpreter = interpreter;
    this.loader = loader;
    this.initializeBuiltInWidgets();
  }

  /**
   * Initialize built-in widgets
   */
  private initializeBuiltInWidgets(): void {
    // Markdown widget (internal)
    this.specs.set('markdown', {
      id: 'markdown',
      name: 'Markdown Viewer',
      version: { major: 1, minor: 0, patch: 0 },
      category: 'document',
      specUrl: 'internal://chrysalis/widgets/markdown',
      canvasTypes: 'all',
      component: { type: 'react', module: './widgets/MarkdownWidget' },
      props: [
        { name: 'content', type: 'string', required: true, description: 'Markdown content' }
      ],
      events: [],
      permissions: [],
      trustLevel: 'internal',
      provider: { name: 'Chrysalis', url: 'https://chrysalis.ai' }
    });

    // Code viewer (internal)
    this.specs.set('code', {
      id: 'code',
      name: 'Code Viewer',
      version: { major: 1, minor: 0, patch: 0 },
      category: 'development',
      specUrl: 'internal://chrysalis/widgets/code',
      canvasTypes: 'all',
      component: { type: 'react', module: './widgets/CodeWidget' },
      props: [
        { name: 'code', type: 'string', required: true, description: 'Code content' },
        { name: 'language', type: 'string', required: false, description: 'Language for syntax highlighting' }
      ],
      events: [],
      permissions: [],
      trustLevel: 'internal',
      provider: { name: 'Chrysalis', url: 'https://chrysalis.ai' }
    });

    // Chart widget (internal)
    this.specs.set('chart', {
      id: 'chart',
      name: 'Chart Widget',
      version: { major: 1, minor: 0, patch: 0 },
      category: 'visualization',
      specUrl: 'internal://chrysalis/widgets/chart',
      canvasTypes: ['board', 'research', 'curation'],
      component: { type: 'react', module: './widgets/ChartWidget' },
      props: [
        { name: 'data', type: 'array', required: true, description: 'Chart data' },
        { name: 'type', type: 'string', required: true, description: 'Chart type (line, bar, pie)' }
      ],
      events: [
        { name: 'onDataPointClick', description: 'Fired when data point is clicked', payload: {} }
      ],
      permissions: [],
      trustLevel: 'internal',
      provider: { name: 'Chrysalis', url: 'https://chrysalis.ai' }
    });
  }

  /**
   * Register widget from specification URL
   */
  async register(specUrl: string): Promise<WidgetSpec> {
    // Fetch spec
    const spec = await this.loader.load(specUrl);
    
    // Validate spec schema
    const validation = this.validateSpec(spec);
    if (!validation.valid) {
      throw new Error(`Invalid widget spec: ${validation.errors.join(', ')}`);
    }
    
    // Check security
    const securityCheck = await this.checkSecurity(spec);
    if (!securityCheck.approved) {
      throw new Error(`Security check failed: ${securityCheck.reason}`);
    }
    
    // Interpret spec with LLM
    const interpretation = await this.interpreter.interpretSpec(spec);
    if (!interpretation.success) {
      throw new Error(`Failed to interpret spec: ${interpretation.error}`);
    }
    
    // Store in registry
    this.specs.set(spec.id, spec);
    
    return spec;
  }

  /**
   * Get widgets compatible with canvas type
   */
  getCompatibleWidgets(canvasType: CanvasType): WidgetSpec[] {
    return Array.from(this.specs.values()).filter(spec =>
      spec.canvasTypes === 'all' || spec.canvasTypes.includes(canvasType)
    );
  }

  /**
   * Search widgets
   */
  search(query: WidgetSearchQuery): WidgetSpec[] {
    let results = Array.from(this.specs.values());
    
    if (query.category) {
      results = results.filter(s => s.category === query.category);
    }
    
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(s =>
        s.name.toLowerCase().includes(keyword) ||
        s.id.toLowerCase().includes(keyword)
      );
    }
    
    if (query.canvasType) {
      results = results.filter(s =>
        s.canvasTypes === 'all' || s.canvasTypes.includes(query.canvasType!)
      );
    }
    
    return results;
  }
}
```

---

## 4. Canvas-Widget Integration

### 4.1 Widget Palette UI

Each canvas type has a widget palette that shows compatible widgets:

```typescript
/**
 * Widget Palette Component
 */
function WidgetPalette({ canvasType }: { canvasType: CanvasType }) {
  const registry = useWidgetRegistry();
  const compatibleWidgets = registry.getCompatibleWidgets(canvasType);
  
  const handleAddWidget = async (widgetSpec: WidgetSpec) => {
    // Create widget instance
    const instance = await createWidgetInstance(widgetSpec, canvasType);
    
    // Add to canvas
    addWidgetToCanvas(instance);
  };
  
  return (
    <div className={styles.widgetPalette}>
      <h3>Available Widgets</h3>
      <div className={styles.widgetGrid}>
        {compatibleWidgets.map(spec => (
          <WidgetCard
            key={spec.id}
            spec={spec}
            onAdd={() => handleAddWidget(spec)}
          />
        ))}
      </div>
    </div>
  );
}
```

### 4.2 Canvas-Specific Widget Implementations

**Board Canvas** (React Flow nodes):
```typescript
// Widget rendered as custom node type
const WidgetNode = ({ data }: NodeProps<WidgetNodeData>) => {
  const widgetInstance = data.widgetInstance;
  const WidgetComponent = useWidgetComponent(widgetInstance.widgetId);
  
  return (
    <div className="widget-node">
      <Handle type="target" position={Position.Left} />
      <div className="widget-container">
        <WidgetComponent
          {...widgetInstance.config.props}
          canvasId={data.canvasId}
          onEvent={(event) => handleWidgetEvent(widgetInstance.id, event)}
        />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};
```

**Scrapbook/Curation Canvas** (embedded in item cards):
```typescript
// Widget rendered within artifact card
function ArtifactCard({ artifact }: { artifact: CuratedArtifact }) {
  const widgetSpec = getWidgetForArtifactType(artifact.type);
  const WidgetComponent = useWidgetComponent(widgetSpec?.id);
  
  if (!WidgetComponent) {
    return <DefaultArtifactView artifact={artifact} />;
  }
  
  return (
    <Card>
      <CardHeader>{artifact.title}</CardHeader>
      <CardBody>
        <WidgetComponent
          data={artifact.file || artifact.url}
          {...widgetSpec.defaultProps}
        />
      </CardBody>
    </Card>
  );
}
```

**Research Canvas** (embedded in documents):
```typescript
// Widget embedded in markdown via shortcode
// Example: [widget:chart data="./data.json" type="bar"]

function DocumentRenderer({ document }: { document: ResearchDocument }) {
  const processedContent = parseWidgetShortcodes(document.content);
  
  return (
    <MarkdownRenderer>
      {processedContent.map((block, i) => {
        if (block.type === 'widget') {
          const WidgetComponent = useWidgetComponent(block.widgetId);
          return <WidgetComponent key={i} {...block.props} />;
        }
        return <MarkdownBlock key={i} content={block.content} />;
      })}
    </MarkdownRenderer>
  );
}
```

**Media Canvas** (tools and effects):
```typescript
// Widgets as media processing tools
function MediaCanvas() {
  const [activeFile, setActiveFile] = useState<MediaFile | null>(null);
  const toolWidgets = useWidgetsByCategory('media');
  
  return (
    <div className="media-canvas">
      <ToolPanel>
        {toolWidgets.map(spec => (
          <ToolButton
            key={spec.id}
            icon={spec.icon}
            label={spec.name}
            onClick={() => applyWidgetToMedia(spec, activeFile)}
          />
        ))}
      </ToolPanel>
      <MediaEditor file={activeFile} />
    </div>
  );
}
```

---

## 5. MCP Integration Strategy

### 5.1 MCP as Special Widget Type

Model Context Protocol (MCP) servers are treated as a special category of widgets that provide **tools** rather than UI components.

```typescript
/**
 * MCP Widget Specification
 */
interface MCPWidgetSpec extends WidgetSpec {
  category: 'mcp-tool';
  
  // MCP-specific fields
  mcp: {
    serverUrl: string;              // MCP server endpoint
    capabilities: MCPCapabilities;  // What tools this MCP provides
    tools: MCPToolDefinition[];     // Available tools
  };
  
  // Canvas integration
  canvasIntegration: {
    mode: 'agent-accessible' | 'ui-widget' | 'both';
    // If 'ui-widget', how to render tool invocation UI
    uiComponent?: {
      type: 'form' | 'command-palette' | 'custom';
      config: any;
    };
  };
}

/**
 * MCP Tool as Widget
 */
interface MCPToolWidget {
  id: string;
  mcpServerId: string;
  toolName: string;
  
  // Generated from MCP tool schema
  inputs: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
  
  // How to display in canvas
  renderAs: 'button' | 'form' | 'command' | 'auto';
}
```

### 5.2 MCP Discovery and Registration

```typescript
/**
 * MCP Server Registry
 */
class MCPRegistry {
  /**
   * Discover MCP server and register its tools as widgets
   */
  async registerMCPServer(serverUrl: string): Promise<void> {
    // 1. Connect to MCP server
    const client = await this.connectToMCP(serverUrl);
    
    // 2. Discover capabilities
    const capabilities = await client.getCapabilities();
    
    // 3. Get tool list
    const tools = await client.listTools();
    
    // 4. For each tool, create a widget spec
    for (const tool of tools) {
      const widgetSpec: MCPWidgetSpec = {
        id: `mcp:${tool.name}`,
        name: tool.displayName || tool.name,
        version: { major: 1, minor: 0, patch: 0 },
        category: 'mcp-tool',
        specUrl: `dynamic://mcp/${serverUrl}/${tool.name}`,
        canvasTypes: this.determineCanvasCompatibility(tool),
        component: {
          type: 'custom',
          // LLM will generate UI based on tool schema
        },
        props: this.convertMCPInputsToProps(tool.inputSchema),
        events: [
          {
            name: 'onToolComplete',
            description: 'Fired when MCP tool execution completes',
            payload: { type: 'object' }
          }
        ],
        permissions: this.determineMCPPermissions(tool),
        trustLevel: 'experimental',
        provider: {
          name: 'MCP Server',
          url: serverUrl
        },
        mcp: {
          serverUrl,
          capabilities,
          tools: [tool]
        }
      };
      
      // Register with widget registry
      await this.widgetRegistry.register(widgetSpec.specUrl);
    }
  }
  
  /**
   * Determine which canvases can use this MCP tool
   */
  private determineCanvasCompatibility(tool: MCPToolDefinition): CanvasType[] {
    // Use LLM to analyze tool and suggest compatible canvases
    const prompt = `
Analyze this MCP tool and determine which Chrysalis canvas types would benefit from it.

Canvas types:
- board: General-purpose node workspace
- scrapbook: Media collection
- research: Documentation and knowledge
- scenarios: Future planning
- curation: Domain research library
- media: Audio/video/image editing

Tool:
${JSON.stringify(tool, null, 2)}

Return array of compatible canvas types.
`;
    
    // Execute LLM query
    // Return compatible canvas types
  }
}
```

### 5.3 MCP Tool Invocation in Canvas

```typescript
/**
 * MCP Tool Widget Component
 */
function MCPToolWidget({ toolSpec, onComplete }: {
  toolSpec: MCPToolWidget;
  onComplete: (result: any) => void;
}) {
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  
  const handleExecute = async () => {
    setIsExecuting(true);
    
    try {
      // Connect to MCP server
      const client = await connectToMCP(toolSpec.mcpServerId);
      
      // Execute tool
      const result = await client.callTool(toolSpec.toolName, inputs);
      
      // Pass result back to canvas
      onComplete(result);
    } catch (error) {
      console.error('MCP tool execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };
  
  return (
    <div className="mcp-tool-widget">
      <h4>{toolSpec.toolName}</h4>
      <form onSubmit={(e) => { e.preventDefault(); handleExecute(); }}>
        {toolSpec.inputs.map(input => (
          <Input
            key={input.name}
            label={input.name}
            type={input.type}
            required={input.required}
            onChange={(value) => setInputs({ ...inputs, [input.name]: value })}
          />
        ))}
        <Button type="submit" disabled={isExecuting}>
          {isExecuting ? 'Executing...' : 'Run Tool'}
        </Button>
      </form>
    </div>
  );
}
```

---

## 6. Widget Lifecycle

### 6.1 Lifecycle States

```
┌─────────────────────────────────────────────────────────────────┐
│                     WIDGET LIFECYCLE                             │
└─────────────────────────────────────────────────────────────────┘

1. REGISTERED
   │ Widget spec added to registry
   │ Available in widget palette
   │
   └─→ User clicks "Add Widget"

2. INITIALIZING
   │ Creating widget instance
   │ Loading component code
   │ Setting up connections
   │
   └─→ Permissions granted, code loaded

3. READY
   │ Widget is rendered and interactive
   │ Can receive events and emit outputs
   │
   ├─→ User interacts with widget
   │   └─→ ACTIVE
   │
   ├─→ Canvas loses focus
   │   └─→ SUSPENDED (resources paused)
   │
   └─→ Widget removed from canvas
       └─→ DISPOSED

4. ERROR
   │ Widget failed to load or crashed
   │ Show error state and retry option
   │
   └─→ User clicks "Retry"
       └─→ INITIALIZING

5. DISPOSED
   │ Widget removed from canvas
   │ Resources cleaned up
   │ State optionally saved
   │
   └─→ End
```

### 6.2 Resource Management

```typescript
/**
 * Widget Resource Manager
 */
class WidgetResourceManager {
  private activeWidgets: Map<string, WidgetInstance> = new Map();
  private resourceLimits = {
    maxWidgetsPerCanvas: 20,
    maxMemoryMB: 512,
    maxNetworkRequests: 100
  };
  
  /**
   * Suspend inactive widgets to free resources
   */
  async suspendInactiveWidgets(canvasId: string): Promise<void> {
    const widgets = this.getCanvasWidgets(canvasId);
    const now = Date.now();
    
    for (const widget of widgets) {
      const inactiveMs = now - widget.state.lastActive.getTime();
      
      // Suspend if inactive for > 5 minutes
      if (inactiveMs > 5 * 60 * 1000 && widget.state.status === 'ready') {
        await this.suspendWidget(widget.id);
      }
    }
  }
  
  /**
   * Resume suspended widget when user focuses it
   */
  async resumeWidget(widgetId: string): Promise<void> {
    const widget = this.activeWidgets.get(widgetId);
    if (!widget || widget.state.status !== 'suspended') return;
    
    // Reload widget component
    await this.loadWidgetComponent(widget);
    
    // Restore widget state
    await this.restoreWidgetState(widget);
    
    widget.state.status = 'ready';
    widget.state.lastActive = new Date();
  }
}
```

---

## 7. Implementation Phases

### Phase 1: Widget Foundation (Week 1-2)

**Week 1: Core Infrastructure**
```
Days 1-2: Widget Registry
├── Define TypeScript interfaces
├── Implement WidgetRegistry class
├── Create WidgetSpec schema validation
└── Add built-in widgets (markdown, code, chart)

Days 3-4: LLM Widget Adapter
├── Implement LLMWidgetInterpreter
├── Create spec interpretation prompts
├── Build component generation logic
└── Add interpretation caching

Day 5: Testing & Integration
├── Unit tests for registry
├── Integration tests for LLM adapter
└── Performance benchmarks
```

**Week 2: Canvas Integration**
```
Days 1-2: Widget Palette UI
├── Create WidgetPalette component
├── Implement widget search/filter
├── Add widget installation flow
└── Build widget configuration UI

Days 3-4: Canvas-Specific Adapters
├── Board Canvas widget nodes
├── Research Canvas embedded widgets
├── Scrapbook Canvas widget cards
└── Media Canvas tool widgets

Day 5: Widget Lifecycle
├── Resource management
├── Suspend/resume logic
├── Error handling
└── State persistence
```

### Phase 2: MCP Integration (Week 3)

```
Days 1-2: MCP Registry
├── MCP server discovery
├── Tool-to-widget conversion
├── MCP client integration
└── Capability mapping

Days 3-4: MCP Tool Widgets
├── Auto-generated tool UI
├── Tool invocation handling
├── Result processing
└── Canvas integration

Day 5: Testing & Documentation
├── E2E tests with real MCP servers
├── Documentation for MCP providers
└── Example MCP widgets
```

### Phase 3: Advanced Features (Week 4)

```
Days 1-2: External Widget Providers
├── Third-party widget registration
├── Security sandboxing (iframes)
├── Permission management
└── Trust levels

Days 3-4: Widget Marketplace (Optional)
├── Widget discovery UI
├── Installation wizard
├── Update notifications
└── Community widgets

Day 5: Polish & Launch
├── Performance optimization
├── Accessibility audit
├── Documentation
└── Launch
```

**Total Timeline**: 4 weeks for full widget system

---

## 8. Security & Sandboxing

### 8.1 Security Model

```typescript
/**
 * Widget Security Levels
 */
enum WidgetTrustLevel {
  INTERNAL = 'internal',      // Built by Chrysalis team
  VERIFIED = 'verified',      // Reviewed and approved
  COMMUNITY = 'community',    // Community-contributed
  EXPERIMENTAL = 'experimental' // Untrusted, requires explicit approval
}

/**
 * Security Constraints by Trust Level
 */
const SECURITY_CONSTRAINTS: Record<WidgetTrustLevel, SecurityPolicy> = {
  [WidgetTrustLevel.INTERNAL]: {
    sandbox: false,
    networkAccess: 'unrestricted',
    storageQuota: 'unlimited',
    requiresApproval: false
  },
  [WidgetTrustLevel.VERIFIED]: {
    sandbox: false,
    networkAccess: 'allowlist',
    storageQuota: '100MB',
    requiresApproval: false
  },
  [WidgetTrustLevel.COMMUNITY]: {
    sandbox: true,
    networkAccess: 'allowlist',
    storageQuota: '10MB',
    requiresApproval: true
  },
  [WidgetTrustLevel.EXPERIMENTAL]: {
    sandbox: true,
    networkAccess: 'explicit-permission',
    storageQuota: '1MB',
    requiresApproval: true
  }
};
```

### 8.2 Iframe Sandboxing

For untrusted widgets, use iframe sandbox:

```typescript
/**
 * Sandboxed Widget Container
 */
function SandboxedWidget({ widgetSpec, config }: {
  widgetSpec: WidgetSpec;
  config: WidgetConfig;
}) {
  const sandboxPolicy = SECURITY_CONSTRAINTS[widgetSpec.trustLevel];
  
  return (
    <iframe
      src={widgetSpec.component.url}
      sandbox={[
        'allow-scripts',
        sandboxPolicy.networkAccess === 'allowlist' ? 'allow-same-origin' : '',
        config.permissions.includes('forms') ? 'allow-forms' : '',
        config.permissions.includes('popups') ? 'allow-popups' : ''
      ].filter(Boolean).join(' ')}
      allow={[
        config.permissions.includes('camera') ? 'camera' : '',
        config.permissions.includes('microphone') ? 'microphone' : ''
      ].filter(Boolean).join('; ')}
      style={{
        width: config.size.width,
        height: config.size.height,
        border: 'none'
      }}
    />
  );
}
```

---

## Appendix A: Widget Specification Example

### Runway Gen-2 Video Generation Widget

```json
{
  "id": "runway-gen2",
  "name": "Runway Gen-2 Video Generator",
  "version": { "major": 1, "minor": 0, "patch": 0 },
  "category": "ai-generation",
  "specUrl": "https://api.runwayml.com/widgets/gen2/spec.json",
  "canvasTypes": ["remixer", "media"],
  
  "component": {
    "type": "react",
    "module": "https://cdn.runwayml.com/widgets/gen2@1.0.0.js"
  },
  
  "api": {
    "baseUrl": "https://api.runwayml.com/v1",
    "authentication": "api-key",
    "endpoints": [
      {
        "name": "generate",
        "method": "POST",
        "path": "/generate/gen2",
        "rateLimit": "10/hour"
      }
    ]
  },
  
  "props": [
    {
      "name": "prompt",
      "type": "string",
      "required": true,
      "description": "Text prompt for video generation"
    },
    {
      "name": "duration",
      "type": "number",
      "required": false,
      "default": 4,
      "description": "Video duration in seconds (1-16)"
    },
    {
      "name": "style",
      "type": "string",
      "required": false,
      "description": "Style preset"
    }
  ],
  
  "events": [
    {
      "name": "onGenerationComplete",
      "description": "Fired when video generation completes",
      "payload": {
        "type": "object",
        "properties": {
          "videoUrl": { "type": "string" },
          "thumbnailUrl": { "type": "string" },
          "duration": { "type": "number" }
        }
      }
    }
  ],
  
  "permissions": [
    {
      "type": "network",
      "scope": "https://api.runwayml.com/*",
      "rationale": "Required to call Runway API for video generation"
    },
    {
      "type": "storage",
      "scope": "temp",
      "rationale": "Store generation results temporarily"
    }
  ],
  
  "constraints": {
    "maxWidth": 800,
    "maxHeight": 600
  },
  
  "trustLevel": "verified",
  
  "provider": {
    "name": "Runway",
    "url": "https://runwayml.com",
    "supportEmail": "support@runwayml.com"
  }
}
```

---

## Appendix B: File Structure

```
ui/src/
├── widgets/
│   ├── registry/
│   │   ├── WidgetRegistry.ts          # Widget registry implementation
│   │   ├── WidgetSpec.ts              # Widget spec types
│   │   ├── SpecLoader.ts              # Fetch specs from URLs
│   │   └── SpecValidator.ts           # Validate widget specs
│   │
│   ├── adapter/
│   │   ├── LLMWidgetAdapter.ts        # LLM-powered widget adapter
│   │   ├── WidgetInterpreter.ts       # Spec interpretation
│   │   ├── ComponentGenerator.ts      # Generate React wrappers
│   │   └── InterpretationCache.ts     # Cache interpretations
│   │
│   ├── runtime/
│   │   ├── WidgetContainer.tsx        # Widget container component
│   │   ├── WidgetLoader.tsx           # Dynamic component loading
│   │   ├── WidgetSandbox.tsx          # Iframe sandbox
│   │   └── WidgetResourceManager.ts   # Resource management
│   │
│   ├── mcp/
│   │   ├── MCPRegistry.ts             # MCP server registry
│   │   ├── MCPClient.ts               # MCP protocol client
│   │   ├── MCPToolWidget.tsx          # MCP tool UI generator
│   │   └── MCPDiscovery.ts            # Auto-discover MCP tools
│   │
│   ├── built-in/
│   │   ├── MarkdownWidget.tsx         # Built-in markdown widget
│   │   ├── CodeWidget.tsx             # Built-in code widget
│   │   ├── ChartWidget.tsx            # Built-in chart widget
│   │   └── index.ts                   # Exports
│   │
│   └── ui/
│       ├── WidgetPalette.tsx          # Widget selection UI
│       ├── WidgetCard.tsx             # Widget info card
│       ├── WidgetConfigDialog.tsx     # Widget configuration
│       └── WidgetInstaller.tsx        # Widget installation flow
│
└── components/Canvas/
    └── [Each canvas type]/
        └── widgets/                    # Canvas-specific widget integration
            ├── WidgetNode.tsx          # For Board Canvas
            ├── EmbeddedWidget.tsx      # For Research/Curation
            └── ToolWidget.tsx          # For Media Canvas
```

---

**End of Document**

**Version**: 1.0  
**Status**: Design Specification  
**Next Steps**: Review and approval, begin Phase 1 implementation