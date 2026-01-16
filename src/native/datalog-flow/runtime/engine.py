"""
Chrysalis Datalog Flow Engine

Python runtime for executing Datalog-specified flow graphs.
Provides integration between Soufflé and the Universal Adapter.
"""

import subprocess
import tempfile
import os
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any, Optional
from enum import Enum


class NodeType(Enum):
    START = "start"
    END = "end"
    PROMPT = "prompt"
    CONDITION = "condition"
    ACTION = "action"
    PARALLEL = "parallel"
    JOIN = "join"


@dataclass
class Node:
    """A node in the flow graph."""
    id: str
    type: NodeType
    handler: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Edge:
    """An edge connecting two nodes."""
    from_node: str
    to_node: str
    label: str = "default"
    condition: Optional[str] = None


@dataclass
class ExecutionState:
    """Current state of flow execution."""
    executed_nodes: set[str] = field(default_factory=set)
    current_node: Optional[str] = None
    outputs: dict[str, dict[str, Any]] = field(default_factory=dict)
    bindings: dict[str, Any] = field(default_factory=dict)
    timestamp: int = 0


class DatalogEngine:
    """
    Datalog-based flow graph execution engine.

    Uses Soufflé for graph analysis and routing decisions.
    """

    def __init__(self, program_path: Optional[str] = None):
        self.program_path = program_path or self._default_program_path()
        self.nodes: dict[str, Node] = {}
        self.edges: list[Edge] = []
        self.state = ExecutionState()
        self._souffle_available = self._check_souffle()

    def _default_program_path(self) -> str:
        """Get the default Datalog program path."""
        return str(Path(__file__).parent.parent / "flow.dl")

    def _check_souffle(self) -> bool:
        """Check if Soufflé is available."""
        try:
            result = subprocess.run(
                ["souffle", "--version"],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except FileNotFoundError:
            return False

    def add_node(self, node_id: str, node_type: NodeType | str, handler: str,
                 metadata: Optional[dict[str, Any]] = None) -> None:
        """Add a node to the flow graph."""
        if isinstance(node_type, str):
            node_type = NodeType(node_type)
        self.nodes[node_id] = Node(
            id=node_id,
            type=node_type,
            handler=handler,
            metadata=metadata or {}
        )

    def add_edge(self, from_node: str, to_node: str,
                 label: str = "default", condition: Optional[str] = None) -> None:
        """Add an edge to the flow graph."""
        self.edges.append(Edge(
            from_node=from_node,
            to_node=to_node,
            label=label,
            condition=condition
        ))

    def _generate_facts(self, temp_dir: str) -> None:
        """Generate Soufflé fact files from the current graph."""
        # Node facts
        with open(os.path.join(temp_dir, "node.facts"), "w") as f:
            for node in self.nodes.values():
                f.write(f"{node.id}\t{node.type.value}\t{node.handler}\n")

        # Edge facts
        with open(os.path.join(temp_dir, "edge.facts"), "w") as f:
            for edge in self.edges:
                f.write(f"{edge.from_node}\t{edge.to_node}\t{edge.label}\n")

        # Executed nodes
        with open(os.path.join(temp_dir, "executed.facts"), "w") as f:
            for node_id in self.state.executed_nodes:
                f.write(f"{node_id}\t{self.state.timestamp}\n")

        # Condition results
        with open(os.path.join(temp_dir, "condition_result.facts"), "w") as f:
            for node_id, outputs in self.state.outputs.items():
                if "condition_label" in outputs:
                    label = outputs["condition_label"]
                    f.write(f"{node_id}\t{label}\t{self.state.timestamp}\n")

        # Node outputs
        with open(os.path.join(temp_dir, "node_output.facts"), "w") as f:
            for node_id, outputs in self.state.outputs.items():
                for key, value in outputs.items():
                    if key != "condition_label":
                        f.write(f"{node_id}\t{key}\t{value}\n")

        # Bindings
        with open(os.path.join(temp_dir, "binding.facts"), "w") as f:
            for name, value in self.state.bindings.items():
                f.write(f"global\t{name}\t{value}\n")

    def _run_souffle(self, temp_dir: str, output_dir: str) -> bool:
        """Run Soufflé on the current facts."""
        result = subprocess.run(
            ["souffle", self.program_path, "-F", temp_dir, "-D", output_dir],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"Soufflé error: {result.stderr}")
            return False
        return True

    def _read_output(self, output_dir: str, relation: str) -> list[tuple[str, ...]]:
        """Read a Soufflé output relation."""
        output_file = os.path.join(output_dir, f"{relation}.csv")
        if not os.path.exists(output_file):
            return []

        results = []
        with open(output_file, "r") as f:
            for line in f:
                parts = line.strip().split("\t")
                results.append(tuple(parts))
        return results

    def query(self, relation: str) -> list[tuple[str, ...]]:
        """
        Query a Datalog relation.

        Args:
            relation: Name of the relation to query

        Returns:
            List of tuples representing the relation's contents
        """
        if not self._souffle_available:
            return self._fallback_query(relation)

        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = os.path.join(temp_dir, "output")
            os.makedirs(output_dir)

            self._generate_facts(temp_dir)

            if not self._run_souffle(temp_dir, output_dir):
                return []

            return self._read_output(output_dir, relation)

    def _fallback_query(self, relation: str) -> list[tuple[str, ...]]:
        """Fallback query implementation when Soufflé is not available."""
        if relation == "start_node":
            return [(n.id,) for n in self.nodes.values()
                    if n.type == NodeType.START or
                    not any(e.to_node == n.id for e in self.edges)]

        elif relation == "end_node":
            return [(n.id,) for n in self.nodes.values()
                    if n.type == NodeType.END or
                    not any(e.from_node == n.id for e in self.edges)]

        elif relation == "can_execute":
            executable = []
            for node in self.nodes.values():
                if node.id in self.state.executed_nodes:
                    continue
                predecessors = [e.from_node for e in self.edges if e.to_node == node.id]
                if not predecessors or all(p in self.state.executed_nodes for p in predecessors):
                    executable.append((node.id,))
            return executable

        elif relation == "next_node":
            if not self.state.current_node:
                return []
            current = self.state.current_node
            outputs = self.state.outputs.get(current, {})
            condition_label = outputs.get("condition_label")

            for edge in self.edges:
                if edge.from_node == current:
                    if condition_label and edge.label == condition_label:
                        return [(current, edge.to_node)]
                    elif edge.label == "default" and not condition_label:
                        return [(current, edge.to_node)]
            return []

        elif relation == "graph_valid":
            # Simple validation
            if self._has_cycles():
                return []
            if any(n.type.value == "" for n in self.nodes.values()):
                return []
            return [()]

        elif relation == "is_dag":
            return [] if self._has_cycles() else [()]

        elif relation == "flow_terminates":
            if self._has_cycles():
                return []
            return [()]

        return []

    def _has_cycles(self) -> bool:
        """Check if the graph has cycles using DFS."""
        visited = set()
        rec_stack = set()

        def dfs(node_id: str) -> bool:
            visited.add(node_id)
            rec_stack.add(node_id)

            for edge in self.edges:
                if edge.from_node == node_id:
                    neighbor = edge.to_node
                    if neighbor not in visited:
                        if dfs(neighbor):
                            return True
                    elif neighbor in rec_stack:
                        return True

            rec_stack.remove(node_id)
            return False

        for node_id in self.nodes:
            if node_id not in visited:
                if dfs(node_id):
                    return True
        return False

    def validate(self) -> tuple[bool, list[str]]:
        """
        Validate the flow graph.

        Returns:
            Tuple of (is_valid, list of error messages)
        """
        errors = []

        # Check for cycles
        if not self.query("is_dag"):
            errors.append("Graph contains cycles")

        # Check for unreachable nodes
        start_nodes = {t[0] for t in self.query("start_node")}
        if not start_nodes:
            errors.append("No start node found")

        end_nodes = {t[0] for t in self.query("end_node")}
        if not end_nodes:
            errors.append("No end node found")

        # Check edge validity
        for edge in self.edges:
            if edge.from_node not in self.nodes:
                errors.append(f"Edge source not found: {edge.from_node}")
            if edge.to_node not in self.nodes:
                errors.append(f"Edge target not found: {edge.to_node}")

        return len(errors) == 0, errors

    def get_execution_order(self) -> list[str]:
        """Get topological execution order of nodes."""
        topo_levels = self.query("topo_level")
        sorted_nodes = sorted(topo_levels, key=lambda x: int(x[1]))
        return [node_id for node_id, _ in sorted_nodes]

    def mark_executed(self, node_id: str, outputs: Optional[dict[str, Any]] = None) -> None:
        """Mark a node as executed with optional outputs."""
        self.state.executed_nodes.add(node_id)
        self.state.current_node = node_id
        self.state.timestamp += 1

        if outputs:
            self.state.outputs[node_id] = outputs

    def get_next_nodes(self) -> list[str]:
        """Get the next nodes that can be executed."""
        return [t[0] for t in self.query("can_execute")]

    def get_next_from_current(self) -> Optional[str]:
        """Get the next node based on current node and conditions."""
        results = self.query("next_node")
        if results:
            return results[0][1]
        return None

    def reset(self) -> None:
        """Reset execution state."""
        self.state = ExecutionState()

    def to_json(self) -> str:
        """Export graph as JSON."""
        return json.dumps({
            "nodes": [
                {
                    "id": n.id,
                    "type": n.type.value,
                    "handler": n.handler,
                    "metadata": n.metadata
                }
                for n in self.nodes.values()
            ],
            "edges": [
                {
                    "from": e.from_node,
                    "to": e.to_node,
                    "label": e.label,
                    "condition": e.condition
                }
                for e in self.edges
            ]
        }, indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> "DatalogEngine":
        """Create engine from JSON definition."""
        data = json.loads(json_str)
        engine = cls()

        for node in data.get("nodes", []):
            engine.add_node(
                node["id"],
                node["type"],
                node["handler"],
                node.get("metadata")
            )

        for edge in data.get("edges", []):
            engine.add_edge(
                edge["from"],
                edge["to"],
                edge.get("label", "default"),
                edge.get("condition")
            )

        return engine


# Example usage
if __name__ == "__main__":
    engine = DatalogEngine()

    # Build a simple flow
    engine.add_node("start", NodeType.START, "start_handler")
    engine.add_node("prompt", NodeType.PROMPT, "llm_prompt")
    engine.add_node("check", NodeType.CONDITION, "check_response")
    engine.add_node("success", NodeType.ACTION, "handle_success")
    engine.add_node("retry", NodeType.ACTION, "handle_retry")
    engine.add_node("end", NodeType.END, "end_handler")

    engine.add_edge("start", "prompt")
    engine.add_edge("prompt", "check")
    engine.add_edge("check", "success", "success")
    engine.add_edge("check", "retry", "retry")
    engine.add_edge("success", "end")
    engine.add_edge("retry", "prompt")  # Loop back

    # Validate
    is_valid, errors = engine.validate()
    print(f"Graph valid: {is_valid}")
    if errors:
        print(f"Errors: {errors}")

    # Get execution order
    print(f"Start nodes: {engine.query('start_node')}")
    print(f"End nodes: {engine.query('end_node')}")
    print(f"Can execute: {engine.get_next_nodes()}")

    # Simulate execution
    engine.mark_executed("start")
    print(f"After start, can execute: {engine.get_next_nodes()}")

    engine.mark_executed("prompt", {"response": "hello"})
    print(f"After prompt, can execute: {engine.get_next_nodes()}")

    engine.mark_executed("check", {"condition_label": "success"})
    print(f"After check (success), next: {engine.get_next_from_current()}")