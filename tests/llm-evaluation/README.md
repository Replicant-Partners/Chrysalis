# LLM Evaluation Framework for Continuous Improvement Systems

Comprehensive evaluation suite for benchmarking small-scale local Large Language Models against their capacity to operate within a neurosymbolic continuous improvement kata engine.

## Overview

This framework evaluates LLMs across four interdependent cognitive modes that form a closed-loop PDCA-style improvement cycle:

```
┌─────────────────┐
│  Mode 1:        │──► Real-time process execution & calibration
│  Process Manager│
└────────┬────────┘
         │ metrics
         ▼
┌─────────────────┐
│  Mode 2:        │──► Standards comparison & gap analysis
│  Compliance     │
│  Evaluator      │
└────────┬────────┘
         │ gaps
         ▼
┌─────────────────┐
│  Mode 3:        │──► Root cause analysis & research
│  Root Cause     │
│  Analyst        │
└────────┬────────┘
         │ root causes
         ▼
┌─────────────────┐
│  Mode 4:        │──► Process redesign & meta-learning
│  Meta-Process   │
│  Designer       │
└────────┬────────┘
         │ improvements
         └────────────────┐
                          │
         ┌────────────────┘
         ▼
    Back to Mode 1
    (continuous cycle)
```

## Quick Start

### Prerequisites

```bash
# Node.js & TypeScript
node >= 18.0.0
npm >= 9.0.0

# Optional: Local LLM (Ollama)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull gemma:7b

# Optional: Chrysalis Gateway
cd ../../go-services
go run cmd/gateway/main.go
```

### Installation

```bash
cd tests/llm-evaluation
npm install
npm run build
```

### Run Example Evaluation

```bash
# Evaluate a local model via Ollama
npm run evaluate -- \
  --model gemma:7b \
  --provider ollama \
  --suite basic-isolation \
  --output ./results

# Evaluate via Chrysalis Gateway
npm run evaluate -- \
  --model kata-mode-1 \
  --provider gateway \
  --gateway-url http://localhost:8080 \
  --suite full-cycle \
  --output ./results

# Compare multiple models
npm run compare -- \
  --models gemma:7b,mistral:7b,llama3:8b \
  --suite benchmark \
  --output ./comparison-report.html
```

## Project Structure

```
tests/llm-evaluation/
├── README.md                          # This file
├── EVALUATION_FRAMEWORK_SPEC.md       # Comprehensive specification
├── package.json
├── tsconfig.json
│
├── src/
│   ├── types/
│   │   └── schemas.ts                 # TypeScript type definitions & JSON schemas
│   │
│   ├── core/
│   │   ├── TestExecutor.ts            # Test orchestration engine
│   │   ├── ModelAdapter.ts            # LLM provider adapters
│   │   ├── ScoringEngine.ts           # Automated scoring logic
│   │   ├── ValidationFramework.ts     # Output validation
│   │   ├── StateManager.ts            # Test state & results storage
│   │   └── TelemetryCollector.ts      # Performance metrics
│   │
│   ├── evaluation/
│   │   ├── mode1/                     # Mode 1 specific evaluators
│   │   ├── mode2/                     # Mode 2 specific evaluators
│   │   ├── mode3/                     # Mode 3 specific evaluators
│   │   └── mode4/                     # Mode 4 specific evaluators
│   │
│   ├── reporting/
│   │   ├── ReportGenerator.ts         # HTML/PDF report generation
│   │   ├── Visualizer.ts              # Charts & graphs
│   │   └── ComparativeAnalysis.ts     # Cross-model comparison
│   │
│   └── cli/
│       ├── evaluate.ts                # Main evaluation CLI
│       ├── compare.ts                 # Model comparison CLI
│       └── report.ts                  # Report generation CLI
│
├── prompts/
│   ├── mode1-process-manager.json     # Mode 1 test prompts
│   ├── mode2-compliance.json          # Mode 2 test prompts (TODO)
│   ├── mode3-root-cause.json          # Mode 3 test prompts (TODO)
│   └── mode4-meta-process.json        # Mode 4 test prompts (TODO)
│
├── test-suites/
│   ├── basic-isolation.json           # Phase 1: Isolation testing
│   ├── integration.json               # Phase 2: Inter-mode dependencies
│   ├── full-cycle.json                # Phase 3: Complete PDCA cycles
│   └── benchmark.json                 # Comprehensive benchmark suite
│
├── models/
│   ├── profiles/                      # Model configuration profiles
│   │   ├── gemma-7b.json
│   │   ├── mistral-7b.json
│   │   ├── llama3-8b.json
│   │   └── claude-opus.json
│   │
│   └── baselines/                     # Reference model results
│       └── gpt-4-baseline.json
│
└── results/
    ├── executions/                    # Individual test run results
    ├── comparisons/                   # Cross-model comparisons
    └── reports/                       # Generated HTML/PDF reports
```

## Core Concepts

### Test Categories

1. **Atomic Tests**: Single capability in isolation (e.g., "adjust one parameter")
2. **Compound Tests**: Multiple capabilities within one mode (e.g., "manage 3 processes")
3. **Integration Tests**: Authentic inter-mode data flow (e.g., Mode 2 uses Mode 1 outputs)
4. **Adversarial Tests**: Ambiguous states, conflicting requirements, impossible constraints

### Evaluation Phases

#### Phase 1: Isolation Testing
Test each mode independently with controlled inputs:
```bash
npm run evaluate -- --suite basic-isolation --mode 1
```

#### Phase 2: Dependency Testing
Introduce inter-mode dependencies:
```bash
npm run evaluate -- --suite integration --modes 1,2
```

#### Phase 3: Full-Cycle Testing
Complete PDCA cycles from Mode 1 → 2 → 3 → 4 → 1:
```bash
npm run evaluate -- --suite full-cycle
```

#### Phase 4: Parallel Execution
Test context-switching overhead:
```bash
npm run evaluate -- --suite benchmark --parallel
```

### Scoring Methodology

Each mode has specific metrics weighted by importance:

**Mode 1: Process Manager**
```
score = 0.30 × decision_correctness
      + 0.25 × state_management_accuracy
      + 0.20 × prioritization_logic
      + 0.25 × calibration_effectiveness
```

**Mode 2: Compliance Evaluator**
```
score = 0.20 × retrieval_completeness
      + 0.30 × precision
      + 0.30 × recall
      + 0.20 × actionability
```

**Mode 3: Root Cause Analyst**
```
score = 0.30 × causal_chain_validity
      + 0.30 × discovery_rate
      + 0.20 × reasoning_depth
      + 0.20 × source_quality
```

**Mode 4: Meta-Process Designer**
```
score = 0.25 × synthesis_coherence
      + 0.20 × design_creativity
      + 0.20 × practical_feasibility
      + 0.20 × meta_cognitive_quality
      + 0.15 × root_cause_alignment
```

## Integration with Chrysalis

### Using the Go LLM Gateway

The framework integrates with Chrysalis's existing infrastructure:

```typescript
import { ChrysalisGatewayAdapter } from './src/core/ModelAdapter';

const adapter = new ChrysalisGatewayAdapter(
  modelProfile,
  'http://localhost:8080',
  'kata-mode-1' // Agent ID
);

// Gateway handles:
// - Per-agent rate limiting
// - ComplexityRouter for tier-based routing
// - Response caching
// - Telemetry collection
```

### Model Tier Configuration

```json
{
  "model_id": "kata-mode-1",
  "characteristics": {
    "type": "local_slm",
    "parameters": "7B",
    "context_window": 8192
  },
  "deployment": {
    "provider": "gateway",
    "model_name": "gemma:7b"
  }
}
```

### Memory System Integration

Test results integrate with Chrysalis memory layers:
- **Beads**: Test execution state (short-term)
- **Fireproof**: Test case library & history (local CRDT)
- **Zep/Letta**: Performance trends (long-term)

## Example Workflows

### Evaluate Single Model

```bash
# Step 1: Define model profile
cat > models/profiles/my-model.json <<EOF
{
  "model_id": "my-custom-model",
  "name": "Custom Gemma 7B",
  "version": "1.0",
  "characteristics": {
    "type": "local_slm",
    "parameters": "7B",
    "quantization": "Q4_K_M",
    "context_window": 8192
  },
  "deployment": {
    "provider": "ollama",
    "model_name": "gemma:7b",
    "api_key_required": false
  }
}
EOF

# Step 2: Run evaluation
npm run evaluate -- \
  --model my-custom-model \
  --suite benchmark \
  --output ./results/my-model

# Step 3: Generate report
npm run report -- \
  --execution ./results/my-model/execution-*.json \
  --format html \
  --output ./reports/my-model.html
```

### Compare Multiple Models

```bash
# Compare local models
npm run compare -- \
  --models gemma:7b,mistral:7b,llama3:8b \
  --provider ollama \
  --suite benchmark \
  --output ./comparison-local.html

# Compare local vs cloud
npm run compare -- \
  --models gemma:7b,claude-opus \
  --providers ollama,anthropic \
  --api-key $ANTHROPIC_API_KEY \
  --suite benchmark \
  --include-cost-analysis \
  --output ./comparison-local-vs-cloud.html
```

### Benchmark Against Baseline

```bash
# Establish baseline with reference model
npm run evaluate -- \
  --model gpt-4 \
  --provider openai \
  --api-key $OPENAI_API_KEY \
  --suite benchmark \
  --save-baseline ./models/baselines/gpt-4-baseline.json

# Evaluate candidate model against baseline
npm run evaluate -- \
  --model gemma:7b \
  --provider ollama \
  --suite benchmark \
  --compare-baseline ./models/baselines/gpt-4-baseline.json \
  --output ./results/gemma-vs-baseline
```

## Configuration

### Test Suite Configuration

```json
{
  "suite_id": "custom-suite",
  "name": "Custom Evaluation Suite",
  "version": "1.0",
  "test_cases": [
    "mode1_atomic_001",
    "mode1_atomic_002",
    "mode1_compound_001"
  ],
  "execution_order": "sequential",
  "filters": {
    "modes": [1, 2],
    "complexity": ["low", "medium"]
  }
}
```

### Execution Configuration

```json
{
  "settings": {
    "max_retries": 3,
    "retry_delay_ms": 1000,
    "timeout_ms": 30000,
    "parallel_execution": false,
    "max_parallel_tests": 3,
    "capture_intermediate_steps": true,
    "enable_telemetry": true
  },
  "model_config": {
    "temperature": 0.7,
    "top_p": 0.9,
    "max_tokens": 2048
  }
}
```

## Development

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests with real models
npm run test:e2e
```

### Adding New Test Prompts

1. Create prompt definition in `prompts/modeN-*.json`
2. Follow the schema in `src/types/schemas.ts`
3. Add ground truth and scoring criteria
4. Register in appropriate test suite

Example:
```json
{
  "test_id": "mode1_custom_001",
  "name": "My Custom Test",
  "difficulty": 5,
  "prompt": "Test prompt here...",
  "expected_output_schema": {
    "field1": "string",
    "field2": "number"
  },
  "scoring_metrics": ["decision_correctness"],
  "ground_truth": {
    "expected_field1": "value"
  }
}
```

### Extending Model Adapters

To add support for a new LLM provider:

```typescript
// src/core/ModelAdapter.ts
export class MyProviderAdapter extends ModelAdapter {
  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    // Implement provider-specific logic
  }
  
  async warmup(): Promise<void> {
    // Optional warmup logic
  }
  
  async cleanup(): Promise<void> {
    // Cleanup resources
  }
}

// Register in factory
export class ModelAdapterFactory {
  static create(profile: ModelProfile, options: any): ModelAdapter {
    switch (profile.deployment.provider) {
      case 'my-provider':
        return new MyProviderAdapter(profile, options);
      // ... other providers
    }
  }
}
```

## Performance Benchmarks

### Expected Latencies (Local SLM)

| Mode | Atomic Test | Compound Test | Integration Test |
|------|-------------|---------------|------------------|
| Mode 1 | < 1000ms | < 2000ms | < 3000ms |
| Mode 2 | < 1500ms | < 2500ms | < 4000ms |
| Mode 3 | < 2000ms | < 3500ms | < 5000ms |
| Mode 4 | < 2500ms | < 4000ms | < 6000ms |

### Expected Latencies (Cloud LLM)

| Mode | Atomic Test | Compound Test | Integration Test |
|------|-------------|---------------|------------------|
| Mode 1 | < 2000ms | < 4000ms | < 6000ms |
| Mode 2 | < 3000ms | < 5000ms | < 8000ms |
| Mode 3 | < 4000ms | < 7000ms | < 10000ms |
| Mode 4 | < 5000ms | < 8000ms | < 12000ms |

## Troubleshooting

### Common Issues

**Issue**: Tests timing out
```bash
# Increase timeout in execution config
npm run evaluate -- --timeout 60000
```

**Issue**: Model not responding
```bash
# Check Ollama is running
ollama list
ollama ps

# Restart Ollama
systemctl restart ollama
```

**Issue**: Out of memory errors
```bash
# Reduce parallel execution
npm run evaluate -- --max-parallel 1

# Use smaller model
npm run evaluate -- --model gemma:2b
```

## Roadmap

### Phase 1 (Completed)
- [x] Framework specification
- [x] Core type system
- [x] Test executor engine
- [x] Model adapters (Ollama, Chrysalis Gateway, Anthropic, OpenAI)
- [x] Mode 1 prompt library

### Phase 2 (In Progress)
- [ ] Mode 2, 3, 4 prompt libraries
- [ ] Validation framework
- [ ] Scoring engine implementation
- [ ] State manager & telemetry

### Phase 3 (Planned)
- [ ] Report generation & visualization
- [ ] Comparative analysis engine
- [ ] Expert review interface
- [ ] Web-based dashboard

### Phase 4 (Future)
- [ ] Automated test case generation
- [ ] Adaptive difficulty tuning
- [ ] Multi-agent evaluation scenarios
- [ ] Long-running continuous evaluation

## Contributing

See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for guidelines.

## References

- [Full Evaluation Framework Specification](./EVALUATION_FRAMEWORK_SPEC.md)
- [Chrysalis System Agents](../../Agents/system-agents/README.md)
- [LLM Adaptive Layer Specification](../../plans/adaptive-llm-layer-prompts-and-connectors.md)
- [Architecture Audit](../../docs/ARCHITECTURE_AUDIT_2026-01-16.md)

## License

Part of the Chrysalis project. See root LICENSE file.

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-17  
**Status**: Development - Core infrastructure complete, prompt libraries in progress
