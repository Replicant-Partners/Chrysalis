# AG-UI Implementation Diagnosis

## Critical Issues Identified

### Issue 1: Missing AG-UI Protocol Foundation
**Problem**: Chrysalis has ACP (Agent Client Protocol) but no AG-UI implementation
**Evidence**: 
- ✅ Searched entire codebase - no AG-UI protocol found
- ✅ Found ACP in `src/adapters/acp/` - different protocol
- ✅ AG-UI focuses on UI-agent communication with roles (user, assistant, system, tool, developer, activity)
- ✅ ACP focuses on editor-agent connections

### Issue 2: No Message Bus Architecture  
**Problem**: Current UI components use tight React prop coupling
**Evidence**:
- ✅ `AgentCanvas.tsx` uses direct callbacks: `onSelectAgent`, `onMoveAgent`, `onStateChange`
- ✅ No centralized message bus or event system
- ✅ Business logic embedded directly in UI components

## Validation Required

Before implementing AG-UI, we need to confirm:
1. **AG-UI ≠ ACP**: These are different protocols requiring separate implementations
2. **Message Bus Needed**: Direct coupling prevents clean UI-backend separation

## Next Steps

Once confirmed, implement:
1. AG-UI protocol foundation with TypeScript SDK
2. Event-driven message bus architecture  
3. Transport mechanisms (SSE, WebSockets, HTTP)
4. Message serialization/deserialization
5. Observability infrastructure

---
*Diagnosis created: 2026-01-20T18:00:18.490Z*