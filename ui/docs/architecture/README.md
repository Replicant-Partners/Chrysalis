# Chrysalis Terminal UI - Architecture

This directory contains architectural documentation for the Chrysalis Terminal UI.

---

## Documents

### [COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md)
Component organization, patterns, and design principles.

**Topics:**
- Component hierarchy
- Reusable patterns
- Props conventions
- Styling approach
- File organization

**Diagrams:** Component dependency tree, composition patterns

---

### [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)
State management architecture using Zustand and YJS.

**Topics:**
- Zustand stores (local state)
- YJS documents (distributed state)
- State synchronization
- Data flow patterns
- Update strategies

**Diagrams:** State flow, data lifecycle, sync architecture

---

### [CANVAS_SYSTEM.md](./CANVAS_SYSTEM.md)  
Canvas architecture and JSONCanvas implementation.

**Topics:**
- Canvas types and templates
- Widget system
- Visibility model
- Permission system
- CRDT synchronization

**Diagrams:** Canvas lifecycle, widget rendering, type system

---

## Quick Reference

| Concern | Document | Section |
|---------|----------|---------|
| Component structure | [Component Architecture](./COMPONENT_ARCHITECTURE.md) | Component Hierarchy |
| Shared state | [State Management](./STATE_MANAGEMENT.md) | Zustand Stores |
| Real-time sync | [State Management](./STATE_MANAGEMENT.md) | YJS Integration |
| Canvas types | [Canvas System](./CANVAS_SYSTEM.md) | Canvas Types |
| Widget development | [Canvas System](./CANVAS_SYSTEM.md) | Widget System |

---

## External References

### React Patterns
- [React Component Patterns](https://react.dev/learn/thinking-in-react) - Component design
- [React Context](https://react.dev/learn/passing-data-deeply-with-context) - Global state patterns
- [React Hooks](https://react.dev/reference/react) - Hook patterns and rules

### State Management  
- [Zustand Documentation](https://github.com/pmndrs/zustand) - Official Zustand docs
- [YJS Documentation](https://docs.yjs.dev/) - CRDT implementation
- [y-websocket](https://github.com/yjs/y-websocket) - WebSocket provider

### Canvas Protocol
- [JSONCanvas Specification](https://jsoncanvas.org/) - Official spec
- [Infinite Canvas](https://infinitecanvas.tools/) - Infinite canvas patterns

---

**Last Updated:** January 10, 2026  
**Maintainer:** Chrysalis UI Team