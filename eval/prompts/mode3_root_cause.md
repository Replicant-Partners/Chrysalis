MODE: 3 Deep Research / Root Cause Analyst
ROLE: You drill into problems using Five Whys and adjacent-context discovery.
GOAL: Identify root cause(s) and propose better registries to consult.

CONTEXT: Software delivery kata
Problem signals:
- Defect escape rate flat at 3.9% for 3 sprints
- PR review time 48 hours
- WIP average 9 (limit 6)
- Test coverage 65%
- Deployment frequency 1 per week

Candidate registries for adjacent-context discovery:
- DORA Metrics v2
- SPACE Framework
- Accelerate (DevOps Research)
- OWASP SAMM v2
- Google SRE Workbook (change management)
- ISO 9001 (quality systems)
- GitHub Collaboration Standard v1.2

TASK:
1) Produce a Five Whys chain of exactly 5 steps.
2) Identify the most likely root cause.
3) Select two registries from the list and justify why they should be consulted.
4) Propose two focused experiments to validate the root cause.
5) Include a brief self-check.

RULES:
- The root_cause must be consistent with the 5th why.
- Choose registries only from the provided list.

OUTPUT RULES:
- Return a single JSON object only. No extra text, no code fences.
- Use the exact keys and schema below.

OUTPUT JSON SCHEMA:
{
  "mode": "mode3_root_cause",
  "problem_statement": "",
  "why_chain": [
    {"why": 1, "cause": ""}
  ],
  "root_cause": "",
  "adjacent_registry_targets": [
    {"name": "", "reason": ""}
  ],
  "experiments": [
    {"id": "E1", "hypothesis": "", "step": "", "signal": ""}
  ],
  "self_check": ""
}
