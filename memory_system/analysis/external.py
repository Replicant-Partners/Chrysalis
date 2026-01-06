"""
External Knowledge Integration.

YAGO Client for external knowledge base queries via SPARQL.
Supports entity resolution, type retrieval, and fact querying.

Ported from Ludwig's yago_client.py with enhancements.
"""

import hashlib
import json
import sqlite3
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Conditional imports
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    requests = None


@dataclass
class YAGOEntity:
    """YAGO entity with metadata."""
    
    uri: str
    label: str
    description: Optional[str] = None
    schema_type: Optional[str] = None  # Schema.org type
    facts: Dict[str, List[str]] = field(default_factory=dict)
    confidence: float = 1.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "uri": self.uri,
            "label": self.label,
            "description": self.description,
            "schema_type": self.schema_type,
            "facts": self.facts,
            "confidence": self.confidence,
        }


class YAGOClient:
    """
    Client for querying YAGO knowledge base via SPARQL.
    
    Features:
    - Entity resolution by name
    - Type retrieval (Schema.org classes)
    - Fact querying with pagination
    - Local SQLite caching for offline usage
    - Wikidata fallback when YAGO is unavailable
    
    Usage:
        client = YAGOClient(cache_path=Path("./cache/yago.db"))
        
        # Resolve entity
        entities = client.resolve_entity("Albert Einstein")
        for e in entities:
            print(f"{e.label}: {e.schema_type}")
            
        # Get facts
        facts = client.get_entity_facts(entities[0].uri)
        print(facts.get("schema:birthDate"))
    """
    
    # YAGO 4.5 public SPARQL endpoint
    ENDPOINT = "https://yago-knowledge.org/sparql"
    
    # Wikidata fallback
    WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"
    
    # Cache TTL
    CACHE_TTL_DAYS = 30
    
    def __init__(
        self,
        cache_path: Optional[Path] = None,
        timeout: int = 10,
        use_cache: bool = True,
        user_agent: str = "Chrysalis/1.0",
    ):
        """
        Initialize YAGO client.
        
        Args:
            cache_path: Path to SQLite cache (default: in-memory)
            timeout: Request timeout in seconds
            use_cache: Whether to use local cache
            user_agent: User-Agent header for requests
        """
        self.timeout = timeout
        self.use_cache = use_cache
        self.user_agent = user_agent
        
        # Initialize cache
        if cache_path and use_cache:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            self._cache_conn = sqlite3.connect(str(cache_path))
        else:
            self._cache_conn = sqlite3.connect(":memory:")
        
        self._cache_conn.row_factory = sqlite3.Row
        self._init_cache()
    
    def _init_cache(self) -> None:
        """Initialize cache database schema."""
        cursor = self._cache_conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS entity_cache (
                uri TEXT PRIMARY KEY,
                label TEXT,
                description TEXT,
                schema_type TEXT,
                facts TEXT,
                confidence REAL DEFAULT 1.0,
                cached_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS query_cache (
                query_hash TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                response TEXT NOT NULL,
                cached_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)
        
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_entity_label ON entity_cache(label)")
        self._cache_conn.commit()
    
    def _query_hash(self, query: str) -> str:
        """Generate hash for query caching."""
        return hashlib.sha256(query.encode()).hexdigest()[:16]
    
    def _is_cache_valid(self, expires_at: str) -> bool:
        """Check if cached entry is still valid."""
        expires = datetime.fromisoformat(expires_at)
        return datetime.now() < expires
    
    def _sparql_query(
        self, 
        query: str, 
        use_fallback: bool = True
    ) -> Dict[str, Any]:
        """
        Execute SPARQL query against YAGO endpoint.
        
        Args:
            query: SPARQL query string
            use_fallback: Try Wikidata if YAGO fails
            
        Returns:
            Parsed JSON response
        """
        if not REQUESTS_AVAILABLE:
            logger.warning("requests library not available")
            return {"results": {"bindings": []}}
        
        # Check cache
        if self.use_cache:
            query_hash = self._query_hash(query)
            cursor = self._cache_conn.cursor()
            cursor.execute(
                "SELECT response, expires_at FROM query_cache WHERE query_hash = ?",
                (query_hash,)
            )
            row = cursor.fetchone()
            
            if row and self._is_cache_valid(row["expires_at"]):
                return json.loads(row["response"])
        
        # Make request
        headers = {
            "Accept": "application/sparql-results+json",
            "User-Agent": self.user_agent,
        }
        
        try:
            response = requests.post(
                self.ENDPOINT,
                data={"query": query},
                headers=headers,
                timeout=self.timeout,
            )
            response.raise_for_status()
            result = response.json()
            
        except Exception as e:
            logger.warning(f"YAGO query failed: {e}")
            
            if use_fallback:
                try:
                    response = requests.post(
                        self.WIKIDATA_ENDPOINT,
                        data={"query": query, "format": "json"},
                        headers=headers,
                        timeout=self.timeout,
                    )
                    response.raise_for_status()
                    result = response.json()
                except Exception as e2:
                    logger.error(f"Fallback query also failed: {e2}")
                    return {"results": {"bindings": []}}
            else:
                return {"results": {"bindings": []}}
        
        # Cache result
        if self.use_cache:
            query_hash = self._query_hash(query)
            now = datetime.now()
            expires = now + timedelta(days=self.CACHE_TTL_DAYS)
            
            cursor = self._cache_conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO query_cache
                (query_hash, query, response, cached_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    query_hash,
                    query,
                    json.dumps(result),
                    now.isoformat(),
                    expires.isoformat(),
                )
            )
            self._cache_conn.commit()
        
        return result
    
    def _escape_sparql(self, text: str) -> str:
        """Escape string for SPARQL literal."""
        return text.replace("\\", "\\\\").replace('"', '\\"')
    
    def resolve_entity(self, name: str, limit: int = 5) -> List[YAGOEntity]:
        """
        Resolve entity by name to YAGO URIs.
        
        Args:
            name: Entity name to search for
            limit: Maximum number of results
            
        Returns:
            List of matching YAGO entities
        """
        escaped_name = self._escape_sparql(name)
        
        query = f"""
        PREFIX schema: <http://schema.org/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT DISTINCT ?entity ?label ?type ?description
        WHERE {{
            ?entity rdfs:label "{escaped_name}"@en .
            ?entity a ?type .
            OPTIONAL {{ ?entity schema:description ?description . }}
            BIND("{escaped_name}" AS ?label)
            FILTER(STRSTARTS(STR(?type), "http://schema.org/"))
        }}
        LIMIT {limit}
        """
        
        result = self._sparql_query(query)
        entities = []
        
        for binding in result.get("results", {}).get("bindings", []):
            uri = binding.get("entity", {}).get("value", "")
            label = binding.get("label", {}).get("value", name)
            schema_type = binding.get("type", {}).get("value", "")
            description = binding.get("description", {}).get("value")
            
            # Simplify Schema.org type
            if schema_type.startswith("http://schema.org/"):
                schema_type = "schema:" + schema_type.split("/")[-1]
            
            entities.append(YAGOEntity(
                uri=uri,
                label=label,
                description=description,
                schema_type=schema_type,
                facts={},
            ))
        
        return entities
    
    def get_entity_facts(
        self, 
        entity_uri: str, 
        limit: int = 20
    ) -> Dict[str, List[str]]:
        """
        Get facts about an entity.
        
        Args:
            entity_uri: YAGO entity URI
            limit: Maximum facts to retrieve
            
        Returns:
            Dictionary mapping property names to values
        """
        # Validate URI
        unsafe_chars = ['<', '>', '"', '{', '}', '|', '^', '`', '\\']
        if any(c in entity_uri for c in unsafe_chars):
            logger.warning(f"Unsafe characters in URI: {entity_uri}")
            return {}
        
        query = f"""
        PREFIX schema: <http://schema.org/>
        
        SELECT ?property ?value
        WHERE {{
            <{entity_uri}> ?property ?value .
            FILTER(
                STRSTARTS(STR(?property), "http://schema.org/") ||
                STRSTARTS(STR(?property), "http://www.w3.org/2000/01/rdf-schema#")
            )
        }}
        LIMIT {limit}
        """
        
        result = self._sparql_query(query)
        facts: Dict[str, List[str]] = {}
        
        for binding in result.get("results", {}).get("bindings", []):
            prop = binding.get("property", {}).get("value", "")
            value = binding.get("value", {}).get("value", "")
            
            # Simplify property names
            if prop.startswith("http://schema.org/"):
                prop = "schema:" + prop.split("/")[-1]
            elif prop.startswith("http://www.w3.org/2000/01/rdf-schema#"):
                prop = "rdfs:" + prop.split("#")[-1]
            
            if prop not in facts:
                facts[prop] = []
            facts[prop].append(value)
        
        return facts
    
    def get_entity_type(self, entity_uri: str) -> Optional[str]:
        """
        Get Schema.org type for entity.
        
        Args:
            entity_uri: YAGO entity URI
            
        Returns:
            Schema.org type or None
        """
        unsafe_chars = ['<', '>', '"', '{', '}', '|', '^', '`', '\\']
        if any(c in entity_uri for c in unsafe_chars):
            return None
        
        query = f"""
        PREFIX schema: <http://schema.org/>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        
        SELECT ?type
        WHERE {{
            <{entity_uri}> rdf:type ?type .
            FILTER(STRSTARTS(STR(?type), "http://schema.org/"))
        }}
        LIMIT 1
        """
        
        result = self._sparql_query(query)
        bindings = result.get("results", {}).get("bindings", [])
        
        if not bindings:
            return None
        
        type_uri = bindings[0].get("type", {}).get("value", "")
        if type_uri.startswith("http://schema.org/"):
            return "schema:" + type_uri.split("/")[-1]
        
        return None
    
    def search_entities(self, query_text: str, limit: int = 10) -> List[YAGOEntity]:
        """
        Search for entities by text.
        
        Args:
            query_text: Search query
            limit: Maximum results
            
        Returns:
            List of matching entities
        """
        return self.resolve_entity(query_text, limit=limit)
    
    def clear_cache(self) -> None:
        """Clear all cached data."""
        cursor = self._cache_conn.cursor()
        cursor.execute("DELETE FROM entity_cache")
        cursor.execute("DELETE FROM query_cache")
        self._cache_conn.commit()
    
    def get_cache_stats(self) -> Dict[str, int]:
        """Get cache statistics."""
        cursor = self._cache_conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as count FROM entity_cache")
        entity_count = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM query_cache")
        query_count = cursor.fetchone()["count"]
        
        now = datetime.now().isoformat()
        cursor.execute(
            "SELECT COUNT(*) as count FROM query_cache WHERE expires_at < ?",
            (now,)
        )
        expired = cursor.fetchone()["count"]
        
        return {
            "cached_entities": entity_count,
            "cached_queries": query_count,
            "expired_queries": expired,
            "cache_ttl_days": self.CACHE_TTL_DAYS,
        }
    
    def close(self) -> None:
        """Close cache connection."""
        if self._cache_conn:
            self._cache_conn.close()
