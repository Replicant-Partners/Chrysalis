# GaryVision Builder Runbook (Telemetry + Troubleshooting)

This runbook standardizes how to run the Builder for the GaryVision team with telemetry and fallback safety.

## 1) Environment

```bash
source .venv/bin/activate

# Required
export VOYAGE_API_KEY="<voyage_ai_key>"       # primary embeddings
export OPENAI_API_KEY="<openai_key>"         # fallback embeddings
export ANTHROPIC_API_KEY="<anthropic_key>"   # Claude Sonnet 4.5 (semantic)

# Optional / diagnostics
export EMBEDDING_PROVIDER=""   # auto (voyage→openai→deterministic)
export LOG_LEVEL=INFO           # set to DEBUG for deep traces
```

## 2) Health checks

```bash
# Embedding provider + dimensions
python - <<'PY'
from memory_system.embedding import EmbeddingService
s = EmbeddingService()
print(s.get_provider_info())
print(len(s.embed("hello voyage")))
PY

# Full test smoke (should be 127/127)
python3 -m pytest projects/KnowledgeBuilder/tests/ -v
python3 -m pytest memory_system/tests/ -v
```

## 3) Run Builder with telemetry (recommended default)

```bash
LOG_LEVEL=INFO python3 projects/KnowledgeBuilder/src/pipeline/simple_pipeline.py \
  --source "sample" \
  --target "output" \
  --max-results 20
```

Notes:
- Uses Voyage AI by default; if VOYAGE_API_KEY missing or fails, it falls back to OpenAI; else deterministic.
- If network is blocked, force offline mode: `export EMBEDDING_PROVIDER=deterministic`.

## 4) Common failure causes and fixes

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `ModuleNotFoundError: pyarrow` | pyarrow not installed | `pip install -r projects/KnowledgeBuilder/requirements.txt` |
| Voyage HTTP errors/timeouts | Missing/invalid VOYAGE_API_KEY or egress block | Set VOYAGE_API_KEY; if blocked, `EMBEDDING_PROVIDER=openai` or `deterministic` |
| OpenAI errors | Missing OPENAI_API_KEY | Set OPENAI_API_KEY or fallback to deterministic |
| Anthropic errors | Missing ANTHROPIC_API_KEY | Set key; otherwise HeuristicStrategy still works (lower confidence) |
| Permission errors on data/ | Read-only data directory | Ensure `data/` and sqlite/LanceDB paths are writable |

## 5) Telemetry checklist

- Set `LOG_LEVEL=DEBUG` to capture provider selection, HTTP fallbacks, and LanceDB ops.
- Verify provider: `EmbeddingService().get_provider_info()` prints `provider/model/dimensions`.
- Network-offline runs: `EMBEDDING_PROVIDER=deterministic` (hash-based) and unset ANTHROPIC_API_KEY (uses heuristic).

## 6) If failures persist

Capture and share:
- Full command line used
- LOG_LEVEL=DEBUG output excerpt
- Environment provider info (from the snippet in section 2)

Then rerun with `EMBEDDING_PROVIDER=deterministic` to isolate network/API issues.

