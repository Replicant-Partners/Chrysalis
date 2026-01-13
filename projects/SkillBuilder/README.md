# SkillBuilder

SkillBuilder is a pipeline for **building agent "modes"** (behavior + workflow + rules) from exemplar-driven research and turning them into installable formats (KiloCode, RooCode, Cursor).

## Quick Start

```bash
# Install
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure API keys (at least one provider)
export TAVILY_API_KEY="..."   # or BRAVE_API_KEY / HUGGINGFACE_TOKEN

# Run the SkillBuilder CLI
python -m skill_builder create            # interactive wizard
python -m skill_builder run --spec path/to/spec.yaml --iterations 4
```

## Interactive Wizard

The wizard asks 5 questions:

1. **Build on existing modes?** - Optionally extend from modes in your Kilocode config
2. **Role model?** - Name of a person (real, fictional, or imagined) as the seed
3. **Defining qualities?** - What they did, their accomplishments (the salts)
4. **Mode name?** - What to call the new mode
5. **Auto-upload to Kilocode?** - Sync to VS Code extension and CLI

When choosing to build on existing modes, the CLI now prints available modes as a two-column list (Name | Slug) sourced from Kilocode configuration and the consolidated `ExistingModes` archive. Enter one or more names or slugs (comma-separated) to seed the new mode.

## Output Artifacts

```
reports/<mode-name>/
├── skills.md          # Extracted skill cards
├── generated-mode.md  # Complete mode definition
├── citations.md       # Source references
├── semantic-map.md    # Semantic structure
└── mode-reference.md  # Reference documentation
```

## Setup

```bash
python -m skill_builder setup
```

Verifies:
- Go search binary is built
- Search API keys are configured
- Kilocode config paths are accessible

## Documentation

- Operator guide: `docs/guides/operator.md`
- Architecture: `docs/architecture/overview.md`

## License

See `LICENSE`.
