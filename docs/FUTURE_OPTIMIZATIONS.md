# Future Optimizations for Chrysalis

**Document Version**: 1.0  
**Last Updated**: 2026-01-09  
**Status**: Planning Document

---

## Overview

This document outlines future optimization opportunities for the Chrysalis project, with a focus on scalability improvements for the embedding and skill management systems. These optimizations are not currently needed but provide a clear roadmap for when the system scales beyond current capacity.

---

## Issue #4: FAISS Indexing for Large-Scale Similarity Search

### Current State

**Implementation**: Linear search with cosine similarity  
**Performance**: O(n) for each similarity comparison  
**Current Scale**: ~50 legends, ~350 skills  
**Performance**: Acceptable (<1s for full comparison)

**Current Code Location**: `scripts/semantic_embedding_merger.py`
```python
def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(b * b for b in vec2))
    return dot_product / (magnitude1 * magnitude2)
```

### Trigger Points for Optimization

Implement FAISS indexing when **any** of these conditions are met:

1. **Scale Threshold**: >1,000 legends or >10,000 skills
2. **Performance Threshold**: Similarity search takes >5 seconds
3. **Memory Threshold**: Embedding comparisons use >2GB RAM
4. **User Experience**: Noticeable lag in processing pipeline

### Recommended Solution: FAISS Integration

**FAISS** (Facebook AI Similarity Search) is a library for efficient similarity search and clustering of dense vectors.

#### Benefits
- **Performance**: O(log n) or better for similarity search
- **Scalability**: Handles millions of vectors efficiently
- **Memory Efficient**: Compressed index formats available
- **GPU Support**: Optional GPU acceleration for massive scale

#### Implementation Approach

##### 1. Add FAISS Dependency

```python
# requirements.txt
faiss-cpu==1.7.4  # or faiss-gpu for GPU support
```

##### 2. Create FAISS Index Manager

```python
# scripts/faiss_index_manager.py
"""
FAISS Index Manager for efficient similarity search.

Provides FAISS-based indexing for embeddings when scale requires it.
Falls back to linear search for small datasets.
"""

import faiss
import numpy as np
from typing import List, Tuple, Optional
from pathlib import Path
import pickle


class FAISSIndexManager:
    """
    Manage FAISS indices for efficient similarity search.
    
    Automatically switches between linear and FAISS-based search
    based on dataset size.
    """
    
    def __init__(
        self,
        dimension: int = 1024,
        index_type: str = "IVFFlat",
        nlist: int = 100,
        use_gpu: bool = False
    ):
        """
        Initialize FAISS index manager.
        
        Args:
            dimension: Embedding dimension (e.g., 1024 for Voyage)
            index_type: FAISS index type (IVFFlat, HNSW, Flat)
            nlist: Number of clusters for IVF indices
            use_gpu: Whether to use GPU acceleration
        """
        self.dimension = dimension
        self.index_type = index_type
        self.nlist = nlist
        self.use_gpu = use_gpu
        self.index: Optional[faiss.Index] = None
        self.id_map: List[str] = []  # Maps FAISS IDs to legend/skill IDs
        
    def build_index(self, embeddings: List[np.ndarray], ids: List[str]) -> None:
        """
        Build FAISS index from embeddings.
        
        Args:
            embeddings: List of embedding vectors
            ids: List of corresponding IDs (legend names, skill names, etc.)
        """
        if len(embeddings) == 0:
            return
        
        # Convert to numpy array
        vectors = np.array(embeddings).astype('float32')
        
        # Create appropriate index based on size
        if len(embeddings) < 1000:
            # Use flat index for small datasets (exact search)
            self.index = faiss.IndexFlatL2(self.dimension)
        else:
            # Use IVF index for larger datasets (approximate search)
            quantizer = faiss.IndexFlatL2(self.dimension)
            self.index = faiss.IndexIVFFlat(
                quantizer, self.dimension, self.nlist, faiss.METRIC_L2
            )
            
            # Train the index
            self.index.train(vectors)
        
        # Add vectors to index
        self.index.add(vectors)
        self.id_map = ids
        
        # Move to GPU if requested
        if self.use_gpu and faiss.get_num_gpus() > 0:
            res = faiss.StandardGpuResources()
            self.index = faiss.index_cpu_to_gpu(res, 0, self.index)
    
    def search(
        self,
        query_vector: np.ndarray,
        k: int = 10,
        similarity_threshold: float = 0.85
    ) -> List[Tuple[str, float]]:
        """
        Search for similar vectors.
        
        Args:
            query_vector: Query embedding vector
            k: Number of nearest neighbors to return
            similarity_threshold: Minimum similarity score (0-1)
            
        Returns:
            List of (id, similarity_score) tuples
        """
        if self.index is None or len(self.id_map) == 0:
            return []
        
        # Reshape query vector
        query = np.array([query_vector]).astype('float32')
        
        # Search
        distances, indices = self.index.search(query, min(k, len(self.id_map)))
        
        # Convert L2 distances to cosine similarity
        # Note: This assumes normalized vectors
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self.id_map):
                continue
            
            # Convert L2 distance to similarity (approximate)
            similarity = 1.0 / (1.0 + dist)
            
            if similarity >= similarity_threshold:
                results.append((self.id_map[idx], similarity))
        
        return results
    
    def save(self, path: Path) -> None:
        """Save index to disk."""
        if self.index is None:
            return
        
        # Save FAISS index
        faiss.write_index(self.index, str(path / "faiss.index"))
        
        # Save ID mapping
        with open(path / "id_map.pkl", "wb") as f:
            pickle.dump(self.id_map, f)
    
    def load(self, path: Path) -> None:
        """Load index from disk."""
        index_path = path / "faiss.index"
        id_map_path = path / "id_map.pkl"
        
        if not index_path.exists() or not id_map_path.exists():
            raise FileNotFoundError(f"Index files not found in {path}")
        
        # Load FAISS index
        self.index = faiss.read_index(str(index_path))
        
        # Load ID mapping
        with open(id_map_path, "rb") as f:
            self.id_map = pickle.load(f)
        
        # Move to GPU if requested
        if self.use_gpu and faiss.get_num_gpus() > 0:
            res = faiss.StandardGpuResources()
            self.index = faiss.index_cpu_to_gpu(res, 0, self.index)


# Example usage
if __name__ == "__main__":
    # Create sample embeddings
    dimension = 1024
    num_vectors = 10000
    embeddings = np.random.rand(num_vectors, dimension).astype('float32')
    ids = [f"legend_{i}" for i in range(num_vectors)]
    
    # Build index
    manager = FAISSIndexManager(dimension=dimension)
    manager.build_index(embeddings, ids)
    
    # Search
    query = np.random.rand(dimension).astype('float32')
    results = manager.search(query, k=5)
    
    print(f"Found {len(results)} similar vectors:")
    for id, similarity in results:
        print(f"  {id}: {similarity:.4f}")
```

##### 3. Integrate with Semantic Merger

```python
# scripts/semantic_embedding_merger.py (updated)

class EmbeddingMerger:
    """Merge embeddings using semantic similarity."""
    
    def __init__(
        self,
        similarity_threshold: float = 0.85,
        use_faiss: bool = False,
        faiss_threshold: int = 1000
    ):
        """
        Args:
            similarity_threshold: Cosine similarity threshold
            use_faiss: Force FAISS usage
            faiss_threshold: Auto-enable FAISS above this many embeddings
        """
        self.similarity_threshold = similarity_threshold
        self.use_faiss = use_faiss
        self.faiss_threshold = faiss_threshold
        self.faiss_manager: Optional[FAISSIndexManager] = None
    
    def merge_similar_embeddings(
        self,
        existing: List[Dict[str, Any]],
        new: Dict[str, Any]
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """
        Merge new embedding with existing embeddings.
        
        Automatically uses FAISS if dataset is large enough.
        """
        new_embedding = new.get("embedding", [])
        if not new_embedding:
            return existing, False
        
        # Decide whether to use FAISS
        should_use_faiss = self.use_faiss or len(existing) >= self.faiss_threshold
        
        if should_use_faiss and self.faiss_manager is None:
            # Initialize FAISS index
            self._build_faiss_index(existing)
        
        # Find similar embedding
        if should_use_faiss and self.faiss_manager is not None:
            # Use FAISS for fast search
            results = self.faiss_manager.search(
                np.array(new_embedding),
                k=1,
                similarity_threshold=self.similarity_threshold
            )
            
            if results:
                # Found similar embedding
                best_id, best_similarity = results[0]
                best_match_idx = int(best_id.split("_")[1])  # Extract index from ID
                
                # Merge embeddings
                existing_entry = existing[best_match_idx]
                merged_emb = self.average_embeddings(
                    [existing_entry["embedding"], new_embedding],
                    weights=[0.4, 0.6]
                )
                
                existing[best_match_idx]["embedding"] = merged_emb
                existing[best_match_idx]["merged_count"] = existing_entry.get("merged_count", 1) + 1
                existing[best_match_idx]["similarity_score"] = best_similarity
                
                return existing, True
            else:
                # No similar embedding found
                new["merged_count"] = 1
                existing.append(new)
                return existing, False
        else:
            # Use linear search for small datasets
            return self._linear_merge(existing, new)
    
    def _build_faiss_index(self, embeddings: List[Dict[str, Any]]) -> None:
        """Build FAISS index from existing embeddings."""
        vectors = [e["embedding"] for e in embeddings if "embedding" in e]
        ids = [f"emb_{i}" for i in range(len(vectors))]
        
        dimension = len(vectors[0]) if vectors else 1024
        self.faiss_manager = FAISSIndexManager(dimension=dimension)
        self.faiss_manager.build_index(vectors, ids)
    
    def _linear_merge(
        self,
        existing: List[Dict[str, Any]],
        new: Dict[str, Any]
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """Original linear search implementation (for small datasets)."""
        # ... existing implementation ...
```

##### 4. Configuration

```python
# Add to environment variables or config file
FAISS_ENABLED=true
FAISS_THRESHOLD=1000  # Auto-enable above this many embeddings
FAISS_INDEX_TYPE=IVFFlat
FAISS_USE_GPU=false
```

### Performance Comparison

| Dataset Size | Linear Search | FAISS (CPU) | FAISS (GPU) |
|--------------|---------------|-------------|-------------|
| 100 items    | <0.01s        | <0.01s      | <0.01s      |
| 1,000 items  | ~0.1s         | <0.01s      | <0.01s      |
| 10,000 items | ~1s           | ~0.05s      | ~0.01s      |
| 100,000 items| ~10s          | ~0.2s       | ~0.05s      |
| 1,000,000 items | ~100s      | ~1s         | ~0.2s       |

### Migration Path

1. **Phase 1**: Implement FAISS manager (1-2 days)
2. **Phase 2**: Integrate with semantic merger (1 day)
3. **Phase 3**: Add configuration and testing (1 day)
4. **Phase 4**: Build indices for existing data (1 day)
5. **Phase 5**: Monitor and optimize (ongoing)

**Total Estimated Effort**: 4-5 days

### Testing Strategy

```python
# tests/test_faiss_integration.py

def test_faiss_vs_linear_accuracy():
    """Ensure FAISS results match linear search."""
    # Generate test data
    embeddings = generate_test_embeddings(1000)
    
    # Linear search
    linear_results = linear_similarity_search(embeddings, query)
    
    # FAISS search
    faiss_results = faiss_similarity_search(embeddings, query)
    
    # Compare results (should be very similar)
    assert similarity(linear_results, faiss_results) > 0.95

def test_faiss_performance():
    """Verify FAISS performance improvement."""
    embeddings = generate_test_embeddings(10000)
    
    # Benchmark linear
    linear_time = benchmark(linear_similarity_search, embeddings)
    
    # Benchmark FAISS
    faiss_time = benchmark(faiss_similarity_search, embeddings)
    
    # FAISS should be significantly faster
    assert faiss_time < linear_time * 0.1  # At least 10x faster
```

### Monitoring

Add metrics to track when optimization is needed:

```python
# In semantic_embedding_merger.py

def log_search_metrics(self, search_time: float, dataset_size: int):
    """Log search performance metrics."""
    logger.info(
        "Similarity search metrics",
        extra={
            "metrics": {
                "search_time_sec": search_time,
                "dataset_size": dataset_size,
                "time_per_item_ms": (search_time / dataset_size) * 1000,
                "using_faiss": self.faiss_manager is not None,
            }
        }
    )
    
    # Alert if search is slow
    if search_time > 5.0 and not self.faiss_manager:
        logger.warning(
            "Similarity search is slow - consider enabling FAISS",
            extra={"dataset_size": dataset_size, "search_time": search_time}
        )
```

---

## Other Future Optimizations

### 1. Batch Processing

**Current**: Sequential processing of legends  
**Future**: Parallel processing with multiprocessing

**Trigger**: >100 legends to process  
**Estimated Speedup**: 4-8x (depending on CPU cores)

### 2. Incremental Embeddings

**Current**: Full re-embedding on each run  
**Future**: Cache embeddings, only re-embed if content changed

**Trigger**: Frequent re-processing of same legends  
**Estimated Savings**: 80-90% of embedding API calls

### 3. Embedding Compression

**Current**: Full-precision float32 embeddings  
**Future**: Quantized int8 embeddings

**Trigger**: Memory usage >10GB  
**Estimated Savings**: 75% memory reduction, minimal accuracy loss

### 4. Distributed Processing

**Current**: Single-machine processing  
**Future**: Distributed processing with Ray or Dask

**Trigger**: >10,000 legends or multi-hour processing times  
**Estimated Speedup**: Linear with number of machines

---

## Decision Matrix

| Optimization | Complexity | Impact | Priority | Trigger Point |
|--------------|------------|--------|----------|---------------|
| FAISS Indexing | Medium | High | High | >1,000 legends |
| Batch Processing | Low | Medium | Medium | >100 legends |
| Incremental Embeddings | Medium | High | High | Frequent re-processing |
| Embedding Compression | Low | Medium | Low | >10GB memory |
| Distributed Processing | High | High | Low | >10,000 legends |

---

## Conclusion

The current implementation is well-suited for the current scale (~50 legends). FAISS indexing should be the first optimization implemented when the system scales beyond 1,000 legends or when similarity search takes >5 seconds.

The implementation path is clear, well-documented, and can be completed in approximately one week of focused development.

---

**Next Review**: When legend count reaches 500 (50% of trigger point)  
**Owner**: Development Team  
**Status**: Approved for future implementation
