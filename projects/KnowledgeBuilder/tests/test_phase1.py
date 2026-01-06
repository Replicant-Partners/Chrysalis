import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

import numpy as np
import pytest

from src.collectors.brave_search_collector import BraveSearchCollector
from src.storage.lancedb_client import LanceDBClient
from src.storage.sqlite_cache import SQLiteCache


def test_sqlite_cache_roundtrip(tmp_path):
    """SQLiteCache stores and retrieves metadata."""
    cache = SQLiteCache(db_path=str(tmp_path / "cache.db"))
    cache.set_metadata(
        "entity_1",
        {
            "entity_type": "Person",
            "quality_score": 0.85,
            "trust_score": 0.9,
            "completeness": 0.7,
            "attributes": {"summary": "Test"},
        },
    )

    metadata = cache.get_metadata("entity_1")
    assert metadata is not None
    assert metadata["quality_score"] == 0.85
    assert metadata["attributes"]["summary"] == "Test"


def test_lancedb_insert_and_search(tmp_path):
    """Insert and search a vector in LanceDB (skips if lancedb missing)."""
    pytest.importorskip("lancedb")

    uri = f"{tmp_path}/lancedb"
    client = LanceDBClient(uri=uri, vector_dim=8)

    embedding = np.random.rand(8)  # small vector for test
    entity = {
        "id": "entity_1",
        "name": "Test Entity",
        "type": "Person",
        "text": "Test description",
    }
    client.insert_entity(entity, embedding)

    results = client.search(embedding, k=1)
    assert len(results) == 1
    assert results[0]["entity_name"] == "Test Entity"


def test_brave_collector_parses_snippets(monkeypatch):
    """BraveSearchCollector extracts simple attributes from mocked response."""

    class DummyResponse:
        def __init__(self, payload):
            self._payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self._payload

    payload = {
        "web": {
            "results": [
                {
                    "title": "Official Site - Example",
                    "description": "Example person, born in Example City.",
                    "url": "https://example.com",
                }
            ]
        }
    }

    def _fake_get(url, headers, params, timeout):
        return DummyResponse(payload)

    monkeypatch.setattr("requests.get", _fake_get)
    collector = BraveSearchCollector(api_key="dummy")
    result = collector.collect("Example Person", "Person")

    assert result["attributes"]["summary"] == "Example person, born in Example City."
    assert result["attributes"]["official_site"] == "https://example.com"
