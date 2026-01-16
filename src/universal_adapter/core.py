"""
Universal Adapter Core - General-Purpose JSON-Driven Logic Processor

The main orchestration engine that:
1. Receives task.json specifications
2. Parses and validates the schema
3. Constructs the flow graph from Mermaid diagram
4. Executes prompts according to the flow topology
5. Evaluates responses for conditional branching
6. Verifies goal achievement upon completion
"""

from __future__ import annotations
import time
import asyncio
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from .schema import (
    TaskSchema,
    Goal,
    ResourceLLM,
    ResourceRegistry,
    Prompt,
    FlowDiagram,
    validate_task_schema,
)
from .flow.graph import FlowGraph, FlowNode, NodeType
from .flow.parser import MermaidParser, parse_mermaid
from .flow.executor import (
    FlowExecutor,
    FlowExecutorBuilder,
    ExecutionState,
    ExecutionResult as FlowExecutionResult,
    ExecutionStatus,
)
from .engine.interpolator import TemplateInterpolator, InterpolationContext
from .engine.llm_client import LLMClient, LLMRequest, LLMResponse, Message
from .evaluator.categorizer import ResponseCategorizer, EvaluationResult
from .verifier.goal_verifier import GoalVerifier, VerificationResult
from .task_library import TaskLibrary, DEFAULT_TASK_LIBRARY
from .logger import log_run_event

logger = logging.getLogger("universal_adapter")


@dataclass(frozen=True)
class AdapterResult:
    """
    Complete result from Universal Adapter execution.

    Aggregates flow execution and goal verification results.
    """
    success: bool
    goal_met: bool
    execution_status: ExecutionStatus
    final_response: Any
    execution_time_ms: float
    iteration_count: int
    goal_verification: VerificationResult | None
    execution_result: FlowExecutionResult
    errors: tuple[str, ...] = ()
    metadata: Mapping[str, Any] = field(default_factory=dict)

    @property
    def summary(self) -> str:
        """Generate a summary of the execution."""
        lines = [
            f"Success: {self.success}",
            f"Goal Met: {self.goal_met}",
            f"Status: {self.execution_status.name}",
            f"Iterations: {self.iteration_count}",
            f"Time: {self.execution_time_ms:.1f}ms",
        ]
        if self.errors:
            lines.append(f"Errors: {', '.join(self.errors)}")
        return "\n".join(lines)


@dataclass
class AdapterConfig:
    """Configuration for the Universal Adapter."""
    max_iterations: int = 1000
    timeout_ms: float = 300000  # 5 minutes
    strict_validation: bool = True
    debug_mode: bool = False
    require_all_conditions: bool = True


class UniversalAdapter:
    """
    General-purpose JSON-driven logic processor for LLM task orchestration.

    The Universal Adapter is the main entry point for executing tasks
    defined in task.json specifications. It coordinates:

    1. Schema parsing and validation
    2. Flow graph construction from Mermaid diagrams
    3. Prompt execution with template interpolation
    4. Response categorization for branching
    5. Goal verification

    Example usage:
        adapter = UniversalAdapter()
        result = await adapter.execute(task_json)
    """

    def __init__(
        self,
        config: AdapterConfig | None = None,
        task_library: TaskLibrary | None = None
    ) -> None:
        """
        Initialize the Universal Adapter.

        Args:
            config: Optional configuration settings
        """
        self.config = config or AdapterConfig()
        self.task_library = task_library or DEFAULT_TASK_LIBRARY
        self.parser = MermaidParser()
        self.interpolator = TemplateInterpolator(strict=self.config.strict_validation)
        self.verifier = GoalVerifier(require_all=self.config.require_all_conditions)

    async def execute(
        self,
        task: TaskSchema | str | dict,
        variables: Mapping[str, Any] | None = None
    ) -> AdapterResult:
        """
        Execute a task specification.

        Args:
            task: Either a TaskSchema object, JSON string, or dictionary

        Returns:
            AdapterResult with execution details
        """
        start_time = time.time()
        errors: list[str] = []

        try:
            # Step 1: Parse and validate task schema
            task_schema = self._parse_task(task)
            is_valid, validation_errors = validate_task_schema(task_schema)
            if not is_valid and self.config.strict_validation:
                return self._error_result(
                    f"Schema validation failed: {', '.join(validation_errors)}",
                    start_time
                )
            errors.extend(validation_errors)

            self._log("Task schema parsed successfully")

            # Step 2: Parse flow diagram into flow graph
            flow_graph = self.parser.parse(task_schema.flow_diagram.mermaid)
            graph_valid, graph_errors = flow_graph.validate()
            if not graph_valid:
                errors.extend(graph_errors)
                if self.config.strict_validation:
                    return self._error_result(
                        f"Flow graph invalid: {', '.join(graph_errors)}",
                        start_time
                    )

            self._log(f"Flow graph parsed: {len(flow_graph)} nodes")

            # Step 3: Create LLM client
            llm_client = LLMClient(task_schema.resource_llm)
            client_valid, client_errors = llm_client.validate()
            if not client_valid:
                errors.extend(client_errors)

            # Step 4: Build flow executor with prompt handler
            executor = self._build_executor(
                flow_graph,
                task_schema,
                llm_client
            )

            # Step 5: Execute the flow
            self._log("Starting flow execution")
            execution_result = await executor.execute(initial_variables=variables)
            self._log(f"Flow execution complete: {execution_result.status.name}")

            # Step 6: Verify goal if execution completed
            goal_verification = None
            goal_met = False

            if execution_result.status == ExecutionStatus.COMPLETED:
                goal_verification = self.verifier.verify(
                    task_schema.goal,
                    execution_result.final_state
                )
                goal_met = goal_verification.goal_met
                self._log(f"Goal verification: {'ACHIEVED' if goal_met else 'NOT ACHIEVED'}")

            result = AdapterResult(
                success=execution_result.success and goal_met,
                goal_met=goal_met,
                execution_status=execution_result.status,
                final_response=execution_result.final_response,
                execution_time_ms=(time.time() - start_time) * 1000,
                iteration_count=execution_result.final_state.iteration,
                goal_verification=goal_verification,
                execution_result=execution_result,
                errors=tuple(errors),
                metadata={
                    "task_name": task_schema.name,
                    "task_version": task_schema.version,
                    "task_id": task_schema.task_id,
                    "task_type": task_schema.task_type,
                    "priority": task_schema.priority,
                    "nodes_executed": len(execution_result.history),
                }
            )

            self._log_run(task_schema, result)
            return result

        except Exception as e:
            err_result = self._error_result(str(e), start_time)
            self._log_run(None, err_result, error=str(e))
            return err_result

    def _parse_task(self, task: TaskSchema | str | dict) -> TaskSchema:
        """Parse task input into TaskSchema."""
        if isinstance(task, TaskSchema):
            return task
        if isinstance(task, str):
            # Try named task from library first
            if task in self.task_library.list_tasks():
                return self.task_library.load(task)

            path = Path(task)
            if path.exists():
                return TaskSchema.from_file(str(path))

            # Treat as raw JSON string
            return TaskSchema.from_json(task)
        if isinstance(task, dict):
            return TaskSchema.from_dict(task)
        raise ValueError(f"Invalid task type: {type(task)}")

    def _build_executor(
        self,
        graph: FlowGraph,
        task: TaskSchema,
        llm_client: LLMClient
    ) -> FlowExecutor:
        """Build a flow executor with configured handlers."""
        # Create the prompt handler that will be called for PROMPT nodes
        async def prompt_handler(
            node: FlowNode,
            state: ExecutionState
        ) -> tuple[Any, str | None]:
            return await self._handle_prompt_node(node, state, task, llm_client)

        # Create the registry handler for REGISTRY nodes
        async def registry_handler(
            node: FlowNode,
            state: ExecutionState
        ) -> tuple[Any, str | None]:
            return self._handle_registry_node(node, state, task)

        async def goal_check_handler(
            node: FlowNode,
            state: ExecutionState
        ) -> tuple[Any, str | None]:
            verification = self.verifier.verify(task.goal, state)
            category = "goal_met" if verification.goal_met else "goal_failed"
            return (verification.summary, category)

        builder = FlowExecutorBuilder(graph)
        builder.with_handler(NodeType.PROMPT, prompt_handler)
        builder.with_handler(NodeType.REGISTRY, registry_handler)
        builder.with_handler(NodeType.GOAL_CHECK, goal_check_handler)
        builder.with_max_iterations(self.config.max_iterations)
        builder.with_timeout_ms(self.config.timeout_ms)

        return builder.build()

    async def _handle_prompt_node(
        self,
        node: FlowNode,
        state: ExecutionState,
        task: TaskSchema,
        llm_client: LLMClient
    ) -> tuple[Any, str | None]:
        """
        Handle execution of a PROMPT node.

        1. Get the prompt template by index
        2. Interpolate variables and registry references
        3. Execute LLM call
        4. Categorize response for branching
        """
        # Get prompt by index
        if node.prompt_index is None:
            raise ValueError(f"Prompt node {node.id} has no prompt_index")

        prompt = task.get_prompt(node.prompt_index)
        if prompt is None:
            raise ValueError(f"Prompt not found at index {node.prompt_index}")

        # Build interpolation context
        context = InterpolationContext(
            variables={**(task.input_context or {}), **dict(state.variables)},
            responses=dict(state.responses),
            registry=task.resource_registry,
            loop_index=sum(state.loop_counters.values()) if state.loop_counters else 0,
            loop_count=len(state.loop_counters)
        )

        # Interpolate the prompt template
        interpolated_prompt = self.interpolator.interpolate(prompt.template, context)

        self._log(f"Executing prompt {node.prompt_index}: {prompt.description or node.id}")

        # Create LLM request
        request = LLMRequest.simple(
            prompt=interpolated_prompt,
            model=task.resource_llm.model,
            temperature=task.resource_llm.temperature,
            max_tokens=task.resource_llm.max_tokens
        )

        # Execute LLM call
        response = await llm_client.complete(request)
        response_content = response.content

        # Categorize response for branching
        # Use edge labels from the graph as categories
        categorizer = ResponseCategorizer.from_edge_labels(
            self._extract_edge_labels(task.flow_diagram.mermaid, node.id)
        )
        evaluation = categorizer.evaluate(response_content)

        return (response_content, evaluation.category)

    def _handle_registry_node(
        self,
        node: FlowNode,
        state: ExecutionState,
        task: TaskSchema
    ) -> tuple[Any, str | None]:
        """Handle REGISTRY node - resolve registry entries."""
        if node.registry_key:
            entry = task.resource_registry.lookup(node.registry_key)
            if entry:
                return (entry.source_url, None)
        return (None, None)

    def _extract_edge_labels(self, mermaid: str, node_id: str) -> list[str]:
        """Extract edge labels from Mermaid diagram for a given node."""
        import re
        # Pattern: node_id -->|label| target
        pattern = rf'{re.escape(node_id)}\s*-->\|([^|]+)\|'
        matches = re.findall(pattern, mermaid, re.IGNORECASE)

        if matches:
            return [m.strip() for m in matches]

        # Default categories if no specific labels found
        return ["success", "failure"]

    def _error_result(self, error: str, start_time: float) -> AdapterResult:
        """Create an error result."""
        return AdapterResult(
            success=False,
            goal_met=False,
            execution_status=ExecutionStatus.FAILED,
            final_response=None,
            execution_time_ms=(time.time() - start_time) * 1000,
            iteration_count=0,
            goal_verification=None,
            execution_result=FlowExecutionResult(
                status=ExecutionStatus.FAILED,
                final_state=ExecutionState.initial("error"),
                history=(),
                error=error
            ),
            errors=(error,)
        )

    def _log(self, message: str) -> None:
        """Debug logging."""
        if self.config.debug_mode:
            logger.debug(message)

    def _log_run(self, task: TaskSchema | None, result: AdapterResult, error: str | None = None) -> None:
        """Emit a JSONL run event."""
        try:
            event = {
                "@timestamp": time.time(),
                "task_name": getattr(task, "name", None),
                "task_id": getattr(task, "task_id", None),
                "task_type": getattr(task, "task_type", None),
                "task_version": getattr(task, "version", None),
                "priority": getattr(task, "priority", None),
                "goal_met": result.goal_met,
                "success": result.success,
                "status": result.execution_status.name if result.execution_status else None,
                "iteration_count": result.iteration_count,
                "execution_time_ms": result.execution_time_ms,
                "errors": list(result.errors) if result.errors else ([] if not error else [error]),
            }
            if task:
                event["registry_entries"] = len(task.resource_registry.entries)
                event["llm_provider"] = task.resource_llm.provider
                event["llm_model"] = task.resource_llm.model
            log_run_event(event)
        except Exception:
            return


async def execute_task(
    task: TaskSchema | str | dict,
    config: AdapterConfig | None = None,
    variables: Mapping[str, Any] | None = None
) -> AdapterResult:
    """
    Convenience function for task execution.

    Args:
        task: Task specification (TaskSchema, JSON string, or dict)
        config: Optional adapter configuration

    Returns:
        AdapterResult
    """
    adapter = UniversalAdapter(config)
    return await adapter.execute(task, variables=variables)


def run_task(
    task: TaskSchema | str | dict,
    config: AdapterConfig | None = None,
    variables: Mapping[str, Any] | None = None
) -> AdapterResult:
    """
    Synchronous wrapper for task execution.

    Convenience function for non-async contexts.
    """
    return asyncio.run(execute_task(task, config, variables))
