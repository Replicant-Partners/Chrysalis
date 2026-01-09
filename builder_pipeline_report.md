hat# Chrysalis Builder Pipeline Report

## Complex Learner Commitments
- Identity: complexity scientist; model evolving interacting patterns; default lenses are evolution-over-time + Five Whys (see [AGENT.md](AGENT.md:1)).
- Priority: learning and disciplined discovery first; solutions preserve understanding; reason symbolically/probabilistically.
- Workflow: Discovery → Investigation → Synthesis → Reporting; ask why until root causes surface.
- Rigor: single-step inferences; mark confidence; cite evidence; avoid chained speculation; cross-check recency/quality.
- Method: semantic/symbolic analysis over brute force; tackle issues directly; systematic refactors over quick hacks.
- Collaboration/Tone: lead with analysis; disagree plainly; accuracy over reassurance.
- Reporting: concise, evidence-backed, document decisions/trade-offs and boundaries.

## Artifacts and Locations
- Harnessed legend runs and telemetry: [scripts/process_legends.py](scripts/process_legends.py:1)
- Embedding summaries: `Replicants/legends/Embeddings/*_embeddings.json`
- Full embeddings + contexts: `Replicants/legends/Embeddings/*_embeddings_full.json`
- Per-run skill artifacts: `Replicants/legends/Skills/*_skills_run{n}.json`
- Harness log (descriptor strategy, durations): `Replicants/legends/Embeddings/harness_log.jsonl`

## Current Run Summary (hybrid descriptor sampling, 3 iterations per legend)
- Legends processed: 49 JSON legends × 3 KB + 3 SB passes each (147 KB + 147 SB iterations).
- Descriptor strategy: hybrid (focused on odd runs, diverse on even runs) sourced only from legend JSON buckets.
- Outputs persisted to Legends/Embeddings and Legends/Skills; previous deterministic embeddings remain until rerun with live providers.

## API Keys Located (.env)
- OpenAI: [OPENAI_API_KEY](.env:57)
- Voyage: [VOYAGE_API_KEY](.env:49)
- Tavily: [TAVILY_API_KEY](.env:101)
- LanceDB: [LANCEDB_API_KEY / LANCEDB_DATABASE_URI](.env:89)
- Anthropic (if needed for deepening): [ANTHROPIC_API_KEY](.env:47)

## Required Rerun with Real Providers
- Action: rerun builders with environment loaded from `.env` and ensure LanceDB + Tavily available. Example command (loads keys explicitly):
  ```bash
  set -a && source .env && set +a \
    && python3 scripts/process_legends.py --run-count 3 --strategy hybrid
  ```
- If LanceDB import is missing, install in the active environment before rerun:
  ```bash
  pip install lancedb
  ```
- Verify EmbeddingService logs switch from "deterministic" to provider (voyage/openai) and that KnowledgeBuilder collects/lands rows in LanceDB.

## Observations
- Harness now accumulates prior-run descriptors/embeddings into later iterations; telemetry stored per run for analysis.
- Without loading .env, EmbeddingService falls back to deterministic and KnowledgeBuilder cannot call Tavily/LanceDB; collected_knowledge remains empty.
- Once rerun with keys, compare focused vs diverse descriptors via harness_log.jsonl and skill artifacts to tune descriptor sampling.

## Next Steps (recommended)
1) Load `.env` keys and rerun `scripts/process_legends.py` with run-count 3, hybrid strategy. Confirm KB logs show real provider and LanceDB writes succeed.
2) Regenerate harness_log.jsonl and Embeddings/Skills outputs (overwrite allowed).
3) Add simple quality metrics (embedding norm, collected_knowledge count) into harness_log for future comparisons.
4) Optionally add KnowledgeBuilder pipeline outputs into subsequent SkillBuilder contexts to deepen accumulation across runs.

## Investigation Path (what was inspected)
- Architecture docs: [projects/SkillBuilder/docs/architecture/overview.md](projects/SkillBuilder/docs/architecture/overview.md:1), [projects/GaryVision/BuilderRun.md](projects/GaryVision/BuilderRun.md:1)
- Legend definitions: `Replicants/legends/*.json`
- Harness script: [scripts/process_legends.py](scripts/process_legends.py:1)
- Environment keys: [.env](.env:47)

Commitment: I will load the API keys from `.env` and use them on the next builder run, not defaulting to deterministic providers when keys are present.
