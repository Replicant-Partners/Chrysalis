# Ollama Small General-Purpose Models (<10GB) Research Workflow and Decision Tree

## Discovery Summary
This document defines a research workflow to map Ollama’s general-purpose model inventory under 10GB and produce a Chrysalis-oriented decision tree and analytical report. It prioritizes reproducible sourcing, multi-source validation, and explicit inclusion/exclusion rules for small model selection in agent workflows.

## Task 1 — Semantic Map (Entities, Attributes, Relationships)

### Core Entities
- **Model**
  - Attributes: `name`, `family`, `variants`, `parameter_count`, `quantization`, `download_size_gb`, `context_length`, `throughput_toks_per_s`, `latency_ms`, `vram_gb`, `ram_gb`, `license`, `tool_calling`, `multilingual`, `safety_features`, `release_date`, `source_urls`
  - Relationships: `published_by` → Publisher, `hosted_on` → Source Repository, `evaluated_by` → Evaluation Source, `compared_in` → Comparative Study
- **Publisher**
  - Attributes: `name`, `organization_type` (lab/company/individual), `primary_site`
  - Relationships: `publishes` → Model
- **Source Repository** (Ollama docs, GitHub, Hugging Face, model website)
  - Attributes: `platform`, `url`, `artifact_type` (weights, docs, model card)
  - Relationships: `hosts` → Model
- **Evaluation Source** (arena leaderboards, benchmarks, competition stats)
  - Attributes: `name`, `metric_set`, `dataset`, `scoring_method`, `url`
  - Relationships: `scores` → Model
- **Evidence Type** (academic papers, comparative studies, benchmark reports)
  - Attributes: `type`, `methodology`, `publication_date`, `doi_or_url`
  - Relationships: `supports` → Claim, `compares` → Model
- **Claim**
  - Attributes: `claim_text`, `confidence`, `evidence_links`
  - Relationships: `about` → Model, `supported_by` → Evidence Type

### Decision Tree Inputs
- **Context/Use Case** → `task_type`, `latency_budget`, `context_length_min`, `tool_calling_required`, `multilingual_required`, `hardware_profile`.
- **Constraints** → `download_size_gb < 10`, `general_purpose_only`, `multiple_size_variants`.
- **Outputs** → `shortlist_models`, `rationale`, `fallback_models`.

### Relationship Graph (Textual)
Model ←published_by— Publisher
Model ←hosts— Source Repository
Model ←scores— Evaluation Source
Model ←compared_in— Evidence Type
Claim ←supported_by— Evidence Type
Claim ←about— Model

## Task 2 — Requirements (Best Practices Expansion)

### Data Collection Methods
- **Primary scraping**: Playwright-based web scraping for model cards, release notes, and docs.
- **Approved providers**: Tavily, Oxylabs, Exa, Brave, Firecrawl.
- **Manual verification**: For fields with ambiguous sources (license, safety features, tool calling).

### Validation Rules
- Minimum **two independent sources** per data point (e.g., Ollama docs + model card).
- Conflicts resolved by **primary source precedence**: official model website or GitHub repo > Hugging Face card > third-party summaries.
- Track **validation status**: `validated`, `partially_validated`, `conflict`.

### Inclusion/Exclusion Criteria
- **Include**: general-purpose language models (chat/LLM) with **download size < 10GB** in at least one variant and **multiple size variants** (e.g., 3B/7B/8B).
- **Exclude**: embedding-only, vision-only, domain-specific fine-tunes, single-size releases without variants.
- **Ollama alignment**: must be present in Ollama model inventory or officially supported by Ollama.

### Normalized Metrics
- **Context length** (tokens)
- **Latency** (ms per response at fixed prompt length)
- **Throughput** (tokens/sec)
- **Quantization** (Q2/Q4/Q5/Q8, GGUF, etc.)
- **VRAM/RAM needs** (GB at each quantization)
- **License** (commercial, research-only)
- **Safety** (alignment notes, refusal policy)
- **Multilingual capability** (self-reported + benchmarks)
- **Tool/function calling** (native vs prompt-based)

### Reproducibility and Citation Tracking
- Log **scrape timestamps**, raw URLs, and data extraction scripts.
- Store **source snapshots** in a `data/ollama-small-models/` folder.
- Each metric must have an explicit citation with version and date.

## Task 3 — Dependency-Aware Workflow

1. **Gather Ollama Documentation & Model Inventory**
   - Source: Ollama official docs and model registry.
2. **Filter for General-Purpose Models <10GB with Multiple Variants**
   - Apply inclusion/exclusion criteria.
3. **Compile Metadata per Model**
   - Sources: official model sites, GitHub, Hugging Face model cards.
4. **Collect Benchmark and Arena Statistics**
   - Sources: arena leaderboards, benchmark reports, competition leaderboards.
5. **Cross-Validate Each Data Point**
   - At least two sources per metric.
6. **Synthesize Strengths/Weaknesses and Trends**
   - Identify patterns across families and quantizations.
7. **Design Decision Tree**
   - Tie model selection to Chrysalis agent tasks and JSON schema selection.
8. **Draft Report Sections**
   - Decision tree → Rationale → Model analysis matrix → Evolution trends → Future research.
9. **Finalize with References and Reproducibility Notes**

## Task 4 — Report Output Structure

### 1. Chrysalis-Oriented Decision Tree (Small Model Selection)
```
Start
 ├─ Need tool/function calling? → Yes → shortlist tool-capable models under 10GB
 │   ├─ Need long context (>32k)? → Yes → pick long-context variant
 │   └─ Latency critical? → Yes → smallest viable variant (3B–7B)
 └─ No tool calling needed
     ├─ Multilingual required? → Yes → multilingual-optimized family
     └─ English-only → highest-performing 7B–8B variant under 10GB
```

### 2. Decision Logic Explanation
- **Why tool calling**: agent orchestration depends on structured outputs.
- **Why context length**: multi-step tasks demand longer memory.
- **Why latency**: small model routing must respect user interaction budgets.

### 3. Model Analysis Matrix (Template)

| Model | Variants | Size <10GB? | Context | Quantization | VRAM/RAM | Tool Calling | Multilingual | License | Benchmarks | Sources |
|---|---|---|---|---|---|---|---|---|---|---|
| (Populate) | 3B/7B/8B | Yes | 8k/ | Q4/Q5/Q8 | 6–12GB | Native/Prompt | Yes/No | (License) | (Arena/Bench) | (Citations) |

### 4. Narrative Analysis (Per Model)
- **Strengths**: reasoning, instruction following, tool use reliability, multilingual coverage.
- **Weaknesses**: hallucination rate, safety gaps, latency, memory limits.
- **Best-fit tasks**: summarization, routing, extraction, coding, QA.

### 5. Comparative Evidence and Trends
- **Arena leaderboards**: include rank, score, and timeframe.
- **Benchmark suites**: include dataset versions (e.g., MMLU, MT-Bench, GSM8K).
- **Research comparisons**: cite academic papers and comparative studies.

### 6. Model Evolution (Timeline)
- Track progression from earlier 3B/7B families → current optimized 7B/8B.
- Note shifts in quantization strategies and context length growth.

### 7. Future Research: Edge Inference & Local Deployment
- Investigate on-device optimizations, quantization trade-offs, and memory paging.
- Compare CPU-only inference vs GPU acceleration cost/performance.
- Evaluate streaming and batching for multi-agent workloads.

### 8. Sizing Guidance
- **Too small**: under 3B tends to fail on multi-step reasoning and tool grounding.
- **Too large**: over 10GB download complicates rapid deployment and edge use.
- **Practical range**: 3B–8B with Q4/Q5 quantization for balanced latency and quality.

## Evidence Tracking and Citations (To Be Filled)
- `[Ollama docs]()` — model inventory, download sizes, variants.
- `[Model card]()` — architecture, context length, license, safety notes.
- `[GitHub repo]()` — release notes and tooling.
- `[Arena leaderboard]()` — comparative ranking.
- `[Benchmark report]()` — dataset-specific scores.
- `[Academic study]()` — comparative evaluations.

## Reproducibility Notes
- Store scraping scripts and raw HTML snapshots in `data/ollama-small-models/`.
- Maintain a `sources.json` ledger with URLs, timestamps, and hash fingerprints.
- Document any manual overrides with justification.