# Operator Guide: Creating a Mode

This guide is for users who want to create new agent modes using SkillBuilder.

## Quick Start

```bash
python -m semantic_mode create
```

## Interactive Wizard

The wizard asks 5 questions:

### Question 1: Build on existing modes?

Do you want to extend or compose from modes that already exist in your Kilocode configuration?

- If yes, the system lists available modes from your Kilocode CLI and VS Code extension settings
- Enter mode names or slugs (comma-separated)
- The system confirms which modes were found

### Question 2: Role model (the seed)

Who is the role model for this mode? This should be an actual person's name.

- Can be a real person (e.g., "Hadley Wickham")
- Can be fictional or imaginary (e.g., "Sherlock Holmes")
- Can be a literary figure (e.g., "Marcus Aurelius")

This is the only required input. The system uses this person's name to seed research queries.

### Question 3: Defining qualities (the salts)

What did they do? What were their defining qualities or accomplishments?

- Enter comma-separated keywords
- Examples: "tidy data, data visualization, R programming"
- These keywords guide the research and skill extraction

### Question 4: Mode name and location

What should we call this mode? Where should we save it?

- Default: lowercase role model name with hyphens
- Output goes to `reports/<mode-name>/`

### Question 5: Kilocode integration

Automatically upload to Kilocode?

- If yes, the mode is synced to:
  - Kilocode CLI global config (`~/.kilocode/modes.yaml`)
  - VS Code extension settings

## Output Artifacts

The pipeline generates:

- `skills.md` - Extracted skill cards with triggers and confidence scores
- `generated-mode.md` - Complete mode definition
- `citations.md` - Source references
- `semantic-map.md` - Semantic structure of discovered knowledge
- `mode-reference.md` - Reference documentation
- `telemetry.jsonl` - Run telemetry (JSONL) under `.roo/runs/<run_id>/`

## Prerequisites

Run `python -m semantic_mode setup` to verify:

- Go search binary is built
- Search API keys are configured (TAVILY_API_KEY or BRAVE_API_KEY)
- Kilocode config paths are accessible

## Batch Merge (mode clustering)

```bash
python -m semantic_mode batch-merge \
  --mode-folder ExistingModes/JTG \
  --target-mode-count 125 \
  --cluster-model openai
```

- Uses OpenAI embeddings when available; falls back to TF-IDF + cosine.
- Outputs merged YAMLs to `ExistingModes/MergedJTG/merged-*.yaml`.
- Telemetry for batch merge: `.roo/runs/<run_id>/batch_merge.jsonl` (run_id, target_count, actual_clusters, embedding provider/model/fallback, similarity stats).

CLI flags live in [`semantic_mode/cli.py`](../semantic_mode/cli.py:93) (hybrid search, batch-merge, cluster-model, target counts).

## UX Principles

- **Interactive first**: All input comes from the wizard, not config files
- **Confirm matches**: The system verifies mode names exist before using them
- **Immediate feedback**: Progress and results are shown as the pipeline runs
- **Optional integration**: Kilocode upload is offered but not required
