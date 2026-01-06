"""
Enable running skill_builder as a module.

Usage:
    python -m skill_builder run spec.yaml
    python -m skill_builder transform generated-mode.md -f kilocode
    python -m skill_builder validate spec.yaml
"""

from skill_builder.cli import main

if __name__ == "__main__":
    main()
