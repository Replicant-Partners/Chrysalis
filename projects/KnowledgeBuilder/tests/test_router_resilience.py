import pytest
import time

from src.pipeline.router import SearchOrchestrator
from src.utils.telemetry import TelemetryRecorder


class FlakyBrave:
    def __init__(self):
        self.calls = 0

    def collect(self, identifier, entity_type=None):
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("temporary failure")
        return {
            "attributes": {"summary": "ok"},
            "urls": ["https://example.com"],
            "source": "brave_search",
            "confidence": 0.7,
            "cost": 0.001,
        }


class DummyBrave:
    def collect(self, identifier, entity_type=None):
        return {
            "attributes": {"summary": "stub"},
            "urls": [],
            "source": "brave_search",
            "confidence": 0.7,
            "cost": 0.001,
        }


class TrackingExa:
    def __init__(self):
        self.calls = 0

    def collect(self, query, entity_type=None, num_results=10):
        self.calls += 1
        return {
            "source": "exa",
            "attributes": {"extra": "data"},
            "urls": [],
            "snippets": [],
            "confidence": 0.6,
            "cost": 0.06,
        }


class FailingExa(TrackingExa):
    def collect(self, query, entity_type=None, num_results=10):
        self.calls += 1
        raise RuntimeError("boom")


def test_brave_retries_and_succeeds(tmp_path):
    telemetry = TelemetryRecorder(db_path=str(tmp_path / "telemetry.db"))
    brave = FlakyBrave()
    orchestrator = SearchOrchestrator(
        use_exa=False,
        use_firecrawl=False,
        use_tavily=False,
        retry_attempts=2,
        brave=brave,
        telemetry=telemetry,
        max_cost=0.01,
    )

    result = orchestrator.collect("Example Person", "Person")

    assert brave.calls == 2
    assert result["attributes"]["summary"] == "ok"
    summary = telemetry.summary()
    assert summary["brave"]["calls"] == 1
    assert summary["brave"]["success"] == 1


def test_exa_skipped_when_budget_insufficient(tmp_path):
    telemetry = TelemetryRecorder(db_path=str(tmp_path / "telemetry.db"))
    exa = TrackingExa()
    orchestrator = SearchOrchestrator(
        use_exa=True,
        use_firecrawl=False,
        use_tavily=False,
        brave=DummyBrave(),
        exa_client=exa,
        telemetry=telemetry,
        max_cost=0.0015,  # brave consumes almost everything
        retry_attempts=1,
    )

    result = orchestrator.collect("Example Person", "Person")

    assert exa.calls == 0  # skipped due to budget
    assert result["attributes"]["summary"] == "stub"
    summary = telemetry.summary()
    assert summary["exa"]["calls"] == 1
    assert summary["exa"]["success"] == 0
    assert summary["exa"]["cost"] == 0.0


def test_exa_failures_recorded_and_dont_break_pipeline(tmp_path):
    telemetry = TelemetryRecorder(db_path=str(tmp_path / "telemetry.db"))
    exa = FailingExa()
    orchestrator = SearchOrchestrator(
        use_exa=True,
        use_firecrawl=False,
        use_tavily=False,
        brave=DummyBrave(),
        exa_client=exa,
        telemetry=telemetry,
        max_cost=0.2,
        retry_attempts=2,
    )

    result = orchestrator.collect("Example Person", "Person")

    # Retry twice, but propagate fallback to keep pipeline alive
    assert exa.calls == 2
    assert result["attributes"]["summary"] == "stub"
    summary = telemetry.summary()
    assert summary["exa"]["calls"] == 1
    assert summary["exa"]["success"] == 0


def test_timeout_guard_records_failure(tmp_path):
    telemetry = TelemetryRecorder(db_path=str(tmp_path / "telemetry.db"))

    class SlowBrave:
        def collect(self, identifier, entity_type=None):
            time.sleep(0.2)
            return {
                "attributes": {"summary": "slow"},
                "urls": [],
                "source": "brave_search",
                "confidence": 0.7,
                "cost": 0.001,
            }

    orchestrator = SearchOrchestrator(
        use_exa=False,
        use_firecrawl=False,
        use_tavily=False,
        brave=SlowBrave(),
        telemetry=telemetry,
        per_source_timeout=0.05,
        retry_attempts=1,
        max_cost=0.01,
    )

    result = orchestrator.collect("Timeout Example", "Person")
    # Should return empty attrs because the only call timed out
    assert result["attributes"].get("summary") is None
    summary = telemetry.summary()
    assert summary["brave"]["calls"] == 1
    assert summary["brave"]["success"] == 0
