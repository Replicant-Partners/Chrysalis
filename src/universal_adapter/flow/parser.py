"""
Mermaid Diagram Parser

Parses Mermaid flowchart syntax into FlowGraph structures.

Supported syntax:
- graph TD / flowchart TD - top-down direction
- A --> B - simple edge (unconditional)
- A -->|condition| B - conditional edge
- A[label] - rectangular node (prompt, registry)
- A{label} - diamond node (condition)
- A((label)) - circular node (start/end)
- A([label]) - stadium node (loop)

Node type inference:
- P0, P1, P2... - Prompt nodes (index extracted)
- START - Start node
- END - End node
- Names containing ? or COND - Condition nodes
- Names containing LOOP or ITER - Loop nodes
- Names containing REG or REGISTRY - Registry nodes
"""

from __future__ import annotations
import re
from dataclasses import dataclass
from typing import Sequence

from .graph import FlowGraph, FlowGraphBuilder, FlowNode, FlowEdge, NodeType


@dataclass
class ParsedNode:
    """Intermediate representation of a parsed node."""
    id: str
    label: str
    shape: str  # 'rect', 'diamond', 'circle', 'stadium'


@dataclass
class ParsedEdge:
    """Intermediate representation of a parsed edge."""
    source: str
    target: str
    condition: str | None


class MermaidParser:
    """
    Parser for Mermaid flowchart diagrams.

    Converts Mermaid text into FlowGraph structures for execution.
    """

    # Regex patterns for Mermaid syntax
    GRAPH_DECL = re.compile(r'^(?:graph|flowchart)\s+(\w+)', re.IGNORECASE)

    # Node patterns: ID[label], ID{label}, ID((label)), ID([label]), ID[[label]]
    NODE_PATTERNS = {
        'rect': re.compile(r'(\w+)\[([^\]]*)\]'),
        'diamond': re.compile(r'(\w+)\{([^\}]*)\}'),
        'circle': re.compile(r'(\w+)\(\(([^\)]*)\)\)'),
        'stadium': re.compile(r'(\w+)\(\[([^\]]*)\]\)'),
        'subroutine': re.compile(r'(\w+)\[\[([^\]]*)\]\]'),
    }

    # Edge patterns: A --> B, A -->|label| B, A --- B, A ---|label| B
    EDGE_PATTERN = re.compile(
        r'(\w+)\s*'                     # Source node
        r'(-->|---|-\.->|==>)'          # Arrow type
        r'(?:\|([^|]*)\|)?'             # Optional condition in |...|
        r'\s*(\w+)'                     # Target node
    )

    # Prompt node pattern: P0, P1, PROMPT0, etc.
    PROMPT_PATTERN = re.compile(r'^P(?:ROMPT)?(\d+)$', re.IGNORECASE)

    def __init__(self) -> None:
        self._nodes: dict[str, ParsedNode] = {}
        self._edges: list[ParsedEdge] = []

    def parse(self, mermaid_text: str) -> FlowGraph:
        """
        Parse Mermaid diagram text into a FlowGraph.

        Args:
            mermaid_text: Raw Mermaid flowchart syntax

        Returns:
            FlowGraph ready for execution

        Raises:
            ValueError: If parsing fails
        """
        self._nodes.clear()
        self._edges.clear()

        lines = self._preprocess(mermaid_text)
        self._parse_lines(lines)
        return self._build_graph()

    def _preprocess(self, text: str) -> list[str]:
        """Clean and split input into lines."""
        lines = []
        for line in text.strip().split('\n'):
            # Remove comments
            if '%%' in line:
                line = line[:line.index('%%')]
            line = line.strip()
            if line:
                lines.append(line)
        return lines

    def _parse_lines(self, lines: list[str]) -> None:
        """Parse all lines, extracting nodes and edges."""
        for line in lines:
            # Skip graph declaration
            if self.GRAPH_DECL.match(line):
                continue

            # Try to extract edges (which may contain inline node definitions)
            self._parse_line(line)

    def _parse_line(self, line: str) -> None:
        """Parse a single line which may contain edges and node definitions."""
        # Handle chained edges: A --> B --> C
        # Split on --> while preserving conditions

        # First, extract any edges
        matches = list(self.EDGE_PATTERN.finditer(line))

        if matches:
            for match in matches:
                source = match.group(1)
                condition = match.group(3)  # May be None
                target = match.group(4)

                # Ensure nodes exist
                self._ensure_node(source)
                self._ensure_node(target)

                # Add edge
                self._edges.append(ParsedEdge(
                    source=source,
                    target=target,
                    condition=condition.strip() if condition else None
                ))
        else:
            # Try to parse standalone node definitions
            self._parse_node_definitions(line)

    def _parse_node_definitions(self, line: str) -> None:
        """Extract node definitions from a line."""
        for shape, pattern in self.NODE_PATTERNS.items():
            for match in pattern.finditer(line):
                node_id = match.group(1)
                label = match.group(2).strip()
                self._nodes[node_id] = ParsedNode(
                    id=node_id,
                    label=label,
                    shape=shape
                )

    def _ensure_node(self, node_id: str) -> None:
        """Ensure a node exists, creating a default if necessary."""
        if node_id not in self._nodes:
            # Infer shape from ID
            shape = self._infer_shape(node_id)
            self._nodes[node_id] = ParsedNode(
                id=node_id,
                label=node_id,
                shape=shape
            )

    def _infer_shape(self, node_id: str) -> str:
        """Infer node shape from its ID."""
        upper = node_id.upper()
        if upper in ('START', 'BEGIN'):
            return 'circle'
        if upper in ('END', 'FINISH', 'DONE'):
            return 'circle'
        if '?' in upper or 'COND' in upper:
            return 'diamond'
        if 'LOOP' in upper or 'ITER' in upper:
            return 'stadium'
        return 'rect'

    def _build_graph(self) -> FlowGraph:
        """Convert parsed data into FlowGraph."""
        builder = FlowGraphBuilder()

        # Convert parsed nodes to FlowNodes
        for parsed in self._nodes.values():
            node_type = self._infer_node_type(parsed)
            prompt_index = self._extract_prompt_index(parsed.id)
            registry_key = self._extract_registry_key(parsed)
            loop_limit = self._extract_loop_limit(parsed)

            node = FlowNode(
                id=parsed.id,
                node_type=node_type,
                label=parsed.label,
                prompt_index=prompt_index,
                registry_key=registry_key,
                loop_limit=loop_limit
            )
            builder.add_node(node)

        # Convert parsed edges to FlowEdges
        for i, parsed in enumerate(self._edges):
            edge = FlowEdge(
                source=parsed.source,
                target=parsed.target,
                condition=parsed.condition,
                priority=i  # Preserve order for evaluation
            )
            builder.add_edge(edge)

        # Determine start and end nodes
        start_node = self._find_start_node()
        end_nodes = self._find_end_nodes()

        if start_node:
            builder.set_start(start_node)
        else:
            # Use first node with no predecessors
            predecessors = {e.target for e in self._edges}
            for node_id in self._nodes:
                if node_id not in predecessors:
                    builder.set_start(node_id)
                    break

        for end_id in end_nodes:
            builder.add_end(end_id)

        return builder.build()

    def _infer_node_type(self, parsed: ParsedNode) -> NodeType:
        """Infer the NodeType from parsed node data."""
        upper_id = parsed.id.upper()
        upper_label = parsed.label.upper()

        # Start nodes
        if upper_id in ('START', 'BEGIN') or upper_label in ('START', 'BEGIN'):
            return NodeType.START

        # End nodes
        if upper_id in ('END', 'FINISH', 'DONE') or upper_label in ('END', 'FINISH', 'DONE'):
            return NodeType.END

        # Prompt nodes: P0, P1, PROMPT0, etc.
        if self.PROMPT_PATTERN.match(parsed.id):
            return NodeType.PROMPT

        # Condition nodes: diamond shape or explicit naming
        if parsed.shape == 'diamond' or 'COND' in upper_id or '?' in upper_id:
            return NodeType.CONDITION

        # Loop nodes
        if 'LOOP' in upper_id or 'ITER' in upper_id:
            return NodeType.LOOP

        # Registry nodes
        if 'REG' in upper_id or 'REGISTRY' in upper_id:
            return NodeType.REGISTRY

        # Merge nodes
        if 'MERGE' in upper_id or 'JOIN' in upper_id:
            return NodeType.MERGE

        # Default: treat as prompt if it looks like one
        if parsed.shape == 'rect' and not any(x in upper_id for x in ['COND', 'END', 'START']):
            # Check if label suggests it's a prompt step
            return NodeType.PROMPT

        return NodeType.PROMPT  # Default fallback

    def _extract_prompt_index(self, node_id: str) -> int | None:
        """Extract prompt index from node ID like P0, P1, PROMPT0."""
        match = self.PROMPT_PATTERN.match(node_id)
        if match:
            return int(match.group(1))

        # Also check for nodes that are prompts but named differently
        # They might reference prompt index in metadata or we assign based on order
        return None

    def _extract_registry_key(self, parsed: ParsedNode) -> str | None:
        """Extract registry key from registry node."""
        upper = parsed.id.upper()
        if 'REG' in upper or 'REGISTRY' in upper:
            # Use label as the registry key
            return parsed.label if parsed.label != parsed.id else None
        return None

    def _extract_loop_limit(self, parsed: ParsedNode) -> int:
        """Extract loop iteration limit from node label."""
        # Look for patterns like "loop:10" or "max:5" in label
        label = parsed.label.lower()
        limit_patterns = [
            re.compile(r'(?:loop|max|limit)[:\s]*(\d+)'),
            re.compile(r'(\d+)\s*(?:times|iterations)'),
        ]
        for pattern in limit_patterns:
            match = pattern.search(label)
            if match:
                return int(match.group(1))
        return 10  # Default

    def _find_start_node(self) -> str | None:
        """Find the start node."""
        for node_id, parsed in self._nodes.items():
            upper = node_id.upper()
            if upper in ('START', 'BEGIN'):
                return node_id
            if parsed.label.upper() in ('START', 'BEGIN'):
                return node_id
        return None

    def _find_end_nodes(self) -> list[str]:
        """Find all end nodes."""
        end_nodes = []

        # Explicit END nodes
        for node_id, parsed in self._nodes.items():
            upper = node_id.upper()
            if upper in ('END', 'FINISH', 'DONE'):
                end_nodes.append(node_id)
            elif parsed.label.upper() in ('END', 'FINISH', 'DONE'):
                end_nodes.append(node_id)

        # If no explicit ends, find nodes with no successors
        if not end_nodes:
            successors = {e.source for e in self._edges}
            for node_id in self._nodes:
                targets = {e.target for e in self._edges if e.source == node_id}
                if not targets:
                    end_nodes.append(node_id)

        return end_nodes


def parse_mermaid(mermaid_text: str) -> FlowGraph:
    """
    Convenience function to parse Mermaid text into FlowGraph.

    Args:
        mermaid_text: Raw Mermaid flowchart syntax

    Returns:
        FlowGraph ready for execution
    """
    parser = MermaidParser()
    return parser.parse(mermaid_text)
