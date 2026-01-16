# Chrysalis Development Guides

## For Widget Developers

| Guide | Description | Time |
|-------|-------------|------|
| [Widget Developer Guide](./WIDGET_DEVELOPER_GUIDE.md) | Create custom widgets from scratch | 30 min |
| [Canvas Type Extension Guide](./CANVAS_TYPE_EXTENSION_GUIDE.md) | Modify existing or create new canvas types | 45 min |
| [Widget Publishing Guide](./WIDGET_PUBLISHING_GUIDE.md) | Package and distribute your widgets | 20 min |

## Reading Order

1. **Start here** → Widget Developer Guide
2. **If you need a new canvas type** → Canvas Type Extension Guide
3. **When ready to share** → Widget Publishing Guide

## Quick Reference

### Minimum Viable Widget

```typescript
import type { WidgetDefinition } from '@chrysalis/canvas';

export const MyWidget: WidgetDefinition<{ value: string }> = {
  typeId: '@my-org/my-widget',
  name: 'My Widget',
  description: 'Does something useful',
  category: 'utilities',
  icon: '📦',
  version: '1.0.0',
  supportedCanvases: ['board'],
  capabilities: {
    canResize: true,
    canMove: true,
    canDelete: true,
    canDuplicate: true,
    canConnect: false,
    canGroup: true,
    canNest: false,
    canCollapse: false,
  },
  defaultSize: { width: 200, height: 100 },
  defaultData: { value: '' },
  dataContract: {
    version: '1.0.0',
    schema: { type: 'object', properties: { value: { type: 'string' } } },
    migrations: [],
  },
  requiredServices: [],
  handles: [],
  initialState: 'default',
  allowedStates: ['default'],
};
```

### Register a Widget

```typescript
import { getWidgetRegistry } from '@chrysalis/canvas';

const registry = getWidgetRegistry();
registry.register(MyWidget);
registry.registerComponent('@my-org/my-widget', MyWidgetView);
```

### Install a Widget Package

```bash
chrysalis-cli install @my-org/widget-pack
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
├─────────────────────────────────────────────────────────┤
│  Canvas Components (React)                              │
│  ├─ Canvas          - Interactive workspace             │
│  ├─ WidgetWrapper   - Drag/resize container             │
│  └─ Toolbar         - Canvas controls                   │
├─────────────────────────────────────────────────────────┤
│  Widget System                                          │
│  ├─ WidgetRegistry  - Register/lookup widgets           │
│  ├─ PackageManager  - Install/update packages           │
│  └─ Your Widgets    - Custom widget definitions         │
├─────────────────────────────────────────────────────────┤
│  Canvas Engine                                          │
│  ├─ LayoutEngine    - Grid, collision, arrangement      │
│  ├─ ExecutionMgr    - Background/foreground states      │
│  └─ BindingSystem   - Widget ↔ Canvas connections       │
├─────────────────────────────────────────────────────────┤
│  Backend Services (must be configured)                  │
│  ├─ Storage         - Persistence                       │
│  ├─ Terminal        - PTY backend                       │
│  ├─ Browser         - Iframe proxy                      │
│  └─ LLM             - AI capabilities                   │
└─────────────────────────────────────────────────────────┘
```

## Getting Help

- Check the [Troubleshooting](#) section in each guide
- Open an issue on GitHub
- Ask in Discord
