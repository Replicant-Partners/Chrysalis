# Chrysalis Terminal Architecture - Clarification Session
**Date:** January 10, 2026  
**Status:** In Progress (Paused at Q3.3)

## Key Clarifications Achieved

### 1. Chat Panes & Teams ✅
- Chat labels customizable ("Team A" → "Design Team")
- 30+ persistent teams possible
- UI limit: Max 2 teams active simultaneously (left/right panes)
- Need team selector/switcher

### 2. Contact Management System ✅
- System Service Canvas (always-running invisible)
- Stores contacts, groups, notification prefs
- Bulk invites: `/invite @team-design`
- Email/text notifications
- Pluggable architecture with LLM-managed connector

### 3. Canvas Architecture ✅
- Canvas = React Flow (replaced JSONCanvas)
- One visible canvas at a time (center pane)
- Infinite invisible canvases for background work
- Types are templates, not constraints
- Visibility = boolean property (any canvas can toggle)

### 4. Inside vs Outside Agents ✅
- Inside = runs in this Terminal instance
- Outside = runs elsewhere (different compute/session)
- Defined by execution context, not configuration
- Inside: high trust, shares API keys
- Outside: lower trust, own credentials
- No migration during session
- Same agent type can have multiple instances

## Next Question: Q3.3 Canvas Sharing