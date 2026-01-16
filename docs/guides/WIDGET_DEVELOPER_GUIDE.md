# Widget Developer Guide

**For:** Developers building custom widgets for Chrysalis canvases
**Prerequisites:** TypeScript/JavaScript, React basics
**Time to first widget:** ~30 minutes

---

## What is a Widget?

A widget is a self-contained interactive component that lives on a canvas. Examples:
- A note card for capturing ideas
- A terminal for running commands
- A source citation for research
- An API key manager for settings

Widgets are **data-driven** - you define the shape of the data, and the system handles persistence, undo/redo, connections, and layout.

---

## Quick Start: Your First Widget

### Step 1: Define the Widget

Create a file `my-widget.ts`:

```typescript
import type { WidgetDefinition } from '@chrysalis/canvas';

// 1. Define your data shape
interface CounterData {
  count: number;
  label: string;
}

// 2. Create the widget definition
export const CounterWidget: WidgetDefinition<CounterData> = {
  // Required: Unique identifier (use your namespace)
  typeId: 'my-org/counter',

  // Required: Display info
  name: 'Counter',
  description: 'A simple click counter',
  category: 'utilities',
  icon: '🔢',
  version: '1.0.0',

  // Required: Which canvases can use this widget
  supportedCanvases: ['board', 'scrapbook'],

  // Required: What can users do with this widget?
  capabilities: {
    canResize: true,
    canMove: true,
    canDelete: true,
    canDuplicate: true,
    canConnect: false,  // Can other widgets connect to this?
    canGroup: true,
    canNest: false,
    canCollapse: false,
  },

  // Required: Size constraints
  defaultSize: { width: 200, height: 120 },
  minSize: { width: 150, height: 100 },
  maxSize: { width: 400, height: 200 },

  // Required: Initial data when widget is created
  defaultData: {
    count: 0,
    label: 'Clicks',
  },

  // Required: Schema for validation and migration
  dataContract: {
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' },
        label: { type: 'string' },
      },
      required: ['count'],
    },
    migrations: [], // For future version upgrades
  },

  // What services does this widget need?
  requiredServices: [],      // Must have these to function
  optionalServices: [],      // Nice to have

  // Connection points (empty if canConnect is false)
  handles: [],

  // State machine
  initialState: 'default',
  allowedStates: ['default', 'editing'],
};
```

### Step 2: Create the React Component

Create `CounterView.tsx`:

```tsx
import React from 'react';
import type { WidgetProps } from '@chrysalis/canvas';

interface CounterData {
  count: number;
  label: string;
}

export const CounterView: React.FC<WidgetProps<CounterData>> = ({
  node,
  definition,
  selected,
  onDataChange,
}) => {
  const { count, label } = node.data;

  const increment = () => {
    onDataChange?.({ count: count + 1 });
  };

  const decrement = () => {
    onDataChange?.({ count: count - 1 });
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1e1e2e',
      borderRadius: '8px',
      color: '#cdd6f4',
      gap: '12px',
    }}>
      <div style={{ fontSize: '12px', color: '#6c7086' }}>{label}</div>
      <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{count}</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={decrement}>−</button>
        <button onClick={increment}>+</button>
      </div>
    </div>
  );
};
```

### Step 3: Register the Widget

```typescript
import { getWidgetRegistry } from '@chrysalis/canvas';
import { CounterWidget } from './my-widget';
import { CounterView } from './CounterView';

const registry = getWidgetRegistry();

// Register definition
registry.register(CounterWidget);

// Register React component (links typeId to component)
registry.registerComponent('my-org/counter', CounterView);
```

That's it. Your widget now appears in the toolbar for Board and Scrapbook canvases.

---

## Widget Definition Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `typeId` | `string` | Unique identifier. Use namespacing: `@org/widget-name` |
| `name` | `string` | Display name in UI |
| `description` | `string` | Short description for tooltips |
| `category` | `string` | Grouping in widget picker: `content`, `tools`, `flow`, `settings` |
| `version` | `string` | Semantic version for migrations |
| `supportedCanvases` | `CanvasKind[]` | Which canvases accept this widget |
| `capabilities` | `WidgetCapabilities` | What users can do with it |
| `defaultSize` | `{width, height}` | Initial dimensions |
| `defaultData` | `T` | Initial data shape |
| `dataContract` | `DataContract` | Schema and migrations |

### Capabilities

```typescript
interface WidgetCapabilities {
  canResize: boolean;       // User can resize
  canMove: boolean;         // User can drag
  canDelete: boolean;       // User can delete
  canDuplicate: boolean;    // User can copy
  canConnect: boolean;      // Has connection handles
  canGroup: boolean;        // Can be grouped with others
  canNest: boolean;         // Can contain other widgets
  canCollapse: boolean;     // Can minimize to header

  // Optional limits
  maxConnections?: number;
  connectionTypes?: string[];  // e.g., ['data', 'reference']
  maxNestingDepth?: number;
}
```

### Connection Handles

If your widget can connect to others:

```typescript
handles: [
  {
    id: 'input',
    position: 'left',      // 'top' | 'right' | 'bottom' | 'left'
    type: 'target',        // 'source' | 'target' | 'both'
    dataTypes: ['text'],   // What data types it accepts
    maxConnections: 1,     // Optional limit
  },
  {
    id: 'output',
    position: 'right',
    type: 'source',
    dataTypes: ['text'],
  },
],
```

### Services

Widgets can request services from the host:

```typescript
// Services the widget requires to function
requiredServices: ['storage', 'encryption'],

// Services that enhance but aren't required
optionalServices: ['ai', 'validation'],
```

Available services:
- `storage` - Persist data beyond the canvas
- `encryption` - Encrypt sensitive data
- `terminal` - PTY access
- `browser` - Web browsing
- `ai` - LLM access
- `validation` - Schema validation

---

## Data Contract and Migrations

### Schema

Use JSON Schema for validation:

```typescript
dataContract: {
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', maxLength: 100 },
      count: { type: 'number', minimum: 0 },
      tags: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 10,
      },
    },
    required: ['title'],
  },
  migrations: [],
}
```

### Migrations

When you change the data shape, add a migration:

```typescript
migrations: [
  {
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    migrate: (oldData) => ({
      ...oldData,
      // Added in 1.1.0
      createdAt: oldData.createdAt || Date.now(),
    }),
  },
  {
    fromVersion: '1.1.0',
    toVersion: '2.0.0',
    migrate: (oldData) => ({
      // Renamed field
      label: oldData.title,
      count: oldData.count,
      createdAt: oldData.createdAt,
      // Removed 'tags' field
    }),
  },
],
```

---

## Widget Component Props

Your React component receives:

```typescript
interface WidgetProps<T> {
  // The node data from the canvas
  node: {
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    data: T;  // Your widget's data
  };

  // The widget definition
  definition: WidgetDefinition<T>;

  // UI state
  selected: boolean;
  dragging: boolean;
  resizing: boolean;
  readOnly: boolean;

  // Callbacks
  onDataChange?: (partial: Partial<T>) => void;
  onStateChange?: (state: string) => void;
  onConnect?: (handleId: string) => void;
}
```

### Updating Data

Always use `onDataChange` - never mutate `node.data` directly:

```tsx
// ✅ Correct
const handleTitleChange = (newTitle: string) => {
  onDataChange?.({ title: newTitle });
};

// ❌ Wrong - will not persist or trigger undo
node.data.title = newTitle;
```

### State Machine

For multi-state widgets:

```tsx
const [currentState, setCurrentState] = useState(node.state || 'viewing');

const enterEditMode = () => {
  if (definition.allowedStates?.includes('editing')) {
    setCurrentState('editing');
    onStateChange?.('editing');
  }
};
```

---

## Packaging Widgets for Distribution

### Package Manifest

Create `chrysalis-widget.json`:

```json
{
  "id": "@my-org/widget-pack",
  "version": "1.0.0",
  "name": "My Widget Pack",
  "description": "A collection of useful widgets",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "license": "MIT",

  "canvasSystemVersion": "^1.0.0",

  "widgets": [
    {
      "typeId": "@my-org/counter",
      "module": "./widgets/counter.js",
      "canvases": ["board", "scrapbook"]
    },
    {
      "typeId": "@my-org/timer",
      "module": "./widgets/timer.js",
      "canvases": "*"
    }
  ],

  "requiredServices": [],
  "keywords": ["counter", "timer", "utilities"]
}
```

### Building

```bash
# Build your widgets
npm run build

# Package for distribution
chrysalis-cli pack

# Output: my-org-widget-pack-1.0.0.cpkg
```

### Installing

Users install your package:

```bash
# From registry
chrysalis-cli install @my-org/widget-pack

# From file
chrysalis-cli install ./my-org-widget-pack-1.0.0.cpkg

# From URL
chrysalis-cli install https://example.com/widgets/pack.cpkg
```

---

## Best Practices

### 1. Keep Data Minimal

Only store what you need. Compute derived values in the component:

```typescript
// ✅ Good - minimal data
defaultData: {
  items: ['a', 'b', 'c'],
}

// ❌ Bad - storing computed value
defaultData: {
  items: ['a', 'b', 'c'],
  itemCount: 3,  // Can be computed
}
```

### 2. Use Semantic Type IDs

```typescript
// ✅ Good - namespaced and descriptive
typeId: '@acme/project-tracker'
typeId: 'research/source-citation'

// ❌ Bad - generic, collision-prone
typeId: 'card'
typeId: 'widget1'
```

### 3. Provide Good Defaults

Users should be able to add your widget and immediately use it:

```typescript
defaultData: {
  title: 'New Task',           // Not empty string
  priority: 'medium',          // Sensible default
  dueDate: null,               // Optional fields can be null
}
```

### 4. Handle Edge Cases

```tsx
// Always check for missing data gracefully
const title = node.data?.title || 'Untitled';
const items = node.data?.items || [];
```

### 5. Respect Read-Only Mode

```tsx
if (readOnly) {
  return <div>{node.data.content}</div>;
}

return (
  <textarea
    value={node.data.content}
    onChange={e => onDataChange?.({ content: e.target.value })}
  />
);
```

---

## Debugging

### Check Registration

```typescript
const registry = getWidgetRegistry();

// List all registered widgets
console.log(registry.listAll());

// Check if your widget is registered
console.log(registry.get('@my-org/counter'));
```

### Validate Data

```typescript
const registry = getWidgetRegistry();
const errors = registry.validate('@my-org/counter', myData);

if (errors.length > 0) {
  console.error('Validation failed:', errors);
}
```

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Widget not in toolbar | Wrong `supportedCanvases` | Add the canvas type to array |
| Data not persisting | Mutating directly | Use `onDataChange` callback |
| Resize not working | `canResize: false` | Set to `true` in capabilities |
| Migration not running | Version mismatch | Check `fromVersion` matches |

---

## Examples

See the reference widgets for working examples:

| Widget | Location | Demonstrates |
|--------|----------|--------------|
| Card | `reference-widgets/board/card` | Basic content, connections |
| Note | `reference-widgets/scrapbook/note` | Rich text, colors |
| Source | `reference-widgets/research/source` | External data, citations |
| Terminal | `reference-widgets/terminal-browser/terminal` | Service integration |
| API Key | `reference-widgets/settings/api-key` | Encryption, validation |

---

## Next Steps

- Read the [Canvas Type Extension Guide](./CANVAS_TYPE_EXTENSION_GUIDE.md) to create custom canvas types
- Read the [Widget Publishing Guide](./WIDGET_PUBLISHING_GUIDE.md) to distribute your widgets
- Join the community to share and discover widgets
