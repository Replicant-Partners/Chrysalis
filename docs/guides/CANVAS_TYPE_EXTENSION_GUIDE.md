# Canvas Type Extension Guide

**For:** Developers creating new canvas types or extending existing ones
**Prerequisites:** Completed the [Widget Developer Guide](./WIDGET_DEVELOPER_GUIDE.md)

---

## What is a Canvas Type?

A canvas type defines a workspace with:
- **Purpose** - What problem does this canvas solve?
- **Allowed widgets** - Which widgets can be placed here?
- **Behavior rules** - How do widgets interact?
- **Layout constraints** - Grid, snapping, grouping rules
- **Execution model** - Background behavior, resource limits

Built-in canvas types:
- **Settings** - System management and configuration
- **Agent** - Managing internal agent teams
- **Scrapbook** - Content collection when organization unclear
- **Research** - Structured information synthesis
- **Wiki** - MediaWiki knowledgebase
- **Terminal-Browser** - Combined terminal and browser workspace
- **Board** - General workflows and planning
- **Scrapbook** - Content collection
- **Research** - Information synthesis
- **Terminal-Browser** - Development tools

---

## Extending an Existing Canvas Type

### Adding Widgets to a Canvas

The simplest extension - allow your widget on an existing canvas:

```typescript
// In your widget definition
export const MyWidget: WidgetDefinition = {
  typeId: '@my-org/task-tracker',

  // Add to existing canvas types
  supportedCanvases: ['agent', 'scrapbook'],

  // ...rest of definition
};
```

### Restricting Widgets

Create a filtered version of an existing canvas:

```typescript
import { getCanvasRegistry, getWidgetRegistry } from '@chrysalis/canvas';

const canvasRegistry = getCanvasRegistry();
const widgetRegistry = getWidgetRegistry();

// Create a filtered Agent canvas that only allows certain widgets
canvasRegistry.registerVariant('agent', {
  variantId: 'board/minimal',
  name: 'Minimal Board',
  description: 'A focused board with only card and note widgets',

  // Override widget filter
  widgetFilter: (widget) => {
    return ['board/card', 'scrapbook/note'].includes(widget.typeId);
  },
});
```

### Changing Default Behavior

Override canvas configuration:

```typescript
canvasRegistry.registerVariant('board', {
  variantId: 'board/strict-grid',
  name: 'Strict Grid Board',

  // Override layout config
  layoutOverrides: {
    grid: {
      enabled: true,
      size: 40,        // Larger grid
      visible: true,
      snapThreshold: 20,
    },
    collision: {
      enabled: true,
      mode: 'prevent',  // Block overlaps instead of push
    },
  },

  // Override execution config
  executionOverrides: {
    allowBackground: false,  // Always suspend when hidden
  },
});
```

---

## Creating a New Canvas Type

### Step 1: Define the Canvas Type

```typescript
import type { CanvasTypeDefinition } from '@chrysalis/canvas';

export const KanbanCanvasType: CanvasTypeDefinition = {
  // Unique identifier
  kind: 'kanban',

  // Display info
  name: 'Kanban Board',
  description: 'Organize work in columns with drag-and-drop cards',
  icon: '📊',

  // What widgets are allowed?
  widgetFilter: {
    // Explicit allowlist
    allowed: [
      'kanban/column',
      'kanban/card',
      'scrapbook/note',  // Reuse existing widget
    ],

    // Or use a function for dynamic filtering
    // filter: (widget) => widget.category === 'kanban' || widget.typeId === 'scrapbook/note',
  },

  // Layout configuration
  layout: {
    grid: {
      enabled: true,
      size: 20,
      visible: false,  // Hide grid dots
      snapThreshold: 10,
    },
    collision: {
      enabled: true,
      mode: 'push',
      padding: 16,
    },
    bounds: {
      // Kanban is horizontally infinite
      minX: 0,
      maxX: Infinity,
      minY: 0,
      maxY: 2000,  // Limited height
    },
  },

  // Execution model
  execution: {
    allowBackground: true,
    backgroundTimeoutMs: 300000,  // 5 minutes
    hibernateTimeoutMs: 0,        // Never hibernate
    priority: 5,
  },

  // Connection rules
  connections: {
    allowConnections: false,  // Kanban uses containment, not connections
    connectionTypes: [],
  },

  // Special behaviors
  behaviors: {
    // Columns auto-arrange horizontally
    autoArrange: {
      enabled: true,
      direction: 'horizontal',
      gap: 20,
      targetWidgetTypes: ['kanban/column'],
    },

    // Cards can only exist inside columns
    containment: {
      'kanban/card': {
        mustBeInside: ['kanban/column'],
        canContain: [],
      },
      'kanban/column': {
        mustBeInside: null,  // Can be at root
        canContain: ['kanban/card', 'scrapbook/note'],
      },
    },
  },

  // Default state for new canvas
  defaultState: {
    nodes: [
      // Start with 3 columns
      {
        id: 'col-todo',
        type: 'kanban/column',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 600 },
        data: { title: 'To Do', color: '#89b4fa' },
      },
      {
        id: 'col-doing',
        type: 'kanban/column',
        position: { x: 320, y: 0 },
        size: { width: 300, height: 600 },
        data: { title: 'In Progress', color: '#f9e2af' },
      },
      {
        id: 'col-done',
        type: 'kanban/column',
        position: { x: 640, y: 0 },
        size: { width: 300, height: 600 },
        data: { title: 'Done', color: '#a6e3a1' },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};
```

### Step 2: Register the Canvas Type

```typescript
import { getCanvasRegistry } from '@chrysalis/canvas';
import { KanbanCanvasType } from './kanban-canvas';

const registry = getCanvasRegistry();
registry.register(KanbanCanvasType);
```

### Step 3: Create Required Widgets

Your canvas probably needs custom widgets:

```typescript
// kanban/column widget
export const KanbanColumnWidget: WidgetDefinition<ColumnData> = {
  typeId: 'kanban/column',
  name: 'Column',
  supportedCanvases: ['kanban'],

  capabilities: {
    canResize: true,
    canMove: true,
    canDelete: true,
    canNest: true,        // Can contain cards
    canConnect: false,
  },

  // ...rest
};

// kanban/card widget
export const KanbanCardWidget: WidgetDefinition<CardData> = {
  typeId: 'kanban/card',
  name: 'Card',
  supportedCanvases: ['kanban'],

  capabilities: {
    canResize: false,     // Cards have fixed width
    canMove: true,
    canDelete: true,
    canNest: false,
    canConnect: false,
  },

  constraints: {
    // Card width matches column
    widthMode: 'fill-parent',
    heightMode: 'content',
  },

  // ...rest
};
```

---

## Canvas Type Definition Reference

### Core Fields

```typescript
interface CanvasTypeDefinition {
  // Identity
  kind: string;              // Unique identifier
  name: string;              // Display name
  description: string;       // Purpose
  icon: string;              // Emoji or icon URL

  // Widget allowlist
  widgetFilter: {
    allowed?: string[];      // Explicit list
    blocked?: string[];      // Blocklist (if no allowed)
    filter?: (w: WidgetDefinition) => boolean;  // Dynamic
  };

  // Layout rules
  layout: LayoutConfig;

  // Execution model
  execution: ExecutionConfig;

  // Connection rules
  connections: ConnectionConfig;

  // Special behaviors
  behaviors: BehaviorConfig;

  // Initial state
  defaultState: CanvasState;
}
```

### Layout Configuration

```typescript
interface LayoutConfig {
  grid: {
    enabled: boolean;
    size: number;           // Pixels
    visible: boolean;       // Show grid dots
    snapThreshold: number;  // Snap distance
    subdivisions?: number;  // Minor grid lines
  };

  collision: {
    enabled: boolean;
    mode: 'push' | 'prevent' | 'overlap';
    padding: number;        // Minimum gap between widgets
  };

  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };

  zoom?: {
    min: number;            // e.g., 0.1
    max: number;            // e.g., 2.0
    default: number;        // e.g., 1.0
  };
}
```

### Execution Configuration

```typescript
interface ExecutionConfig {
  // Can this canvas run in background?
  allowBackground: boolean;

  // Auto-suspend after this time in background (ms, 0 = never)
  backgroundTimeoutMs: number;

  // Auto-hibernate after this time suspended (ms, 0 = never)
  hibernateTimeoutMs: number;

  // Priority for resource allocation (1-10)
  priority: number;

  // Resource limits when in background
  backgroundBudget?: {
    maxMemoryMB: number;
    maxCpuMsPerSecond: number;
    maxConcurrentTasks: number;
  };
}
```

### Connection Configuration

```typescript
interface ConnectionConfig {
  // Allow connections between widgets?
  allowConnections: boolean;

  // What types of connections?
  connectionTypes: Array<{
    id: string;
    name: string;
    color: string;
    animated?: boolean;
  }>;

  // Validation rules
  rules?: Array<{
    from: string | string[];  // Widget typeIds
    to: string | string[];
    connectionType: string;
    maxConnections?: number;
  }>;
}
```

### Behavior Configuration

```typescript
interface BehaviorConfig {
  // Auto-arrangement
  autoArrange?: {
    enabled: boolean;
    direction: 'horizontal' | 'vertical' | 'grid';
    gap: number;
    targetWidgetTypes?: string[];  // Only these types
  };

  // Containment rules
  containment?: Record<string, {
    mustBeInside: string[] | null;  // Required parents
    canContain: string[];           // Allowed children
  }>;

  // Selection behavior
  selection?: {
    multiSelect: boolean;
    boxSelect: boolean;
    clickToSelect: boolean;
  };

  // Drag behavior
  drag?: {
    snapWhileDragging: boolean;
    showGuidelines: boolean;
    allowDragToOtherCanvas: boolean;
  };
}
```

---

## Advanced: Canvas Lifecycle Hooks

For complex canvases, implement lifecycle hooks:

```typescript
const MyCanvasType: CanvasTypeDefinition = {
  kind: 'my-canvas',
  // ...basic config...

  hooks: {
    // Called when canvas is created
    onCreate: async (canvas) => {
      // Initialize services, load data
    },

    // Called when canvas becomes active
    onActivate: async (canvas) => {
      // Resume connections, start polling
    },

    // Called when canvas goes to background
    onBackground: async (canvas) => {
      // Pause non-essential work
    },

    // Called when canvas is destroyed
    onDestroy: async (canvas) => {
      // Cleanup, save final state
    },

    // Called when a widget is added
    onWidgetAdd: async (canvas, widget) => {
      // Validate, initialize widget
    },

    // Called when widgets are connected
    onConnect: async (canvas, edge) => {
      // Validate connection, propagate data
    },
  },
};
```

---

## Packaging Canvas Types

### Canvas Package Manifest

```json
{
  "id": "@my-org/kanban-canvas",
  "version": "1.0.0",
  "name": "Kanban Canvas",
  "description": "Kanban-style project management canvas",

  "canvasTypes": [
    {
      "kind": "kanban",
      "module": "./canvas/kanban.js"
    }
  ],

  "widgets": [
    {
      "typeId": "kanban/column",
      "module": "./widgets/column.js",
      "canvases": ["kanban"]
    },
    {
      "typeId": "kanban/card",
      "module": "./widgets/card.js",
      "canvases": ["kanban"]
    }
  ],

  "canvasSystemVersion": "^1.0.0"
}
```

### Installation

```bash
# Install canvas type with its widgets
chrysalis-cli install @my-org/kanban-canvas
```

The canvas type appears in the canvas type switcher, and its widgets appear in the toolbar when that canvas is active.

---

## Best Practices

### 1. Start with Existing Types

Before creating a new canvas type, check if an existing type with customization works:

```typescript
// Often this is enough
canvasRegistry.registerVariant('board', {
  variantId: 'board/my-workflow',
  widgetFilter: (w) => myAllowedWidgets.includes(w.typeId),
});
```

### 2. Keep Canvas Types Focused

One canvas type = one problem domain. Don't create a "do everything" canvas.

### 3. Provide Sensible Defaults

Users should be able to create a canvas and immediately be productive:

```typescript
defaultState: {
  nodes: [/* helpful starting widgets */],
  viewport: { x: 0, y: 0, zoom: 1 },
}
```

### 4. Consider Background Behavior

What should happen when users switch away?

- Settings canvas: Suspend immediately (no background work needed)
- Terminal-Browser canvas: Keep running (terminal commands or browser sessions active)
- Research canvas: Stay active briefly (might be loading)

### 5. Design Connection Rules Carefully

Connections should have meaning. Don't allow arbitrary connections just because you can.

---

## Examples

| Canvas Type | Purpose | Key Features |
|-------------|---------|--------------|
| `board` | General workflows | Connections, grouping |
| `kanban` | Project tracking | Columns, containment |
| `mindmap` | Idea exploration | Radial layout, auto-arrange |
| `timeline` | Temporal planning | Horizontal scroll, date snapping |
| `whiteboard` | Freeform drawing | No grid, infinite bounds |

---

## Next Steps

- Create widgets specific to your canvas type
- Package and distribute via the [Widget Publishing Guide](./WIDGET_PUBLISHING_GUIDE.md)
- Submit to the community registry for others to use