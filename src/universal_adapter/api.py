"""
Universal Adapter API - Programmatic Interface for Agents

A clean, comprehensive API for programmatic integration with the
Universal Adapter. Designed for use by system agents, automation
scripts, and other software components.

This module provides:
1. High-level convenience functions for common operations
2. Structured request/response types
3. Async-first design with sync wrappers
4. Rich error handling and validation
5. Integration hooks for agent systems
6. Security context for permission control

Security:
    All API functions accept an optional security_context parameter.
    Default behavior uses USER-level permissions.
    
    For agents, use create_agent_context() for restricted access:
    - Explicitly specified providers only
    - No file writes
    - Limited iterations/timeout

Example usage:
    from universal_adapter.api import (
        run_task,
        validate_task,
        list_available_tasks,
        TaskRequest,
    )
    
    # Simple execution
    result = await run_task("simple_qa", variables={"question": "What is 2+2?"})
    
    # Structured request
    request = TaskRequest(
        task="research_synthesis",
        variables={"topic": "AI Safety"},
        debug=True,
    )
    result = await execute_request(request)
    
    # With security context for agents
    from universal_adapter.security import create_agent_context
    ctx = create_agent_context(allowed_providers=["anthropic"])
    result = await run_task("simple_qa", security_context=ctx)
"""

from __future__ import annotations
import asyncio
import json
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence, TypeVar, Generic

from .core import (
    UniversalAdapter,
    AdapterConfig,
    AdapterResult,
    execute_task as core_execute_task,
)
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
from .flow.parser import MermaidParser
from .flow.graph import FlowGraph, NodeType
from .task_library import TaskLibrary, DEFAULT_TASK_LIBRARY
from .cli import CLICommands, CLIOutput
from .security import (
    SecurityContext,
    PermissionLevel,
    Operation,
    PathSecurityError,
    create_admin_context,
    create_user_context,
    create_agent_context,
    get_default_context,
)


# ============================================================================
# Type Definitions
# ============================================================================

T = TypeVar("T")


class TaskStatus(Enum):
    """Status of a task operation."""
    PENDING = auto()
    RUNNING = auto()
    COMPLETED = auto()
    FAILED = auto()
    CANCELLED = auto()


class ValidationLevel(Enum):
    """Validation strictness level."""
    NONE = auto()
    BASIC = auto()
    STRICT = auto()
    PARANOID = auto()


# ============================================================================
# Request Types
# ============================================================================

@dataclass
class TaskRequest:
    """
    Structured request for task execution.
    
    Provides a clean interface for specifying task execution parameters
    with sensible defaults.
    """
    task: str | dict | TaskSchema
    variables: dict[str, Any] = field(default_factory=dict)
    debug: bool = False
    max_iterations: int = 1000
    timeout_seconds: int = 300
    validation_level: ValidationLevel = ValidationLevel.STRICT
    provider_override: str | None = None
    model_override: str | None = None
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    
    def to_config(self) -> AdapterConfig:
        """Convert to AdapterConfig."""
        return AdapterConfig(
            max_iterations=self.max_iterations,
            timeout_ms=self.timeout_seconds * 1000,
            strict_validation=self.validation_level in (ValidationLevel.STRICT, ValidationLevel.PARANOID),
            debug_mode=self.debug,
        )


@dataclass
class ValidationRequest:
    """Request for task validation."""
    task: str | dict | TaskSchema
    level: ValidationLevel = ValidationLevel.STRICT
    check_registry_urls: bool = False
    check_prompt_syntax: bool = True


@dataclass
class InspectionRequest:
    """Request for task inspection."""
    task: str | dict | TaskSchema
    include_flow: bool = True
    include_prompts: bool = True
    include_registry: bool = True
    include_goal: bool = True
    include_metadata: bool = True


# ============================================================================
# Response Types
# ============================================================================

@dataclass
class APIResponse(Generic[T]):
    """
    Generic API response wrapper.
    
    Provides a consistent structure for all API responses with
    success status, data payload, and error information.
    """
    success: bool
    data: T | None = None
    error: str | None = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def ok(cls, data: T, **kwargs: Any) -> APIResponse[T]:
        """Create successful response."""
        return cls(success=True, data=data, **kwargs)
    
    @classmethod
    def fail(cls, error: str, **kwargs: Any) -> APIResponse[T]:
        """Create failed response."""
        return cls(success=False, error=error, **kwargs)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "errors": self.errors,
            "warnings": self.warnings,
            "metadata": self.metadata,
        }
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=2, default=str)


@dataclass
class TaskExecutionResult:
    """Detailed result from task execution."""
    success: bool
    goal_met: bool
    status: str
    final_response: Any
    execution_time_ms: float
    iteration_count: int
    verification_summary: str | None = None
    responses: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    task_name: str = ""
    task_version: str = ""
    
    @classmethod
    def from_adapter_result(cls, result: AdapterResult) -> TaskExecutionResult:
        """Create from AdapterResult."""
        return cls(
            success=result.success,
            goal_met=result.goal_met,
            status=result.execution_status.name,
            final_response=result.final_response,
            execution_time_ms=result.execution_time_ms,
            iteration_count=result.iteration_count,
            verification_summary=result.goal_verification.summary if result.goal_verification else None,
            responses=dict(result.execution_result.final_state.responses) if result.execution_result else {},
            errors=list(result.errors),
            task_name=result.metadata.get("task_name", ""),
            task_version=result.metadata.get("task_version", ""),
        )


@dataclass
class ValidationResult:
    """Result from task validation."""
    valid: bool
    schema_valid: bool
    flow_valid: bool
    errors: list[str]
    warnings: list[str]
    task_info: dict[str, Any]


@dataclass
class InspectionResult:
    """Result from task inspection."""
    name: str
    version: str
    task_id: str
    task_type: str
    priority: int
    goal: dict[str, Any]
    llm_config: dict[str, Any]
    prompts: list[dict[str, Any]]
    registry: list[dict[str, Any]]
    flow: dict[str, Any]
    metadata: dict[str, Any]


@dataclass
class TaskInfo:
    """Summary information about a task."""
    name: str
    path: str | None
    version: str
    description: str
    prompt_count: int
    available: bool
    error: str | None = None


# ============================================================================
# Core API Functions
# ============================================================================

async def run_task(
    task: str | dict | TaskSchema,
    variables: dict[str, Any] | None = None,
    debug: bool = False,
    max_iterations: int = 1000,
    timeout_seconds: int = 300,
    strict: bool = True,
    provider: str | None = None,
    model: str | None = None,
    task_library: TaskLibrary | None = None,
    security_context: SecurityContext | None = None,
) -> APIResponse[TaskExecutionResult]:
    """
    Execute a task and return structured results.
    
    This is the primary API for task execution. It handles task loading,
    validation, execution, and result packaging.
    
    Args:
        task: Task name, file path, JSON dict, or TaskSchema
        variables: Context variables to inject into prompts
        debug: Enable debug logging
        max_iterations: Maximum state machine iterations
        timeout_seconds: Execution timeout
        strict: Enable strict validation
        provider: Override LLM provider
        model: Override LLM model
        task_library: Custom task library
        security_context: Security context for permission control
    
    Returns:
        APIResponse containing TaskExecutionResult
    
    Security:
        Respects security_context permissions for:
        - Provider override (validated against allowed list)
        - Iteration/timeout limits
        - File path access
    
    Example:
        result = await run_task(
            "simple_qa",
            variables={"question": "What is the capital of France?"},
            debug=True
        )
        if result.success:
            print(result.data.final_response)
    """
    ctx = security_context or get_default_context()
    
    # Check permission
    if not ctx.has_permission(Operation.RUN_TASK):
        return APIResponse.fail(
            "Operation RUN_TASK not allowed at current permission level"
        )
    
    try:
        # Validate and cap parameters based on security context
        max_iterations = ctx.validate_iterations(max_iterations)
        timeout_seconds = ctx.validate_timeout(timeout_seconds)
        
        # Validate provider override
        if provider:
            if ctx.has_permission(Operation.OVERRIDE_PROVIDER):
                provider = ctx.validate_provider(provider)
            else:
                provider = None  # Ignore override
        
        if model and not ctx.has_permission(Operation.OVERRIDE_MODEL):
            model = None  # Ignore override
        
        config = AdapterConfig(
            max_iterations=max_iterations,
            timeout_ms=timeout_seconds * 1000,
            strict_validation=strict,
            debug_mode=debug,
        )
        
        library = task_library or DEFAULT_TASK_LIBRARY
        adapter = UniversalAdapter(config, library)
        
        # Load task with security validation
        task_schema = _load_task(task, library, ctx)
        
        # Check if using real provider requires permission
        effective_provider = provider or task_schema.resource_llm.provider
        if not ctx.can_run_with_real_provider():
            return APIResponse.fail(
                f"Real provider '{effective_provider}' not allowed at "
                f"permission level '{ctx.permission_level.name}'"
            )
        
        if provider or model:
            task_schema = _apply_overrides(task_schema, provider, model)
        
        # Inject variables
        if variables:
            task_schema = _inject_variables(task_schema, variables)
        
        # Execute
        adapter_result = await adapter.execute(task_schema)
        
        # Package result
        execution_result = TaskExecutionResult.from_adapter_result(adapter_result)
        
        return APIResponse.ok(
            data=execution_result,
            metadata={
                "task_name": task_schema.name,
                "task_version": task_schema.version,
                "provider_used": task_schema.resource_llm.provider,
                "security_level": ctx.permission_level.name,
            }
        )
        
    except PermissionError as e:
        return APIResponse.fail(f"Permission denied: {e}")
    except PathSecurityError as e:
        return APIResponse.fail(f"Security violation: {e}")
    except Exception as e:
        return APIResponse.fail(str(e))


def run_task_sync(
    task: str | dict | TaskSchema,
    **kwargs: Any
) -> APIResponse[TaskExecutionResult]:
    """
    Synchronous wrapper for run_task.
    
    Convenience function for non-async contexts.
    """
    return asyncio.run(run_task(task, **kwargs))


async def execute_request(
    request: TaskRequest,
    task_library: TaskLibrary | None = None,
) -> APIResponse[TaskExecutionResult]:
    """
    Execute a structured TaskRequest.
    
    Args:
        request: TaskRequest with execution parameters
        task_library: Custom task library
    
    Returns:
        APIResponse containing TaskExecutionResult
    """
    return await run_task(
        task=request.task,
        variables=request.variables,
        debug=request.debug,
        max_iterations=request.max_iterations,
        timeout_seconds=request.timeout_seconds,
        strict=request.validation_level in (ValidationLevel.STRICT, ValidationLevel.PARANOID),
        provider=request.provider_override,
        model=request.model_override,
        task_library=task_library,
    )


# ============================================================================
# Validation API
# ============================================================================

def validate_task(
    task: str | dict | TaskSchema,
    level: ValidationLevel = ValidationLevel.STRICT,
    task_library: TaskLibrary | None = None,
) -> APIResponse[ValidationResult]:
    """
    Validate a task without executing it.
    
    Performs schema validation and flow graph analysis to identify
    potential issues before execution.
    
    Args:
        task: Task to validate
        level: Validation strictness level
        task_library: Custom task library
    
    Returns:
        APIResponse containing ValidationResult
    """
    try:
        library = task_library or DEFAULT_TASK_LIBRARY
        task_schema = _load_task(task, library)
        
        errors: list[str] = []
        warnings: list[str] = []
        
        # Schema validation
        schema_valid, schema_errors = validate_task_schema(task_schema)
        errors.extend(schema_errors)
        
        # Flow validation
        parser = MermaidParser()
        flow_graph = parser.parse(task_schema.flow_diagram.mermaid)
        flow_valid, flow_errors = flow_graph.validate()
        errors.extend(flow_errors)
        
        # Additional checks for strict/paranoid levels
        if level in (ValidationLevel.STRICT, ValidationLevel.PARANOID):
            # Check for API key configuration
            if not task_schema.resource_llm.api_key_env:
                warnings.append("No API key environment variable specified")
            
            # Check prompt count
            if len(task_schema.prompts) > 10:
                warnings.append(f"Large prompt count ({len(task_schema.prompts)}) may indicate complex flow")
        
        if level == ValidationLevel.PARANOID:
            # Check for cycles
            if flow_graph.has_cycles():
                warnings.append("Flow graph contains cycles - ensure loop limits are set")
            
            # Check prompt template syntax
            from .engine.interpolator import TemplateInterpolator
            interpolator = TemplateInterpolator(strict=False)
            for prompt in task_schema.prompts:
                placeholders = interpolator.extract_placeholders(prompt.template)
                for ph in placeholders:
                    if ph.startswith("response:"):
                        ref_id = ph.split(":")[1].split(".")[0]
                        if not ref_id.startswith("P"):
                            warnings.append(f"Unusual response reference: {ph}")
        
        is_valid = schema_valid and flow_valid
        
        result = ValidationResult(
            valid=is_valid,
            schema_valid=schema_valid,
            flow_valid=flow_valid,
            errors=errors,
            warnings=warnings,
            task_info={
                "name": task_schema.name,
                "version": task_schema.version,
                "prompts": len(task_schema.prompts),
                "nodes": len(flow_graph.nodes),
                "edges": len(flow_graph.edges),
            }
        )
        
        return APIResponse.ok(data=result, warnings=warnings)
        
    except Exception as e:
        return APIResponse.fail(str(e))


# ============================================================================
# Inspection API
# ============================================================================

def inspect_task(
    task: str | dict | TaskSchema,
    include_flow: bool = True,
    include_prompts: bool = True,
    include_registry: bool = True,
    include_goal: bool = True,
    task_library: TaskLibrary | None = None,
) -> APIResponse[InspectionResult]:
    """
    Inspect a task and return detailed information.
    
    Args:
        task: Task to inspect
        include_flow: Include flow diagram analysis
        include_prompts: Include prompt details
        include_registry: Include registry entries
        include_goal: Include goal and conditions
        task_library: Custom task library
    
    Returns:
        APIResponse containing InspectionResult
    """
    try:
        library = task_library or DEFAULT_TASK_LIBRARY
        task_schema = _load_task(task, library)
        
        # Build goal info
        goal_info = {}
        if include_goal:
            goal_info = {
                "description": task_schema.goal.description,
                "conditions": [
                    {
                        "description": c.description,
                        "type": c.evaluation_type.name,
                        "expected": c.expected_value,
                    }
                    for c in task_schema.goal.target_conditions
                ],
            }
        
        # Build prompts info
        prompts_info = []
        if include_prompts:
            prompts_info = [
                {
                    "index": p.index,
                    "description": p.description,
                    "role": p.role,
                    "template": p.template,
                }
                for p in task_schema.prompts
            ]
        
        # Build registry info
        registry_info = []
        if include_registry:
            registry_info = [
                {
                    "name": e.name,
                    "category": e.category,
                    "url": e.source_url,
                    "schema_ref": e.schema_ref,
                }
                for e in task_schema.resource_registry.entries
            ]
        
        # Build flow info
        flow_info = {}
        if include_flow:
            parser = MermaidParser()
            graph = parser.parse(task_schema.flow_diagram.mermaid)
            flow_info = {
                "mermaid": task_schema.flow_diagram.mermaid,
                "nodes": [
                    {"id": n.id, "type": n.node_type.name, "label": n.label}
                    for n in graph.nodes.values()
                ],
                "edges": [
                    {"source": e.source, "target": e.target, "condition": e.condition}
                    for e in graph.edges
                ],
                "start": graph.start_node,
                "ends": list(graph.end_nodes),
            }
        
        result = InspectionResult(
            name=task_schema.name,
            version=task_schema.version,
            task_id=task_schema.task_id,
            task_type=task_schema.task_type,
            priority=task_schema.priority,
            goal=goal_info,
            llm_config={
                "provider": task_schema.resource_llm.provider,
                "model": task_schema.resource_llm.model,
                "temperature": task_schema.resource_llm.temperature,
                "max_tokens": task_schema.resource_llm.max_tokens,
            },
            prompts=prompts_info,
            registry=registry_info,
            flow=flow_info,
            metadata={},
        )
        
        return APIResponse.ok(data=result)
        
    except Exception as e:
        return APIResponse.fail(str(e))


# ============================================================================
# Task Library API
# ============================================================================

def list_available_tasks(
    verbose: bool = False,
    task_library: TaskLibrary | None = None,
) -> APIResponse[list[TaskInfo]]:
    """
    List all available named tasks.
    
    Args:
        verbose: Include detailed information for each task
        task_library: Custom task library
    
    Returns:
        APIResponse containing list of TaskInfo
    """
    library = task_library or DEFAULT_TASK_LIBRARY
    task_names = library.list_tasks()
    
    tasks: list[TaskInfo] = []
    
    for name in task_names:
        if not verbose:
            tasks.append(TaskInfo(
                name=name,
                path=str(library.get_path(name)),
                version="",
                description="",
                prompt_count=0,
                available=True,
            ))
        else:
            try:
                schema = library.load(name)
                tasks.append(TaskInfo(
                    name=name,
                    path=str(library.get_path(name)),
                    version=schema.version,
                    description=schema.goal.description,
                    prompt_count=len(schema.prompts),
                    available=True,
                ))
            except Exception as e:
                tasks.append(TaskInfo(
                    name=name,
                    path=str(library.get_path(name)),
                    version="",
                    description="",
                    prompt_count=0,
                    available=False,
                    error=str(e),
                ))
    
    return APIResponse.ok(data=tasks)


def get_task(
    name: str,
    task_library: TaskLibrary | None = None,
) -> APIResponse[TaskSchema]:
    """
    Load a task by name.
    
    Args:
        name: Task name
        task_library: Custom task library
    
    Returns:
        APIResponse containing TaskSchema
    """
    try:
        library = task_library or DEFAULT_TASK_LIBRARY
        schema = library.load(name)
        return APIResponse.ok(data=schema)
    except Exception as e:
        return APIResponse.fail(str(e))


# ============================================================================
# Provider API
# ============================================================================

@dataclass
class ProviderInfo:
    """Information about an LLM provider."""
    name: str
    models: list[str]
    endpoint: str | None
    api_key_env: str | None
    api_key_configured: bool


def list_providers(check_keys: bool = True) -> APIResponse[list[ProviderInfo]]:
    """
    List available LLM providers.
    
    Args:
        check_keys: Check if API keys are configured
    
    Returns:
        APIResponse containing list of ProviderInfo
    """
    import os
    
    providers = [
        ProviderInfo(
            name="openai",
            models=["gpt-5", "gpt-4o", "gpt-4", "gpt-3.5-turbo", "o1-preview", "o1-mini"],
            endpoint="https://api.openai.com/v1",
            api_key_env="OPENAI_API_KEY",
            api_key_configured=bool(os.environ.get("OPENAI_API_KEY")) if check_keys else False,
        ),
        ProviderInfo(
            name="anthropic",
            models=["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-sonnet-20240229"],
            endpoint="https://api.anthropic.com/v1",
            api_key_env="ANTHROPIC_API_KEY",
            api_key_configured=bool(os.environ.get("ANTHROPIC_API_KEY")) if check_keys else False,
        ),
    ]
    
    return APIResponse.ok(data=providers)


# ============================================================================
# Flow Analysis API
# ============================================================================

@dataclass
class FlowAnalysis:
    """Analysis of a flow diagram."""
    valid: bool
    node_count: int
    edge_count: int
    start_node: str
    end_nodes: list[str]
    has_cycles: bool
    node_types: dict[str, int]
    prompt_nodes: list[dict[str, Any]]
    errors: list[str]


def analyze_flow(
    source: str | dict,
    task_library: TaskLibrary | None = None,
) -> APIResponse[FlowAnalysis]:
    """
    Analyze a Mermaid flow diagram.
    
    Args:
        source: Mermaid text, task name, or file path
    
    Returns:
        APIResponse containing FlowAnalysis
    """
    try:
        library = task_library or DEFAULT_TASK_LIBRARY
        
        # Get mermaid source
        if isinstance(source, dict):
            mermaid_text = source.get("mermaid", "")
        elif source in library.list_tasks():
            schema = library.load(source)
            mermaid_text = schema.flow_diagram.mermaid
        elif Path(source).exists():
            content = Path(source).read_text()
            if source.endswith(".json"):
                data = json.loads(content)
                mermaid_text = data.get("flow_diagram", {}).get("mermaid", content)
            else:
                mermaid_text = content
        else:
            mermaid_text = source
        
        # Parse
        parser = MermaidParser()
        graph = parser.parse(mermaid_text)
        
        # Validate
        is_valid, errors = graph.validate()
        
        # Analyze
        node_types: dict[str, int] = {}
        for node in graph.nodes.values():
            type_name = node.node_type.name
            node_types[type_name] = node_types.get(type_name, 0) + 1
        
        prompt_nodes = [
            {"id": n.id, "index": n.prompt_index, "label": n.label}
            for n in graph.prompt_nodes()
        ]
        
        result = FlowAnalysis(
            valid=is_valid,
            node_count=len(graph.nodes),
            edge_count=len(graph.edges),
            start_node=graph.start_node,
            end_nodes=list(graph.end_nodes),
            has_cycles=graph.has_cycles(),
            node_types=node_types,
            prompt_nodes=prompt_nodes,
            errors=errors,
        )
        
        return APIResponse.ok(data=result)
        
    except Exception as e:
        return APIResponse.fail(str(e))


# ============================================================================
# Task Creation API
# ============================================================================

def create_task(
    name: str,
    goal_description: str,
    prompts: list[dict[str, str]],
    flow_mermaid: str,
    provider: str = "anthropic",
    model: str = "claude-3-5-sonnet-20241022",
    registry_entries: list[dict[str, str]] | None = None,
    conditions: list[dict[str, Any]] | None = None,
) -> APIResponse[TaskSchema]:
    """
    Create a new task programmatically.
    
    Args:
        name: Task name
        goal_description: Description of what the task should accomplish
        prompts: List of prompt dicts with 'template', 'role', 'description'
        flow_mermaid: Mermaid diagram defining the flow
        provider: LLM provider
        model: Model name
        registry_entries: Optional registry entries
        conditions: Optional goal conditions
    
    Returns:
        APIResponse containing the created TaskSchema
    
    Example:
        result = create_task(
            name="my_task",
            goal_description="Answer a question",
            prompts=[
                {"template": "Answer: {{question}}", "role": "user", "description": "Main"}
            ],
            flow_mermaid="graph TD\\n    START --> P0 --> END"
        )
    """
    try:
        # Build conditions
        if conditions:
            target_conditions = tuple(
                TargetCondition(
                    description=c.get("description", ""),
                    evaluation_type=ConditionType[c.get("type", "GOAL_MET")],
                    expected_value=c.get("expected"),
                )
                for c in conditions
            )
        else:
            target_conditions = (
                TargetCondition(
                    description="Task completed successfully",
                    evaluation_type=ConditionType.GOAL_MET,
                ),
            )
        
        # Build goal
        goal = Goal(
            description=goal_description,
            target_conditions=target_conditions,
        )
        
        # Build LLM config
        resource_llm = ResourceLLM(
            provider=provider,
            model=model,
        )
        
        # Build registry
        entries = tuple(
            RegistryEntry(
                name=e.get("name", ""),
                category=e.get("category", "default"),
                schema_ref=e.get("schema_ref"),
                source_url=e.get("url", ""),
            )
            for e in (registry_entries or [])
        )
        resource_registry = ResourceRegistry(entries=entries)
        
        # Build prompts
        prompt_objects = tuple(
            Prompt(
                index=i,
                template=p.get("template", ""),
                role=p.get("role", "user"),
                description=p.get("description", ""),
            )
            for i, p in enumerate(prompts)
        )
        
        # Build flow diagram
        flow_diagram = FlowDiagram(mermaid=flow_mermaid)
        
        # Create schema
        schema = TaskSchema(
            goal=goal,
            resource_llm=resource_llm,
            resource_registry=resource_registry,
            prompts=prompt_objects,
            flow_diagram=flow_diagram,
            name=name,
            version="1.0.0",
        )
        
        return APIResponse.ok(data=schema)
        
    except Exception as e:
        return APIResponse.fail(str(e))


def save_task(
    task: TaskSchema,
    path: str | Path,
    security_context: SecurityContext | None = None,
) -> APIResponse[str]:
    """
    Save a TaskSchema to a JSON file.
    
    Args:
        task: TaskSchema to save
        path: Output file path
        security_context: Security context for permission control
    
    Returns:
        APIResponse with the saved file path
    
    Security:
        Requires SAVE_TASK and WRITE_FILE permissions.
        Path is validated against security context.
    """
    ctx = security_context or get_default_context()
    
    # Check permissions
    if not ctx.has_permission(Operation.SAVE_TASK):
        return APIResponse.fail(
            "Operation SAVE_TASK not allowed at current permission level"
        )
    
    if not ctx.can_write_files():
        return APIResponse.fail(
            "File write operations not allowed at current permission level"
        )
    
    try:
        # Validate path
        try:
            validated_path = ctx.validate_write_path(path)
        except PathSecurityError as e:
            return APIResponse.fail(f"Invalid output path: {e}")
        
        # Convert to dict
        task_dict = {
            "name": task.name,
            "version": task.version,
            "task_id": task.task_id,
            "task_type": task.task_type,
            "priority": task.priority,
            "goal": {
                "description": task.goal.description,
                "target_conditions": [
                    {
                        "description": c.description,
                        "evaluation_type": c.evaluation_type.name,
                        "expected_value": c.expected_value,
                    }
                    for c in task.goal.target_conditions
                ],
            },
            "resource_llm": {
                "provider": task.resource_llm.provider,
                "model": task.resource_llm.model,
                "temperature": task.resource_llm.temperature,
                "max_tokens": task.resource_llm.max_tokens,
                "api_key_env": task.resource_llm.api_key_env,
            },
            "resource_registry": {
                "entries": [
                    {
                        "name": e.name,
                        "category": e.category,
                        "schema_ref": e.schema_ref,
                        "source_url": e.source_url,
                    }
                    for e in task.resource_registry.entries
                ],
            },
            "prompts": [
                {
                    "template": p.template,
                    "role": p.role,
                    "description": p.description,
                }
                for p in task.prompts
            ],
            "flow_diagram": {
                "mermaid": task.flow_diagram.mermaid,
            },
        }
        
        with open(validated_path, "w") as f:
            json.dump(task_dict, f, indent=2)
        
        return APIResponse.ok(data=str(validated_path))
        
    except PermissionError as e:
        return APIResponse.fail(f"Permission denied: {e}")
    except Exception as e:
        return APIResponse.fail(str(e))


# ============================================================================
# Helper Functions
# ============================================================================

def _load_task(
    task: str | dict | TaskSchema,
    library: TaskLibrary,
    security_context: SecurityContext | None = None,
) -> TaskSchema:
    """
    Load task from various sources with security validation.
    
    Security:
        File paths are validated against the security context.
        Named tasks from the library are always allowed.
    """
    ctx = security_context or get_default_context()
    
    if isinstance(task, TaskSchema):
        return task
    
    if isinstance(task, dict):
        return TaskSchema.from_dict(task)
    
    # String - could be name, path, or JSON
    # Named tasks from library are always allowed (trusted source)
    if task in library.list_tasks():
        return library.load(task)
    
    # File path - requires permission and validation
    path = Path(task)
    if path.exists() or task.endswith('.json'):
        if not ctx.can_read_files():
            raise PermissionError("File read operations not allowed")
        
        try:
            validated_path = ctx.validate_read_path(task)
        except PathSecurityError as e:
            raise PermissionError(f"Path security violation: {e}")
        
        if validated_path.exists():
            return TaskSchema.from_file(str(validated_path))
    
    # Try as JSON string (always allowed - no file access)
    if task.startswith("{"):
        return TaskSchema.from_json(task)
    
    raise ValueError(f"Cannot load task: {task}")


def _apply_overrides(
    schema: TaskSchema,
    provider: str | None,
    model: str | None,
) -> TaskSchema:
    """Apply provider/model overrides."""
    new_llm = ResourceLLM(
        provider=provider or schema.resource_llm.provider,
        model=model or schema.resource_llm.model,
        endpoint=schema.resource_llm.endpoint,
        api_key_env=schema.resource_llm.api_key_env,
        temperature=schema.resource_llm.temperature,
        max_tokens=schema.resource_llm.max_tokens,
        timeout_seconds=schema.resource_llm.timeout_seconds,
    )
    
    return TaskSchema(
        goal=schema.goal,
        resource_llm=new_llm,
        resource_registry=schema.resource_registry,
        prompts=schema.prompts,
        flow_diagram=schema.flow_diagram,
        name=schema.name,
        version=schema.version,
        task_id=schema.task_id,
        task_type=schema.task_type,
        priority=schema.priority,
        input_context=schema.input_context,
    )


def _inject_variables(
    schema: TaskSchema,
    variables: dict[str, Any],
) -> TaskSchema:
    """
    Inject variables into a task schema's input_context.
    
    Variables are merged with existing input_context and made available
    for template interpolation during execution.
    """
    # Merge with existing input_context
    merged_context = dict(schema.input_context)
    merged_context.update(variables)
    
    return TaskSchema(
        goal=schema.goal,
        resource_llm=schema.resource_llm,
        resource_registry=schema.resource_registry,
        prompts=schema.prompts,
        flow_diagram=schema.flow_diagram,
        name=schema.name,
        version=schema.version,
        task_id=schema.task_id,
        task_type=schema.task_type,
        priority=schema.priority,
        input_context=merged_context,
    )


# ============================================================================
# Convenience Aliases
# ============================================================================

# Async aliases
execute = run_task
validate = validate_task
inspect = inspect_task
tasks = list_available_tasks
providers = list_providers
flow = analyze_flow

# Sync aliases
execute_sync = run_task_sync
