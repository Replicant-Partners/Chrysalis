"""
Task Schema Definitions

Pure data structures for the five required task.json components:
1. Goal - Natural language description + target conditions
2. ResourceLLM - Model endpoint configuration
3. ResourceRegistry - Entity name → documentation URL mappings
4. Prompts - Indexed collection of prompt templates
5. FlowDiagram - Mermaid diagram defining execution topology
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence
from enum import Enum, auto
import json


class ConditionType(Enum):
    """Types of conditions for flow branching."""
    CATEGORY_MATCH = auto()    # Response matches a category
    CONTAINS = auto()          # Response contains pattern
    ITERATION_LIMIT = auto()   # Loop iteration count
    GOAL_MET = auto()          # Goal verification passed
    CUSTOM = auto()            # Custom evaluation function


@dataclass(frozen=True)
class TargetCondition:
    """
    A single condition that must be met for goal completion.

    Conditions are evaluated against the final execution state
    to determine if the task goal has been achieved.
    """
    description: str
    evaluation_type: ConditionType = ConditionType.CATEGORY_MATCH
    expected_value: str | None = None

    def __post_init__(self) -> None:
        if not self.description:
            raise ValueError("TargetCondition requires a description")


@dataclass(frozen=True)
class Goal:
    """
    Component 1: Goal

    Natural language task description with target outcome conditions
    for completion verification.
    """
    description: str
    target_conditions: tuple[TargetCondition, ...]

    def __post_init__(self) -> None:
        if not self.description:
            raise ValueError("Goal requires a description")
        if not self.target_conditions:
            raise ValueError("Goal requires at least one target condition")

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> Goal:
        """Parse Goal from dictionary."""
        conditions = tuple(
            TargetCondition(
                description=c.get('description', ''),
                evaluation_type=ConditionType[c.get('evaluation_type', 'CATEGORY_MATCH')],
                expected_value=c.get('expected_value')
            )
            for c in data.get('target_conditions', [])
        )
        return cls(
            description=data.get('description', ''),
            target_conditions=conditions
        )


@dataclass(frozen=True)
class ResourceLLM:
    """
    Component 2: Resource LLM

    Language model endpoint configuration for task execution.
    """
    provider: str              # e.g., "openai", "anthropic", "local"
    model: str                 # e.g., "gpt-4o", "claude-3-opus"
    endpoint: str | None = None  # Custom endpoint URL if not default
    api_key_env: str | None = None  # Environment variable for API key
    temperature: float = 0.7
    max_tokens: int = 4096
    timeout_seconds: int = 120

    def __post_init__(self) -> None:
        if not self.provider:
            raise ValueError("ResourceLLM requires a provider")
        if not self.model:
            raise ValueError("ResourceLLM requires a model")
        if not 0.0 <= self.temperature <= 2.0:
            raise ValueError("Temperature must be between 0.0 and 2.0")

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> ResourceLLM:
        """Parse ResourceLLM from dictionary."""
        return cls(
            provider=data.get('provider', ''),
            model=data.get('model', ''),
            endpoint=data.get('endpoint'),
            api_key_env=data.get('api_key_env'),
            temperature=float(data.get('temperature', 0.7)),
            max_tokens=int(data.get('max_tokens', 4096)),
            timeout_seconds=int(data.get('timeout_seconds', 120))
        )


@dataclass(frozen=True)
class RegistryEntry:
    """
    A single registry entry mapping an entity to its documentation.
    """
    name: str                  # Entity name for reference
    category: str              # Category identifier (e.g., "schema", "api", "concept")
    schema_ref: str | None     # JSON Schema reference if applicable
    source_url: str            # Documentation URL

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("RegistryEntry requires a name")
        if not self.source_url:
            raise ValueError("RegistryEntry requires a source_url")

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> RegistryEntry:
        """Parse RegistryEntry from dictionary."""
        return cls(
            name=data.get('name', ''),
            category=data.get('category', 'default'),
            schema_ref=data.get('schema_ref'),
            source_url=data.get('source_url', '')
        )


@dataclass(frozen=True)
class ResourceRegistry:
    """
    Component 3: Resource Registry

    Indexed lookup structure mapping entity names, category identifiers,
    and schema references to their corresponding source documentation URLs.
    """
    entries: tuple[RegistryEntry, ...]

    def __post_init__(self) -> None:
        # Validate no duplicate names
        names = [e.name for e in self.entries]
        if len(names) != len(set(names)):
            raise ValueError("Registry entries must have unique names")

    def lookup(self, name: str) -> RegistryEntry | None:
        """Lookup entry by name."""
        for entry in self.entries:
            if entry.name == name:
                return entry
        return None

    def by_category(self, category: str) -> tuple[RegistryEntry, ...]:
        """Get all entries in a category."""
        return tuple(e for e in self.entries if e.category == category)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> ResourceRegistry:
        """Parse ResourceRegistry from dictionary."""
        entries = tuple(
            RegistryEntry.from_dict(e)
            for e in data.get('entries', [])
        )
        return cls(entries=entries)


@dataclass(frozen=True)
class Prompt:
    """
    A single prompt template representing a discrete logical processing step.

    Templates support interpolation syntax:
    - {{variable}} - Context variable substitution
    - {{registry:name}} - Registry entry resolution
    - {{response:node_id}} - Previous response reference
    """
    index: int                 # Position in the ordered collection
    template: str              # Prompt template with interpolation markers
    role: str = "user"         # Message role: "user", "assistant", "system"
    description: str = ""      # Human-readable step description

    def __post_init__(self) -> None:
        if self.index < 0:
            raise ValueError("Prompt index must be non-negative")
        if not self.template:
            raise ValueError("Prompt requires a template")

    @classmethod
    def from_dict(cls, data: Mapping[str, Any], index: int) -> Prompt:
        """Parse Prompt from dictionary."""
        return cls(
            index=index,
            template=data.get('template', ''),
            role=data.get('role', 'user'),
            description=data.get('description', '')
        )


@dataclass(frozen=True)
class FlowDiagram:
    """
    Component 5: Flow Diagram

    Mermaid-formatted diagram defining the execution topology including:
    - Prompt sequencing (which prompts run in which order)
    - Registry element integration (when to resolve references)
    - Iteration loops (repeat until condition)
    - Conditional branching based on response categorization

    The diagram uses standard Mermaid flowchart syntax with extensions
    for prompt references (P0, P1, ...) and category conditions.
    """
    mermaid: str               # Raw Mermaid diagram text

    def __post_init__(self) -> None:
        if not self.mermaid:
            raise ValueError("FlowDiagram requires mermaid content")
        if not self._is_valid_mermaid():
            raise ValueError("Invalid Mermaid diagram syntax")

    def _is_valid_mermaid(self) -> bool:
        """Basic validation of Mermaid syntax."""
        content = self.mermaid.strip()
        # Must start with graph or flowchart declaration
        valid_starts = ('graph ', 'flowchart ', 'graph\n', 'flowchart\n')
        return any(content.lower().startswith(s) for s in valid_starts)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> FlowDiagram:
        """Parse FlowDiagram from dictionary."""
        mermaid = data.get('mermaid', '') if isinstance(data, dict) else str(data)
        return cls(mermaid=mermaid)


@dataclass(frozen=True)
class TaskSchema:
    """
    Complete task.json schema with all five required components.

    This is the root data structure that the Universal Adapter receives,
    parses, and executes.
    """
    goal: Goal
    resource_llm: ResourceLLM
    resource_registry: ResourceRegistry
    prompts: tuple[Prompt, ...]
    flow_diagram: FlowDiagram

    # Metadata
    name: str = ""
    version: str = "1.0.0"
    task_id: str = ""
    task_type: str = ""
    priority: str = "normal"
    created_at: str | None = None
    prompt_pipeline: Mapping[str, Any] = field(default_factory=dict)
    input_context: Mapping[str, Any] = field(default_factory=dict)
    output_spec: Mapping[str, Any] = field(default_factory=dict)
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.prompts:
            raise ValueError("TaskSchema requires at least one prompt")
        # Validate prompt indices are contiguous starting from 0
        indices = sorted(p.index for p in self.prompts)
        expected = list(range(len(self.prompts)))
        if indices != expected:
            raise ValueError(f"Prompt indices must be contiguous from 0: got {indices}")

    def get_prompt(self, index: int) -> Prompt | None:
        """Get prompt by index."""
        for p in self.prompts:
            if p.index == index:
                return p
        return None

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> TaskSchema:
        """Parse complete TaskSchema from dictionary."""
        prompts = tuple(
            Prompt.from_dict(p, i)
            for i, p in enumerate(data.get('prompts', []))
        )

        return cls(
            goal=Goal.from_dict(data.get('goal', {})),
            resource_llm=ResourceLLM.from_dict(data.get('resource_llm', {})),
            resource_registry=ResourceRegistry.from_dict(data.get('resource_registry', {})),
            prompts=prompts,
            flow_diagram=FlowDiagram.from_dict(data.get('flow_diagram', {})),
            name=data.get('name', ''),
            version=data.get('version', '1.0.0'),
            task_id=data.get('taskId', '') or data.get('task_id', ''),
            task_type=data.get('taskType', '') or data.get('task_type', ''),
            priority=data.get('priority', 'normal'),
            created_at=data.get('createdAt') or data.get('created_at'),
            prompt_pipeline=data.get('promptPipeline', {}) or data.get('prompt_pipeline', {}),
            input_context=data.get('input', {}) or data.get('input_context', {}),
            output_spec=data.get('output', {}) or data.get('output_spec', {}),
            metadata=data.get('metadata', {}),
        )

    @classmethod
    def from_json(cls, json_str: str) -> TaskSchema:
        """Parse TaskSchema from JSON string."""
        data = json.loads(json_str)
        return cls.from_dict(data)

    @classmethod
    def from_file(cls, path: str) -> TaskSchema:
        """Parse TaskSchema from JSON file."""
        with open(path, 'r', encoding='utf-8') as f:
            return cls.from_json(f.read())


def validate_task_schema(schema: TaskSchema) -> tuple[bool, list[str]]:
    """
    Validate a TaskSchema for structural and semantic correctness.

    Returns (is_valid, errors) tuple.
    """
    errors: list[str] = []

    # Validate goal
    if not schema.goal.description:
        errors.append("Goal description is empty")
    if not schema.goal.target_conditions:
        errors.append("Goal has no target conditions")

    # Validate resource_llm
    if not schema.resource_llm.provider:
        errors.append("ResourceLLM provider is required")
    if not schema.resource_llm.model:
        errors.append("ResourceLLM model is required")

    # Validate prompts are referenced in flow diagram
    mermaid = schema.flow_diagram.mermaid.lower()
    for prompt in schema.prompts:
        prompt_ref = f"p{prompt.index}"
        if prompt_ref not in mermaid:
            errors.append(f"Prompt {prompt.index} not referenced in flow diagram")

    # Validate registry entries have unique names
    names = [e.name for e in schema.resource_registry.entries]
    if len(names) != len(set(names)):
        errors.append("Registry entries have duplicate names")

    return (len(errors) == 0, errors)
