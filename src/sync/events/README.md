# uSA Event Contracts (Chrysalis)

This module defines the canonical **typed events** Chrysalis uses for:
- deterministic convergence (event log is the source of truth)
- dual-plane sync (private ledger-shaped HTTPS plane + public CRDT view)
- adapter integration (KnowledgeBuilder and SkillBuilder emit into these types)

Primitives (core):
- persona
- rights
- skills
- episodic_memory
- semantic_memory

Semantic memory conflicts are resolved by emitting `ResolutionEvent` which updates the public view and suppresses losing claims in outward sync flows, while retaining full history.
