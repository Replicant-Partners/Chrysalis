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
- CLI: Command-line interface for terminal and TUI integration
- API: Programmatic interface for agent integration

Core abstraction: The adapter interprets a Mermaid flow diagram as a
state graph where nodes are prompt executions and edges are conditional
transitions based on response categorization.

Example - Programmatic Usage:
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

Example - CLI Usage:
    # Run from terminal
    python -m universal_adapter run simple_qa --debug
    python -m universal_adapter validate task.json
    python -m universal_adapter list --verbose

Example - Slash Commands (for TUI/Agent integration):
    from universal_adapter import execute_slash_command, is_slash_command

    user_input = "//run simple_qa --debug"
    if is_slash_command(user_input):
        result = execute_slash_command(user_input)
        print(result.format())

Example - API for Agents:
    from universal_adapter.api import run_task, validate_task, list_available_tasks

    result = await run_task("simple_qa", variables={"question": "What is 2+2?"})
    if result.success:
        print(result.data.final_response)
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

# Task Library
from .task_library import TaskLibrary, DEFAULT_TASK_LIBRARY

# CLI
from .cli import (
    CLICommands,
    CLIOutput,
    OutputFormat,
    main as cli_main,
)

# Slash Commands
from .slash_commands import (
    SlashCommandParser,
    SlashCommandConfig,
    ParsedCommand,
    is_slash_command,
    execute_slash_command,
    parse_slash_command,
    get_command_suggestions,
    create_user_parser,
    create_agent_parser,
    create_readonly_parser,
)

# Security
from .security import (
    SecurityContext,
    PermissionLevel,
    Operation,
    PathSecurityError,
    PathValidator,
    create_admin_context,
    create_user_context,
    create_agent_context,
    create_readonly_context,
    get_default_context,
    set_default_context,
)

# API
from .api import (
    # Request types
    TaskRequest,
    ValidationRequest,
    InspectionRequest,
    # Response types
    APIResponse,
    TaskExecutionResult,
    ValidationResult,
    InspectionResult,
    TaskInfo,
    ProviderInfo,
    FlowAnalysis,
    # Enums
    TaskStatus,
    ValidationLevel,
    # Core functions
    run_task as api_run_task,
    run_task_sync as api_run_task_sync,
    execute_request,
    validate_task as api_validate_task,
    inspect_task,
    list_available_tasks,
    get_task,
    list_providers,
    analyze_flow,
    create_task,
    save_task,
)

# Configuration
from .config import (
    LLMConfig,
    DEFAULT_CONFIG,
    DEFAULT_MODEL,
    DEFAULT_PROVIDER,
    MODEL_PRESETS,
    get_config,
    get_default_config,
    build_resource_llm,
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
    # Task library
    'TaskLibrary',
    'DEFAULT_TASK_LIBRARY',
    # CLI
    'CLICommands',
    'CLIOutput',
    'OutputFormat',
    'cli_main',
    # Slash Commands
    'SlashCommandParser',
    'SlashCommandConfig',
    'ParsedCommand',
    'is_slash_command',
    'execute_slash_command',
    'parse_slash_command',
    'get_command_suggestions',
    'create_user_parser',
    'create_agent_parser',
    'create_readonly_parser',
    # Security
    'SecurityContext',
    'PermissionLevel',
    'Operation',
    'PathSecurityError',
    'PathValidator',
    'create_admin_context',
    'create_user_context',
    'create_agent_context',
    'create_readonly_context',
    'get_default_context',
    'set_default_context',
    # API Request Types
    'TaskRequest',
    'ValidationRequest',
    'InspectionRequest',
    # API Response Types
    'APIResponse',
    'TaskExecutionResult',
    'ValidationResult',
    'InspectionResult',
    'TaskInfo',
    'ProviderInfo',
    'FlowAnalysis',
    # API Enums
    'TaskStatus',
    'ValidationLevel',
    # API Functions
    'api_run_task',
    'api_run_task_sync',
    'execute_request',
    'api_validate_task',
    'inspect_task',
    'list_available_tasks',
    'get_task',
    'list_providers',
    'analyze_flow',
    'create_task',
    'save_task',
    # Configuration
    'LLMConfig',
    'DEFAULT_CONFIG',
    'DEFAULT_MODEL',
    'DEFAULT_PROVIDER',
    'MODEL_PRESETS',
    'get_config',
    'get_default_config',
    'build_resource_llm',
]
