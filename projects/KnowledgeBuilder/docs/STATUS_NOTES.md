# Status Notes (current session)

Date: 2025-02 (checkpoint)

- Browserbase and YAGO removed; Schema.org is the ground truth scaffold.
- Judge-based (RAGAS-lite) evaluation in place; default backend OpenAI (gpt-4o-mini). Control set: `data/judge_control.json`. Script: `scripts/run_judge_eval.py` logs scores to `data/telemetry.db` (eval_metrics).
- Ollama path supported but untested here; default model for Ollama is `llama3.2:3b`. Use `JUDGE_BACKEND=ollama` and `OLLAMA_BASE_URL` to try locally.
- Telemetry now stores both tool calls and eval metrics.
- Agentic framework assessment added to plan (LangGraph/LCEL, LlamaIndex Agents, AutoGen, Haystack Agents).

Next actions
- Run judge eval with OpenAI to accumulate scores on a richer control set of real enrichments; use telemetry to tune snippet limits/merge thresholds/timeouts.
- If needed, resolve dependency warnings (crewai vs openai/fsspec) with a constraints file.
- If returning to Ollama, probe available endpoints (`/api/chat` vs `/api/generate`) on your machine and adjust `OLLAMA_BASE_URL`/model accordingly.
