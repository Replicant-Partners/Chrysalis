"""
Universal Adapter - General-Purpose JSON-Driven Logic Processor

A state machine executor that orchestrates LLM-based task execution
through declarative task.json specifications.

Architecture:
- Schema: Immutable data structures for task definition
- Flow: Mermaid parser and state machine executor
- Engine: Template interpolation and LLM client
- Evaluator: Response categorization for branching
- Verifier: Goal completion validation

Core abstraction: The adapter interprets a Mermaid flow diagram as a
state graph where nodes are prompt executions and edges are conditional
transitions based on response categorization.

Example:
    from universal_adapter import UniversalAdapter, run_task

    # From JSON file
    result = run_task("task.json")

    # From dictionary
    result = run_task({
        "goal": {...},
        "resource_llm": {...},
        "resource_registry": {...},
        "prompts": [...],
        "flow_diagram": {...}
    })

    if result.success:
        print(result.final_response)
"""

# Core
from .core import (
    UniversalAdapter,
    AdapterConfig,
    AdapterResult,
    execute_task,
    run_task,
)

# Schema
from .schema import (
    TaskSchema,
    Goal,
    TargetCondition,
    ConditionType,
    ResourceLLM,
    ResourceRegistry,
    RegistryEntry,
    Prompt,
    FlowDiagram,
    validate_task_schema,
)

# Flow
from .flow import (
    FlowGraph,
    FlowNode,
    FlowEdge,
    NodeType,
    MermaidParser,
    FlowExecutor,
)

# Engine
from .engine import (
    TemplateInterpolator,
    InterpolationContext,
    LLMClient,
    LLMRequest,
    LLMResponse,
)

# Evaluator
from .evaluator import (
    ResponseCategorizer,
    CategoryCriteria,
    CategoryMatch,
    EvaluationResult,
)

# Verifier
from .verifier import (
    GoalVerifier,
    VerificationResult,
)

__version__ = "1.0.0"

__all__ = [
    # Core
    'UniversalAdapter',
    'AdapterConfig',
    'AdapterResult',
    'execute_task',
    'run_task',
    # Schema
    'TaskSchema',
    'Goal',
    'TargetCondition',
    'ConditionType',
    'ResourceLLM',
    'ResourceRegistry',
    'RegistryEntry',
    'Prompt',
    'FlowDiagram',
    'validate_task_schema',
    # Flow
    'FlowGraph',
    'FlowNode',
    'FlowEdge',
    'NodeType',
    'MermaidParser',
    'FlowExecutor',
    # Engine
    'TemplateInterpolator',
    'InterpolationContext',
    'LLMClient',
    'LLMRequest',
    'LLMResponse',
    # Evaluator
    'ResponseCategorizer',
    'CategoryCriteria',
    'CategoryMatch',
    'EvaluationResult',
    # Verifier
    'GoalVerifier',
    'VerificationResult',
]
