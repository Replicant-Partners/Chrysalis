"""
Schema.org-based Ground Truth Resolver.

This module provides entity type resolution and scaffolding based on Schema.org
taxonomy. It replaces the deprecated YAGO approach with a web-search-augmented
Schema.org type system.

Design rationale:
- Schema.org is the industry standard maintained by Google, Microsoft, Yahoo, Yandex
- Adopted by 31.3% of all websites (as of 2020)
- Provides stable, well-documented entity types
- Web search provides dynamic context for type inference
"""

import logging
import sqlite3
import os
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set
from enum import Enum

logger = logging.getLogger(__name__)


class SchemaType(Enum):
    """Core Schema.org entity types supported by KnowledgeBuilder."""
    PERSON = "schema:Person"
    ORGANIZATION = "schema:Organization"
    PLACE = "schema:Place"
    PRODUCT = "schema:Product"
    CREATIVE_WORK = "schema:CreativeWork"
    EVENT = "schema:Event"
    THING = "schema:Thing"  # Fallback for concepts


@dataclass
class EntitySchema:
    """Schema.org-aligned entity scaffold with mandatory and optional attributes."""
    
    type: SchemaType
    mandatory_attrs: List[str]
    optional_attrs: List[str]
    search_hints: List[str]  # Keywords to enhance search queries
    
    
# Schema.org type definitions with attribute scaffolds
SCHEMA_DEFINITIONS: Dict[SchemaType, EntitySchema] = {
    SchemaType.PERSON: EntitySchema(
        type=SchemaType.PERSON,
        mandatory_attrs=["name", "description"],
        optional_attrs=[
            "birthDate", "deathDate", "birthPlace", "nationality",
            "occupation", "affiliation", "alumniOf", "award",
            "sameAs", "url", "image"
        ],
        search_hints=["biography", "profile", "career", "background"]
    ),
    SchemaType.ORGANIZATION: EntitySchema(
        type=SchemaType.ORGANIZATION,
        mandatory_attrs=["name", "description"],
        optional_attrs=[
            "foundingDate", "founder", "headquarters", "numberOfEmployees",
            "industry", "parentOrganization", "subOrganization",
            "sameAs", "url", "logo"
        ],
        search_hints=["company", "organization", "founded", "headquarters"]
    ),
    SchemaType.PLACE: EntitySchema(
        type=SchemaType.PLACE,
        mandatory_attrs=["name", "description"],
        optional_attrs=[
            "geo", "address", "containedInPlace", "containsPlace",
            "population", "timezone", "sameAs", "url", "image"
        ],
        search_hints=["location", "geography", "city", "country", "region"]
    ),
    SchemaType.PRODUCT: EntitySchema(
        type=SchemaType.PRODUCT,
        mandatory_attrs=["name", "description"],
        optional_attrs=[
            "brand", "manufacturer", "model", "releaseDate",
            "category", "offers", "review", "sameAs", "url", "image"
        ],
        search_hints=["product", "features", "specifications", "review"]
    ),
    SchemaType.CREATIVE_WORK: EntitySchema(
        type=SchemaType.CREATIVE_WORK,
        mandatory_attrs=["name", "description"],
        optional_attrs=[
            "author", "creator", "datePublished", "publisher",
            "genre", "inLanguage", "award", "sameAs", "url"
        ],
        search_hints=["book", "film", "article", "publication", "work"]
    ),
    SchemaType.EVENT: EntitySchema(
        type=SchemaType.EVENT,
        mandatory_attrs=["name", "description"],
        optional_attrs=[
            "startDate", "endDate", "location", "organizer",
            "performer", "attendee", "sameAs", "url"
        ],
        search_hints=["event", "conference", "meeting", "date", "venue"]
    ),
    SchemaType.THING: EntitySchema(
        type=SchemaType.THING,
        mandatory_attrs=["name", "description"],
        optional_attrs=["sameAs", "url", "image"],
        search_hints=["concept", "definition", "meaning"]
    ),
}


@dataclass
class ResolvedEntity:
    """Result of entity resolution with Schema.org typing."""
    
    name: str
    schema_type: SchemaType
    confidence: float
    schema_uri: str
    mandatory_attrs: List[str]
    optional_attrs: List[str]
    search_hints: List[str]
    inferred_context: Dict[str, Any] = field(default_factory=dict)
    cached_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "schema_type": self.schema_type.value,
            "confidence": self.confidence,
            "schema_uri": self.schema_uri,
            "mandatory_attrs": self.mandatory_attrs,
            "optional_attrs": self.optional_attrs,
            "search_hints": self.search_hints,
            "inferred_context": self.inferred_context,
            "cached_at": self.cached_at.isoformat() if self.cached_at else None,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ResolvedEntity":
        return cls(
            name=data["name"],
            schema_type=SchemaType(data["schema_type"]),
            confidence=data["confidence"],
            schema_uri=data["schema_uri"],
            mandatory_attrs=data["mandatory_attrs"],
            optional_attrs=data["optional_attrs"],
            search_hints=data["search_hints"],
            inferred_context=data.get("inferred_context", {}),
            cached_at=datetime.fromisoformat(data["cached_at"]) if data.get("cached_at") else None,
        )


class SchemaResolver:
    """
    Schema.org-based entity type resolver with caching.
    
    This replaces the deprecated YAGO approach with Schema.org scaffolding.
    Entity types are inferred from:
    1. Explicit type hints provided by the caller
    2. Context clues from web search results
    3. Keyword matching against Schema.org type definitions
    
    Caching:
    - Resolved entities are cached in SQLite with 7-day TTL
    - Cache reduces redundant type inference for known entities
    """
    
    CACHE_TTL_DAYS = 7
    
    # Type inference keywords (lowercase)
    TYPE_KEYWORDS: Dict[SchemaType, Set[str]] = {
        SchemaType.PERSON: {
            "person", "people", "ceo", "founder", "author", "scientist",
            "professor", "researcher", "artist", "musician", "actor",
            "politician", "athlete", "engineer", "developer"
        },
        SchemaType.ORGANIZATION: {
            "company", "corporation", "organization", "institution",
            "university", "agency", "foundation", "startup", "firm",
            "inc", "llc", "ltd", "corp"
        },
        SchemaType.PLACE: {
            "city", "country", "state", "region", "location", "place",
            "town", "village", "continent", "island", "mountain", "river"
        },
        SchemaType.PRODUCT: {
            "product", "software", "app", "application", "tool",
            "device", "gadget", "service", "platform"
        },
        SchemaType.CREATIVE_WORK: {
            "book", "film", "movie", "article", "paper", "publication",
            "album", "song", "painting", "novel", "documentary"
        },
        SchemaType.EVENT: {
            "event", "conference", "summit", "meeting", "festival",
            "concert", "exhibition", "ceremony", "competition"
        },
    }
    
    def __init__(self, cache_path: str = "./data/schema_cache.db") -> None:
        os.makedirs(os.path.dirname(cache_path) or ".", exist_ok=True)
        self.cache_path = cache_path
        self._conn = sqlite3.connect(cache_path)
        self._init_cache_schema()
    
    def _init_cache_schema(self) -> None:
        """Create cache table for resolved entities."""
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_cache (
                entity_name TEXT PRIMARY KEY,
                schema_type TEXT NOT NULL,
                confidence REAL NOT NULL,
                schema_uri TEXT NOT NULL,
                mandatory_attrs TEXT NOT NULL,
                optional_attrs TEXT NOT NULL,
                search_hints TEXT NOT NULL,
                inferred_context TEXT,
                cached_at TEXT NOT NULL
            )
        """)
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_schema_cache_type ON schema_cache(schema_type)"
        )
        self._conn.commit()
    
    def resolve(
        self,
        name: str,
        type_hint: Optional[str] = None,
        context: Optional[str] = None
    ) -> ResolvedEntity:
        """
        Resolve an entity name to a Schema.org type with scaffolding.
        
        Args:
            name: Entity name to resolve
            type_hint: Optional explicit type (e.g., "Person", "Organization")
            context: Optional context string to aid type inference
        
        Returns:
            ResolvedEntity with Schema.org type and attribute scaffold
        """
        # Check cache first
        cached = self._get_cached(name)
        if cached and not self._is_expired(cached):
            logger.debug("Cache hit for entity: %s", name)
            return cached
        
        # Infer type
        schema_type, confidence = self._infer_type(name, type_hint, context)
        schema_def = SCHEMA_DEFINITIONS[schema_type]
        
        # Build resolved entity
        resolved = ResolvedEntity(
            name=name,
            schema_type=schema_type,
            confidence=confidence,
            schema_uri=f"https://schema.org/{schema_type.name.title()}",
            mandatory_attrs=schema_def.mandatory_attrs.copy(),
            optional_attrs=schema_def.optional_attrs.copy(),
            search_hints=schema_def.search_hints.copy(),
            inferred_context={"type_hint": type_hint, "context_provided": bool(context)},
            cached_at=datetime.now(timezone.utc),
        )
        
        # Cache the result
        self._cache_entity(resolved)
        
        return resolved
    
    def _infer_type(
        self,
        name: str,
        type_hint: Optional[str],
        context: Optional[str]
    ) -> tuple[SchemaType, float]:
        """
        Infer Schema.org type from name, hint, and context.
        
        Returns:
            Tuple of (SchemaType, confidence)
        """
        # If explicit type hint provided, use it with high confidence
        if type_hint:
            normalized_hint = type_hint.lower().strip()
            for schema_type in SchemaType:
                if normalized_hint in schema_type.name.lower():
                    return schema_type, 0.95
                # Check aliases
                if schema_type in self.TYPE_KEYWORDS:
                    if normalized_hint in self.TYPE_KEYWORDS[schema_type]:
                        return schema_type, 0.90
        
        # Analyze name and context for type keywords
        search_text = f"{name} {context or ''}".lower()
        
        type_scores: Dict[SchemaType, float] = {}
        for schema_type, keywords in self.TYPE_KEYWORDS.items():
            matches = sum(1 for kw in keywords if kw in search_text)
            if matches > 0:
                type_scores[schema_type] = min(0.5 + (matches * 0.1), 0.85)
        
        if type_scores:
            best_type = max(type_scores, key=type_scores.get)
            return best_type, type_scores[best_type]
        
        # Default to Thing with low confidence
        return SchemaType.THING, 0.3
    
    def _get_cached(self, name: str) -> Optional[ResolvedEntity]:
        """Retrieve cached entity resolution."""
        row = self._conn.execute(
            """
            SELECT entity_name, schema_type, confidence, schema_uri,
                   mandatory_attrs, optional_attrs, search_hints,
                   inferred_context, cached_at
            FROM schema_cache
            WHERE entity_name = ?
            """,
            (name,)
        ).fetchone()
        
        if not row:
            return None
        
        return ResolvedEntity(
            name=row[0],
            schema_type=SchemaType(row[1]),
            confidence=row[2],
            schema_uri=row[3],
            mandatory_attrs=json.loads(row[4]),
            optional_attrs=json.loads(row[5]),
            search_hints=json.loads(row[6]),
            inferred_context=json.loads(row[7]) if row[7] else {},
            cached_at=datetime.fromisoformat(row[8]) if row[8] else None,
        )
    
    def _cache_entity(self, entity: ResolvedEntity) -> None:
        """Cache resolved entity."""
        self._conn.execute(
            """
            INSERT OR REPLACE INTO schema_cache (
                entity_name, schema_type, confidence, schema_uri,
                mandatory_attrs, optional_attrs, search_hints,
                inferred_context, cached_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entity.name,
                entity.schema_type.value,
                entity.confidence,
                entity.schema_uri,
                json.dumps(entity.mandatory_attrs),
                json.dumps(entity.optional_attrs),
                json.dumps(entity.search_hints),
                json.dumps(entity.inferred_context),
                entity.cached_at.isoformat() if entity.cached_at else None,
            )
        )
        self._conn.commit()
    
    def _is_expired(self, entity: ResolvedEntity) -> bool:
        """Check if cached entity has expired."""
        if not entity.cached_at:
            return True
        expiry = entity.cached_at + timedelta(days=self.CACHE_TTL_DAYS)
        return datetime.now(timezone.utc) > expiry
    
    def get_schema_definition(self, schema_type: SchemaType) -> EntitySchema:
        """Get the schema definition for a type."""
        return SCHEMA_DEFINITIONS[schema_type]
    
    def build_search_query(self, entity: ResolvedEntity) -> str:
        """
        Build an enriched search query using Schema.org hints.
        
        This enhances the base entity name with type-specific keywords
        to improve search result relevance.
        """
        hints = " ".join(entity.search_hints[:3])  # Use top 3 hints
        return f"{entity.name} {hints}"
    
    def close(self) -> None:
        """Close database connection."""
        self._conn.close()
