# SkillBuilder Deepening (GaryVision agent enrichment)

**Last updated**: 2026-01-06  

This note documents how Chrysalis can enrich a seed persona by:

1) merging role “modes” (e.g. Root Cause Analyst, DevOps Architect) into `semantic_memory.items[]`, and  
2) running SkillBuilder “skillforge” (offline bridge), and  
3) optionally running LLM deepening passes (Anthropic Opus) to propose additional semantic items.

## Script

Use: `scripts/sem_agent.py`

### Example: generate `Sem25er.json` (offline-only)

```bash
python3 scripts/sem_agent.py \
  --persona ~/Documents/GitClones/GaryVision/Agents-Temp-Scratch/Chrysalis-Persona/25er.persona.json \
  --skillbuilder-root projects/SkillBuilder \
  --merge-agent-md Agents/root-cause-analyst.md \
  --merge-agent-md Agents/devops-architect.md \
  --out ~/Documents/GitClones/GaryVision/Agents-Temp-Scratch/Sem25er.json \
  --offline \
  --max-passes 12
```

### Example: add “maximum” deepening passes with Anthropic Opus (network)

Prereq:
- `ANTHROPIC_API_KEY` is set.

```bash
python3 scripts/sem_agent.py \
  --persona ~/Documents/GitClones/GaryVision/Agents-Temp-Scratch/Chrysalis-Persona/25er.persona.json \
  --skillbuilder-root projects/SkillBuilder \
  --merge-agent-md Agents/root-cause-analyst.md \
  --merge-agent-md Agents/devops-architect.md \
  --out ~/Documents/GitClones/GaryVision/Agents-Temp-Scratch/Sem25er.json \
  --offline \
  --max-passes 12 \
  --deepening-model claude-opus-4-5 \
  --deepening-passes 8 \
  --deepening-max-items 12
```

### Example: generate `Sem105er.json` (merge Don Quixote + Socratic Mentor + David Dunning role text)

```bash
python3 scripts/sem_agent.py \
  --persona ~/Documents/GitClones/GaryVision/Agents-Temp-Scratch/Chrysalis-Persona/105er.persona.json \
  --skillbuilder-root projects/SkillBuilder \
  --merge-agent-json Agents/don_quixote.json \
  --merge-agent-md Agents/socratic-mentor.md \
  --merge-role-text "David Dunning: metacognition; calibration; self-assessment; avoid labeling; coach the process via small tests, checklists, and feedback loops." \
  --out ~/Documents/GitClones/GaryVision/Agents-Temp-Scratch/Sem105er.json \
  --offline \
  --max-passes 12 \
  --deepening-model claude-opus-4-5 \
  --deepening-passes 8 \
  --deepening-max-items 12
```

Notes:
- Deepening is **append-only** and de-dupes by identical `content`.
- The script records deepening metadata under `metadata.x_skillbuilder_merge`.
