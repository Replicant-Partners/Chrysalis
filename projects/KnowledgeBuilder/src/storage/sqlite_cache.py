import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class SQLiteCache:
    """
    SQLite-based cache for entity metadata.

    Tables:
        - entity_metadata: stores quality/trust/completeness and timestamps
    """

    def __init__(self, db_path: str = "./data/cache.db") -> None:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self._conn = sqlite3.connect(self.db_path)
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS entity_metadata (
                entity_id TEXT PRIMARY KEY,
                entity_type TEXT,
                quality_score REAL,
                trust_score REAL,
                completeness REAL,
                model TEXT,
                model_version TEXT,
                attributes TEXT,
                extracted_facts TEXT,
                created_at TEXT,
                updated_at TEXT
            )
            """
        )
        self._conn.commit()

    def set_metadata(self, entity_id: str, metadata: Dict[str, Any]) -> None:
        """Insert or update metadata."""
        now = datetime.now(timezone.utc).isoformat()
        self._conn.execute(
            """
            INSERT OR REPLACE INTO entity_metadata (
                entity_id, entity_type, quality_score, trust_score, completeness,
                model, model_version, attributes, extracted_facts, created_at, updated_at
            )
            VALUES (
                :entity_id,
                :entity_type,
                :quality_score,
                :trust_score,
                :completeness,
                :model,
                :model_version,
                :attributes,
                :extracted_facts,
                COALESCE((SELECT created_at FROM entity_metadata WHERE entity_id = :entity_id), :created_at),
                :updated_at
            )
            """,
            {
                "entity_id": entity_id,
                "entity_type": metadata.get("entity_type"),
                "quality_score": metadata.get("quality_score", 0.0),
                "trust_score": metadata.get("trust_score", 0.0),
                "completeness": metadata.get("completeness", 0.0),
                "model": metadata.get("model"),
                "model_version": metadata.get("model_version"),
                "attributes": json.dumps(metadata.get("attributes", {})),
                "extracted_facts": json.dumps(metadata.get("extracted_facts", {})),
                "created_at": now,
                "updated_at": now,
            },
        )
        self._conn.commit()

    def get_metadata(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve metadata by entity_id."""
        row = self._conn.execute(
            """
            SELECT entity_id, entity_type, quality_score, trust_score, completeness,
                   model, model_version, attributes, extracted_facts, created_at, updated_at
            FROM entity_metadata
            WHERE entity_id = ?
            """,
            (entity_id,),
        ).fetchone()

        if not row:
            return None

        return {
            "entity_id": row[0],
            "entity_type": row[1],
            "quality_score": row[2],
            "trust_score": row[3],
            "completeness": row[4],
            "model": row[5],
            "model_version": row[6],
            "attributes": json.loads(row[7]),
            "extracted_facts": json.loads(row[8]) if row[8] else {},
            "created_at": row[9],
            "updated_at": row[10],
        }
