"""
Task Library - Named task registry for the Universal Adapter.

Provides a lightweight mechanism to load task.json files by task name
so calling code can invoke `adapter.execute("simple_qa")` instead of
managing file paths directly.
"""

from __future__ import annotations
from pathlib import Path
from typing import Mapping, Iterable

from .schema import TaskSchema


class TaskLibrary:
    """Immutable registry mapping task names to JSON file paths."""

    def __init__(self, task_map: Mapping[str, str]) -> None:
        self._tasks = {name: Path(path) for name, path in task_map.items()}

    def list_tasks(self) -> list[str]:
        """Return available task names."""
        return sorted(self._tasks.keys())

    def get_path(self, name: str) -> Path | None:
        """Get the file path for a task name."""
        return self._tasks.get(name)

    def load(self, name: str) -> TaskSchema:
        """Load a task by name."""
        path = self.get_path(name)
        if not path:
            raise ValueError(f"Unknown task '{name}'. Available: {', '.join(self.list_tasks())}")
        if not path.exists():
            raise FileNotFoundError(f"Task file not found for '{name}': {path}")
        return TaskSchema.from_file(str(path))

    @classmethod
    def from_pairs(cls, pairs: Iterable[tuple[str, str]]) -> TaskLibrary:
        """Create a TaskLibrary from iterable of (name, path)."""
        return cls({name: path for name, path in pairs})


# Default task library pointing at bundled examples
BASE_DIR = Path(__file__).parent
DEFAULT_TASK_LIBRARY = TaskLibrary({
    "simple_qa": str(BASE_DIR / "examples/simple_qa_task.json"),
    "research_synthesis": str(BASE_DIR / "examples/research_task.json"),
    "agent_quick_config": str(BASE_DIR / "examples/agent_quick_config_task.json"),
    "protocol_translation": str(BASE_DIR / "examples/protocol_translation_task.json"),
    "agent_morphing": str(BASE_DIR / "examples/agent_morph_task.json"),
    "flow_guardrail": str(BASE_DIR / "examples/flow_guardrail_task.json"),
    "mcp_request_dispatch": str(BASE_DIR / "examples/mcp_request_dispatch_task.json"),
    "experience_sync_protocol": str(BASE_DIR / "examples/experience_sync_protocol_task.json"),
    "bridge_translation_pipeline": str(BASE_DIR / "examples/bridge_translation_pipeline_task.json"),
    "agent_registry_bootstrap": str(BASE_DIR / "examples/agent_registry_bootstrap_task.json"),
    "serena_tool_router": str(BASE_DIR / "examples/serena_tool_router_task.json"),
    "converter_pipeline": str(BASE_DIR / "examples/converter_pipeline_task.json"),
})
