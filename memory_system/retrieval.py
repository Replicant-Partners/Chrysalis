"""
Retrieval engine for memory system
Handles different retrieval strategies
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from .core import MemoryEntry, RetrievalResult, MemoryStore


class RetrievalEngine:
    """
    Retrieval engine supporting different strategies
    
    Strategies:
    - Semantic: Vector similarity search
    - Temporal: Time-based filtering
    - Hybrid: Semantic + temporal + metadata
    """
    
    def __init__(self, vector_store: MemoryStore):
        self.vector_store = vector_store
    
    def semantic_search(
        self,
        query: str,
        limit: int = 5,
        memory_types: Optional[List[str]] = None,
        threshold: float = 0.7
    ) -> RetrievalResult:
        """
        Pure semantic search using vector similarity
        """
        results = self.vector_store.retrieve(
            query=query,
            limit=limit,
            memory_types=memory_types
        )
        
        # Filter by threshold
        if threshold > 0:
            filtered_entries = []
            filtered_scores = []
            
            for entry, score in zip(results.entries, results.scores):
                if score >= threshold:
                    filtered_entries.append(entry)
                    filtered_scores.append(score)
            
            results = RetrievalResult(
                entries=filtered_entries,
                scores=filtered_scores,
                metadata=results.metadata
            )
        
        return results
    
    def temporal_search(
        self,
        query: str,
        limit: int = 5,
        memory_types: Optional[List[str]] = None,
        time_window: Optional[timedelta] = None,
        recent_first: bool = True
    ) -> RetrievalResult:
        """
        Search with temporal filtering
        
        Args:
            query: Search query
            limit: Max results
            memory_types: Filter by memory types
            time_window: Only return memories within this time window
            recent_first: Sort by recency
        """
        # Get semantic results
        results = self.vector_store.retrieve(
            query=query,
            limit=limit * 2,  # Get more to filter
            memory_types=memory_types
        )
        
        # Apply temporal filtering
        if time_window:
            cutoff = datetime.now() - time_window
            filtered = [
                (entry, score)
                for entry, score in zip(results.entries, results.scores)
                if entry.timestamp >= cutoff
            ]
        else:
            filtered = list(zip(results.entries, results.scores))
        
        # Sort by recency if requested
        if recent_first:
            filtered.sort(key=lambda x: x[0].timestamp, reverse=True)
        
        # Limit results
        filtered = filtered[:limit]
        
        return RetrievalResult(
            entries=[e for e, _ in filtered],
            scores=[s for _, s in filtered],
            metadata={
                **results.metadata,
                "temporal_filter": time_window.total_seconds() if time_window else None
            }
        )
    
    def hybrid_search(
        self,
        query: str,
        limit: int = 5,
        memory_types: Optional[List[str]] = None,
        metadata_filters: Optional[Dict[str, Any]] = None,
        time_window: Optional[timedelta] = None,
        recency_weight: float = 0.3,
        relevance_weight: float = 0.7
    ) -> RetrievalResult:
        """
        Hybrid search combining semantic, temporal, and metadata filtering
        
        Args:
            query: Search query
            limit: Max results
            memory_types: Filter by memory types
            metadata_filters: Filter by metadata fields
            time_window: Temporal window
            recency_weight: Weight for recency in scoring
            relevance_weight: Weight for relevance in scoring
        """
        # Get semantic results (more than needed for filtering)
        results = self.vector_store.retrieve(
            query=query,
            limit=limit * 3,
            memory_types=memory_types
        )
        
        # Apply filters and calculate hybrid scores
        filtered = []
        now = datetime.now()
        
        for entry, relevance_score in zip(results.entries, results.scores):
            # Temporal filter
            if time_window and entry.timestamp < now - time_window:
                continue
            
            # Metadata filters
            if metadata_filters:
                match = all(
                    entry.metadata.get(key) == value
                    for key, value in metadata_filters.items()
                )
                if not match:
                    continue
            
            # Calculate hybrid score
            # Recency score (0-1, recent = higher)
            age_seconds = (now - entry.timestamp).total_seconds()
            max_age = 30 * 24 * 3600  # 30 days
            recency_score = max(0, 1 - (age_seconds / max_age))
            
            # Combined score
            hybrid_score = (
                relevance_weight * relevance_score +
                recency_weight * recency_score
            )
            
            filtered.append((entry, hybrid_score, relevance_score))
        
        # Sort by hybrid score
        filtered.sort(key=lambda x: x[1], reverse=True)
        
        # Limit results
        filtered = filtered[:limit]
        
        return RetrievalResult(
            entries=[e for e, _, _ in filtered],
            scores=[hs for _, hs, _ in filtered],
            metadata={
                "query": query,
                "hybrid_scoring": {
                    "recency_weight": recency_weight,
                    "relevance_weight": relevance_weight
                },
                "relevance_scores": [rs for _, _, rs in filtered]
            }
        )
    
    def get_recent(
        self,
        limit: int = 10,
        memory_types: Optional[List[str]] = None,
        time_window: Optional[timedelta] = None
    ) -> List[MemoryEntry]:
        """
        Get most recent memories
        
        Note: This requires the vector store to support listing by time
        For now, retrieves all and sorts (not efficient for large datasets)
        """
        # This is a simplified implementation
        # Production version should use database's temporal indexing
        
        if hasattr(self.vector_store, 'list_recent'):
            return self.vector_store.list_recent(limit)
        
        # Fallback: retrieve with generic query and sort
        # This is inefficient but works
        results = self.vector_store.retrieve(
            query="recent memories",  # Generic query
            limit=limit * 2,
            memory_types=memory_types
        )
        
        # Filter by time window
        entries = results.entries
        if time_window:
            cutoff = datetime.now() - time_window
            entries = [e for e in entries if e.timestamp >= cutoff]
        
        # Sort by timestamp
        entries.sort(key=lambda x: x.timestamp, reverse=True)
        
        return entries[:limit]
