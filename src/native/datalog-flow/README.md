# Chrysalis Flow Graph Execution - Datalog Specification

This directory contains the Datalog specification for flow graph execution in the Chrysalis Universal Adapter.

## Overview

The Datalog specification provides:

1. **Declarative Graph Traversal** - Define flow logic as facts and rules
2. **Condition Evaluation** - Route execution based on conditions
3. **Termination Proofs** - Guarantee DAG execution terminates
4. **Deterministic Ordering** - Topological sort for execution order
5. **Parallel Execution** - Fork/join semantics for concurrent branches

## Files

- `flow.dl` - Main Datalog specification
- `examples/` - Example flow definitions
- `runtime/` - Runtime integration (Python/TypeScript)

## Usage with Soufflé

```bash
# Install Soufflé
# Ubuntu: apt install souffle
# macOS: brew install souffle

# Compile the Datalog program
souffle -c flow.dl

# Run with input facts
souffle flow.dl -F input_facts/ -D output/
```

## Input Facts

Create fact files in the input directory:

### `node.facts`
```
start_node  start   start_handler
prompt_1    prompt  llm_prompt
condition_1 condition   check_result
action_1    action  do_action
end_node    end end_handler
```

### `edge.facts`
```
start_node  prompt_1    default
prompt_1    condition_1 default
condition_1 action_1    success
condition_1 end_node    failure
action_1    end_node    default
```

## Key Queries

### Check if graph is valid DAG
```prolog
?- graph_valid().
```

### Find execution order
```prolog
?- topo_level(Node, Level).
```

### Find next node to execute
```prolog
?- can_execute(Node).
```

### Check termination guarantee
```prolog
?- flow_terminates().
```

## Integration with Python

```python
from chrysalis_flow import DatalogEngine

engine = DatalogEngine("flow.dl")

# Add nodes
engine.add_fact("node", ["start", "start", "handler"])
engine.add_fact("node", ["end", "end", "handler"])
engine.add_fact("edge", ["start", "end", "default"])

# Run analysis
results = engine.query("graph_valid")
if results:
    print("Graph is valid!")

# Get execution order
for node, level in engine.query("topo_level"):
    print(f"Node {node} at level {level}")
```

## Integration with TypeScript

```typescript
import { DatalogEngine } from './datalog-runtime';

const engine = new DatalogEngine();
await engine.loadProgram('flow.dl');

// Add flow definition
engine.addNode('start', 'start', 'handler');
engine.addNode('prompt', 'prompt', 'llm');
engine.addEdge('start', 'prompt', 'default');

// Validate
const isValid = await engine.query('graph_valid');
console.log('Valid:', isValid.length > 0);
```

## Extending the Specification

### Adding Custom Node Types

```prolog
// Define new node type behavior
.decl custom_node_behavior(id: symbol, output: symbol)
custom_node_behavior(id, "processed") :-
    node(id, "my_custom_type", _),
    executed(id, _).
```

### Adding Custom Conditions

```prolog
// Route based on LLM response sentiment
.decl sentiment_positive(node_id: symbol)
sentiment_positive(id) :-
    node_output(id, "sentiment", "positive").

next_node(current, next) :-
    edge(current, next, "positive"),
    sentiment_positive(current).
```

## Performance Considerations

- Soufflé compiles to C++ for high performance
- Supports parallel execution with `-j` flag
- Incremental evaluation with `--live-profile`

For large graphs (>10K nodes), consider:
- Using Soufflé's compiled mode (`-c`)
- Enabling MPI for distributed execution
- Profiling with `--profile`