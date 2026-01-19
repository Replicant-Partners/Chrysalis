# Chrysalis CRDT Architecture: Fireproof + YJS Complementary Design

**Version**: 1.0.0
**Last Updated**: January 2026
**Status**: Design Specification

---

## 1. Overview

Chrysalis employs a **dual-CRDT architecture** that combines YJS for real-time collaboration with Fireproof for durable persistence. This separation of concerns provides both instantaneous user experience and reliable long-term storage.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Workspace UI │  │ Chat Panes   │  │ Canvas/Agents        │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
├─────────┴─────────────────┴──────────────────────┴───────────────┤
│                    Real-Time Layer (YJS)                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Y.Doc → Y.Array (chat) + Y.Map (state) + Y.Text (canvas)   │ │
│  │  WebSocket Provider ←→ Peers                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              ↓ snapshot                          │
├──────────────────────────────┼───────────────────────────────────┤
│                    Durable Layer (Fireproof)                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  SQLite + CRDT Merge + Vector Cache + Sync Gateway          │ │
│  │  Documents: Beads, Memories, Metadata, EmbeddingRefs        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              ↓ sync                              │
├──────────────────────────────┼───────────────────────────────────┤
│                    Remote Layer (Optional)                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Fireproof Sync Gateway / Zep / Object Storage              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Design Principles

### 2.1 Separation of Concerns

| Layer | Technology | Purpose | Latency Target |
|-------|------------|---------|----------------|
| **Real-Time** | YJS | Instant collaboration, keystroke sync | <50ms |
| **Durable** | Fireproof | Persistent storage, offline support | <100ms local |
| **Remote** | Zep/Gateway | Cross-device sync, backup | <1s |

### 2.2 Local-First Architecture

1. **All reads are local** — No network required for basic operation
2. **Writes propagate asynchronously** — Background sync doesn't block UI
3. **Conflicts resolve automatically** — CRDT semantics ensure eventual consistency
4. **Offline-capable** — Full functionality without network

---

## 3. YJS Layer: Real-Time Collaboration

### 3.1 Responsibilities

- **Keystroke-level sync** for collaborative editing
- **Presence awareness** (cursors, selections, active users)
- **Operational transformation** for text and structured data
- **WebSocket-based peer-to-peer sync**

### 3.2 Data Structures

```typescript
// Workspace YJS state structure
interface WorkspaceYJSState {
  leftChat: Y.Array<ChatMessage>;      // Left pane messages
  rightChat: Y.Array<ChatMessage>;     // Right pane messages
  session: Y.Map<unknown>;             // Session metadata
  participants: Y.Map<ChatParticipant>; // Active participants
  canvas: Y.Map<CanvasNode>;           // Canvas node positions
  selections: Y.Map<Selection>;        // User selections
}
```

### 3.3 Sync Flow

```
User A Input → Y.Doc Update → Encode as Update → WebSocket →
→ Peer B receives → Y.applyUpdate → UI reflects change
```

### 3.4 When to Use YJS

- ✅ Real-time text editing
- ✅ Cursor/selection sync
- ✅ Collaborative canvas manipulation
- ✅ Chat message streaming
- ✅ Session presence

---

## 4. Fireproof Layer: Durable Persistence

### 4.1 Responsibilities

- **Permanent storage** for memories, beads, metadata
- **CRDT merge** for conflict-free updates
- **Vector caching** for embedding retrieval
- **Offline persistence** when network unavailable
- **Sync to remote** for backup and cross-device access

### 4.2 Document Types

```python
# Core document types
DocumentType = Enum('DocumentType', [
    'BEAD',           # Short-term memory entries
    'MEMORY',         # Promoted long-term memories
    'METADATA',       # LLM prompt/response metadata
    'EMBEDDING_REF',  # Vector embedding references
])
```

### 4.3 CRDT Merge Semantics

| Field Type | Merge Strategy | Example |
|------------|---------------|---------|
| Scalars | Last-Writer-Wins (by `updated_at`) | `content`, `role` |
| Arrays | Union with deduplication | `tags`, `span_refs` |
| Counters | Take maximum | `version`, `access_count` |
| Scores | Take maximum | `importance`, `confidence` |
| Timestamps | Take latest | `updated_at`, `last_accessed` |
| Sync status | Pending wins over synced | `sync_status` |

### 4.4 When to Use Fireproof

- ✅ Agent memories (episodic, semantic)
- ✅ Conversation history
- ✅ LLM interaction metadata
- ✅ Embedding vector cache
- ✅ User preferences/settings
- ✅ Session snapshots

---

## 5. Bridge: YJS ↔ Fireproof Integration

### 5.1 Snapshot Strategy

YJS state is ephemeral (lost on browser refresh). Important state must be persisted to Fireproof:

```typescript
// Periodic snapshot of YJS chat to Fireproof
async function snapshotChatToFireproof(
  yjsDoc: Y.Doc,
  fireproof: FireproofService
): Promise<void> {
  const leftChat = yjsDoc.getArray<ChatMessage>('leftChat');
  const rightChat = yjsDoc.getArray<ChatMessage>('rightChat');

  // Convert YJS arrays to beads
  for (const msg of leftChat.toArray()) {
    await fireproof.put({
      type: 'bead',
      content: msg.content,
      role: msg.role,
      importance: msg.importance || 0.5,
      source: 'yjs_snapshot',
      session_id: sessionId,
      yjs_id: msg.id, // Track origin
    });
  }
}
```

### 5.2 Trigger Points

| Trigger | Action |
|---------|--------|
| Session end | Full snapshot of all YJS state |
| High-importance message | Immediate bead creation |
| Periodic interval | Incremental snapshot (new items only) |
| User explicit save | Full state checkpoint |
| Before tab close | Best-effort emergency save |

### 5.3 Deduplication

Use `yjs_id` tracking to avoid duplicate entries:

```python
# Check if already persisted before creating bead
existing = await fireproof.query("yjs_id", {"key": msg_id})
if not existing:
    await fireproof.put_bead(bead)
```

---

## 6. Memory Tiers Integration

The CRDT architecture integrates with the three-tier memory model:

```
┌─────────────────────────────────────────────────────────────────┐
│ Tier 1: Working Memory (YJS)                                    │
│ - Real-time chat messages (Y.Array)                             │
│ - Session state (Y.Map)                                         │
│ - Canvas positions (Y.Map)                                      │
│ - TTL: Session duration                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓ snapshot + promote
┌─────────────────────────────────────────────────────────────────┐
│ Tier 2: Durable Cache (Fireproof)                               │
│ - Beads (short-term with TTL)                                   │
│ - Local memories                                                │
│ - Embedding cache                                               │
│ - TTL: 7-30 days                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓ sync + archive
┌─────────────────────────────────────────────────────────────────┐
│ Tier 3: Long-term Storage (Zep/Remote)                          │
│ - Semantic memories                                             │
│ - Knowledge graph                                               │
│ - Vector index                                                  │
│ - TTL: Permanent                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 6.1 Promotion Flow

```python
# Bead promotion from Tier 1 → Tier 2
def should_promote_bead(bead: dict) -> bool:
    return (
        bead.get('importance', 0) >= 0.7 or
        bead.get('access_count', 0) >= 3 or
        bead.get('explicit_save', False)
    )

# Memory promotion from Tier 2 → Tier 3
def should_promote_memory(memory: dict) -> bool:
    return (
        memory.get('confidence', 0) >= 0.8 and
        memory.get('access_count', 0) >= 5 and
        age_days(memory) >= 7
    )
```

---

## 7. Embedding Management

### 7.1 Vector Storage Strategy

| Location | Use Case | Max Size | Latency |
|----------|----------|----------|---------|
| **Fireproof local** | Hot cache, recent vectors | 10KB per doc | <10ms |
| **SQLite blob** | Warm cache, session vectors | Unlimited | <50ms |
| **Zep remote** | Cold storage, all vectors | Unlimited | <500ms |

### 7.2 Embedding Flow

```
Text → Hash → Check Fireproof Cache →
  HIT:  Return cached vector
  MISS: Generate via Ollama/HuggingFace → Cache locally → Return
```

### 7.3 Provider Priority

1. **Ollama** (`nomic-embed-text`) — Local, free, fast
2. **HuggingFace** — API fallback, many model options
3. **OpenAI** — Legacy fallback (deprecated)

---

## 8. Sync Architecture

### 8.1 Outbound Sync (Local → Remote)

```
Fireproof put() → Mark sync_status=PENDING →
→ Background worker → Batch pending docs →
→ POST to sync gateway → Mark sync_status=SYNCED
```

### 8.2 Inbound Sync (Remote → Local)

```
Polling/WebSocket notification →
→ Fetch remote changes → CRDT merge into Fireproof →
→ Notify subscribers → Update UI if needed
```

### 8.3 Conflict Resolution

- **Fireproof CRDT merge** handles document-level conflicts
- **Vector clocks** track causality for ordering
- **Tombstones** for soft deletes (sync before hard delete)

---

## 9. Configuration

### 9.1 Environment Variables

```bash
# YJS Configuration
YJS_WEBSOCKET_URL=ws://localhost:4444
YJS_ROOM_PREFIX=chrysalis-

# Fireproof Configuration
FIREPROOF_ENABLED=true
FIREPROOF_DB_PATH=./data/fireproof.db
FIREPROOF_SYNC_ENABLED=false
FIREPROOF_SYNC_GATEWAY=https://sync.example.com
FIREPROOF_PROMOTION_ENABLED=true
FIREPROOF_PROMOTION_THRESHOLD=0.7
FIREPROOF_LOCAL_VECTORS=true

# Embedding Provider
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
HUGGINGFACE_API_KEY=hf_...
```

### 9.2 Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `enableYjs` | `false` | Enable YJS real-time sync |
| `FIREPROOF_ENABLED` | `false` | Enable Fireproof persistence |
| `FIREPROOF_SYNC_ENABLED` | `false` | Enable remote sync |
| `FIREPROOF_PROMOTION_ENABLED` | `false` | Enable bead → memory promotion |
| `FIREPROOF_LOCAL_VECTORS` | `false` | Cache vectors locally |

---

## 10. Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| YJS integration | ✅ Implemented | ProjectionService, Workspace |
| Fireproof service | ✅ Implemented | SQLite backend |
| CRDT merge | ✅ Implemented | LWW + array union |
| Vector cache | ✅ Implemented | Local SQLite blob storage |
| YJS → Fireproof bridge | 🔄 Partial | Needs snapshot automation |
| Remote sync | ⏸️ Planned | Awaiting sync gateway |
| Embedding providers | ✅ Implemented | Ollama, HuggingFace, OpenAI |

---

## 11. Future Enhancements

1. **Native Fireproof bindings** — Replace SQLite emulation with JS Fireproof
2. **WebRTC sync** — Direct peer-to-peer for Fireproof
3. **Selective sync** — Sync only high-importance items
4. **Encrypted sync** — E2E encryption for remote storage
5. **Vector index in Fireproof** — HNSW index for local similarity search
