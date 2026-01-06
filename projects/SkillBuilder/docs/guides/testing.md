# Testing, Calibration, and Debugging

## Quick sanity checks

- Validate that your spec parses and resolves output paths:
  - `python3 scripts/mode_frontend.py examples/testcase_rother.yaml --max-results 1`

## Full run

1. Ensure environment variables for HTTP providers are set:
   - `TAVILY_API_KEY`, `BRAVE_API_KEY`
2. Run:
   - `python3 scripts/mode_frontend.py examples/testcase_rother.yaml`
3. Inspect outputs in `out_dir`:
   - `semantic-map.md`, `skills.md`, `citations.md`, `mode-reference.md`
4. Debug using telemetry:
   - open `telemetry.jsonl`, search for `run.error`
   - confirm `search.backend.selected` is the expected backend
   - inspect `search.tool.error` events

## Telemetry location
- Per-run telemetry: `.roo/runs/<run_id>/telemetry.jsonl`
- Batch merge telemetry: `.roo/runs/<run_id>/batch_merge.jsonl`

## Regression validation
- Compare telemetry between runs for key signals (search.rrf.fused counts, synthesis timings, artifact.written paths) to ensure behavioral consistency after changes.

## Calibration heuristics

- If skills are too vague: increase specificity in salts and add more technical query templates.
- If results are noisy: reduce `search_max_results_per_query`, increase trust allowlist, or add domain filters.
- If stage 2 is unhelpful: tighten stage-2 templates (standards bodies, societies, reference models).
