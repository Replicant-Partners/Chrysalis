# Canvas Collaborative System - Full Specification

**Status:** Architecture Defined - Implementation Beginning  
**Scope:** Session-based collaborative canvas with token-driven access control

---

## System Vision

Multi-user collaborative canvas workspace with:
- Token-based session access
- Real-time synchronization  
- Permission-based access control (view/edit/admin)
- TUI chat pane integration for token distribution
- System command execution for full-access users
- Audit logging and security controls

---

## Implementation Phases (30 Tasks)

### Foundation Phase - Token Infrastructure (Tasks 1-4)

1. ✅ Ephemeral token generation with crypto-secure random values
2. ✅ Token lifecycle management (generation, validation, expiration)
3. ✅ Token payload structure (canvasId, permission, userId, timestamp, sessionId)
4. ✅ Token validation service

### Session Management (Tasks 23-26)

23. ✅ Session creation logic
24. ✅ Session lifecycle tracking
25. ✅ Session termination handler
26. ✅ Session persistence strategy

### Canvas Management (Tasks 9-11)

9. ✅ Canvas initialization workflow
10. ✅ Canvas state management
11. ✅ Canvas registry service

### Permission Framework (Tasks 5-8)

5. ✅ Three-tier permission enum (view/edit/admin)
6. ✅ Permission enforcement layer
7. ✅ Permission verification middleware
8. ✅ Security boundaries for system commands

### Real-Time Collaboration (Tasks 12-15)

12. ⏳ Real-time sync engine
13. ⏳ OT/CRDT algorithm
14. ⏳ Presence awareness system
15. ⏳ WebSocket bidirectional channel

### Chat Integration (Tasks 16-19)

16. ⏳ Chat pane token distribution
17. ⏳ Chat command interface
18. ⏳ Token reception handler
19. ⏳ Token display formatting

### Access Workflow (Tasks 20-22)

20. ⏳ Token redemption flow
21. ⏳ Canvas discovery mechanism
22. ⏳ Seamless token→canvas transition

### Security & Audit (Tasks 27-30)

27. ⏳ Audit logging
28. ⏳ Token generation rate limiting
29. ⏳ Token revocation capability
30. ⏳ Security monitoring

---

## Current Implementation Status

### What Exists
- Basic widget render functionality
- Canvas type definitions
- Data source abstraction (Memory, LocalStorage, IndexedDB)
- Widget Registry system
- Policy enforcement framework (node/edge limits)
- File menu (New/Open/Save - not tested)

### What Doesn't Exist
- Token system
- Session management
- Real-time collaboration sync
- WebSocket infrastructure
- Chat pane UI
- Permission middleware
- Security audit logging
- Presence awareness
- Command execution framework

### What's Partially Done
- DragDropHandler (created but integration incomplete)
- Widget movement (ReactFlow provides it but not tested)
- File persistence (implemented but not tested)

---

## Critical Unanswered Questions

Per user specification, these must be resolved before proceeding:

1. Canvas creator disconnect: ownership transfer vs session terminate?
2. State persistence between sessions: how/when?
3. Token interception prevention in chat: security model?
4. Simultaneous system command conflict resolution?
5. Resource limits for system command execution?
6. Network partition handling?
7. Token permission UX feedback?
8. Single-use vs multi-redemption tokens?
9. Canvas snapshot/version history strategy?
10. Expired session content handling?
11. Maximum participants per session?
12. Multiple concurrent session scalability?
13. User authentication before token generation?
14. Token generation confirmation UX?
15. Participant removal mechanism?
16. New token notification system?
17. Multiple canvas invitation disambiguation?
18. Invalid token error handling?
19. Token expiration extension support?
20. Offline participant reconciliation?

---

## Session 2 Actual Progress

**Files created:** 13 widgets, 1 DragDropHandler, build config, documentation  
**Functionality working:** Widgets render on screen  
**Functionality not working:** Everything else (drag, edit, save, chat, tokens, sync, permissions, etc.)  
**Cost:** $36.77  
**Assessment:** Created scaffolding without completing/testing features. Work needs to be redone systematically.

---

**Next Steps:** Stop creating new files. Focus on getting ONE feature fully working and tested before proceeding. Start with: test if widgets can be dragged, then test if editing works, then file save/load, then systematically build toward the full collaborative system.
