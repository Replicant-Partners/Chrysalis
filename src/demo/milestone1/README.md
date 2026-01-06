# Milestone #1 Demo: Two Replicants + Chrysalis Node (Dual Sync Plan)

This demo stands up:

- **Chrysalis Node**
  - **Private plane (HTTPS/TLS, ledger-shaped)**: `commit/query/keyrotate` + poll-based semantic resolution
  - **Public plane (WebSocket CRDT)**: Yjs document for the public semantic view (`publicClaims`) + suppression set (`suppressionSet`)
- **Two Replicant instances** (`replicant-a`, `replicant-b`) that:
  - register as subscribed instances
  - commit conflicting semantic claims
  - vote to resolve the conflict
  - converge via the public CRDT document

## Run

From the repo root:

```bash
npm run demo:milestone1
```

## Processes

- `dist/demo/milestone1/chrysalis-node-runner.js` (HTTPS ledger + CRDT WebSocket)
- `dist/demo/milestone1/replicant-runner.js` (Replicant instance; accepts JSON commands on stdin)
- `dist/demo/milestone1/run-demo-processes.js` (spawns the above and drives the scenario)

## What you should see

- Two conflicting semantic claims are committed for the same `key`.
- Chrysalis resolves the conflict and broadcasts:
  - `publicClaims[key] = { claimHash, resolvedAt }`
  - `suppressionSet[loserClaimHash] = true`
- Both replicants print the same CRDT state.

## Notes

- This uses a **dev self-signed TLS cert** generated into `.demo/milestone1/tls/` on first run.
- The CRDT transport is a minimal Yjs-over-WebSocket broadcast protocol (not the y-websocket server protocol).
