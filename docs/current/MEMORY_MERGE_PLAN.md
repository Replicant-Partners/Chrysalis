# Memory Merge Plan (v3.1 → v3.2)

## Goals
- Semantic deduplication with bounded latency (target p99 < 100 ms at 10K memories).
- Provenance-aware confidence updates that resist noisy or malicious sources.
- Clear event hooks for observability (“voyeur” stream) and offline review.
- Upgrade path to vector indexing (HNSW) without breaking current APIs.

## Pipeline (proposed)
1) **Normalize + hash**: trim, lower, collapse whitespace; compute SHA-384 for exact dedupe cache.  
2) **Similarity path selection**: if embedding service ready → embedding; else Jaccard fallback.  
3) **Candidate search**: exact-hash cache → ANN index (HNSW) when enabled → linear scan fallback.  
4) **Similarity decision**: compare against threshold tuned by source trust tier (human > agent > auto).  
5) **Merge policy**: weighted confidence (recency + source trust), tags/metadata union, importance = max, provenance append.  
6) **Conflict handling**: if similarity in “gray zone” or confidence gap too small, enqueue for review; emit voyeur event.  
7) **Persist/index**: write to store and update vector index (if enabled); maintain related_memories edges.

## Tuning Defaults
- Similarity thresholds: human-origin 0.80, agent 0.85, auto/ingested 0.90 (cosine).  
- Timeout budget: embedding call < 150 ms; ANN query < 25 ms; linear scan only when collections are small or ANN unavailable.  
- Caps: per-source contribution caps to avoid dominance; LRU decay for rarely used memories.

## Vector Index Backends
- Preferred: **HNSW** (`hnswlib-node`) for fast ANN; auto-fallback to brute-force if not installed.  
- Optional: **LanceDB** adapter scaffolded for persistent vectors (requires `lancedb`).  
- Config: `vector_index_type` = `hnsw | lance | brute`; default tries HNSW then falls back.

## Merge Rules (deterministic)
- Confidence: `c_new = lerp(c_old, c_incoming, weight)` where weight depends on source tier and recency.  
- Importance: take max; record rationale.  
- Timestamps: keep earliest created, update last_accessed.  
- Provenance: append source_instance + hash; maintain count of unique sources.  
- Related memories: symmetric links for matches; keep top-k by similarity.  
- Privacy: do not merge PUBLIC with PRIVATE; keep partitions separate.

## Observability Hooks (“Voyeur”)
- Emit structured events at: ingest-start, embed-request, candidate-match, merge-applied, merge-deferred, error.  
- Fields: event_id, kind, memory_hash, similarity, thresholds, source_instance, latency_ms, decision_reason.  
- Controls: sampling rate, redaction (strip content), slow-mo mode (optional delays between stages).

## Data Structures
- `HashCache`: map SHA-384 → memory_id.  
- `EmbeddingService`: pluggable (mock, transformers.js).  
- `VectorIndex`: interface with `upsert(memory_id, embedding)` and `findSimilar(vector, topK, minScore)`.  
- `VoyeurSink`: `emit(event)` for UI/telemetry.

## References
- HNSW ANN: Malkov & Yashunin, “Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs” (2018).  
- Gossip/backoff patterns for sync: Birman (1999); Lamport clocks (1978) for ordering.  
- Robust aggregation/Byzantine tolerance: threshold 2/3, median/trimmed mean (standard BFT literature).  
- Embedding similarity: cosine on normalized vectors; transformers.js (`@xenova/transformers`) for on-device embedding.
