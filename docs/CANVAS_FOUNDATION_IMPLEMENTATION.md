# Canvas Foundation Implementation

## Files Created

### Core Infrastructure
1. **`src/canvas/types.ts`**
   - CanvasKind type (6 canvas types: settings, agent, scrapbook, research, wiki, terminal-browser)
   - WidgetNodeData, WidgetDefinition interfaces
   - CanvasPolicy, CanvasTheme, CanvasDataSource
   - Event types, lifecycle hooks

2. **`src/canvas/WidgetRegistry.ts`**
   - Per-canvas widget registry with enforcement
   - Allowlist/denylist validation
   - Capability checking
   - Schema validation hooks
   - Creation/update guards

3. **`src/canvas/BaseCanvas.tsx`**
   - Generic BaseCanvas<TWidget> component
   - XYFlow integration with virtualization
   - Rate limiting
   - Event emission
   - Lifecycle management
   - Accessibility support

### Implementation Example
4. **`src/canvas/canvases/TerminalBrowserCanvas.tsx`**
   - Terminal-Browser canvas configuration
   - Widget allowlist: ['terminal_session', 'browser_tab']
   - Policy: max 20 nodes, rate limits
   - Registry setup with capabilities

5. **`src/canvas/widgets/TerminalSessionWidget.tsx`**
   - Terminal widget renderer placeholder
   - xterm.js integration hooks (TODO)
   - PTY WebSocket connection points

6. **`src/canvas/index.ts`**
   - All canvas exports

## Architecture

### Widget Registry Pattern
```typescript
const registry = createWidgetRegistry(
  'terminal',
  ['terminal_session'],  // allowlist
  logger,
  { capabilities: ['terminal:execute'] }
);

registry.register({
  type: 'terminal_session',
  displayName: 'Terminal Session',
  renderer: TerminalSessionWidget,
  capabilities: ['terminal:execute'],
});

// Guards enforce policy
const validation = registry.guardCreate(request);
if (!validation.valid) {
  // Block creation, emit event
}
```

### BaseCanvas Usage
```typescript
<BaseCanvas
  canvasKind="terminal"
  registry={registry}
  policy={policy}
  theme={theme}
  a11y={{ enableKeyboardNav: true }}
  onEvent={handleEvent}
/>
```

## Key Features Implemented

### Type Safety
- Generic BaseCanvas<TWidget> constrains widget types per canvas
- Registry validates against allowlist at runtime
- Type-safe widget data payloads

### Security
- Per-canvas widget allowlists enforced
- Capability requirements checked
- Rate limiting on actions
- Node/edge limits

### Virtualization Ready
- XYFlow onlyRenderVisibleElements enabled
- DataSource interface for tile-based loading
- Event system for load tracking

### Accessibility
- ARIA labels on canvas
- Keyboard navigation support
- Configurable reduced motion

## Remaining Work

### For Production
1. **Widget Implementations**
   - Complete xterm.js integration in TerminalSessionWidget
   - Create widgets for other canvases (Browser, Media, etc.)

2. **Data Source**
   - Implement tile-based loading
   - Add LRU caching
   - Persistence layer

3. **Remaining Canvases**
   - Create 5 more canvas implementations (Agent, Scrapbook, Research, Wiki, Settings)
   - Define widget allowlists for each
   - Register widgets

4. **Virtualization**
   - Viewport culling hook
   - Tile prefetch logic
   - Offscreen widget pause/resume

5. **Testing**
   - Registry guard tests
   - Policy enforcement tests
   - Event emission tests

## Usage Example

```typescript
import { TerminalCanvas } from './canvas';

function App() {
  const handleEvent = (event: CanvasEvent) => {
    console.log('Canvas event:', event);
  };
  
  return (
    <TerminalCanvas
      onEvent={handleEvent}
      theme={{ background: '#000' }}
      a11y={{ enableKeyboardNav: true }}
    />
  );
}
```

## Implementation Status

- ✅ Core types defined
- ✅ WidgetRegistry system complete
- ✅ BaseCanvas component functional
- ⚠️ Canvas implementations removed (System A and B deprecated)
- ⚠️ Widget implementations need xterm.js integration
- ⚠️ Data source needs tile loading implementation
- ⚠️ 9 canvases remain to be created
- ⚠️ Virtualization hooks need implementation

## Dependencies Required

```json
{
  "reactflow": "^11.x",
  "@xterm/xterm": "^5.x",
  "@xterm/addon-fit": "^0.8.x"
}
```

## Next Steps

1. Implement xterm.js in TerminalSessionWidget
2. Create remaining 9 canvases (Board, Browser, Media, etc.)
3. Implement DataSource with tile loading
4. Add virtualization viewport hooks
5. Testing and documentation