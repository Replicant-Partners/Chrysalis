"""
Universal Adapter - Command Line Entry Point

Enables running the Universal Adapter as a module:
    python -m universal_adapter <command> [options]

Examples:
    python -m universal_adapter run simple_qa
    python -m universal_adapter validate task.json
    python -m universal_adapter list --verbose
    python -m universal_adapter help

For programmatic usage, import from the package directly:
    from universal_adapter import run_task, UniversalAdapter
    from universal_adapter.api import run_task, validate_task
    from universal_adapter.slash_commands import execute_slash_command
"""

import sys
from .cli import main

if __name__ == "__main__":
    sys.exit(main())
