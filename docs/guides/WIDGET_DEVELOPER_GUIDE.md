# Widget Developer Guide

**For:** Developers building custom widgets for Chrysalis canvases  
**Prerequisites:** TypeScript/JavaScript, React basics  
**Time to first widget:** ~30 minutes  
**Last Updated:** 2026-01-18

---

## What is a Widget?

A widget is a self-contained interactive component that lives on a canvas. Widgets are the building blocks of the human-agent interaction surface in Chrysalis Terminal.

**Implemented Examples in [`src/canvas/widgets/`](../../src/canvas/widgets/):**
- NoteWidget - Text notes for capturing ideas
- TerminalSessionWidget - Terminal for running commands
- SourceWidget - Source citation for research
- ConfigWidget - Configuration key/value editor for settings

Widgets are **data-driven** - you define the shape of the data, and the system handles persistence, rendering, policy enforcement, and event emission.

---

## Quick Start: Your First Widget

### Step 1: Review Existing Widgets

Before creating a new widget, examine the reference implementations:

```bash
# View existing widgets
ls src/canvas/widgets/

# Example widgets to study:
- NoteWidget.tsx (simple text editing)
- AgentCardWidget.tsx (state display with actions)
- TerminalSessionWidget.tsx (external service integration)
```

### Step 2: Define Widget Data Shape

```typescript
import type { WidgetNodeData, WidgetProps } from '@chrysalis/canvas';

// Extend WidgetNodeData with your custom fields
interface MyWidgetData extends WidgetNodeData {
  count: number;
  customField: string;
}
```

### Step 3: Create the React Component

```tsx
import React from 'react';
import type { WidgetProps } from '../../types';

export const MyWidget: React.FC<WidgetProps<MyWidgetData>> = ({
  data,
  id,
  selected,
  onDataChange,
  onEvent,
}) => {
  const handleIncrement = () => {
    onDataChange?.({ count: data.count + 1 });
  };

  return (
    <div style={{ padding: 12, background: '#fff', border: '1px solid #ddd' }}>
      <h3>{data.label}</h3>
      <div>Count: {data.count}</div>
      <button onClick={handleIncrement}>Increment</button>
    </div>
  );
};
```

### Step 3: Register with WidgetRegistry

```typescript
import { createWidgetRegistry } from '@chrysalis/canvas';

const registry = createWidgetRegistry('scrapbook', ['my_widget', 'note']);

registry.register({
  type: 'my_widget',
  displayName: 'My Widget',
  renderer: MyWidget,
  capabilities: [],
  defaultData: {
    count: 0,
    customField: 'default value',
  },
  category: 'utilities',
});
```

## Widget Definition Reference

**Actual Implementation:** See [`src/canvas/types.ts:99-140`](../../src/canvas/types.ts) for `WidgetDefinition` interface

### Required Fields

```typescript
interface WidgetDefinition<TData extends WidgetNodeData> {
  type: string;                           // Unique identifier (e.g., 'text_note', 'terminal_session')
  displayName: string;                    // Human-readable name
  renderer: ComponentType<WidgetProps<TData>>;  // React component
  capabilities: string[];                 // Required capabilities (e.g., ['terminal:execute'])
  defaultData?: Partial<TData>;          // Default data for new instances
  schema?: unknown;                       // JSON Schema for validation (optional)
  category?: string;                      // For UI organization
  icon?: string;                          // Icon for visualization
}
```

### Widget Props Interface

**Actual Implementation:** See [`src/canvas/types.ts:66-91`](../../src/canvas/types.ts) for `WidgetProps` interface

```typescript
interface WidgetProps<TData extends WidgetNodeData> {
  data: TData;                           // Widget data
  id: string;                            // Node ID
  selected?: boolean;                    // Selection state
  onDataChange?: (newData: Partial<TData>) => void;  // Update callback
  onEvent?: (event: WidgetEvent) => void;             // Event emission
}
```

## Registry System

**Actual Implementation:** See [`src/canvas/WidgetRegistry.ts`](../../src/canvas/WidgetRegistry.ts)

The WidgetRegistry enforces:
- Widget type allowlisting per canvas kind
- Capability requirements
- Data validation against schemas
- Registration uniqueness

```typescript
// Example from actual code
const registry = new WidgetRegistry('scrapbook', ['note', 'link', 'artifact']);

// Register widget
registry.register({
  type: 'note',
  displayName: 'Note',
  renderer: NoteWidget,
  capabilities: [],
});

// Validate data
const validation = registry.validateData(widgetData);
if (!validation.valid) {
  console.error(validation.errors);
}
```

---

## Examples from Actual Implementation

| Widget | File | Canvas Type | Demonstrates |
|--------|------|-------------|--------------|
| NoteWidget | [`src/canvas/widgets/NoteWidget.tsx`](../../src/canvas/widgets/NoteWidget.tsx) | Scrapbook | Text editing, tags |
| AgentCardWidget | [`src/canvas/widgets/AgentCardWidget.tsx`](../../src/canvas/widgets/AgentCardWidget.tsx) | Agent | State display, actions |
| TerminalSessionWidget | [`src/canvas/widgets/TerminalSessionWidget.tsx`](../../src/canvas/widgets/TerminalSessionWidget.tsx) | Terminal-Browser | Service integration (xterm.js pending) |
| WikiPageWidget | [`src/canvas/widgets/WikiPageWidget.tsx`](../../src/canvas/widgets/WikiPageWidget.tsx) | Wiki | Hierarchical content |
| ConfigWidget | [`src/canvas/widgets/ConfigWidget.tsx`](../../src/canvas/widgets/ConfigWidget.tsx) | Settings | Key/value editing |

---

## Best Practices

### 1. Use Design Tokens, Not Hardcoded Colors

**⚠️ Current Issue:** Most existing widgets use hardcoded colors and need migration.

**See:** [`plans/WIDGET_REDESIGN_PLAN.md`](../../plans/WIDGET_REDESIGN_PLAN.md) for migration status.

```typescript
// ❌ Bad - hardcoded colors (current state of most widgets)
<div style={{ background: '#2196f3', color: '#ffffff' }}>

// ✅ Good - design tokens (NoteWidget example)
import tokens from '../../components/shared/tokens';
<div style={{ 
  background: tokens.color.surface.secondary,
  color: tokens.color.text.primary 
}}>
```

### 2. Always Use onDataChange for Updates

```typescript
// ✅ Correct - triggers persistence,undo/redo, events
const handleUpdate = (newText: string) => {
  onDataChange?.({ text: newText });
};

// ❌ Wrong - no persistence, no events
data.text = newText;
```

### 3. Implement Proper Widget Lifecycle

```typescript
const MyWidget: React.FC<WidgetProps<MyData>> = ({ data, id, onEvent }) => {
  // Emit lifecycle events
  useEffect(() => {
    onEvent?.({ type: 'widget:mounted', widgetId: id, widgetType: data.type, timestamp: Date.now() });
    
    return () => {
      onEvent?.({ type: 'widget:unmounted', widgetId: id, widgetType: data.type, timestamp: Date.now() });
    };
  }, [id, data.type, onEvent]);
  
  // ... render logic
};
```

---


## Integration with Canvas System

### Canvas Usage

**Actual Implementation:** See [`src/canvas/BaseCanvas.tsx`](../../src/canvas/BaseCanvas.tsx)

```typescript
import { BaseCanvasWithProvider } from '@chrysalis/canvas';
import { createWidgetRegistry } from '@chrysalis/canvas';

const registry = createWidgetRegistry('scrapbook', ['note', 'link']);
// Register widgets...

<BaseCanvasWithProvider
  canvasKind="scrapbook"
  canvasId="my-canvas"
  registry={registry}
  policy={{
    maxNodes: 100,
    maxEdges: 200,
    rateLimit: { actions: 10, windowMs: 1000 },
    allowedWidgetTypes: ['note', 'link'],
  }}
  onEvent={(event) => console.log(event)}
/>
```

---

## Next Steps

- Study existing widgets in [`src/canvas/widgets/`](../../src/canvas/widgets/)
- Read [`src/canvas/types.ts`](../../src/canvas/types.ts) for complete type definitions
- Review [`src/canvas/demo.tsx`](../../src/canvas/demo.tsx) for working example
- Follow [`plans/WIDGET_REDESIGN_PLAN.md`](../../plans/WIDGET_REDESIGN_PLAN.md) for design token migration
- Read the [Canvas Type Extension Guide](./CANVAS_TYPE_EXTENSION_GUIDE.md) to create custom canvas types
