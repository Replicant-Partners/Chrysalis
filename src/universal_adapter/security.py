"""
Universal Adapter Security Module

Provides security controls for the Universal Adapter CLI and API:
- Permission levels for different contexts (admin, user, agent)
- Path sandboxing for file operations
- Provider restrictions
- Operation allowlists

Security Model:
    ADMIN   - Full access, all operations allowed (direct CLI usage)
    USER    - Read + execute, restricted file writes (TUI/interactive)
    AGENT   - Read-only with restricted providers (automated agents)
    LOCKED  - No operations allowed (emergency lockdown)

Usage:
    from universal_adapter.security import (
        SecurityContext,
        PermissionLevel,
        require_permission,
    )
    
    # Create a restricted context for agents
    ctx = SecurityContext(
        permission_level=PermissionLevel.AGENT,
        allowed_providers=["anthropic"],
    )
    
    # Check permissions
    if ctx.can_write_files():
        save_task(task, path)
"""

from __future__ import annotations
import os
import re
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Any, Callable, TypeVar, ParamSpec
from functools import wraps

# ============================================================================
# Permission Levels
# ============================================================================

class PermissionLevel(Enum):
    """
    Permission levels for security contexts.
    
    Higher values indicate more restrictions.
    """
    ADMIN = 0       # Full access - direct CLI usage by power users
    USER = 1        # Standard user - TUI/interactive, some restrictions
    AGENT = 2       # Automated agent - read-mostly, restricted providers
    LOCKED = 99     # Emergency lockdown - no operations allowed


class Operation(Enum):
    """Operations that can be controlled by permissions."""
    # Read operations
    READ_TASK = auto()
    LIST_TASKS = auto()
    INSPECT_TASK = auto()
    VALIDATE_TASK = auto()
    ANALYZE_FLOW = auto()
    LIST_PROVIDERS = auto()
    
    # Execute operations
    RUN_TASK = auto()
    RUN_WITH_REAL_PROVIDER = auto()
    
    # Write operations
    CREATE_TASK = auto()
    SAVE_TASK = auto()
    WRITE_FILE = auto()
    
    # Configuration operations
    OVERRIDE_PROVIDER = auto()
    OVERRIDE_MODEL = auto()
    SET_HIGH_ITERATIONS = auto()


# Default operation permissions by level
DEFAULT_PERMISSIONS: dict[PermissionLevel, set[Operation]] = {
    PermissionLevel.ADMIN: set(Operation),  # All operations
    
    PermissionLevel.USER: {
        # Read operations
        Operation.READ_TASK,
        Operation.LIST_TASKS,
        Operation.INSPECT_TASK,
        Operation.VALIDATE_TASK,
        Operation.ANALYZE_FLOW,
        Operation.LIST_PROVIDERS,
        # Execute operations
        Operation.RUN_TASK,
        Operation.RUN_WITH_REAL_PROVIDER,
        # Limited write
        Operation.CREATE_TASK,  # With path restrictions
        Operation.SAVE_TASK,    # With path restrictions
        # Configuration
        Operation.OVERRIDE_PROVIDER,
        Operation.OVERRIDE_MODEL,
    },
    
    PermissionLevel.AGENT: {
        # Read operations only
        Operation.READ_TASK,
        Operation.LIST_TASKS,
        Operation.INSPECT_TASK,
        Operation.VALIDATE_TASK,
        Operation.ANALYZE_FLOW,
        Operation.LIST_PROVIDERS,
        # Execute with explicitly allowed providers
        Operation.RUN_TASK,
    },
    
    PermissionLevel.LOCKED: set(),  # No operations
}


# ============================================================================
# Path Security
# ============================================================================

class PathSecurityError(Exception):
    """Raised when a path operation violates security rules."""
    pass


class PathValidator:
    """
    Validates and sanitizes file paths for security.
    
    Prevents:
    - Path traversal attacks (../)
    - Access outside allowed directories
    - Access to sensitive files
    """
    
    # Patterns that are never allowed in paths
    FORBIDDEN_PATTERNS = [
        r'\.\./',           # Parent directory traversal
        r'\.\.\\',          # Windows traversal
        r'^/',              # Absolute paths (when sandboxed)
        r'^[A-Za-z]:',      # Windows absolute paths
        r'~',               # Home directory expansion
        r'\$',              # Environment variable expansion
        r'%',               # Windows env vars
    ]
    
    # File extensions that are allowed for task files
    ALLOWED_EXTENSIONS = {'.json', '.yaml', '.yml', '.mmd'}
    
    # Sensitive file patterns to block
    SENSITIVE_PATTERNS = [
        r'\.env',
        r'\.git/',
        r'\.ssh/',
        r'credentials',
        r'secrets?',
        r'password',
        r'api.?key',
        r'token',
        r'\.pem$',
        r'\.key$',
    ]
    
    def __init__(
        self,
        allowed_directories: list[str | Path] | None = None,
        allow_absolute: bool = False,
        allow_outside_workspace: bool = False,
    ):
        """
        Initialize the path validator.
        
        Args:
            allowed_directories: List of allowed base directories
            allow_absolute: Whether to allow absolute paths
            allow_outside_workspace: Whether to allow paths outside workspace
        """
        self.allowed_directories = [
            Path(d).resolve() for d in (allowed_directories or [])
        ]
        self.allow_absolute = allow_absolute
        self.allow_outside_workspace = allow_outside_workspace
        
        # Default workspace is current directory
        self._workspace = Path.cwd().resolve()
    
    def set_workspace(self, path: str | Path) -> None:
        """Set the workspace root directory."""
        self._workspace = Path(path).resolve()
    
    def validate_read_path(self, path: str | Path) -> Path:
        """
        Validate a path for reading.
        
        Args:
            path: Path to validate
            
        Returns:
            Resolved, validated Path
            
        Raises:
            PathSecurityError: If path is not allowed
        """
        return self._validate_path(path, for_write=False)
    
    def validate_write_path(self, path: str | Path) -> Path:
        """
        Validate a path for writing.
        
        Args:
            path: Path to validate
            
        Returns:
            Resolved, validated Path
            
        Raises:
            PathSecurityError: If path is not allowed
        """
        return self._validate_path(path, for_write=True)
    
    def _validate_path(self, path: str | Path, for_write: bool) -> Path:
        """Core path validation logic."""
        path_str = str(path)
        
        # Check for forbidden patterns
        for pattern in self.FORBIDDEN_PATTERNS:
            if re.search(pattern, path_str, re.IGNORECASE):
                if pattern == r'^/' and self.allow_absolute:
                    continue
                raise PathSecurityError(
                    f"Forbidden path pattern detected: {pattern}"
                )
        
        # Check for sensitive file patterns
        for pattern in self.SENSITIVE_PATTERNS:
            if re.search(pattern, path_str, re.IGNORECASE):
                raise PathSecurityError(
                    f"Access to sensitive file pattern blocked: {pattern}"
                )
        
        # Resolve the path
        resolved = Path(path).resolve()
        
        # Check if within workspace
        if not self.allow_outside_workspace:
            try:
                resolved.relative_to(self._workspace)
            except ValueError:
                raise PathSecurityError(
                    f"Path outside workspace: {resolved}"
                )
        
        # Check allowed directories if specified
        if self.allowed_directories:
            in_allowed = any(
                self._is_subpath(resolved, allowed)
                for allowed in self.allowed_directories
            )
            if not in_allowed:
                raise PathSecurityError(
                    f"Path not in allowed directories: {resolved}"
                )
        
        # For writes, check extension
        if for_write and resolved.suffix:
            if resolved.suffix.lower() not in self.ALLOWED_EXTENSIONS:
                raise PathSecurityError(
                    f"File extension not allowed for write: {resolved.suffix}"
                )
        
        return resolved
    
    def _is_subpath(self, path: Path, parent: Path) -> bool:
        """Check if path is a subpath of parent."""
        try:
            path.relative_to(parent)
            return True
        except ValueError:
            return False
    
    def sanitize_filename(self, filename: str) -> str:
        """
        Sanitize a filename for safe use.
        
        Args:
            filename: Original filename
            
        Returns:
            Sanitized filename
        """
        # Remove path separators
        filename = filename.replace('/', '_').replace('\\', '_')
        
        # Remove other dangerous characters
        filename = re.sub(r'[<>:"|?*]', '_', filename)
        
        # Remove leading/trailing dots and spaces
        filename = filename.strip('. ')
        
        # Ensure not empty
        if not filename:
            filename = 'unnamed'
        
        return filename


# ============================================================================
# Security Context
# ============================================================================

@dataclass
class SecurityContext:
    """
    Security context for Universal Adapter operations.
    
    Encapsulates permission level, allowed operations, and path restrictions.
    Pass this to CLI/API functions to enforce security policies.
    """
    permission_level: PermissionLevel = PermissionLevel.USER
    allowed_operations: set[Operation] | None = None
    denied_operations: set[Operation] = field(default_factory=set)
    allowed_providers: list[str] | None = None  # None = all allowed
    allowed_directories: list[str] | None = None
    max_iterations: int = 1000
    max_timeout_seconds: int = 600
    allow_file_writes: bool = True
    allow_file_reads: bool = True
    require_confirmation_for_writes: bool = False
    audit_log: bool = False
    
    def __post_init__(self) -> None:
        """Initialize derived attributes."""
        # If no explicit allowed operations, use defaults for permission level
        if self.allowed_operations is None:
            self.allowed_operations = DEFAULT_PERMISSIONS.get(
                self.permission_level, set()
            ).copy()
        
        # Remove any denied operations
        self.allowed_operations -= self.denied_operations
        
        # Initialize path validator
        self._path_validator = PathValidator(
            allowed_directories=self.allowed_directories,
            allow_absolute=(self.permission_level == PermissionLevel.ADMIN),
            allow_outside_workspace=(self.permission_level == PermissionLevel.ADMIN),
        )
    
    # -------------------------------------------------------------------------
    # Permission Checks
    # -------------------------------------------------------------------------
    
    def has_permission(self, operation: Operation) -> bool:
        """Check if an operation is allowed."""
        if self.permission_level == PermissionLevel.LOCKED:
            return False
        return operation in (self.allowed_operations or set())
    
    def require_permission(self, operation: Operation) -> None:
        """
        Require a specific permission, raising if not allowed.
        
        Raises:
            PermissionError: If operation is not allowed
        """
        if not self.has_permission(operation):
            raise PermissionError(
                f"Operation '{operation.name}' not allowed at "
                f"permission level '{self.permission_level.name}'"
            )
    
    def can_read_files(self) -> bool:
        """Check if file reading is allowed."""
        return (
            self.allow_file_reads and 
            self.has_permission(Operation.READ_TASK)
        )
    
    def can_write_files(self) -> bool:
        """Check if file writing is allowed."""
        return (
            self.allow_file_writes and
            self.has_permission(Operation.WRITE_FILE)
        )
    
    def can_use_provider(self, provider: str) -> bool:
        """Check if a specific provider is allowed."""
        if self.allowed_providers is None:
            return True
        return provider.lower() in [p.lower() for p in self.allowed_providers]
    
    def can_run_with_real_provider(self) -> bool:
        """Check if running with LLM providers is allowed."""
        return self.has_permission(Operation.RUN_WITH_REAL_PROVIDER)
    
    # -------------------------------------------------------------------------
    # Path Validation
    # -------------------------------------------------------------------------
    
    def validate_read_path(self, path: str | Path) -> Path:
        """Validate a path for reading."""
        self.require_permission(Operation.READ_TASK)
        return self._path_validator.validate_read_path(path)
    
    def validate_write_path(self, path: str | Path) -> Path:
        """Validate a path for writing."""
        self.require_permission(Operation.WRITE_FILE)
        return self._path_validator.validate_write_path(path)
    
    def sanitize_filename(self, filename: str) -> str:
        """Sanitize a filename."""
        return self._path_validator.sanitize_filename(filename)
    
    # -------------------------------------------------------------------------
    # Parameter Validation
    # -------------------------------------------------------------------------
    
    def validate_iterations(self, iterations: int) -> int:
        """Validate and cap iteration count."""
        if iterations > self.max_iterations:
            if self.has_permission(Operation.SET_HIGH_ITERATIONS):
                return iterations
            return self.max_iterations
        return iterations
    
    def validate_timeout(self, timeout_seconds: int) -> int:
        """Validate and cap timeout."""
        return min(timeout_seconds, self.max_timeout_seconds)
    
    def validate_provider(self, provider: str) -> str:
        """
        Validate provider selection.
        
        Returns the provider if allowed, raises PermissionError if not.
        """
        if not self.can_use_provider(provider):
            raise PermissionError(
                f"Provider '{provider}' not allowed. "
                f"Allowed providers: {self.allowed_providers}"
            )
        if not self.can_run_with_real_provider():
            raise PermissionError(
                f"Real provider usage not allowed at permission level "
                f"'{self.permission_level.name}'"
            )
        return provider


# ============================================================================
# Decorator for Permission Checks
# ============================================================================

P = ParamSpec('P')
T = TypeVar('T')


def require_permission(operation: Operation):
    """
    Decorator to require a specific permission for a function.
    
    The decorated function must accept a `security_context` keyword argument.
    
    Example:
        @require_permission(Operation.CREATE_TASK)
        def create_task(name, security_context=None):
            ...
    """
    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            ctx = kwargs.get('security_context')
            if ctx is None:
                ctx = get_default_context()
            
            ctx.require_permission(operation)
            return func(*args, **kwargs)
        return wrapper
    return decorator


# ============================================================================
# Default Contexts
# ============================================================================

# Default context for different usage scenarios
_default_context: SecurityContext | None = None


def get_default_context() -> SecurityContext:
    """Get the default security context."""
    global _default_context
    if _default_context is None:
        _default_context = SecurityContext(permission_level=PermissionLevel.USER)
    return _default_context


def set_default_context(ctx: SecurityContext) -> None:
    """Set the default security context."""
    global _default_context
    _default_context = ctx


def create_admin_context() -> SecurityContext:
    """Create an admin-level security context."""
    return SecurityContext(
        permission_level=PermissionLevel.ADMIN,
        allow_file_writes=True,
        allow_file_reads=True,
        max_iterations=10000,
        max_timeout_seconds=3600,
    )


def create_user_context(
    allowed_directories: list[str] | None = None,
) -> SecurityContext:
    """Create a user-level security context."""
    return SecurityContext(
        permission_level=PermissionLevel.USER,
        allowed_directories=allowed_directories,
        allow_file_writes=True,
        allow_file_reads=True,
        require_confirmation_for_writes=True,
    )


def create_agent_context(
    allowed_providers: list[str] | None = None,
) -> SecurityContext:
    """
    Create an agent-level security context.
    
    Suitable for automated agents like Ada.
    Note: You must explicitly specify allowed_providers - there is no default.
    """
    if allowed_providers is None:
        raise ValueError(
            "allowed_providers must be explicitly specified for agent context. "
            "Example: create_agent_context(allowed_providers=['anthropic'])"
        )
    return SecurityContext(
        permission_level=PermissionLevel.AGENT,
        allowed_providers=allowed_providers,
        allow_file_writes=False,
        allow_file_reads=True,
        max_iterations=100,
        max_timeout_seconds=60,
    )


def create_readonly_context() -> SecurityContext:
    """Create a read-only security context."""
    return SecurityContext(
        permission_level=PermissionLevel.AGENT,
        allowed_providers=[],  # No providers - can't run tasks
        allow_file_writes=False,
        allow_file_reads=True,
        denied_operations={Operation.RUN_TASK},
    )


# ============================================================================
# Security Audit
# ============================================================================

class SecurityAuditLog:
    """Simple audit log for security events."""
    
    def __init__(self) -> None:
        self._events: list[dict[str, Any]] = []
    
    def log(
        self,
        operation: Operation,
        context: SecurityContext,
        allowed: bool,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Log a security event."""
        import datetime
        
        event = {
            "timestamp": datetime.datetime.now().isoformat(),
            "operation": operation.name,
            "permission_level": context.permission_level.name,
            "allowed": allowed,
            "details": details or {},
        }
        self._events.append(event)
    
    def get_events(self) -> list[dict[str, Any]]:
        """Get all logged events."""
        return self._events.copy()
    
    def clear(self) -> None:
        """Clear the audit log."""
        self._events.clear()


# Global audit log instance
_audit_log = SecurityAuditLog()


def get_audit_log() -> SecurityAuditLog:
    """Get the global audit log."""
    return _audit_log
