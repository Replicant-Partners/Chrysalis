"""
Universal Adapter CLI - Command Line Interface

A comprehensive command-line interface for the Universal Adapter.
Supports both direct terminal invocation and slash command parsing
for TUI/agent integration.

Security:
    The CLI respects SecurityContext for permission control.
    - ADMIN: Full access (direct CLI usage)
    - USER: Standard access with path restrictions
    - AGENT: Read-mostly, restricted providers

Usage:
    # From terminal
    python -m universal_adapter run task.json
    python -m universal_adapter validate task.json
    python -m universal_adapter list
    
    # As slash commands (parsed by SlashCommandParser)
    //run simple_qa --debug
    //validate task.json
    //list
"""

from __future__ import annotations
import argparse
import asyncio
import json
import sys
import os
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence, TextIO

from .core import UniversalAdapter, AdapterConfig, AdapterResult, run_task, execute_task
from .schema import TaskSchema, validate_task_schema
from .flow.parser import MermaidParser
from .flow.graph import FlowGraph, NodeType
from .engine.llm_client import LLMClient
from .task_library import TaskLibrary, DEFAULT_TASK_LIBRARY
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
# Output Formatting
# ============================================================================

class OutputFormat(Enum):
    """Output format options."""
    TEXT = auto()
    JSON = auto()
    MARKDOWN = auto()


@dataclass
class CLIOutput:
    """Structured output from CLI commands."""
    success: bool
    message: str
    data: Any = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "success": self.success,
            "message": self.message,
            "data": self.data,
            "errors": self.errors,
            "warnings": self.warnings,
        }
    
    def format(self, fmt: OutputFormat = OutputFormat.TEXT) -> str:
        """Format output for display."""
        if fmt == OutputFormat.JSON:
            return json.dumps(self.to_dict(), indent=2, default=str)
        
        if fmt == OutputFormat.MARKDOWN:
            return self._format_markdown()
        
        return self._format_text()
    
    def _format_text(self) -> str:
        """Format as plain text."""
        lines = []
        
        status = "✓" if self.success else "✗"
        lines.append(f"{status} {self.message}")
        
        if self.errors:
            lines.append("\nErrors:")
            for err in self.errors:
                lines.append(f"  • {err}")
        
        if self.warnings:
            lines.append("\nWarnings:")
            for warn in self.warnings:
                lines.append(f"  ⚠ {warn}")
        
        if self.data is not None:
            lines.append("\n" + self._format_data(self.data))
        
        return "\n".join(lines)
    
    def _format_markdown(self) -> str:
        """Format as Markdown."""
        lines = []
        
        status = "**Success**" if self.success else "**Failed**"
        lines.append(f"## {status}: {self.message}")
        
        if self.errors:
            lines.append("\n### Errors")
            for err in self.errors:
                lines.append(f"- {err}")
        
        if self.warnings:
            lines.append("\n### Warnings")
            for warn in self.warnings:
                lines.append(f"- ⚠️ {warn}")
        
        if self.data is not None:
            lines.append("\n### Details")
            lines.append("```")
            lines.append(self._format_data(self.data))
            lines.append("```")
        
        return "\n".join(lines)
    
    def _format_data(self, data: Any, indent: int = 0) -> str:
        """Format data for display."""
        prefix = "  " * indent
        
        if isinstance(data, dict):
            lines = []
            for key, value in data.items():
                if isinstance(value, (dict, list)):
                    lines.append(f"{prefix}{key}:")
                    lines.append(self._format_data(value, indent + 1))
                else:
                    lines.append(f"{prefix}{key}: {value}")
            return "\n".join(lines)
        
        if isinstance(data, list):
            lines = []
            for item in data:
                if isinstance(item, (dict, list)):
                    lines.append(self._format_data(item, indent))
                else:
                    lines.append(f"{prefix}• {item}")
            return "\n".join(lines)
        
        return f"{prefix}{data}"


# ============================================================================
# CLI Commands
# ============================================================================

class CLICommands:
    """
    Implementation of all CLI commands.
    
    Each method corresponds to a CLI subcommand and returns a CLIOutput.
    These can be called programmatically by agents or through the CLI.
    
    Security:
        Pass a SecurityContext to control permissions. By default,
        uses USER-level permissions when called from CLI.
    """
    
    def __init__(
        self,
        task_library: TaskLibrary | None = None,
        output_stream: TextIO | None = None,
        security_context: SecurityContext | None = None,
    ):
        self.task_library = task_library or DEFAULT_TASK_LIBRARY
        self.output_stream = output_stream or sys.stdout
        self.security_context = security_context or get_default_context()
    
    # -------------------------------------------------------------------------
    # run - Execute a task
    # -------------------------------------------------------------------------
    
    async def run_async(
        self,
        task: str,
        variables: dict[str, Any] | None = None,
        debug: bool = False,
        max_iterations: int = 1000,
        timeout_seconds: int = 300,
        strict: bool = True,
        provider_override: str | None = None,
        model_override: str | None = None,
    ) -> CLIOutput:
        """
        Execute a task asynchronously.
        
        Args:
            task: Task name, file path, or inline JSON
            variables: Context variables to pass to the task
            debug: Enable debug output
            max_iterations: Maximum state machine iterations
            timeout_seconds: Execution timeout in seconds
            strict: Enable strict validation
            provider_override: Override the LLM provider
            model_override: Override the LLM model
        
        Returns:
            CLIOutput with execution results
        """
        ctx = self.security_context
        
        # Check permission to run tasks
        if not ctx.has_permission(Operation.RUN_TASK):
            return CLIOutput(
                success=False,
                message="Permission denied",
                errors=["Operation RUN_TASK not allowed at current permission level"],
            )
        
        try:
            # Validate and cap parameters based on security context
            max_iterations = ctx.validate_iterations(max_iterations)
            timeout_seconds = ctx.validate_timeout(timeout_seconds)
            
            # Validate provider override
            if provider_override:
                if not ctx.has_permission(Operation.OVERRIDE_PROVIDER):
                    provider_override = None  # Ignore override
                else:
                    provider_override = ctx.validate_provider(provider_override)
            
            if model_override and not ctx.has_permission(Operation.OVERRIDE_MODEL):
                model_override = None  # Ignore override
            
            config = AdapterConfig(
                max_iterations=max_iterations,
                timeout_ms=timeout_seconds * 1000,
                strict_validation=strict,
                debug_mode=debug,
            )
            
            adapter = UniversalAdapter(config, self.task_library)
            
            # Load task
            task_schema = self._load_task(task)
            
            # Check if using real provider requires permission
            effective_provider = provider_override or task_schema.resource_llm.provider
            if not ctx.can_run_with_real_provider():
                return CLIOutput(
                    success=False,
                    message="Permission denied",
                    errors=[f"Real provider '{effective_provider}' not allowed at current permission level"],
                )
            
            # Apply overrides
            if provider_override or model_override:
                task_schema = self._apply_overrides(
                    task_schema, provider_override, model_override
                )
            
            # Apply variables - inject into input_context
            if variables:
                task_schema = self._inject_variables(task_schema, variables)
            
            # Execute
            result = await adapter.execute(task_schema)
            
            return CLIOutput(
                success=result.success,
                message=f"Task '{task_schema.name}' {'completed successfully' if result.success else 'failed'}",
                data={
                    "goal_met": result.goal_met,
                    "status": result.execution_status.name,
                    "iterations": result.iteration_count,
                    "time_ms": round(result.execution_time_ms, 2),
                    "final_response": result.final_response,
                    "verification": result.goal_verification.summary if result.goal_verification else None,
                    "provider_used": task_schema.resource_llm.provider,
                },
                errors=list(result.errors),
            )
            
        except PermissionError as e:
            return CLIOutput(
                success=False,
                message="Permission denied",
                errors=[str(e)],
            )
        except PathSecurityError as e:
            return CLIOutput(
                success=False,
                message="Security violation",
                errors=[str(e)],
            )
        except FileNotFoundError as e:
            return CLIOutput(
                success=False,
                message="Task not found",
                errors=[str(e)],
            )
        except Exception as e:
            return CLIOutput(
                success=False,
                message="Execution failed",
                errors=[str(e)],
            )
    
    def run(
        self,
        task: str,
        **kwargs: Any
    ) -> CLIOutput:
        """Synchronous wrapper for run_async."""
        return asyncio.run(self.run_async(task, **kwargs))
    
    # -------------------------------------------------------------------------
    # validate - Validate a task without executing
    # -------------------------------------------------------------------------
    
    def validate(
        self,
        task: str,
        strict: bool = True,
    ) -> CLIOutput:
        """
        Validate a task specification without executing it.
        
        Args:
            task: Task name, file path, or inline JSON
            strict: Enable strict validation
        
        Returns:
            CLIOutput with validation results
        """
        try:
            task_schema = self._load_task(task)
            
            # Schema validation
            is_valid, schema_errors = validate_task_schema(task_schema)
            
            # Flow graph validation
            parser = MermaidParser()
            flow_graph = parser.parse(task_schema.flow_diagram.mermaid)
            graph_valid, graph_errors = flow_graph.validate()
            
            # Combine results
            all_errors = schema_errors + graph_errors
            all_valid = is_valid and graph_valid
            
            warnings = []
            
            # Check for common issues
            if not task_schema.resource_llm.api_key_env:
                warnings.append("No API key environment variable specified")
            
            if len(task_schema.prompts) > 10:
                warnings.append(f"Large number of prompts ({len(task_schema.prompts)}) may indicate complex flow")
            
            return CLIOutput(
                success=all_valid,
                message=f"Validation {'passed' if all_valid else 'failed'} for '{task_schema.name}'",
                data={
                    "name": task_schema.name,
                    "version": task_schema.version,
                    "prompts": len(task_schema.prompts),
                    "flow_nodes": len(flow_graph),
                    "registry_entries": len(task_schema.resource_registry.entries),
                    "conditions": len(task_schema.goal.target_conditions),
                },
                errors=all_errors,
                warnings=warnings,
            )
            
        except Exception as e:
            return CLIOutput(
                success=False,
                message="Validation failed",
                errors=[str(e)],
            )
    
    # -------------------------------------------------------------------------
    # inspect - Show detailed information about a task
    # -------------------------------------------------------------------------
    
    def inspect(
        self,
        task: str,
        show_flow: bool = True,
        show_prompts: bool = True,
        show_registry: bool = True,
        show_goal: bool = True,
    ) -> CLIOutput:
        """
        Inspect a task and show detailed information.
        
        Args:
            task: Task name, file path, or inline JSON
            show_flow: Include flow diagram details
            show_prompts: Include prompt templates
            show_registry: Include registry entries
            show_goal: Include goal and conditions
        
        Returns:
            CLIOutput with task details
        """
        try:
            task_schema = self._load_task(task)
            
            data: dict[str, Any] = {
                "name": task_schema.name,
                "version": task_schema.version,
                "task_id": task_schema.task_id,
                "task_type": task_schema.task_type,
                "priority": task_schema.priority,
            }
            
            # LLM configuration
            data["llm"] = {
                "provider": task_schema.resource_llm.provider,
                "model": task_schema.resource_llm.model,
                "temperature": task_schema.resource_llm.temperature,
                "max_tokens": task_schema.resource_llm.max_tokens,
            }
            
            if show_goal:
                data["goal"] = {
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
            
            if show_prompts:
                data["prompts"] = [
                    {
                        "index": p.index,
                        "description": p.description,
                        "role": p.role,
                        "template_preview": p.template[:100] + "..." if len(p.template) > 100 else p.template,
                    }
                    for p in task_schema.prompts
                ]
            
            if show_registry:
                data["registry"] = [
                    {
                        "name": e.name,
                        "category": e.category,
                        "url": e.source_url,
                    }
                    for e in task_schema.resource_registry.entries
                ]
            
            if show_flow:
                parser = MermaidParser()
                flow_graph = parser.parse(task_schema.flow_diagram.mermaid)
                data["flow"] = {
                    "mermaid": task_schema.flow_diagram.mermaid,
                    "nodes": [
                        {
                            "id": n.id,
                            "type": n.node_type.name,
                            "label": n.label,
                        }
                        for n in flow_graph.nodes.values()
                    ],
                    "edges": len(flow_graph.edges),
                }
            
            return CLIOutput(
                success=True,
                message=f"Task: {task_schema.name}",
                data=data,
            )
            
        except Exception as e:
            return CLIOutput(
                success=False,
                message="Inspection failed",
                errors=[str(e)],
            )
    
    # -------------------------------------------------------------------------
    # list - List available tasks
    # -------------------------------------------------------------------------
    
    def list_tasks(
        self,
        verbose: bool = False,
    ) -> CLIOutput:
        """
        List all available named tasks.
        
        Args:
            verbose: Include additional details for each task
        
        Returns:
            CLIOutput with task list
        """
        tasks = self.task_library.list_tasks()
        
        if not verbose:
            return CLIOutput(
                success=True,
                message=f"Found {len(tasks)} available tasks",
                data={"tasks": tasks},
            )
        
        # Verbose mode - load and show details
        task_details = []
        for name in tasks:
            try:
                path = self.task_library.get_path(name)
                schema = self.task_library.load(name)
                task_details.append({
                    "name": name,
                    "path": str(path),
                    "version": schema.version,
                    "goal": schema.goal.description[:80] + "..." if len(schema.goal.description) > 80 else schema.goal.description,
                    "prompts": len(schema.prompts),
                })
            except Exception as e:
                task_details.append({
                    "name": name,
                    "error": str(e),
                })
        
        return CLIOutput(
            success=True,
            message=f"Found {len(tasks)} available tasks",
            data={"tasks": task_details},
        )
    
    # -------------------------------------------------------------------------
    # providers - Show available LLM providers
    # -------------------------------------------------------------------------
    
    def providers(
        self,
        check_keys: bool = True,
    ) -> CLIOutput:
        """
        List available LLM providers and their status.
        
        Args:
            check_keys: Check if API keys are configured
        
        Returns:
            CLIOutput with provider information
        """
        providers_info = []
        
        provider_configs = [
            {
                "name": "openai",
                "models": ["gpt-4o", "gpt-4", "gpt-3.5-turbo", "o1-preview", "o1-mini"],
                "env_var": "OPENAI_API_KEY",
                "endpoint": "https://api.openai.com/v1",
            },
            {
                "name": "anthropic",
                "models": ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-sonnet-20240229"],
                "env_var": "ANTHROPIC_API_KEY",
                "endpoint": "https://api.anthropic.com/v1",
            },
        ]
        
        for config in provider_configs:
            info: dict[str, Any] = {
                "name": config["name"],
                "models": config["models"],
                "endpoint": config["endpoint"],
            }
            
            if check_keys and config["env_var"]:
                key_present = os.environ.get(config["env_var"]) is not None
                info["api_key_configured"] = key_present
                info["env_var"] = config["env_var"]
            
            providers_info.append(info)
        
        return CLIOutput(
            success=True,
            message="Available LLM providers",
            data={"providers": providers_info},
        )
    
    # -------------------------------------------------------------------------
    # flow - Parse and visualize flow diagrams
    # -------------------------------------------------------------------------
    
    def flow(
        self,
        source: str,
        output_format: str = "text",
    ) -> CLIOutput:
        """
        Parse and analyze a Mermaid flow diagram.
        
        Args:
            source: Mermaid diagram text, file path, or task name
            output_format: Output format ('text', 'mermaid', 'dot')
        
        Returns:
            CLIOutput with flow analysis
        """
        try:
            # Determine source type
            mermaid_text = self._get_mermaid_source(source)
            
            # Parse the flow
            parser = MermaidParser()
            graph = parser.parse(mermaid_text)
            
            # Validate
            is_valid, errors = graph.validate()
            
            # Analyze
            analysis = {
                "valid": is_valid,
                "nodes": len(graph.nodes),
                "edges": len(graph.edges),
                "start": graph.start_node,
                "ends": list(graph.end_nodes),
                "has_cycles": graph.has_cycles(),
            }
            
            # Node breakdown
            node_types: dict[str, int] = {}
            for node in graph.nodes.values():
                type_name = node.node_type.name
                node_types[type_name] = node_types.get(type_name, 0) + 1
            analysis["node_types"] = node_types
            
            # Prompt nodes
            prompt_nodes = graph.prompt_nodes()
            analysis["prompt_nodes"] = [
                {"id": n.id, "index": n.prompt_index}
                for n in prompt_nodes
            ]
            
            if output_format == "mermaid":
                analysis["diagram"] = mermaid_text
            elif output_format == "dot":
                analysis["diagram"] = self._to_dot(graph)
            
            return CLIOutput(
                success=is_valid,
                message=f"Flow analysis: {len(graph.nodes)} nodes, {len(graph.edges)} edges",
                data=analysis,
                errors=errors,
            )
            
        except Exception as e:
            return CLIOutput(
                success=False,
                message="Flow parsing failed",
                errors=[str(e)],
            )
    
    # -------------------------------------------------------------------------
    # create - Create a new task from template
    # -------------------------------------------------------------------------
    
    def create(
        self,
        name: str,
        template: str = "simple",
        output_path: str | None = None,
        description: str = "",
        provider: str = "anthropic",
        model: str = "claude-3-5-sonnet-20241022",
    ) -> CLIOutput:
        """
        Create a new task from a template.
        
        Args:
            name: Name for the new task
            template: Template to use ('simple', 'loop', 'conditional')
            output_path: Output file path (default: {name}_task.json)
            description: Goal description
            provider: LLM provider to use
            model: Model name to use
        
        Returns:
            CLIOutput with created task info
        
        Security:
            Requires CREATE_TASK and WRITE_FILE permissions.
            Path is validated against security context.
        """
        ctx = self.security_context
        
        # Check permission to create tasks
        if not ctx.has_permission(Operation.CREATE_TASK):
            return CLIOutput(
                success=False,
                message="Permission denied",
                errors=["Operation CREATE_TASK not allowed at current permission level"],
            )
        
        # Check permission to write files
        if not ctx.can_write_files():
            return CLIOutput(
                success=False,
                message="Permission denied",
                errors=["File write operations not allowed at current permission level"],
            )
        
        templates = {
            "simple": self._template_simple,
            "loop": self._template_loop,
            "conditional": self._template_conditional,
        }
        
        if template not in templates:
            return CLIOutput(
                success=False,
                message="Unknown template",
                errors=[f"Available templates: {', '.join(templates.keys())}"],
            )
        
        try:
            # Sanitize the task name for use in filename
            safe_name = ctx.sanitize_filename(name)
            
            task_dict = templates[template](
                name=name,  # Use original name in the task
                description=description or f"Task: {name}",
                provider=provider,
                model=model,
            )
            
            # Determine and validate output path
            output_file = output_path or f"{safe_name}_task.json"
            
            try:
                validated_path = ctx.validate_write_path(output_file)
            except PathSecurityError as e:
                return CLIOutput(
                    success=False,
                    message="Security violation",
                    errors=[f"Invalid output path: {e}"],
                )
            
            # Check for confirmation if required
            if ctx.require_confirmation_for_writes:
                # In CLI context, we proceed; in interactive context, caller should confirm
                pass
            
            with open(validated_path, "w") as f:
                json.dump(task_dict, f, indent=2)
            
            return CLIOutput(
                success=True,
                message=f"Created task '{name}' at {validated_path}",
                data={
                    "name": name,
                    "template": template,
                    "path": str(validated_path),
                },
            )
            
        except PermissionError as e:
            return CLIOutput(
                success=False,
                message="Permission denied",
                errors=[str(e)],
            )
        except Exception as e:
            return CLIOutput(
                success=False,
                message="Task creation failed",
                errors=[str(e)],
            )
    
    # -------------------------------------------------------------------------
    # help - Show help information
    # -------------------------------------------------------------------------
    
    def help(
        self,
        command: str | None = None,
    ) -> CLIOutput:
        """
        Show help information.
        
        Args:
            command: Specific command to get help for
        
        Returns:
            CLIOutput with help text
        """
        commands = {
            "run": {
                "description": "Execute a task",
                "usage": "//run <task> [--debug] [--timeout N] [-v key=value]",
                "examples": [
                    "//run simple_qa",
                    "//run task.json --debug",
                    "//run research_synthesis -v topic='AI Safety'",
                ],
            },
            "validate": {
                "description": "Validate a task without executing",
                "usage": "//validate <task>",
                "examples": [
                    "//validate task.json",
                    "//validate simple_qa",
                ],
            },
            "inspect": {
                "description": "Show detailed task information",
                "usage": "//inspect <task> [--no-flow] [--no-prompts]",
                "examples": [
                    "//inspect simple_qa",
                    "//inspect task.json --no-prompts",
                ],
            },
            "list": {
                "description": "List available named tasks",
                "usage": "//list [--verbose]",
                "examples": [
                    "//list",
                    "//list --verbose",
                ],
            },
            "providers": {
                "description": "Show available LLM providers",
                "usage": "//providers [--no-check]",
                "examples": [
                    "//providers",
                ],
            },
            "flow": {
                "description": "Analyze a Mermaid flow diagram",
                "usage": "//flow <source> [--format text|mermaid|dot]",
                "examples": [
                    "//flow simple_qa",
                    "//flow diagram.mmd --format dot",
                ],
            },
            "create": {
                "description": "Create a new task from template",
                "usage": "//create <name> [--template simple|loop|conditional]",
                "examples": [
                    "//create my_task",
                    "//create research --template loop",
                ],
            },
        }
        
        if command and command in commands:
            cmd_info = commands[command]
            return CLIOutput(
                success=True,
                message=f"Help: {command}",
                data={
                    "command": command,
                    "description": cmd_info["description"],
                    "usage": cmd_info["usage"],
                    "examples": cmd_info["examples"],
                },
            )
        
        # General help
        return CLIOutput(
            success=True,
            message="Universal Adapter CLI",
            data={
                "version": "1.0.0",
                "slash_prefix": "//",
                "commands": {
                    name: info["description"]
                    for name, info in commands.items()
                },
                "usage": "//command [options]",
                "tip": "Use //help <command> for detailed help on a specific command",
            },
        )
    
    # -------------------------------------------------------------------------
    # Helper methods
    # -------------------------------------------------------------------------
    
    def _load_task(self, task: str) -> TaskSchema:
        """
        Load a task from name, path, or JSON string.
        
        Security:
            File paths are validated against the security context.
            Named tasks from the library are always allowed.
        """
        ctx = self.security_context
        
        # Check if it's a named task (always allowed - from trusted library)
        if task in self.task_library.list_tasks():
            return self.task_library.load(task)
        
        # Check if it's a file path
        path = Path(task)
        if path.exists() or task.endswith('.json'):
            # Validate the path for security
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
        
        raise FileNotFoundError(
            f"Task not found: '{task}'. "
            f"Available named tasks: {', '.join(self.task_library.list_tasks())}"
        )
    
    def _apply_overrides(
        self,
        schema: TaskSchema,
        provider: str | None,
        model: str | None,
    ) -> TaskSchema:
        """Apply provider/model overrides to a task schema."""
        # This is a workaround since TaskSchema is immutable
        # We'd need to reconstruct it with modified resource_llm
        from .schema import ResourceLLM
        
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
        self,
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
    
    def _get_mermaid_source(self, source: str) -> str:
        """
        Get Mermaid diagram from various sources.
        
        Security:
            File paths are validated against the security context.
        """
        ctx = self.security_context
        
        # Named task (always allowed)
        if source in self.task_library.list_tasks():
            schema = self.task_library.load(source)
            return schema.flow_diagram.mermaid
        
        # File path
        path = Path(source)
        if path.exists() or source.endswith((".json", ".mmd", ".mermaid")):
            # Validate the path for security
            if not ctx.can_read_files():
                raise PermissionError("File read operations not allowed")
            
            try:
                validated_path = ctx.validate_read_path(source)
            except PathSecurityError as e:
                raise PermissionError(f"Path security violation: {e}")
            
            if validated_path.exists():
                content = validated_path.read_text()
                # Check if it's a task JSON file
                if source.endswith(".json"):
                    data = json.loads(content)
                    return data.get("flow_diagram", {}).get("mermaid", content)
                return content
        
        # Raw mermaid text (always allowed - no file access)
        if source.startswith("graph ") or source.startswith("flowchart "):
            return source
        
        raise ValueError(f"Cannot determine Mermaid source from: {source}")
    
    def _to_dot(self, graph: FlowGraph) -> str:
        """Convert FlowGraph to Graphviz DOT format."""
        lines = ["digraph G {"]
        lines.append("  rankdir=TB;")
        lines.append("  node [shape=box];")
        
        for node in graph.nodes.values():
            shape = {
                NodeType.START: "ellipse",
                NodeType.END: "ellipse",
                NodeType.CONDITION: "diamond",
                NodeType.LOOP: "octagon",
                NodeType.PROMPT: "box",
            }.get(node.node_type, "box")
            
            lines.append(f'  {node.id} [label="{node.label}", shape={shape}];')
        
        for edge in graph.edges:
            label = f' [label="{edge.condition}"]' if edge.condition else ""
            lines.append(f"  {edge.source} -> {edge.target}{label};")
        
        lines.append("}")
        return "\n".join(lines)
    
    def _template_simple(self, **kwargs: Any) -> dict:
        """Generate simple task template."""
        return {
            "name": kwargs["name"],
            "version": "1.0.0",
            "goal": {
                "description": kwargs["description"],
                "target_conditions": [
                    {"description": "Task completed", "evaluation_type": "GOAL_MET"}
                ],
            },
            "resource_llm": {
                "provider": kwargs["provider"],
                "model": kwargs["model"],
                "temperature": 0.7,
                "max_tokens": 4096,
            },
            "resource_registry": {"entries": []},
            "prompts": [
                {
                    "template": f"Complete the following task:\n\n{{{{input}}}}\n\nProvide a clear response.",
                    "role": "user",
                    "description": "Main prompt",
                }
            ],
            "flow_diagram": {
                "mermaid": "graph TD\n    START((Start)) --> P0[Execute]\n    P0 --> END((End))"
            },
        }
    
    def _template_loop(self, **kwargs: Any) -> dict:
        """Generate loop task template."""
        return {
            "name": kwargs["name"],
            "version": "1.0.0",
            "goal": {
                "description": kwargs["description"],
                "target_conditions": [
                    {"description": "All iterations complete", "evaluation_type": "GOAL_MET"},
                    {"description": "Within limit", "evaluation_type": "ITERATION_LIMIT", "expected_value": "50"},
                ],
            },
            "resource_llm": {
                "provider": kwargs["provider"],
                "model": kwargs["model"],
                "temperature": 0.7,
                "max_tokens": 4096,
            },
            "resource_registry": {"entries": []},
            "prompts": [
                {
                    "template": "Initialize the task:\n\n{{input}}",
                    "role": "user",
                    "description": "Initialization",
                },
                {
                    "template": "Process iteration {{loop.index}}:\n\nPrevious: {{response:P0}}",
                    "role": "user",
                    "description": "Iteration step",
                },
            ],
            "flow_diagram": {
                "mermaid": "graph TD\n    START((Start)) --> P0[Initialize]\n    P0 --> LOOP([Loop])\n    LOOP -->|continue| P1[Process]\n    P1 --> LOOP\n    LOOP -->|exit| END((End))"
            },
        }
    
    def _template_conditional(self, **kwargs: Any) -> dict:
        """Generate conditional task template."""
        return {
            "name": kwargs["name"],
            "version": "1.0.0",
            "goal": {
                "description": kwargs["description"],
                "target_conditions": [
                    {"description": "Condition evaluated", "evaluation_type": "GOAL_MET"}
                ],
            },
            "resource_llm": {
                "provider": kwargs["provider"],
                "model": kwargs["model"],
                "temperature": 0.7,
                "max_tokens": 4096,
            },
            "resource_registry": {"entries": []},
            "prompts": [
                {
                    "template": "Analyze the input:\n\n{{input}}\n\nRespond with 'yes' or 'no'.",
                    "role": "user",
                    "description": "Condition check",
                },
                {
                    "template": "Handle the 'yes' case based on:\n\n{{response:P0}}",
                    "role": "user",
                    "description": "Yes branch",
                },
                {
                    "template": "Handle the 'no' case based on:\n\n{{response:P0}}",
                    "role": "user",
                    "description": "No branch",
                },
            ],
            "flow_diagram": {
                "mermaid": "graph TD\n    START((Start)) --> P0[Check Condition]\n    P0 --> COND{Evaluate}\n    COND -->|yes| P1[Yes Path]\n    COND -->|no| P2[No Path]\n    P1 --> END((End))\n    P2 --> END"
            },
        }


# ============================================================================
# Argument Parser
# ============================================================================

def create_parser() -> argparse.ArgumentParser:
    """Create the argument parser for the CLI."""
    parser = argparse.ArgumentParser(
        prog="universal-adapter",
        description="Universal Adapter CLI - JSON-driven LLM task orchestration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s run simple_qa
  %(prog)s run task.json --debug
  %(prog)s validate task.json
  %(prog)s list --verbose
  %(prog)s inspect research_synthesis
  %(prog)s create my_task --template loop

Slash Commands (for TUI integration):
  //run simple_qa --debug
  //validate task.json
  //list
        """,
    )
    
    parser.add_argument(
        "--version",
        action="version",
        version="%(prog)s 1.0.0",
    )
    
    parser.add_argument(
        "--format",
        choices=["text", "json", "markdown"],
        default="text",
        help="Output format (default: text)",
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # run command
    run_parser = subparsers.add_parser("run", help="Execute a task")
    run_parser.add_argument("task", help="Task name, file path, or JSON")
    run_parser.add_argument("--debug", "-d", action="store_true", help="Enable debug output")
    run_parser.add_argument("--timeout", "-t", type=int, default=300, help="Timeout in seconds")
    run_parser.add_argument("--max-iterations", type=int, default=1000, help="Maximum iterations")
    run_parser.add_argument("--no-strict", action="store_true", help="Disable strict validation")
    run_parser.add_argument("--provider", help="Override LLM provider")
    run_parser.add_argument("--model", help="Override LLM model")
    run_parser.add_argument("-v", "--var", action="append", nargs=2, metavar=("KEY", "VALUE"),
                          help="Set context variable (can be repeated)")
    
    # validate command
    validate_parser = subparsers.add_parser("validate", help="Validate a task")
    validate_parser.add_argument("task", help="Task name, file path, or JSON")
    validate_parser.add_argument("--no-strict", action="store_true", help="Disable strict validation")
    
    # inspect command
    inspect_parser = subparsers.add_parser("inspect", help="Inspect a task")
    inspect_parser.add_argument("task", help="Task name, file path, or JSON")
    inspect_parser.add_argument("--no-flow", action="store_true", help="Hide flow diagram")
    inspect_parser.add_argument("--no-prompts", action="store_true", help="Hide prompts")
    inspect_parser.add_argument("--no-registry", action="store_true", help="Hide registry")
    inspect_parser.add_argument("--no-goal", action="store_true", help="Hide goal")
    
    # list command
    list_parser = subparsers.add_parser("list", help="List available tasks")
    list_parser.add_argument("--verbose", "-v", action="store_true", help="Show task details")
    
    # providers command
    providers_parser = subparsers.add_parser("providers", help="List LLM providers")
    providers_parser.add_argument("--no-check", action="store_true", help="Skip API key check")
    
    # flow command
    flow_parser = subparsers.add_parser("flow", help="Analyze flow diagram")
    flow_parser.add_argument("source", help="Mermaid source (task name, file, or text)")
    flow_parser.add_argument("--format", choices=["text", "mermaid", "dot"], default="text",
                            help="Output format")
    
    # create command
    create_parser = subparsers.add_parser("create", help="Create a new task")
    create_parser.add_argument("name", help="Task name")
    create_parser.add_argument("--template", choices=["simple", "loop", "conditional"],
                              default="simple", help="Template to use")
    create_parser.add_argument("--output", "-o", help="Output file path")
    create_parser.add_argument("--description", help="Goal description")
    create_parser.add_argument("--provider", default="anthropic", help="LLM provider")
    create_parser.add_argument("--model", default="claude-3-5-sonnet-20241022", help="Model name")
    
    # help command
    help_parser = subparsers.add_parser("help", help="Show help")
    help_parser.add_argument("topic", nargs="?", help="Command to get help for")
    
    return parser


# ============================================================================
# Main Entry Point
# ============================================================================

def main(args: Sequence[str] | None = None) -> int:
    """
    Main entry point for the CLI.
    
    Args:
        args: Command line arguments (defaults to sys.argv[1:])
    
    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    parser = create_parser()
    parsed = parser.parse_args(args)
    
    if not parsed.command:
        parser.print_help()
        return 0
    
    cli = CLICommands()
    
    # Determine output format
    fmt = OutputFormat[parsed.format.upper()] if hasattr(parsed, 'format') else OutputFormat.TEXT
    
    # Execute command
    try:
        if parsed.command == "run":
            variables = dict(parsed.var) if parsed.var else None
            result = cli.run(
                task=parsed.task,
                variables=variables,
                debug=parsed.debug,
                max_iterations=parsed.max_iterations,
                timeout_seconds=parsed.timeout,
                strict=not parsed.no_strict,
                provider_override=parsed.provider,
                model_override=parsed.model,
            )
        
        elif parsed.command == "validate":
            result = cli.validate(
                task=parsed.task,
                strict=not parsed.no_strict,
            )
        
        elif parsed.command == "inspect":
            result = cli.inspect(
                task=parsed.task,
                show_flow=not parsed.no_flow,
                show_prompts=not parsed.no_prompts,
                show_registry=not parsed.no_registry,
                show_goal=not parsed.no_goal,
            )
        
        elif parsed.command == "list":
            result = cli.list_tasks(verbose=parsed.verbose)
        
        elif parsed.command == "providers":
            result = cli.providers(check_keys=not parsed.no_check)
        
        elif parsed.command == "flow":
            result = cli.flow(
                source=parsed.source,
                output_format=parsed.format if hasattr(parsed, 'format') else "text",
            )
        
        elif parsed.command == "create":
            result = cli.create(
                name=parsed.name,
                template=parsed.template,
                output_path=parsed.output,
                description=parsed.description or "",
                provider=parsed.provider,
                model=parsed.model,
            )
        
        elif parsed.command == "help":
            result = cli.help(command=parsed.topic)
        
        else:
            parser.print_help()
            return 0
        
        # Output result
        print(result.format(fmt))
        return 0 if result.success else 1
        
    except Exception as e:
        error_output = CLIOutput(
            success=False,
            message="Command failed",
            errors=[str(e)],
        )
        print(error_output.format(fmt), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
