import logging
from typing import Dict, Optional, List, Set

from src.collectors.tavily_collector import TavilyCollector
from src.storage.lancedb_client import LanceDBClient
from src.storage.sqlite_cache import SQLiteCache
from src.utils.embeddings import EmbeddingService
from shared.embedding import EmbeddingTelemetry
from src.ground_truth.schema_resolver import SchemaResolver, SchemaType

logger = logging.getLogger(__name__)


class SimplePipeline:
    """
    Minimal end-to-end pipeline:
      1. Resolve entity type using Schema.org scaffolding
      2. Collect basic facts via Tavily Search (enriched with type hints)
      3. Generate embedding
      4. Store in LanceDB and SQLite cache
    """

    def __init__(
        self,
        collector: Optional[TavilyCollector] = None,
        lancedb_client: Optional[LanceDBClient] = None,
        cache: Optional[SQLiteCache] = None,
        embedding_service: Optional[EmbeddingService] = None,
        schema_resolver: Optional[SchemaResolver] = None,
    ) -> None:
        self.collector = collector or TavilyCollector()
        self.cache = cache or SQLiteCache()
        
        # Initialize embedding service
        if embedding_service:
            self.embedder = embedding_service
        else:
            # Initialize without telemetry for now (can be added later via router)
            # Telemetry integration should be handled at pipeline/router level
            self.embedder = EmbeddingService()
        
        # Initialize LanceDB with correct dimensions from embedding service
        if lancedb_client:
            self.lance = lancedb_client
        else:
            # Get actual embedding dimensions from the service
            embedding_dims = self.embedder.dimensions
            provider_info = self.embedder.get_provider_info()
            provider_name = provider_info.get("provider", "unknown")
            logger.info(f"Initializing LanceDB with {embedding_dims} dimensions (from {provider_name})")
            self.lance = LanceDBClient(uri="./data/lancedb", vector_dim=embedding_dims)
        
        self.schema_resolver = schema_resolver or SchemaResolver()

    def collect_and_store(self, identifier: str, entity_type: Optional[str] = None) -> Dict:
        """
        Run resolve → collect → embed → store pipeline.
        
        Args:
            identifier: Entity name or identifier to collect
            entity_type: Optional type hint (e.g., "Person", "Organization")
        
        Returns:
            Dict with entity, attributes, and resolved schema info
        """
        # 1) Resolve entity type using Schema.org scaffolding
        resolved = self.schema_resolver.resolve(
            name=identifier,
            type_hint=entity_type,
            context=None  # Could be enriched with additional context
        )
        
        logger.info(
            "Resolved entity '%s' as %s (confidence: %.2f)",
            identifier,
            resolved.schema_type.value,
            resolved.confidence
        )

        # 2) Build enriched search query using Schema.org hints
        enriched_query = self.schema_resolver.build_search_query(resolved)
        
        # 3) Collect using enriched query
        collected = self.collector.collect(enriched_query, resolved.schema_type.name)
        text_for_embedding = collected["attributes"].get("summary") or identifier

        # 4) Embed
        embedding = self.embedder.embed(text_for_embedding)

        # 5) Store
        entity_id = f"{resolved.schema_type.name.lower()}:{identifier.lower().replace(' ', '_')}"
        entity = {
            "id": entity_id,
            "name": identifier,
            "type": resolved.schema_type.value,
            "text": text_for_embedding,
            "quality_score": collected.get("confidence", 0.0),
            "trust_score": resolved.confidence,
            "completeness_score": self._calculate_completeness(collected, resolved),
        }
        self.lance.insert_entity(entity, embedding)
        
        # 6) Cache metadata with schema info
        self.cache.set_metadata(
            entity_id,
            {
                "entity_type": resolved.schema_type.value,
                "quality_score": entity["quality_score"],
                "trust_score": entity["trust_score"],
                "completeness": entity["completeness_score"],
                    "model": self.embedder.model,
                "model_version": None,
                "attributes": collected["attributes"],
                "extracted_facts": collected.get("extracted_facts", {}),
            },
        )

        return {
            "entity": entity,
            "embedding": embedding,
            "attributes": collected["attributes"],
            "resolved": {
                "name": resolved.name,
                "schema_type": resolved.schema_type.value,
                "schema_uri": resolved.schema_uri,
                "confidence": resolved.confidence,
                "mandatory_attrs": resolved.mandatory_attrs,
                "optional_attrs": resolved.optional_attrs,
                "search_hints": resolved.search_hints,
            },
        }

    def _calculate_completeness(self, collected: Dict, resolved) -> float:
        """
        Calculate completeness score based on Schema.org attribute coverage.
        
        Completeness = (mandatory_filled * 0.6) + (optional_filled * 0.4)
        """
        attributes = collected.get("attributes", {})
        
        # Check mandatory attributes
        mandatory_count = len(resolved.mandatory_attrs)
        mandatory_filled = sum(
            1 for attr in resolved.mandatory_attrs
            if attr in attributes or attr.lower() in attributes
        )
        
        # Check optional attributes (sample)
        optional_count = min(len(resolved.optional_attrs), 5)  # Cap at 5 for scoring
        optional_filled = sum(
            1 for attr in resolved.optional_attrs[:5]
            if attr in attributes or attr.lower() in attributes
        )
        
        # Calculate weighted score
        mandatory_score = mandatory_filled / max(mandatory_count, 1)
        optional_score = optional_filled / max(optional_count, 1)
        
        return (mandatory_score * 0.6) + (optional_score * 0.4)

    def search(self, query: str, k: int = 10, entity_type: Optional[str] = None) -> list:
        """
        Search for entities by semantic similarity.
        
        Args:
            query: Search query text
            k: Number of results to return
            entity_type: Optional filter by entity type
        
        Returns:
            List of matching entities with similarity scores
        """
        # Generate query embedding
        query_embedding = self.embedder.embed(query)
        
        # Build filters
        filters = None
        if entity_type:
            # Resolve type hint to Schema.org type
            resolved = self.schema_resolver.resolve(name="", type_hint=entity_type)
            filters = {"entity_type": resolved.schema_type.value}
        
        # Search
        results = self.lance.search(query_embedding, k=k, filters=filters)
        
        # Enrich with cached metadata
        enriched_results = []
        for result in results:
            entity_id = result.get("id")
            metadata = self.cache.get_metadata(entity_id) if entity_id else None
            enriched_results.append({
                **result,
                "metadata": metadata,
            })
        
        return enriched_results

def run_knowledge_pipeline(identifier: str, entity_type: Optional[str], deepening_cycles: int) -> List[Dict]:
    """
    Orchestrates the knowledge gathering pipeline with deepening cycles.
    """
    all_results: List[Dict] = []
    processed_identifiers: Set[str] = set()
    identifiers_to_process: List[str] = [identifier]
    
    pipeline = SimplePipeline()

    for i in range(deepening_cycles + 1):
        if not identifiers_to_process:
            break

        current_identifiers = list(identifiers_to_process)
        identifiers_to_process = []
        
        logger.info(f"--- Deepening Cycle {i+1} ---")
        logger.info(f"Processing identifiers: {current_identifiers}")

        for ident in current_identifiers:
            if ident.lower() in processed_identifiers:
                continue
            
            try:
                result = pipeline.collect_and_store(ident, entity_type if i == 0 else None)
                all_results.append(result)
                processed_identifiers.add(ident.lower())

                # For the next cycle, find new entities to drill down into.
                # Simple strategy: take a few interesting attributes.
                attributes = result.get('attributes', {})
                if attributes:
                    # Example of a "drill-down" strategy
                    related_people = attributes.get('knownFor', [])
                    if isinstance(related_people, list) and related_people:
                        identifiers_to_process.extend([p for p in related_people if isinstance(p, str)])
                    
                    # Example of a "skate-across" strategy
                    if 'colleagues' in attributes:
                         colleagues = attributes.get('colleagues', [])
                         if isinstance(colleagues, list) and colleagues:
                            identifiers_to_process.extend([c for c in colleagues if isinstance(c, str)])

            except Exception as e:
                logger.error(f"Failed to process identifier '{ident}': {e}")
                
    # Limit the number of new identifiers to process to avoid getting too broad
    identifiers_to_process = list(dict.fromkeys(identifiers_to_process))[:3]


    return all_results