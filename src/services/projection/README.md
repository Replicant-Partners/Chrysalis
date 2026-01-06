# ProjectionService (Public Plane)

Standalone Node/TS service that:
- polls the private ledger plane for new commits
- projects commits into **public CRDT read models** over WebSocket (Yjs)

Read models (CRDT maps) are derived:
- `publicClaims` (canonical public semantic claim per key when unambiguous or resolved)
- `semanticCandidates` (candidate claim hashes per key)
- `suppressionSet` (claim hashes suppressed by resolution)
- `skills` (skill records)

This service intentionally avoids making “truth” decisions by itself; it projects deterministic decisions that arrive as events (e.g., `ResolutionEvent`).
