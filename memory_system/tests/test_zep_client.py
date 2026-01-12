import json
from typing import Any, Dict, List

import pytest

from memory_system.hooks.zep_client import ZepClient, ZepClientError


class _FakeResponse:
    def __init__(self, status_code: int = 200, payload: Dict[str, Any] | None = None, text: str = ""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text
        self.content = b"" if payload is None else json.dumps(payload).encode("utf-8")

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise ZepClientError(f"status {self.status_code}")

    def json(self) -> Dict[str, Any]:
        return self._payload


class _FakeSession:
    def __init__(self, responses: List[_FakeResponse]):
        self._responses = responses
        self.calls: List[Dict[str, Any]] = []

    def post(self, url: str, headers: Dict[str, str], data: str, timeout: float):
        self.calls.append({"url": url, "headers": headers, "data": data, "timeout": timeout})
        if not self._responses:
            raise AssertionError("No fake responses left")
        return self._responses.pop(0)


def test_upsert_embeddings_success():
    responses = [_FakeResponse(status_code=200, payload={})]
    session = _FakeSession(responses)
    client = ZepClient(endpoint="http://zep.local", api_key="k", project="p", session=session)

    client.upsert_embeddings([{"id": "1", "embedding": [0.1], "metadata": {}}])

    assert session.calls[0]["url"] == "http://zep.local/vectors/upsert"
    payload = json.loads(session.calls[0]["data"])
    assert payload["project"] == "p"
    assert payload["vectors"][0]["id"] == "1"


def test_query_embeddings_returns_matches():
    responses = [_FakeResponse(status_code=200, payload={"matches": [{"id": "n1"}, {"id": "n2"}]})]
    session = _FakeSession(responses)
    client = ZepClient(endpoint="http://zep.local", project="proj", session=session)

    matches = client.query_embeddings([0.1, 0.2], k=2)

    assert len(matches) == 2
    payload = json.loads(session.calls[0]["data"])
    assert payload["k"] == 2
    assert payload["vector"] == [0.1, 0.2]


def test_upsert_kg_and_query_kg():
    responses = [
        _FakeResponse(status_code=200, payload={}),  # upsert
        _FakeResponse(status_code=200, payload={"nodes": [{"id": "A"}], "edges": []}),  # query
    ]
    session = _FakeSession(responses)
    client = ZepClient(endpoint="http://zep.local", project="kgproj", session=session)

    client.upsert_kg([{"id": "A"}], [{"source": "A", "target": "B"}])
    kg_result = client.query_kg(node_ids=["A"], predicates=["rel"], hops=2)

    assert session.calls[0]["url"] == "http://zep.local/kg/upsert"
    upsert_payload = json.loads(session.calls[0]["data"])
    assert upsert_payload["nodes"][0]["id"] == "A"

    assert kg_result["nodes"][0]["id"] == "A"
    query_payload = json.loads(session.calls[1]["data"])
    assert query_payload["node_ids"] == ["A"]
    assert query_payload["predicates"] == ["rel"]
    assert query_payload["hops"] == 2


def test_retries_and_error_raise_on_failure():
    # three failing responses to trigger retry exhaustion
    responses = [
        _FakeResponse(status_code=500, payload=None, text="server error"),
        _FakeResponse(status_code=500, payload=None, text="server error"),
        _FakeResponse(status_code=500, payload=None, text="server error"),
    ]
    session = _FakeSession(responses)
    client = ZepClient(endpoint="http://zep.local", retries=3, backoff_seconds=0, session=session)

    with pytest.raises(ZepClientError):
        client.upsert_embeddings([{"id": "1", "embedding": [0.1]}])