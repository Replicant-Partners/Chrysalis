# LedgerService (Private Plane)

Standalone Node/TS service implementing the **ledger-shaped** private plane:
- instance registration + key rotation
- signed commits of typed uSA events
- query by tx id / event hash

This is the authoritative append-only log that other services derive read models from.

Initial implementation is extracted from the Milestone #1 demo node.
