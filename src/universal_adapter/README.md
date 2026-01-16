# Universal Adapter

A general-purpose JSON-driven logic processor for orchestrating LLM-based task execution.

## Architecture

The Universal Adapter is a **state machine executor** that interprets Mermaid flow diagrams to orchestrate LLM calls. The core abstraction: nodes are execution points (prompts, conditions, loops) and edges are conditional transitions based on response categorization.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        task.json                                     │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐ │
│  │   Goal   │ │ Resource LLM │ │ Registry │ │Prompts │ │  Flow   │ │
│  └──────────┘ └──────────────┘ └──────────┘ └────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Universal Adapter                               │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐   │
│  │Schema Parser│──▶│Flow Parser  │──▶│     Flow Executor       │   │
│  └─────────────┘   │(Mermaid)    │   │  (State Machine)        │   │
│                    └─────────────┘   └───────────┬─────────────┘   │
│                                                  │                  │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────▼──────────┐       │
│  │Interpolator │◀──│ LLM Client  │◀──│  Node Handlers      │       │
│  │(Templates)  │   │(API calls)  │   │  - Prompt           │       │
│  └─────────────┘   └─────────────┘   │  - Condition        │       │
│                                      │  - Loop             │       │
│  ┌─────────────┐   ┌─────────────┐   │  - Registry         │       │
│  │ Categorizer │──▶│Goal Verifier│   └─────────────────────┘       │
│  │(Responses)  │   │(Completion) │                                  │
│  └─────────────┘   └─────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌────────────────┐
                         │ AdapterResult  │
                         │ - success      │
                         │ - goal_met     │
                         │ - responses    │
                         │ - verification │
                         └────────────────┘
```

## task.json Schema

A task specification has five required components:

### 1. Goal
Natural language task description with target outcome conditions.

```json
{
  "goal": {
    "description": "Research and summarize a topic",
    "target_conditions": [
      {"description": "Summary produced", "evaluation_type": "GOAL_MET"},
      {"description": "Within 20 iterations", "evaluation_type": "ITERATION_LIMIT", "expected_value": "20"}
    ]
  }
}
```

### 2. Resource LLM
Language model endpoint configuration.

```json
{
  "resource_llm": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.7,
    "max_tokens": 4096,
    "api_key_env": "ANTHROPIC_API_KEY"
  }
}
```

### 3. Resource Registry
Indexed lookup mapping entity names to documentation URLs.

```json
{
  "resource_registry": {
    "entries": [
      {"name": "schema", "category": "reference", "source_url": "https://..."}
    ]
  }
}
```

### 4. Prompts
Ordered collection of prompt templates representing processing steps.

```json
{
  "prompts": [
    {
      "template": "Given {{topic}}, identify key aspects. Previous: {{response:P0}}",
      "role": "user",
      "description": "Initial analysis"
    }
  ]
}
```

#### Template Interpolation Syntax
- `{{variable}}` - Context variable
- `{{registry:name}}` - Registry entry URL
- `{{registry:name.field}}` - Registry entry field
- `{{response:node_id}}` - Previous response
- `{{loop.index}}` - Current loop iteration
- `{{loop.count}}` - Total loop iterations

### 5. Flow Diagram
Mermaid diagram defining execution topology.

```json
{
  "flow_diagram": {
    "mermaid": "graph TD\n    START --> P0\n    P0 --> COND{Check}\n    COND -->|success| END\n    COND -->|retry| P0"
  }
}
```

#### Node Types
- `P0, P1, ...` - Prompt nodes (index into prompts array)
- `START` - Entry point
- `END` - Terminal node
- `{Label}` - Condition node (diamond)
- `([Label])` - Loop node
- `[Label]` - Generic node

#### Edge Conditions
- `-->|condition|` - Conditional transition
- `-->` - Unconditional transition

## Usage

### Basic Execution

```python
from universal_adapter import UniversalAdapter, run_task

# From JSON file
result = run_task("task.json")

# From dictionary
result = run_task({
    "goal": {...},
    "resource_llm": {...},
    "resource_registry": {"entries": []},
    "prompts": [...],
    "flow_diagram": {...}
})

if result.success:
    print(result.final_response)
else:
    print(f"Failed: {result.errors}")
```

### Async Execution

```python
from universal_adapter import UniversalAdapter, execute_task, AdapterConfig

config = AdapterConfig(
    max_iterations=100,
    timeout_ms=60000,
    debug_mode=True
)

result = await execute_task(task_dict, config)
```

### Custom Configuration

```python
from universal_adapter import UniversalAdapter, AdapterConfig

config = AdapterConfig(
    max_iterations=1000,      # Max state transitions
    timeout_ms=300000,        # 5 minute timeout
    strict_validation=True,   # Fail on schema errors
    debug_mode=True,          # Enable logging
    require_all_conditions=True  # All goal conditions must be met
)

adapter = UniversalAdapter(config)
result = await adapter.execute(task)
```

## Module Structure

```
universal_adapter/
├── __init__.py          # Public API exports
├── core.py              # UniversalAdapter orchestrator
├── schema.py            # Immutable task schema dataclasses
├── flow/
│   ├── graph.py         # FlowGraph, FlowNode, FlowEdge
│   ├── parser.py        # MermaidParser
│   └── executor.py      # FlowExecutor (state machine)
├── engine/
│   ├── interpolator.py  # TemplateInterpolator
│   └── llm_client.py    # LLMClient (OpenAI, Anthropic, Mock)
├── evaluator/
│   └── categorizer.py   # ResponseCategorizer
├── verifier/
│   └── goal_verifier.py # GoalVerifier
└── examples/
    ├── simple_qa_task.json
    └── research_task.json
```

## Design Principles

1. **Immutable Data Structures** - All schema types are frozen dataclasses
2. **Pure Functions** - State passed explicitly, no hidden mutation
3. **Separation of Concerns** - Each module has a single responsibility
4. **Protocol-based Abstraction** - Handlers use Protocol for type safety
5. **Declarative Flow Definition** - Mermaid diagrams define topology, not code

## Supported Providers

- **OpenAI**: GPT-4o, GPT-4, o1-preview, etc.
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, etc.
- **Mock**: For testing without API calls

## Response Categorization

The evaluator categorizes LLM responses to determine flow transitions:

- **Keyword matching**: Check for specific terms
- **Pattern matching**: Regex patterns
- **JSON field matching**: Check JSON structure
- **Custom predicates**: User-defined functions

## Goal Verification

The verifier checks execution outcomes against goal conditions:

- **CATEGORY_MATCH**: Final response category matches expected
- **CONTAINS**: Response contains expected content
- **ITERATION_LIMIT**: Completed within iteration budget
- **GOAL_MET**: Heuristic positive outcome detection
- **CUSTOM**: User-defined verification logic
