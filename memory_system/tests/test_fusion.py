from typing import Any, Dict, Iterable, List, Optional

from memory_system.beads import BeadsService
from memory_system.fusion import FusionRetriever


class FakeEmbedder:
    def __init__(self, value: float = 0.1):
        self.value = value
        self.calls: List[str] = []

    def embed(self, text: str) -> List[float]:
        self.calls.append(text)
        # simple deterministic vector
        return [self.value, self.value + 0.1]


class FakeZepHooks:
    def __init__(self) -> None:
        self.store_calls: List[List[Dict[str, Any]]] = []
        self.retrieve_calls: List[Dict[str, Any]] = []
        self.retrieve_results: List[Dict[str, Any]] = [{"id": "match"}]
        self.kg_calls: List[Dict[str, Any]] = []
        self.kg_result: Dict[str, Any] = {"nodes": [{"id": "n1"}], "edges": []}

    def on_store_embedding(self, payload: List[Dict[str, Any]]) -> Dict[str, Any]:
        self.store_calls.append(payload)
        return {"status": "ok", "count": len(payload)}

    def on_retrieve_embeddings(self, vector: List[float], k: int = 5) -> List[Dict[str, Any]]:
        self.retrieve_calls.append({"vector": vector, "k": k})
        return self.retrieve_results

    def on_retrieve_kg(
        self,
        node_ids: List[str],
        predicates: Optional[Iterable[str]] = None,
        hops: int = 1,
    ) -> Dict[str, Any]:
        self.kg_calls.append({"node_ids": node_ids, "predicates": list(predicates) if predicates else None, "hops": hops})
        return self.kg_result


def test_fusion_ingest_and_retrieve_local_and_remote(tmp_path):
    beads = BeadsService(path=str(tmp_path / "beads.db"))
    embedder = FakeEmbedder()
    zep_hooks = FakeZepHooks()
    fusion = FusionRetriever(beads=beads, embedder=embedder, zep_hooks=zep_hooks)

    ingest_result = fusion.ingest("hello world", role="user", metadata={"a": 1})
    assert ingest_result["bead_id"]
    assert zep_hooks.store_calls  # remote upsert called
    assert embedder.calls == ["hello world"]

    out = fusion.retrieve("query", bead_limit=3, remote_k=2)
    assert len(out["beads"]) == 1
    assert out["remote_embeddings"] == [{"id": "match"}]
    assert zep_hooks.retrieve_calls[0]["k"] == 2
    assert zep_hooks.retrieve_calls[0]["vector"] == [0.1, 0.2]


def test_fusion_kg_retrieval(tmp_path):
    beads = BeadsService(path=str(tmp_path / "beads.db"))
    embedder = FakeEmbedder()
    zep_hooks = FakeZepHooks()
    fusion = FusionRetriever(beads=beads, embedder=embedder, zep_hooks=zep_hooks)

    beads.append("x")
    out = fusion.retrieve("q", kg_node_ids=["node1"], kg_predicates=["rel"], kg_hops=2, include_remote=False)

    assert out["kg"] == {"nodes": [{"id": "n1"}], "edges": []}
    assert zep_hooks.kg_calls[0]["node_ids"] == ["node1"]
    assert zep_hooks.kg_calls[0]["predicates"] == ["rel"]
    assert zep_hooks.kg_calls[0]["hops"] == 2