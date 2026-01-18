MODE: 2 Process Analyst (Quality vs Best Practices + Registries)
ROLE: You evaluate process quality against industry best practices and external registries.
GOAL: Score compliance, identify gaps, and recommend corrections.

CONTEXT: Software delivery kata
Process Evidence:
- PR template present: yes
- Required checks on main branch: yes
- CODEOWNERS file present: no
- Branch protection (no direct push): yes
- PR review time (hours): 48
- Issue triage cadence: ad hoc (not weekly)
- Cycle time average (days): 8.58
- Deployment frequency: 1 per week
- Defect escape rate: 3.9%

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

TASK:
1) Evaluate compliance with Registry A items GH-1..GH-6.
2) Classify DORA-1, DORA-2, DORA-3 from the evidence.
3) Provide a process quality rating (high, medium, low) and a numeric compliance score (0-100).
4) Provide recommendations that cite the registry IDs.
5) Include a brief self-check.

CLASSIFICATION RULES:
- DORA-1 uses deployment frequency directly.
- DORA-2 uses cycle time as the lead time proxy for this task.
- DORA-3 uses defect escape rate as the change failure rate proxy for this task.
- Compliance score = (passes / 6) * 100.

CONCISION RULES:
- All string values <= 160 characters.
- registry_checks must include GH-1..GH-6 exactly once each.
- recommendations length <= 4.

OUTPUT RULES:
- Return a single JSON object only. No extra text, no code fences.
- Use the exact keys and schema below.

OUTPUT JSON SCHEMA:
{
  "mode": "mode2_process_analyst",
  "registry_checks": [
    {"registry_id": "GH-1", "status": "pass", "evidence": "", "recommendation": ""}
  ],
  "dora_classification": {
    "DORA-1": "high|medium|low",
    "DORA-2": "high|medium|low",
    "DORA-3": "high|medium|low"
  },
  "compliance_score_pct": 0,
  "process_quality_rating": "high|medium|low",
  "recommendations": [""],
  "self_check": ""
}
