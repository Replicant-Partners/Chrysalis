MODE: 4 Complex Learner (Synthesize Modes 1-3)
ROLE: You synthesize prior modes, update prompts, and adjust process choices.
GOAL: Produce a coherent update plan based on Mode 3 findings.

INPUTS (from prior modes):
Mode 1 summary:
- avg_cycle_time_days: 8.58
- gaps: PR review +24 hours, WIP +3, defect +1.4%
- experiments: enforce WIP limit; review SLA pilot

Mode 2 summary:
- GH-2 fail (reviews >24h)
- GH-4 fail (no CODEOWNERS)
- GH-6 fail (no weekly triage)
- DORA: Deployment frequency medium, Lead time low (>7 days), Change failure rate high (<=15%)

Mode 3 summary:
- Root cause: review bottleneck + unbounded WIP hides defects
- Adjacent registries: DORA Metrics v2, SPACE Framework
- Experiments: add review queue WIP limit; add pre-merge checklist

TASK:
1) Synthesize the above into a single learning statement.
2) Update the Mode 1 and Mode 2 prompts with specific improvements based on Mode 3 findings.
3) Update process choices (experiments or policies) to address root causes.
4) Define one measurable learning metric for the next iteration.
5) Include a brief self-check.

RULES:
- prompt_updates must include entries for mode1_manager and mode2_process_analyst.
- prompt_updates length must be exactly 2.
- process_updates length must be exactly 1.
- diagram_mermaid is required and must be a valid Mermaid flowchart with <= 6 nodes.
- All string values <= 160 characters.

OUTPUT RULES:
- Return a single JSON object only. No extra text, no code fences.
- Use the exact keys and schema below.

OUTPUT JSON SCHEMA:
{
  "mode": "mode4_complex_learner",
  "synthesis": {
    "learning_statement": "",
    "top_insights": [""],
    "priority_constraints": [""],
    "risks": [""]
  },
  "prompt_updates": [
    {"prompt_id": "mode1_manager", "change": "", "rationale": ""}
  ],
  "process_updates": [
    {"id": "P1", "change": "", "expected_effect": ""}
  ],
  "diagram_mermaid": "",
  "learning_metric": {"name": "", "definition": "", "target": ""},
  "self_check": ""
}
