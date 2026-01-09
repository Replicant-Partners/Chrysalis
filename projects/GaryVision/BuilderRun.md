# Chrysalis Builder Pipeline Guide (GaryVision)

This guide explains how to run KnowledgeBuilder and SkillBuilder, where embeddings are stored in LanceDB, and where to place JSON outputs.

---
## Paths and Outputs
- **LanceDB (KnowledgeBuilder default):** `./data/lancedb` (directory dataset). Table: `knowledgebuilder_entities`.
- **SQLite cache (KnowledgeBuilder):** `./data/cache.db`.
- **Suggested JSON/output dir:** `./projects/KnowledgeBuilder/output/` (create if needed) or pass a custom `--target`.
- **This guide:** `projects/GaryVision/BuilderRun.md`.

To change LanceDB location, set `LANCE_URI` and wire it into `LanceDBClient` init. The dataset lives under `data/lancedb/knowledgebuilder_entities.lance/` (manifests + shard files), not a single `.lance` file.

---
## Environment Setup
```bash
source .venv/bin/activate
export LOG_LEVEL=INFO          # DEBUG for deep telemetry
# .env already has VOYAGE_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY

# Optional
export EMBEDDING_PROVIDER=""   # voyage | openai | deterministic (auto if empty)
export LANCE_URI="./data/lancedb"  # set a custom LanceDB path if desired
```

---
## Health Checks
1) Embedding provider + vector length
```bash
python - <<'PY'
from memory_system.embedding import EmbeddingService
s = EmbeddingService()
print(s.get_provider_info())
print(len(s.embed("hello voyage")))
PY
```
2) Tests (should pass)
```bash
python3 -m pytest projects/KnowledgeBuilder/tests/ -v
python3 -m pytest memory_system/tests/ -v
```

---
## Run KnowledgeBuilder (writes embeddings to LanceDB)
Uses `LanceDBClient.insert_entity(...)` to store vectors in LanceDB; see `projects/KnowledgeBuilder/src/storage/lancedb_client.py`.
```bash
LOG_LEVEL=INFO python3 projects/KnowledgeBuilder/src/pipeline/simple_pipeline.py \
  --source "sample" \
  --target "output" \
  --max-results 20
```
What happens:
- Collect snippets → embed text → insert into LanceDB table `knowledgebuilder_entities` (default path `./data/lancedb`).
- Cache at `./data/cache.db`.

Change LanceDB path:
```bash
export LANCE_URI="/absolute/or/relative/path"
LOG_LEVEL=INFO python3 projects/KnowledgeBuilder/src/pipeline/simple_pipeline.py --source "sample" --target "output"
```

---
## Run SkillBuilder (high level)
SkillBuilder emits JSON/markdown; it does not auto-persist to LanceDB. To persist, add a post-step:
```python
from memory_system.embedding import EmbeddingService
from src.storage.lancedb_client import LanceDBClient

emb = EmbeddingService()
lance = LanceDBClient(uri="./data/lancedb", table_name="knowledgebuilder_entities", vector_dim=1024)

text = "skill summary text"
vec = emb.embed(text)
entity = {"id": "skill-1", "name": "Skill 1", "type": "skill", "text": text}
lance.insert_entity(entity, vec)
```
Example SkillBuilder run (adjust to your script):
```bash
source .venv/bin/activate
export LOG_LEVEL=INFO
python3 scripts/chrysalis_emit_skills.py --input data/skills.yaml --out projects/KnowledgeBuilder/output/skills.json
```

---
## LanceDB storage notes
- Dataset lives under `./data/lancedb/knowledgebuilder_entities.lance/`.
- To relocate, set `LANCE_URI` or pass a custom `uri` when constructing `LanceDBClient`.

---
## Common Failure Fixes
- `ModuleNotFoundError: pyarrow` → `pip install -r projects/KnowledgeBuilder/requirements.txt`
- Voyage/OpenAI timeouts → `EMBEDDING_PROVIDER=deterministic` or ensure network/keys
- Anthropic missing → semantic falls back to heuristic (lower confidence)
- Permissions → ensure `data/` is writable

---
## Minimal Offline (deterministic) Run
```bash
source .venv/bin/activate
export EMBEDDING_PROVIDER=deterministic
unset ANTHROPIC_API_KEY
python3 projects/KnowledgeBuilder/src/pipeline/simple_pipeline.py --source "sample" --target "output" --max-results 5
```
Result: hash-based embeddings still stored in LanceDB.

---
## Need me to run it for GaryVision?
Send the exact command (entrypoint + args). I will run with `LOG_LEVEL=DEBUG` and confirm LanceDB path and inserts.

