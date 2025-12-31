# Sync Primitives, Vocabulary, and Commands

## Nouns (Artifacts)
- **memory**: content + metadata + hash (fingerprint).
- **doc**: CRDT/Yjs document (public/shared).
- **tx**: ledger transaction for commits/key rotations.
- **hash**: SHA-384 fingerprint of content.
- **channel**: CRDT room/topic.
- **commit**: signed ledger entry anchoring a hash.

## Verbs (Actions)
- `join` (CRDT channel), `update` (CRDT doc), `snapshot` (CRDT state).
- `commit` (ledger hash), `query` (ledger tx/hash), `keyrotate` (ledger key update).
- Existing sync verbs: `stream`, `batch`, `check_in`, `sync`.
- Observability verbs: `tail`, `metrics`, `redact`.

## CLI/Emoji Mapping (draft)
- 🛰️/`sync` → start sync (context-aware).
- 📡/`join` → join CRDT channel.
- 📥/`update` → push CRDT update.
- 🧾/`snapshot` → fetch CRDT snapshot.
- 🛡️/`commit` → ledger commit.
- 🔍/`query` → ledger query.
- 🔑/`keyrotate` → rotate keys.
- 🧠/`reflect` and 🔍/`search` remain unchanged.

## Standards to Align With
- CRDT: Yjs/SyncedStore; JSONPatch-like semantics for docs.
- Ledger: Hedera SDK transaction types; Ed25519 signatures (RFC 8032).
- Hashing: SHA-384 (NIST SP 180-4).
- Transport: WebSocket for CRDT; HTTPS/TLS for ledger API.

## Open Questions
- Which Hedera client variant (REST vs SDK) and auth model for subnet/mainnet?
- CRDT persistence: local snapshots vs always-online provider?
- Command surface: do we expose CRDT/ledger verbs in CLI as subcommands or behind `sync --mode {crdt|ledger}`?
- Default trust-tier mapping: when to auto-commit to ledger vs CRDT-only?
