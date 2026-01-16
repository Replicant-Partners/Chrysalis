"""
Flow Executor - State Machine Execution Engine

Executes a FlowGraph by traversing nodes, handling transitions,
managing loop iterations, and invoking callbacks for node actions.

The executor is decoupled from the actual prompt execution and
response evaluation - those are provided via callbacks.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable, Protocol, Mapping
from enum import Enum, auto
import time

from .graph import FlowGraph, FlowNode, NodeType


class ExecutionStatus(Enum):
    """Status of the execution."""
    PENDING = auto()
    RUNNING = auto()
    COMPLETED = auto()
    FAILED = auto()
    TIMEOUT = auto()
    MAX_ITERATIONS = auto()


@dataclass
class ExecutionState:
    """
    Immutable snapshot of execution state at a point in time.

    The executor maintains state through successive state objects,
    enabling replay and debugging.
    """
    current_node: str
    iteration: int
    loop_counters: Mapping[str, int]  # node_id -> current iteration
    responses: Mapping[str, Any]      # node_id -> response from that node
    categories: Mapping[str, str]     # node_id -> evaluated category
    variables: Mapping[str, Any]      # arbitrary variables set during execution
    timestamp: float

    @staticmethod
    def initial(start_node: str) -> ExecutionState:
        """Create initial execution state."""
        return ExecutionState(
            current_node=start_node,
            iteration=0,
            loop_counters={},
            responses={},
            categories={},
            variables={},
            timestamp=time.time()
        )

    def with_transition(
        self,
        next_node: str,
        response: Any = None,
        category: str | None = None,
        variables: Mapping[str, Any] | None = None
    ) -> ExecutionState:
        """Create new state after transition."""
        new_responses = dict(self.responses)
        if response is not None:
            new_responses[self.current_node] = response

        new_categories = dict(self.categories)
        if category is not None:
            new_categories[self.current_node] = category

        new_variables = dict(self.variables)
        if variables:
            new_variables.update(variables)

        return ExecutionState(
            current_node=next_node,
            iteration=self.iteration + 1,
            loop_counters=dict(self.loop_counters),
            responses=new_responses,
            categories=new_categories,
            variables=new_variables,
            timestamp=time.time()
        )

    def increment_loop(self, loop_node: str) -> ExecutionState:
        """Increment loop counter for a loop node."""
        new_counters = dict(self.loop_counters)
        new_counters[loop_node] = new_counters.get(loop_node, 0) + 1
        return ExecutionState(
            current_node=self.current_node,
            iteration=self.iteration,
            loop_counters=new_counters,
            responses=dict(self.responses),
            categories=dict(self.categories),
            variables=dict(self.variables),
            timestamp=time.time()
        )

    def reset_loop(self, loop_node: str) -> ExecutionState:
        """Reset loop counter for a loop node."""
        new_counters = dict(self.loop_counters)
        new_counters.pop(loop_node, None)
        return ExecutionState(
            current_node=self.current_node,
            iteration=self.iteration,
            loop_counters=new_counters,
            responses=dict(self.responses),
            categories=dict(self.categories),
            variables=dict(self.variables),
            timestamp=time.time()
        )


@dataclass
class ExecutionResult:
    """Result of flow execution."""
    status: ExecutionStatus
    final_state: ExecutionState
    history: tuple[ExecutionState, ...]
    error: str | None = None
    execution_time_ms: float = 0.0

    @property
    def success(self) -> bool:
        return self.status == ExecutionStatus.COMPLETED

    @property
    def final_response(self) -> Any:
        """Get the last response from execution."""
        if not self.final_state.responses:
            return None
        # Return the most recent response
        return list(self.final_state.responses.values())[-1]


class NodeHandler(Protocol):
    """Protocol for node execution handlers."""

    async def __call__(
        self,
        node: FlowNode,
        state: ExecutionState
    ) -> tuple[Any, str | None]:
        """
        Handle node execution.

        Args:
            node: The node to execute
            state: Current execution state

        Returns:
            Tuple of (response, category) where category may be None
        """
        ...


class FlowExecutor:
    """
    State machine executor for FlowGraphs.

    The executor traverses the graph, invoking handlers for each node type
    and managing transitions based on response categories.
    """

    def __init__(
        self,
        graph: FlowGraph,
        handlers: Mapping[NodeType, NodeHandler] | None = None,
        max_iterations: int = 1000,
        timeout_ms: float = 300000  # 5 minutes
    ) -> None:
        self.graph = graph
        self.handlers = dict(handlers) if handlers else {}
        self.max_iterations = max_iterations
        self.timeout_ms = timeout_ms

    def set_handler(self, node_type: NodeType, handler: NodeHandler) -> None:
        """Register a handler for a node type."""
        self.handlers[node_type] = handler

    async def execute(self) -> ExecutionResult:
        """
        Execute the flow graph from start to end.

        Returns:
            ExecutionResult with final state and history
        """
        start_time = time.time()
        state = ExecutionState.initial(self.graph.start_node)
        history: list[ExecutionState] = [state]

        try:
            while True:
                # Check termination conditions
                elapsed_ms = (time.time() - start_time) * 1000
                if elapsed_ms > self.timeout_ms:
                    return ExecutionResult(
                        status=ExecutionStatus.TIMEOUT,
                        final_state=state,
                        history=tuple(history),
                        error=f"Execution timeout after {elapsed_ms:.0f}ms",
                        execution_time_ms=elapsed_ms
                    )

                if state.iteration >= self.max_iterations:
                    return ExecutionResult(
                        status=ExecutionStatus.MAX_ITERATIONS,
                        final_state=state,
                        history=tuple(history),
                        error=f"Max iterations ({self.max_iterations}) exceeded",
                        execution_time_ms=elapsed_ms
                    )

                # Get current node
                node = self.graph.get_node(state.current_node)
                if node is None:
                    return ExecutionResult(
                        status=ExecutionStatus.FAILED,
                        final_state=state,
                        history=tuple(history),
                        error=f"Node not found: {state.current_node}",
                        execution_time_ms=elapsed_ms
                    )

                # Check for terminal node
                if node.node_type == NodeType.END:
                    return ExecutionResult(
                        status=ExecutionStatus.COMPLETED,
                        final_state=state,
                        history=tuple(history),
                        execution_time_ms=(time.time() - start_time) * 1000
                    )

                # Execute the node
                response, category = await self._execute_node(node, state)

                # Determine next node
                next_node_id = self._get_next_node(node, state, category)

                if next_node_id is None:
                    return ExecutionResult(
                        status=ExecutionStatus.FAILED,
                        final_state=state,
                        history=tuple(history),
                        error=f"No valid transition from node: {node.id}",
                        execution_time_ms=(time.time() - start_time) * 1000
                    )

                # Transition to next state
                state = state.with_transition(
                    next_node=next_node_id,
                    response=response,
                    category=category
                )
                history.append(state)

        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            return ExecutionResult(
                status=ExecutionStatus.FAILED,
                final_state=state,
                history=tuple(history),
                error=str(e),
                execution_time_ms=elapsed_ms
            )

    async def _execute_node(
        self,
        node: FlowNode,
        state: ExecutionState
    ) -> tuple[Any, str | None]:
        """Execute a single node and return (response, category)."""
        handler = self.handlers.get(node.node_type)

        if handler is None:
            # Default handlers for special node types
            if node.node_type == NodeType.START:
                return (None, None)
            if node.node_type == NodeType.MERGE:
                return (None, None)
            if node.node_type == NodeType.LOOP:
                return self._handle_loop(node, state)
            if node.node_type == NodeType.CONDITION:
                return self._handle_condition(node, state)
            # No handler and not a special type
            raise ValueError(f"No handler for node type: {node.node_type}")

        return await handler(node, state)

    def _handle_loop(
        self,
        node: FlowNode,
        state: ExecutionState
    ) -> tuple[Any, str | None]:
        """Handle loop node iteration logic."""
        current_count = state.loop_counters.get(node.id, 0)

        if current_count >= node.loop_limit:
            # Loop exhausted - return "exit" category
            return (current_count, "exit")
        else:
            # Continue loop - return "continue" category
            return (current_count, "continue")

    def _handle_condition(
        self,
        node: FlowNode,
        state: ExecutionState
    ) -> tuple[Any, str | None]:
        """
        Handle condition node.

        Conditions typically evaluate based on previous responses.
        The category is determined by the condition evaluation.
        """
        # Default: look for the most recent response
        if not state.responses:
            return (None, "false")

        last_response = list(state.responses.values())[-1]

        # Simple truthiness check as default
        if last_response:
            return (last_response, "true")
        return (last_response, "false")

    def _get_next_node(
        self,
        node: FlowNode,
        state: ExecutionState,
        category: str | None
    ) -> str | None:
        """Determine the next node based on current node and category."""
        # Handle loop iteration increment
        if node.node_type == NodeType.LOOP and category == "continue":
            # Need to increment the loop counter
            # This is handled in the state transition
            pass

        # Use graph's edge matching
        return self.graph.get_next_node(node.id, category)


class FlowExecutorBuilder:
    """Builder for configuring and creating FlowExecutor instances."""

    def __init__(self, graph: FlowGraph) -> None:
        self._graph = graph
        self._handlers: dict[NodeType, NodeHandler] = {}
        self._max_iterations = 1000
        self._timeout_ms = 300000.0

    def with_handler(self, node_type: NodeType, handler: NodeHandler) -> FlowExecutorBuilder:
        """Add a handler for a node type."""
        self._handlers[node_type] = handler
        return self

    def with_max_iterations(self, max_iter: int) -> FlowExecutorBuilder:
        """Set maximum iterations."""
        self._max_iterations = max_iter
        return self

    def with_timeout_ms(self, timeout: float) -> FlowExecutorBuilder:
        """Set execution timeout in milliseconds."""
        self._timeout_ms = timeout
        return self

    def build(self) -> FlowExecutor:
        """Build the configured FlowExecutor."""
        return FlowExecutor(
            graph=self._graph,
            handlers=self._handlers,
            max_iterations=self._max_iterations,
            timeout_ms=self._timeout_ms
        )
