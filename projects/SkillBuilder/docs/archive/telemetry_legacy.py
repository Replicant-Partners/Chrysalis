from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class TelemetryRecorder:
    enabled: bool = True
    events: List[Dict[str, Any]] = field(default_factory=list)

    def record(self, event_type: str, data: Dict[str, Any]) -> None:
        if not self.enabled:
            return
        payload = {"ts": time.time(), "type": event_type}
        payload.update(data)
        self.events.append(payload)
