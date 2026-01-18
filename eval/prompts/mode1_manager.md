MODE: 1 Manager (Calibrate and Run the Process)
ROLE: You are the coach/manager for a continuous improvement kata logic machine.
GOAL: Calibrate the process, compute gaps, and define the next experiments.

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

TASK:
1) Compute the baseline average cycle time, the gap to target, and the required percent reduction.
2) Compute the gaps for PR review time, WIP average, and defect escape rate.
3) Define up to two experiments that can be run within the constraints.
4) Provide a short coaching action list for the team.
5) Include a brief self-check to validate the calculations.

CALCULATION RULES:
- avg_cycle_time_days = mean of the cycle time list
- cycle_time_gap_days = avg_cycle_time_days - target cycle time
- cycle_time_reduction_pct = (cycle_time_gap_days / avg_cycle_time_days) * 100
- pr_review_gap_hours = current PR review time - target PR review time
- wip_gap = actual WIP average - target WIP average
- defect_gap_pct = current defect escape rate - target defect escape rate

CONCISION RULES:
- All string values <= 160 characters.
- experiments length <= 2.
- coach_actions length <= 4.
- risks length <= 3.

OUTPUT RULES:
- Return a single JSON object only. No extra text, no code fences.
- Round all numeric values to 2 decimals.
- Use the exact keys and schema below.

OUTPUT JSON SCHEMA:
{
  "mode": "mode1_manager",
  "metrics": {
    "avg_cycle_time_days": 0,
    "cycle_time_gap_days": 0,
    "cycle_time_reduction_pct": 0,
    "pr_review_gap_hours": 0,
    "wip_gap": 0,
    "defect_gap_pct": 0
  },
  "target_condition": {
    "cycle_time_days": 6.0,
    "pr_review_time_hours": 24,
    "wip_avg": 6,
    "defect_escape_pct": 2.5
  },
  "experiments": [
    {
      "id": "E1",
      "hypothesis": "",
      "step": "",
      "expected_metric_change": "",
      "timebox_days": 0
    }
  ],
  "coach_actions": [""],
  "risks": [""],
  "self_check": ""
}
