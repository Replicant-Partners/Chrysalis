# Documentation Audit (Current vs Historical)

This audit records how documentation was reorganized to reduce confusion and align docs with the implemented system.

## Current documentation set

Current docs live under `docs/` and are organized by audience and purpose:
- operator guidance: `docs/guides/`
- architecture and contracts: `docs/architecture/`
- status and audit: `docs/status.md`, `docs/audit.md`

## Archived documentation set

Non-current or historical materials are under `docs/archive/` (see [archive index](archive/README.md)). Example: [Custom-Modes](archive/Custom-Modes.md) is retained for reference only; active modes live in `ExistingModes/` and Kilocode configs.

## De-confliction rules

When discrepancies exist:
1. Prefer implemented behavior in the code (Python pipeline, Go search, Clojure synthesis).
2. Update `docs/status.md` and the relevant `docs/` pages as part of the fix.
3. If an archived doc is still useful, keep it archived and add a pointer in current docs instead of duplicating it.
