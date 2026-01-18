MODE: Combined (Modes 1-4 in one run)
ROLE: You are the coach/manager for a continuous improvement kata logic machine.
GOAL: Produce outputs for Modes 1-4 in a single response.

CONTEXT: Software delivery kata
Vision: Deliver features 2x faster with <= 2.0% defect escapes.
Constraints: No team size change. Max 2 experiments per week. Use only the data below.
Current Condition (last 4 sprints):
- Cycle time (days): [9.5, 8.7, 8.2, 7.9]
- PR review time (hours): 48
- WIP limit: 6
- Actual WIP average: 9
- Build success rate: 92%
- Defect escape rate: 3.9%
- Test coverage: 65%
- Deployment frequency: 1 per week
Target Condition (4 weeks):
- Cycle time: 6.0 days
- PR review time: <= 24 hours
- WIP average: <= 6
- Defect escape rate: <= 2.5%

Registry A: GitHub Collaboration Standard v1.2
- GH-1: PR description template required
- GH-2: Reviews completed within 24 hours
- GH-3: Required status checks on protected branches
- GH-4: CODEOWNERS required for critical paths
- GH-5: No direct push to protected branches
- GH-6: Weekly issue triage

Registry B: DORA Metrics v2 (simplified)
- DORA-1 Deployment frequency: 1/day high, 1/week medium, 1/month low
- DORA-2 Lead time: <= 1 day high, <= 7 days medium, > 7 days low
- DORA-3 Change failure rate: <= 15% high, 16-30% medium, > 30% low

Candidate registries for adjacent-context discovery:
- DORA Metrics v2
- SPACE Framework
- Accelerate (DevOps Research)
- OWASP SAMM v2
- Google SRE Workbook (change management)
- ISO 9001 (quality systems)
- GitHub Collaboration Standard v1.2

TASK:
1) Mode 1: compute gaps and propose up to two experiments.
2) Mode 2: evaluate registries and classify DORA metrics.
3) Mode 3: five whys (5 steps) and pick two registries.
4) Mode 4: synthesize and update prompts/process.
5) Include a brief self-check at the top level.

CALCULATION + CLASSIFICATION RULES:
- avg_cycle_time_days = mean of the cycle time list.
- cycle_time_gap_days = avg_cycle_time_days - target cycle time.
- cycle_time_reduction_pct = (cycle_time_gap_days / avg_cycle_time_days) * 100.
- pr_review_gap_hours = current PR review time - target PR review time.
- wip_gap = actual WIP average - target WIP average.
- defect_gap_pct = current defect escape rate - target defect escape rate.
- DORA-2 uses cycle time as the lead time proxy for this task.
- DORA-3 uses defect escape rate as the change failure rate proxy for this task.
- Compliance score = (passes / 6) * 100.

CONCISION + DIAGRAM RULES:
- All string values <= 160 characters.
- diagram_mermaid is required and must be a valid Mermaid flowchart with <= 6 nodes.

OUTPUT RULES:
- Return a single JSON object only. No extra text, no code fences.
- Round all numeric values to 2 decimals.
- Use the exact keys and schema below.

OUTPUT JSON SCHEMA:
{
  "mode": "combined",
  "mode1": {"metrics": {}, "experiments": [], "coach_actions": [], "risks": []},
  "mode2": {"registry_checks": [], "dora_classification": {}, "compliance_score_pct": 0, "process_quality_rating": ""},
  "mode3": {"why_chain": [], "root_cause": "", "adjacent_registry_targets": [], "experiments": []},
  "mode4": {"synthesis": {}, "prompt_updates": [], "process_updates": [], "learning_metric": {}},
  "diagram_mermaid": "",
  "self_check": ""
}
