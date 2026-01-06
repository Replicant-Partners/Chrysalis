# CapabilityGateway

Node/TS service exposing an agent-facing API for Chrysalis “learning capabilities”.

Endpoints:
- `POST /capabilities/grounding` → runs KnowledgeBuilder adapter and commits semantic claim events to LedgerService
- `POST /capabilities/skillforge` → runs SkillBuilder adapter and commits skill events to LedgerService
- `POST /auth/bootstrap` → one-time creation of an initial API key (returns token once)

Auth:
- After bootstrapping, all capability endpoints require `Authorization: Bearer <keyId>.<secret>`.

Agent identity:
- Requests may supply `agentId`, or an `agent` profile block (with `designation`) to auto-register a new Replicant via `LedgerService /agents/register`.

This service is intentionally minimal (API keys for now) and focuses on correct wiring:
adapter → uSA events → signed ledger commits → projections.
