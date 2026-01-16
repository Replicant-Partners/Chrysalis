"""
Slash Command Parser - TUI Integration for Universal Adapter

Parses slash commands from user input and executes them through the CLI.
Designed for integration with text-based user interfaces (TUIs) and
agent-driven systems like Ada.

Slash Command Format:
    //command [arguments] [--options]

Examples:
    //run simple_qa
    //run task.json --debug -v topic="AI Safety"
    //validate my_task.json
    //list --verbose
    //help run

Integration with Ada and other agents:
    The SlashCommandParser provides methods to:
    - Check if input contains a slash command
    - Parse and execute commands
    - Generate command suggestions
    - Get completion hints

Security:
    By default, slash commands use USER-level permissions which:
    - Allow running tasks with configured providers
    - Restrict file access to workspace
    - Block write operations unless explicitly enabled
    
    For agents, use create_agent_parser() for more restricted access.
"""

from __future__ import annotations
import re
import shlex
from dataclasses import dataclass, field
from typing import Any, Callable, Sequence

from .cli import CLICommands, CLIOutput, OutputFormat
from .security import (
    SecurityContext,
    PermissionLevel,
    Operation,
    create_user_context,
    create_agent_context,
    create_readonly_context,
)


# ============================================================================
# Slash Command Configuration
# ============================================================================

# Default prefix for slash commands
DEFAULT_PREFIX = "//"

# Alternative prefixes that can be configured
VALID_PREFIXES = ["//", "/", "!!", "ua:"]


@dataclass
class SlashCommandConfig:
    """Configuration for slash command parsing."""
    prefix: str = DEFAULT_PREFIX
    allow_multiline: bool = False
    strict_parsing: bool = True
    output_format: OutputFormat = OutputFormat.TEXT
    
    def __post_init__(self) -> None:
        if self.prefix not in VALID_PREFIXES:
            raise ValueError(f"Invalid prefix: {self.prefix}. Valid: {VALID_PREFIXES}")


# ============================================================================
# Parsed Command
# ============================================================================

@dataclass
class ParsedCommand:
    """
    Represents a parsed slash command.
    
    Attributes:
        raw: Original command string
        command: Command name (e.g., 'run', 'validate')
        args: Positional arguments
        options: Named options (--flag or --key=value)
        valid: Whether parsing succeeded
        error: Error message if parsing failed
    """
    raw: str
    command: str
    args: list[str] = field(default_factory=list)
    options: dict[str, Any] = field(default_factory=dict)
    valid: bool = True
    error: str | None = None
    
    @property
    def is_help_request(self) -> bool:
        """Check if this is a help request."""
        return self.command == "help" or "--help" in self.options or "-h" in self.options
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "raw": self.raw,
            "command": self.command,
            "args": self.args,
            "options": self.options,
            "valid": self.valid,
            "error": self.error,
        }


# ============================================================================
# Slash Command Parser
# ============================================================================

class SlashCommandParser:
    """
    Parser for slash commands in text input.
    
    Provides methods to detect, parse, and execute slash commands
    from user input. Designed for TUI integration.
    
    Security:
        By default, uses USER-level security which restricts:
        - Provider override (validated against allowed list)
        - File writes (blocked by default)
        - Path access (workspace only)
        
        Use create_agent_parser() for agent-safe access.
    
    Example usage:
        parser = SlashCommandParser()
        
        # Check if input is a slash command
        if parser.is_command("//run simple_qa"):
            result = parser.execute("//run simple_qa")
            print(result.format())
        
        # Get suggestions for partial input
        suggestions = parser.get_suggestions("//ru")
    """
    
    # Valid commands and their aliases
    COMMANDS = {
        "run": ["r", "exec", "execute"],
        "validate": ["val", "check"],
        "inspect": ["info", "show", "describe"],
        "list": ["ls", "tasks"],
        "providers": ["prov", "llms"],
        "flow": ["diagram", "graph"],
        "create": ["new", "init"],
        "help": ["h", "?"],
    }
    
    # Commands that are safe for all permission levels (read-only)
    SAFE_COMMANDS = {"list", "providers", "help", "validate", "inspect", "flow"}
    
    # Commands that require elevated permissions
    RESTRICTED_COMMANDS = {"run", "create"}
    
    # Command descriptions for help
    COMMAND_DESCRIPTIONS = {
        "run": "Execute a task (//run <task> [--debug] [-v key=value])",
        "validate": "Validate a task without executing (//validate <task>)",
        "inspect": "Show detailed task information (//inspect <task>)",
        "list": "List available named tasks (//list [--verbose])",
        "providers": "Show available LLM providers (//providers)",
        "flow": "Analyze a flow diagram (//flow <source>)",
        "create": "Create a new task from template (//create <name>) [restricted]",
        "help": "Show help information (//help [command])",
    }
    
    def __init__(
        self,
        config: SlashCommandConfig | None = None,
        cli: CLICommands | None = None,
        security_context: SecurityContext | None = None,
    ) -> None:
        """
        Initialize the parser.
        
        Args:
            config: Configuration options
            cli: CLICommands instance (created if not provided)
            security_context: Security context for permission control
        """
        self.config = config or SlashCommandConfig()
        
        # Create security context - default to USER level for TUI
        self.security_context = security_context or create_user_context()
        
        # Create CLI with the security context
        self.cli = cli or CLICommands(security_context=self.security_context)
        
        # Build alias lookup
        self._alias_map: dict[str, str] = {}
        for cmd, aliases in self.COMMANDS.items():
            self._alias_map[cmd] = cmd
            for alias in aliases:
                self._alias_map[alias] = cmd
    
    # -------------------------------------------------------------------------
    # Detection
    # -------------------------------------------------------------------------
    
    def is_command(self, text: str) -> bool:
        """
        Check if text starts with a slash command.
        
        Args:
            text: Input text to check
        
        Returns:
            True if text appears to be a slash command
        """
        stripped = text.strip()
        return stripped.startswith(self.config.prefix)
    
    def extract_command(self, text: str) -> str | None:
        """
        Extract slash command from text, if present.
        
        Args:
            text: Input text that may contain a slash command
        
        Returns:
            The command portion, or None if no command found
        """
        if not self.is_command(text):
            return None
        
        stripped = text.strip()
        
        if self.config.allow_multiline:
            # Take the first line only
            return stripped.split("\n")[0]
        
        return stripped
    
    # -------------------------------------------------------------------------
    # Parsing
    # -------------------------------------------------------------------------
    
    def parse(self, text: str) -> ParsedCommand:
        """
        Parse a slash command into structured components.
        
        Args:
            text: Slash command text (e.g., "//run task.json --debug")
        
        Returns:
            ParsedCommand with parsed components
        """
        if not self.is_command(text):
            return ParsedCommand(
                raw=text,
                command="",
                valid=False,
                error="Not a slash command",
            )
        
        # Remove prefix
        command_text = text.strip()[len(self.config.prefix):]
        
        if not command_text.strip():
            return ParsedCommand(
                raw=text,
                command="",
                valid=False,
                error="Empty command",
            )
        
        try:
            # Use shlex for proper handling of quoted strings
            tokens = shlex.split(command_text)
        except ValueError as e:
            return ParsedCommand(
                raw=text,
                command="",
                valid=False,
                error=f"Parse error: {e}",
            )
        
        if not tokens:
            return ParsedCommand(
                raw=text,
                command="",
                valid=False,
                error="No command specified",
            )
        
        # Extract command name (resolving aliases)
        cmd_name = tokens[0].lower()
        resolved_cmd = self._alias_map.get(cmd_name)
        
        if resolved_cmd is None and self.config.strict_parsing:
            return ParsedCommand(
                raw=text,
                command=cmd_name,
                valid=False,
                error=f"Unknown command: {cmd_name}. Available: {', '.join(self.COMMANDS.keys())}",
            )
        
        # Parse remaining tokens
        args: list[str] = []
        options: dict[str, Any] = {}
        
        i = 1
        while i < len(tokens):
            token = tokens[i]
            
            # Long option: --key or --key=value
            if token.startswith("--"):
                if "=" in token:
                    key, value = token[2:].split("=", 1)
                    options[key] = self._parse_value(value)
                elif i + 1 < len(tokens) and not tokens[i + 1].startswith("-"):
                    # --key value format
                    options[token[2:]] = self._parse_value(tokens[i + 1])
                    i += 1
                else:
                    # Flag: --key (boolean true)
                    options[token[2:]] = True
            
            # Short option: -k or -k value
            elif token.startswith("-") and len(token) == 2:
                key = token[1]
                if i + 1 < len(tokens) and not tokens[i + 1].startswith("-"):
                    options[key] = self._parse_value(tokens[i + 1])
                    i += 1
                else:
                    options[key] = True
            
            # Variable assignment: key=value
            elif "=" in token and not token.startswith("-"):
                key, value = token.split("=", 1)
                if "var" not in options:
                    options["var"] = {}
                options["var"][key] = self._parse_value(value)
            
            # Positional argument
            else:
                args.append(token)
            
            i += 1
        
        return ParsedCommand(
            raw=text,
            command=resolved_cmd or cmd_name,
            args=args,
            options=options,
            valid=True,
        )
    
    def _parse_value(self, value: str) -> Any:
        """Parse a string value into appropriate type."""
        # Boolean
        if value.lower() in ("true", "yes", "on"):
            return True
        if value.lower() in ("false", "no", "off"):
            return False
        
        # Integer
        try:
            return int(value)
        except ValueError:
            pass
        
        # Float
        try:
            return float(value)
        except ValueError:
            pass
        
        # String
        return value
    
    # -------------------------------------------------------------------------
    # Execution
    # -------------------------------------------------------------------------
    
    def execute(self, text: str) -> CLIOutput:
        """
        Parse and execute a slash command.
        
        Args:
            text: Slash command text
        
        Returns:
            CLIOutput with execution results
        
        Security:
            Checks permissions before executing restricted commands.
        """
        parsed = self.parse(text)
        
        if not parsed.valid:
            return CLIOutput(
                success=False,
                message="Command parse error",
                errors=[parsed.error or "Unknown error"],
            )
        
        # Check if command is restricted and user has permission
        if parsed.command in self.RESTRICTED_COMMANDS:
            if parsed.command == "create":
                if not self.security_context.has_permission(Operation.CREATE_TASK):
                    return CLIOutput(
                        success=False,
                        message="Permission denied",
                        errors=[
                            f"Command '{parsed.command}' requires CREATE_TASK permission. "
                            "This command is restricted in the current security context."
                        ],
                    )
            elif parsed.command == "run":
                if not self.security_context.has_permission(Operation.RUN_TASK):
                    return CLIOutput(
                        success=False,
                        message="Permission denied",
                        errors=[
                            f"Command '{parsed.command}' requires RUN_TASK permission. "
                            "This command is restricted in the current security context."
                        ],
                    )
        
        return self._dispatch(parsed)
    
    def _dispatch(self, cmd: ParsedCommand) -> CLIOutput:
        """Dispatch parsed command to appropriate handler."""
        handlers: dict[str, Callable[[ParsedCommand], CLIOutput]] = {
            "run": self._exec_run,
            "validate": self._exec_validate,
            "inspect": self._exec_inspect,
            "list": self._exec_list,
            "providers": self._exec_providers,
            "flow": self._exec_flow,
            "create": self._exec_create,
            "help": self._exec_help,
        }
        
        handler = handlers.get(cmd.command)
        if handler is None:
            return CLIOutput(
                success=False,
                message="Unknown command",
                errors=[f"No handler for command: {cmd.command}"],
            )
        
        try:
            return handler(cmd)
        except Exception as e:
            return CLIOutput(
                success=False,
                message="Command execution failed",
                errors=[str(e)],
            )
    
    def _exec_run(self, cmd: ParsedCommand) -> CLIOutput:
        """Execute 'run' command."""
        if not cmd.args:
            return CLIOutput(
                success=False,
                message="Missing task argument",
                errors=["Usage: //run <task> [--debug] [-v key=value]"],
            )
        
        variables = cmd.options.get("var") or cmd.options.get("v")
        
        return self.cli.run(
            task=cmd.args[0],
            variables=variables if isinstance(variables, dict) else None,
            debug=cmd.options.get("debug", cmd.options.get("d", False)),
            max_iterations=cmd.options.get("max-iterations", 1000),
            timeout_seconds=cmd.options.get("timeout", cmd.options.get("t", 300)),
            strict=not cmd.options.get("no-strict", False),
            provider_override=cmd.options.get("provider"),
            model_override=cmd.options.get("model"),
        )
    
    def _exec_validate(self, cmd: ParsedCommand) -> CLIOutput:
        """Execute 'validate' command."""
        if not cmd.args:
            return CLIOutput(
                success=False,
                message="Missing task argument",
                errors=["Usage: //validate <task>"],
            )
        
        return self.cli.validate(
            task=cmd.args[0],
            strict=not cmd.options.get("no-strict", False),
        )
    
    def _exec_inspect(self, cmd: ParsedCommand) -> CLIOutput:
        """Execute 'inspect' command."""
        if not cmd.args:
            return CLIOutput(
                success=False,
                message="Missing task argument",
                errors=["Usage: //inspect <task>"],
            )
        
        return self.cli.inspect(
            task=cmd.args[0],
            show_flow=not cmd.options.get("no-flow", False),
            show_prompts=not cmd.options.get("no-prompts", False),
            show_registry=not cmd.options.get("no-registry", False),
            show_goal=not cmd.options.get("no-goal", False),
        )
    
    def _exec_list(self, cmd: ParsedCommand) -> CLIOutput:
        """Execute 'list' command."""
        return self.cli.list_tasks(
            verbose=cmd.options.get("verbose", cmd.options.get("v", False)),
        )
    
    def _exec_providers(self, cmd: ParsedCommand) -> CLIOutput:
        """Execute 'providers' command."""
        return self.cli.providers(
            check_keys=not cmd.options.get("no-check", False),
        )
    
    def _exec_flow(self, cmd: ParsedCommand) -> CLIOutput:
        """Execute 'flow' command."""
        if not cmd.args:
            return CLIOutput(
                success=False,
                message="Missing source argument",
                errors=["Usage: //flow <source> [--format text|mermaid|dot]"],
            )
        
        return self.cli.flow(
            source=cmd.args[0],
            output_format=cmd.options.get("format", "text"),
        )
    
    def _exec_create(self, cmd: ParsedCommand) -> CLIOutput:
        """Execute 'create' command."""
        if not cmd.args:
            return CLIOutput(
                success=False,
                message="Missing name argument",
                errors=["Usage: //create <name> [--template simple|loop|conditional]"],
            )
        
        return self.cli.create(
            name=cmd.args[0],
            template=cmd.options.get("template", "simple"),
            output_path=cmd.options.get("output", cmd.options.get("o")),
            description=cmd.options.get("description", ""),
            provider=cmd.options.get("provider", "anthropic"),
            model=cmd.options.get("model", "claude-3-5-sonnet-20241022"),
        )
    
    def _exec_help(self, cmd: ParsedCommand) -> CLIOutput:
        """Execute 'help' command."""
        topic = cmd.args[0] if cmd.args else None
        return self.cli.help(command=topic)
    
    # -------------------------------------------------------------------------
    # Suggestions and Completions
    # -------------------------------------------------------------------------
    
    def get_suggestions(self, partial: str) -> list[str]:
        """
        Get command suggestions for partial input.
        
        Useful for autocomplete in TUI interfaces.
        
        Args:
            partial: Partial command input
        
        Returns:
            List of suggested completions
        """
        if not self.is_command(partial):
            return []
        
        # Get the text after prefix
        text = partial[len(self.config.prefix):].strip().lower()
        
        if not text:
            # No command yet - suggest all commands
            return [f"{self.config.prefix}{cmd}" for cmd in self.COMMANDS.keys()]
        
        # Split into command and rest
        parts = text.split(maxsplit=1)
        cmd_part = parts[0]
        
        # Check if command is complete
        if cmd_part in self._alias_map:
            # Command is complete - suggest arguments/options
            resolved = self._alias_map[cmd_part]
            return self._get_argument_suggestions(resolved, parts[1] if len(parts) > 1 else "")
        
        # Partial command - suggest matching commands
        suggestions = []
        for cmd in self.COMMANDS.keys():
            if cmd.startswith(cmd_part):
                suggestions.append(f"{self.config.prefix}{cmd}")
        
        return suggestions
    
    def _get_argument_suggestions(self, command: str, current: str) -> list[str]:
        """Get suggestions for command arguments."""
        prefix = self.config.prefix
        
        suggestions: dict[str, list[str]] = {
            "run": [
                f"{prefix}run simple_qa",
                f"{prefix}run research_synthesis",
                f"{prefix}run <task.json> --debug",
                f"{prefix}run <task> -v key=value",
            ],
            "validate": [
                f"{prefix}validate <task.json>",
                f"{prefix}validate simple_qa",
            ],
            "inspect": [
                f"{prefix}inspect simple_qa",
                f"{prefix}inspect <task> --no-prompts",
            ],
            "list": [
                f"{prefix}list",
                f"{prefix}list --verbose",
            ],
            "providers": [
                f"{prefix}providers",
                f"{prefix}providers --no-check",
            ],
            "flow": [
                f"{prefix}flow simple_qa",
                f"{prefix}flow <diagram.mmd>",
            ],
            "create": [
                f"{prefix}create my_task",
                f"{prefix}create task --template loop",
            ],
            "help": [
                f"{prefix}help",
                f"{prefix}help run",
            ],
        }
        
        return suggestions.get(command, [])
    
    def get_command_list(self) -> list[dict[str, Any]]:
        """
        Get list of available commands with descriptions.
        
        Useful for Ada and other agents to present command options.
        
        Returns:
            List of command info dictionaries
        """
        commands = []
        for cmd, aliases in self.COMMANDS.items():
            commands.append({
                "name": cmd,
                "aliases": aliases,
                "description": self.COMMAND_DESCRIPTIONS.get(cmd, ""),
                "usage": f"{self.config.prefix}{cmd}",
            })
        return commands
    
    def format_command_help(self) -> str:
        """
        Format a help message showing all commands.
        
        Returns:
            Formatted help text
        """
        lines = [
            f"Universal Adapter Slash Commands (prefix: {self.config.prefix})",
            "",
            "Commands:",
        ]
        
        for cmd, desc in self.COMMAND_DESCRIPTIONS.items():
            aliases = self.COMMANDS.get(cmd, [])
            alias_str = f" (aliases: {', '.join(aliases)})" if aliases else ""
            lines.append(f"  {self.config.prefix}{cmd}{alias_str}")
            lines.append(f"    {desc}")
        
        lines.extend([
            "",
            "Examples:",
            f"  {self.config.prefix}run simple_qa --debug",
            f"  {self.config.prefix}validate my_task.json",
            f"  {self.config.prefix}list --verbose",
            f"  {self.config.prefix}help run",
        ])
        
        return "\n".join(lines)


# ============================================================================
# Convenience Functions
# ============================================================================

# Global parser instance for simple usage
_default_parser: SlashCommandParser | None = None


def get_parser(config: SlashCommandConfig | None = None) -> SlashCommandParser:
    """
    Get the default slash command parser.
    
    Args:
        config: Optional configuration (used only on first call)
    
    Returns:
        SlashCommandParser instance
    """
    global _default_parser
    if _default_parser is None:
        _default_parser = SlashCommandParser(config)
    return _default_parser


def is_slash_command(text: str) -> bool:
    """
    Check if text is a slash command.
    
    Args:
        text: Input text to check
    
    Returns:
        True if text appears to be a slash command
    """
    return get_parser().is_command(text)


def execute_slash_command(text: str) -> CLIOutput:
    """
    Execute a slash command.
    
    Args:
        text: Slash command text
    
    Returns:
        CLIOutput with results
    """
    return get_parser().execute(text)


def parse_slash_command(text: str) -> ParsedCommand:
    """
    Parse a slash command without executing.
    
    Args:
        text: Slash command text
    
    Returns:
        ParsedCommand with parsed components
    """
    return get_parser().parse(text)


def get_command_suggestions(partial: str) -> list[str]:
    """
    Get suggestions for partial command input.
    
    Args:
        partial: Partial command text
    
    Returns:
        List of suggested completions
    """
    return get_parser().get_suggestions(partial)


# ============================================================================
# Security-Aware Parser Factories
# ============================================================================

def create_user_parser(
    config: SlashCommandConfig | None = None,
    allowed_directories: list[str] | None = None,
) -> SlashCommandParser:
    """
    Create a parser with USER-level security.
    
    Allows:
    - Reading tasks from workspace
    - Running tasks with configured providers
    - Validation and inspection
    
    Restricts:
    - File writes (blocked by default)
    - Path access outside workspace
    """
    ctx = create_user_context(allowed_directories=allowed_directories)
    return SlashCommandParser(config=config, security_context=ctx)


def create_agent_parser(
    config: SlashCommandConfig | None = None,
    allowed_providers: list[str] | None = None,
) -> SlashCommandParser:
    """
    Create a parser with AGENT-level security.
    
    Suitable for automated agents like Ada.
    
    Allows:
    - Reading tasks from library (named tasks only)
    - Running tasks with explicitly allowed providers
    - Validation and inspection
    
    Restricts:
    - All file writes
    - File path access
    - High iteration counts
    
    Note: allowed_providers must be explicitly specified.
    """
    if allowed_providers is None:
        raise ValueError(
            "allowed_providers must be explicitly specified for agent parser. "
            "Example: create_agent_parser(allowed_providers=['anthropic'])"
        )
    ctx = create_agent_context(allowed_providers=allowed_providers)
    return SlashCommandParser(config=config, security_context=ctx)


def create_readonly_parser(
    config: SlashCommandConfig | None = None,
) -> SlashCommandParser:
    """
    Create a parser with read-only access.
    
    Allows:
    - Listing tasks
    - Validation
    - Inspection
    - Help
    
    Restricts:
    - All execution
    - All file writes
    """
    ctx = create_readonly_context()
    return SlashCommandParser(config=config, security_context=ctx)
