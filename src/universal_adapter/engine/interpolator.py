"""
Template Interpolator

Processes prompt templates by replacing placeholders with values from:
- Context variables
- Registry-resolved references
- Previous response values
- Computed expressions

Syntax:
- {{variable}} - Simple variable substitution
- {{registry:name}} - Registry entry lookup (returns source_url)
- {{registry:name.field}} - Registry entry field access
- {{response:node_id}} - Previous response from named node
- {{response:node_id.path}} - JSON path into previous response
- {{loop.index}} - Current loop iteration index
- {{loop.count}} - Total loop count so far
"""

from __future__ import annotations
import re
import json
from dataclasses import dataclass, field
from typing import Any, Mapping, Callable

from ..schema import ResourceRegistry, RegistryEntry


@dataclass(frozen=True)
class InterpolationContext:
    """
    Context for template interpolation.

    Immutable container holding all values available for substitution.
    """
    variables: Mapping[str, Any]
    responses: Mapping[str, Any]
    registry: ResourceRegistry
    loop_index: int = 0
    loop_count: int = 0

    def with_variable(self, name: str, value: Any) -> InterpolationContext:
        """Create new context with an additional variable."""
        new_vars = dict(self.variables)
        new_vars[name] = value
        return InterpolationContext(
            variables=new_vars,
            responses=self.responses,
            registry=self.registry,
            loop_index=self.loop_index,
            loop_count=self.loop_count
        )

    def with_response(self, node_id: str, response: Any) -> InterpolationContext:
        """Create new context with an additional response."""
        new_responses = dict(self.responses)
        new_responses[node_id] = response
        return InterpolationContext(
            variables=self.variables,
            responses=new_responses,
            registry=self.registry,
            loop_index=self.loop_index,
            loop_count=self.loop_count
        )

    def with_loop_state(self, index: int, count: int) -> InterpolationContext:
        """Create new context with updated loop state."""
        return InterpolationContext(
            variables=self.variables,
            responses=self.responses,
            registry=self.registry,
            loop_index=index,
            loop_count=count
        )


class InterpolationError(Exception):
    """Error during template interpolation."""
    pass


class TemplateInterpolator:
    """
    Interpolates template strings by replacing placeholders with values.

    Thread-safe and stateless - all state is passed via InterpolationContext.
    """

    # Pattern for {{expression}}
    PLACEHOLDER = re.compile(r'\{\{([^}]+)\}\}')

    # Sub-patterns for different placeholder types
    REGISTRY_PATTERN = re.compile(r'^registry:(\w+)(?:\.(\w+))?$')
    RESPONSE_PATTERN = re.compile(r'^response:(\w+)(?:\.(.+))?$')
    LOOP_PATTERN = re.compile(r'^loop\.(\w+)$')

    def __init__(self, strict: bool = True) -> None:
        """
        Initialize interpolator.

        Args:
            strict: If True, raise errors for missing values.
                   If False, leave placeholders unchanged.
        """
        self.strict = strict

    def interpolate(self, template: str, context: InterpolationContext) -> str:
        """
        Interpolate a template string with context values.

        Args:
            template: Template string with {{placeholder}} syntax
            context: Values available for substitution

        Returns:
            Interpolated string

        Raises:
            InterpolationError: If strict and a placeholder cannot be resolved
        """
        def replace(match: re.Match) -> str:
            expr = match.group(1).strip()
            try:
                value = self._resolve(expr, context)
                return self._stringify(value)
            except Exception as e:
                if self.strict:
                    raise InterpolationError(f"Cannot resolve '{expr}': {e}")
                return match.group(0)  # Leave unchanged

        return self.PLACEHOLDER.sub(replace, template)

    def _resolve(self, expr: str, context: InterpolationContext) -> Any:
        """Resolve a single expression to its value."""
        # Check for registry reference
        registry_match = self.REGISTRY_PATTERN.match(expr)
        if registry_match:
            return self._resolve_registry(registry_match, context)

        # Check for response reference
        response_match = self.RESPONSE_PATTERN.match(expr)
        if response_match:
            return self._resolve_response(response_match, context)

        # Check for loop reference
        loop_match = self.LOOP_PATTERN.match(expr)
        if loop_match:
            return self._resolve_loop(loop_match, context)

        # Check for simple variable
        if expr in context.variables:
            return context.variables[expr]

        # Check for dotted path in variables
        if '.' in expr:
            return self._resolve_path(expr, context.variables)

        raise ValueError(f"Unknown expression: {expr}")

    def _resolve_registry(
        self,
        match: re.Match,
        context: InterpolationContext
    ) -> Any:
        """Resolve a registry reference."""
        name = match.group(1)
        field_name = match.group(2)  # May be None

        entry = context.registry.lookup(name)
        if entry is None:
            raise ValueError(f"Registry entry not found: {name}")

        if field_name is None:
            # Default to source_url
            return entry.source_url
        elif field_name == 'name':
            return entry.name
        elif field_name == 'category':
            return entry.category
        elif field_name == 'schema_ref':
            return entry.schema_ref or ''
        elif field_name == 'source_url':
            return entry.source_url
        else:
            raise ValueError(f"Unknown registry field: {field_name}")

    def _resolve_response(
        self,
        match: re.Match,
        context: InterpolationContext
    ) -> Any:
        """Resolve a response reference."""
        node_id = match.group(1)
        path = match.group(2)  # May be None

        if node_id not in context.responses:
            raise ValueError(f"Response not found for node: {node_id}")

        response = context.responses[node_id]

        if path is None:
            return response

        # Navigate JSON path
        return self._navigate_path(response, path)

    def _resolve_loop(
        self,
        match: re.Match,
        context: InterpolationContext
    ) -> Any:
        """Resolve a loop reference."""
        field = match.group(1)

        if field == 'index':
            return context.loop_index
        elif field == 'count':
            return context.loop_count
        else:
            raise ValueError(f"Unknown loop field: {field}")

    def _resolve_path(
        self,
        path: str,
        data: Mapping[str, Any]
    ) -> Any:
        """Resolve a dotted path in a mapping."""
        parts = path.split('.')
        current = data

        for part in parts:
            if isinstance(current, Mapping):
                if part not in current:
                    raise ValueError(f"Path segment not found: {part}")
                current = current[part]
            elif isinstance(current, (list, tuple)):
                try:
                    index = int(part)
                    current = current[index]
                except (ValueError, IndexError):
                    raise ValueError(f"Invalid array index: {part}")
            else:
                raise ValueError(f"Cannot navigate into: {type(current)}")

        return current

    def _navigate_path(self, obj: Any, path: str) -> Any:
        """Navigate a path into an object (for JSON-like structures)."""
        parts = path.split('.')
        current = obj

        for part in parts:
            # Handle array notation: field[0]
            array_match = re.match(r'^(\w+)\[(\d+)\]$', part)
            if array_match:
                field = array_match.group(1)
                index = int(array_match.group(2))
                if isinstance(current, Mapping) and field in current:
                    current = current[field]
                    if isinstance(current, (list, tuple)) and 0 <= index < len(current):
                        current = current[index]
                    else:
                        raise ValueError(f"Invalid array access: {part}")
                else:
                    raise ValueError(f"Field not found: {field}")
            elif isinstance(current, Mapping):
                if part not in current:
                    raise ValueError(f"Path segment not found: {part}")
                current = current[part]
            elif isinstance(current, (list, tuple)):
                try:
                    index = int(part)
                    current = current[index]
                except (ValueError, IndexError):
                    raise ValueError(f"Invalid array index: {part}")
            elif hasattr(current, part):
                current = getattr(current, part)
            else:
                raise ValueError(f"Cannot navigate path: {part}")

        return current

    def _stringify(self, value: Any) -> str:
        """Convert a value to string for template substitution."""
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, (int, float, bool)):
            return str(value)
        if isinstance(value, (list, tuple, dict)):
            return json.dumps(value, indent=2)
        return str(value)

    def extract_placeholders(self, template: str) -> list[str]:
        """Extract all placeholder expressions from a template."""
        return [match.group(1).strip() for match in self.PLACEHOLDER.finditer(template)]

    def validate_template(
        self,
        template: str,
        context: InterpolationContext
    ) -> tuple[bool, list[str]]:
        """
        Validate that all placeholders in a template can be resolved.

        Returns (is_valid, errors).
        """
        errors: list[str] = []
        placeholders = self.extract_placeholders(template)

        for expr in placeholders:
            try:
                self._resolve(expr, context)
            except Exception as e:
                errors.append(f"{{{{ {expr} }}}}: {e}")

        return (len(errors) == 0, errors)


def interpolate(template: str, context: InterpolationContext, strict: bool = True) -> str:
    """
    Convenience function for template interpolation.

    Args:
        template: Template string with {{placeholder}} syntax
        context: Values available for substitution
        strict: If True, raise errors for missing values

    Returns:
        Interpolated string
    """
    interpolator = TemplateInterpolator(strict=strict)
    return interpolator.interpolate(template, context)
