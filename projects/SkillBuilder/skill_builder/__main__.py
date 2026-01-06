"""
Enable running semantic_mode as a module.

Usage:
    python -m semantic_mode run spec.yaml
    python -m semantic_mode transform generated-mode.md -f kilocode
    python -m semantic_mode validate spec.yaml
"""

from semantic_mode.cli import main

if __name__ == "__main__":
    main()
