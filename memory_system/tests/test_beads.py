import time
from pathlib import Path

import pytest

from memory_system.beads import BeadsService


def test_append_and_recent(tmp_path: Path):
    db_path = tmp_path / "beads.db"
    beads = BeadsService(path=str(db_path), max_items=3)

    ids = [
        beads.append(f"msg-{i}", role="assistant", importance=0.2 + i * 0.1)
        for i in range(4)
    ]
    recent = beads.recent(limit=5)
    # max_items=3 prunes oldest, so should keep last 3
    assert len(recent) == 3
    contents = [r["content"] for r in recent]
    assert "msg-3" in contents and "msg-2" in contents and "msg-1" in contents
    assert "msg-0" not in contents


def test_ttl_pruning(tmp_path: Path):
    db_path = tmp_path / "beads.db"
    beads = BeadsService(path=str(db_path), ttl_seconds=1)

    beads.append("old", ts=time.time() - 5)
    beads.append("new", ts=time.time())

    # trigger prune via append
    beads.append("trigger", ts=time.time())
    recent = beads.recent(limit=10)
    contents = [r["content"] for r in recent]
    assert "old" not in contents
    assert "new" in contents
    assert "trigger" in contents


def test_blob_offload_called(tmp_path: Path):
    db_path = tmp_path / "beads.db"
    captured = {}

    def offload_fn(content: str) -> str:
        captured["content"] = content
        return "s3://bucket/blob"

    beads = BeadsService(path=str(db_path), blob_offload=offload_fn)
    beads.append("big", metadata={"k": "v"})

    assert captured["content"] == "big"
    recent = beads.recent(limit=1)[0]
    assert recent["blob_uri"] == "s3://bucket/blob"
    assert recent["metadata"] == {"k": "v"}