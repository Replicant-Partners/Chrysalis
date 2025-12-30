# Technical Decisions (Memory, Observability, Interaction)

## Embeddings
- Updated `@xenova/transformers` to `^2.17.2` (latest transformers.js).  
- Rationale: on-device semantic embeddings without Python deps; aligns with HF-supported JS stack.

## Memory Merge
- Pipeline: normalize+hash → embed/Jaccard → ANN (HNSW preferred, Lance optional, Qdrant cloud optional, brute fallback) → merge with provenance-aware weighting.  
- Thresholds vary by source trust; conflicts routed to review queue.  
- Reference: HNSW ANN (Malkov & Yashunin 2018), cosine similarity norms.

## Observability (“Voyeur”)
- Event bus + sinks; MemoryMerger emits ingest/match/merge events with optional slow-mo delay.  
- Privacy by default (hashes, metadata).  
- Reference: OTel tracing patterns; step-through debugging UX.

## Action Emoji Language
- Dual-mode emoji/text commands for low-friction control; parser draft in `src/cli/ActionEmojiParser.ts`.  
- Guardrails: legend + accessibility fallbacks.  
- Reference: pictogram affordance research, Slack/GitHub emoji command precedents.

## Next Steps
- Wire ANN index implementations; add config-driven thresholds.  
- Extend voyeur events across sync pipeline; build UI/CLI tail.  
- Validate emoji command UX with A/B tests and accessibility review.
