import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

import numpy as np
import pyarrow as pa

logger = logging.getLogger(__name__)

# Schema field definitions - single source of truth
# Format: (field_name, pyarrow_type, is_filterable)
# Note: vector field has None type - handled specially with vector_dim
_SCHEMA_FIELDS = [
    ("id", pa.string(), True),
    ("entity_name", pa.string(), True),
    ("entity_type", pa.string(), True),
    ("text", pa.string(), False),  # Not filterable - too large
    ("vector", None, False),  # Special handling for vector field
    ("quality_score", pa.float32(), True),
    ("trust_score", pa.float32(), True),
    ("completeness_score", pa.float32(), True),
    ("created_at", pa.string(), True),
]

# Derive allowed filter columns from schema definition
ALLOWED_FILTER_COLUMNS: Set[str] = {
    field[0] for field in _SCHEMA_FIELDS if field[2]
}


class LanceDBClient:
    """
    Lightweight LanceDB client wrapper.

    Responsibilities:
    - Create table if missing
    - Insert entity vectors with metadata
    - Perform similarity search with safe filtering
    """

    def __init__(
        self,
        uri: str,
        api_key: Optional[str] = None,
        table_name: str = "knowledgebuilder_entities",
        vector_dim: int = 3072,
    ) -> None:
        try:
            import lancedb
        except ImportError as exc:  # pragma: no cover - handled at runtime
            raise ImportError("lancedb is required for LanceDBClient") from exc

        self._lancedb = lancedb
        self.uri = uri
        self.api_key = api_key
        self.table_name = table_name
        self.vector_dim = vector_dim
        self.db = self._connect()
        self._ensure_table()

    def _connect(self):
        if self.api_key:
            return self._lancedb.connect(self.uri, api_key=self.api_key)
        return self._lancedb.connect(self.uri)

    def _ensure_table(self) -> None:
        """Create table if it does not exist.
        
        Schema is derived from _SCHEMA_FIELDS to maintain single source of truth.
        """
        if self.table_name in self.db.list_tables():
            return

        # Build schema from _SCHEMA_FIELDS
        fields = []
        for field_name, field_type, _ in _SCHEMA_FIELDS:
            if field_name == "vector":
                # Vector field needs special handling with dimension
                fields.append(pa.field("vector", pa.list_(pa.float32(), self.vector_dim)))
            else:
                fields.append(pa.field(field_name, field_type))
        
        schema = pa.schema(fields)
        logger.info("Creating LanceDB table %s", self.table_name)
        self.db.create_table(self.table_name, schema=schema)

    def insert_entity(self, entity: Dict[str, Any], embedding: np.ndarray) -> None:
        """Insert a single entity with embedding."""
        table = self.db.open_table(self.table_name)
        table.add(
            [
                {
                    "id": entity["id"],
                    "entity_name": entity["name"],
                    "entity_type": entity.get("type", ""),
                    "text": entity.get("text", ""),
                    "vector": embedding,
                    "quality_score": float(entity.get("quality_score", 0.0)),
                    "trust_score": float(entity.get("trust_score", 0.0)),
                    "completeness_score": float(entity.get("completeness_score", 0.0)),
                    "created_at": entity.get("created_at", datetime.now(timezone.utc).isoformat()),
                }
            ]
        )

    def _validate_filter_key(self, key: str) -> bool:
        """Validate that a filter key is in the allowed set."""
        return key in ALLOWED_FILTER_COLUMNS

    def _escape_filter_value(self, value: Any) -> str:
        """
        Safely escape a filter value for use in LanceDB where clause.
        
        LanceDB uses SQL-like syntax, so we need to:
        1. Convert to string
        2. Escape single quotes by doubling them
        3. Remove any potentially dangerous characters
        """
        if value is None:
            return "NULL"
        
        str_value = str(value)
        
        # Remove any control characters or null bytes
        str_value = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', str_value)
        
        # Escape single quotes by doubling them (SQL standard)
        str_value = str_value.replace("'", "''")
        
        return str_value

    def search(
        self,
        query_embedding: np.ndarray,
        k: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Similarity search with optional metadata filters.
        
        Args:
            query_embedding: Vector to search for
            k: Number of results to return
            filters: Optional dict of column -> value filters
                     Only columns in ALLOWED_FILTER_COLUMNS are permitted
        
        Returns:
            List of matching records with similarity scores
        
        Raises:
            ValueError: If an invalid filter column is provided
        """
        table = self.db.open_table(self.table_name)
        search = table.search(query_embedding)
        
        if filters:
            for key, value in filters.items():
                # Validate the filter key
                if not self._validate_filter_key(key):
                    raise ValueError(
                        f"Invalid filter column: '{key}'. "
                        f"Allowed columns: {sorted(ALLOWED_FILTER_COLUMNS)}"
                    )
                
                # Escape the value and build safe where clause
                escaped_value = self._escape_filter_value(value)
                
                # Handle different value types appropriately
                if value is None:
                    where_clause = f"{key} IS NULL"
                elif isinstance(value, (int, float)):
                    where_clause = f"{key} = {value}"
                else:
                    where_clause = f"{key} = '{escaped_value}'"
                
                search = search.where(where_clause)
        
        return search.limit(k).to_list()

    def delete_entity(self, entity_id: str) -> None:
        """Delete an entity by ID."""
        table = self.db.open_table(self.table_name)
        # Escape the entity_id for safety
        escaped_id = self._escape_filter_value(entity_id)
        table.delete(f"id = '{escaped_id}'")

    def count(self) -> int:
        """Return the number of entities in the table."""
        table = self.db.open_table(self.table_name)
        return table.count_rows()
