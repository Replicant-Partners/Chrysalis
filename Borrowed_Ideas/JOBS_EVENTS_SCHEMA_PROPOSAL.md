# Chrysalis: Durable Jobs + Events Schema Proposal (Version 85)

**Date**: 2026-01-04  
**Goal**: Make interaction loops tight and resilient by turning workflow state into durable, replayable patterns.

---

## 1) Problem framing (evolution of interacting patterns)

**Current patterns** (observed):

- Ledger (authoritative, durable) + derived indexes (Qdrant; optional Arango).
- Some workflow state is **process-local**:
  - creative loop session state
  - WebSocket ticket stores
  - event stream used for progress

As the system evolves (more users, multi-process deployment, retries, partial failures), these patterns interact and create emergent failure modes:

- lost progress after restart,
- drift between ledger and Qdrant,
- duplicate work on retries,
- inconsistent UX for 85ers (“what happened?”).

---

## 2) Design principle

- **Ledger remains the SSOT** for photo lifecycle state.
- **Jobs become the SSOT** for workflow execution state.
- **Events become the SSOT** for progress/history and UI replay.

This preserves the architecture invariant “system of record vs derived indexes” while making workflows resilient.

---

## 3) Minimal Job model

### 3.1 Job fields (minimum)

```text
job_id: uuid
job_type: enum
subject_type: enum (photo | household | creative_session | backfill_run)
subject_id: string
requested_by_user_id: string
household_id?: string
status: enum (queued | running | succeeded | failed | canceled)
attempts: int
max_attempts: int
idempotency_key?: string
created_at, updated_at: timestamps
last_error_code?: string
last_error_message?: string
last_error_details?: json
```

### 3.2 Job types (initial)

- `PHOTO_ANALYZE` (caption/tags/detections)
- `PHOTO_EMBED_UPSERT` (Qdrant upsert)
- `VECTORDB_BACKFILL_RUN` (rebuild embeddings from ledger)
- `DEDUP_CLASSIFY` (near-dup features)
- `COMPOSITE_BUILD` (merge_faces decisions)
- `PHOTO_PURGE` (two-stage deletion finalization)
- `CREATIVE_LOOP` (long-running creative session)

---

## 4) Events schema (typed, replayable)

### 4.1 Common event envelope

```json
{
  "event_id": "uuid",
  "job_id": "uuid",
  "timestamp": 1735940000.0,
  "type": "JOB_PROGRESS",
  "level": "info",
  "message": "Generating search index…",
  "data": {
    "percent": 42,
    "phase": "embed_upsert",
    "photo_id": "..."
  }
}
```

### 4.2 Event types

- `JOB_STATE`: status transitions (queued→running→succeeded/failed)
- `JOB_PROGRESS`: percent/phase + human message
- `JOB_OUTPUT`: references produced artifacts (derivative paths, counts)
- `USER_ACTION_REQUIRED`: e.g., “needs caregiver confirmation”
- `ERROR_USER_FACING`: maps to elder-friendly remediation shape

### 4.3 Storage for events

Choose the smallest durable mechanism first:

- **JSONL per job** under `data/jobs/events/<job_id>.jsonl` (local-first)
- Optional Redis stream or Arango collection later

Properties:

- append-only
- replayable to reconstruct progress UI
- safe under restart

---

## 5) Stores and interfaces

### 5.1 JobStore

- `create(job)`
- `get(job_id)`
- `list(filters)`
- `claim_next(worker_id, job_types)` (for worker model)
- `update_status(job_id, status, error?)`

### 5.2 EventStore

- `append(job_id, event)`
- `tail(job_id, since_event_id?)`
- `replay(job_id)`

### 5.3 TicketStore (for WS auth)

- `issue(ticket_type, user_id, subject_id, ttl_seconds)`
- `consume(ticket)`

Implementations:

- In-memory (dev)
- Redis (prod / multi-process)

---

## 6) How this tightens the user loops (Version 85)

- **Comfort**: progress is always explainable (“what is happening, how long, what next”).
- **Trust**: jobs can be resumed/inspected after restart.
- **Caregiver support**: `USER_ACTION_REQUIRED` events route to caregiver-friendly tasks.
- **Non-destructive**: job outputs always produce derivatives and metadata updates, not original mutation.

---

## 7) Migration path (minimize disruption)

1) Wrap current background tasks in Job records (even if executed in-process).
2) Emit events from existing workflow points:
   - upload pipeline
   - embedding upsert
   - composite worker
   - creative loop
3) Add a thin worker loop only after durability is proven.
4) Only then add Redis/Arango-backed shared stores if deploying multi-worker.
