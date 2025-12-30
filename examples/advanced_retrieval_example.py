#!/usr/bin/env python3
"""
Advanced retrieval strategies example
"""
import os
from datetime import timedelta
from memory_system import Memory, MemoryConfig
from memory_system.retrieval import RetrievalEngine

def main():
    """Demonstrate advanced retrieval strategies"""
    
    # Configure memory
    config = MemoryConfig(
        embedding_model="openai/text-embedding-3-small",
        storage_path="./advanced_memory_data",
        openai_api_key=os.getenv("OPENAI_API_KEY")
    )
    
    memory = Memory(config)
    memory.initialize()
    
    print("=== Advanced Retrieval Strategies ===\n")
    
    # Add sample memories with metadata
    print("1. Adding sample memories with metadata...")
    
    memories = [
        ("User discussed Python async programming", {"language": "python", "topic": "async"}),
        ("We covered JavaScript promises and async/await", {"language": "javascript", "topic": "async"}),
        ("User asked about React hooks", {"language": "javascript", "topic": "react"}),
        ("Explained Python decorators", {"language": "python", "topic": "decorators"}),
        ("User prefers functional programming style", {"preference": "style"}),
    ]
    
    for content, metadata in memories:
        memory.add_episodic(content, metadata=metadata)
    
    print("   ✓ Added 5 memories with metadata")
    
    # Get retrieval engine
    retrieval = RetrievalEngine(memory._vector_store)
    
    # 2. Semantic Search
    print("\n2. Semantic Search (vector similarity)...")
    results = retrieval.semantic_search(
        query="async programming",
        limit=3,
        threshold=0.5
    )
    print(f"   Found {len(results.entries)} results:")
    for entry, score in zip(results.entries, results.scores):
        print(f"   - {entry.content} (score: {score:.3f})")
    
    # 3. Temporal Search
    print("\n3. Temporal Search (recent memories)...")
    results = retrieval.temporal_search(
        query="programming",
        limit=3,
        time_window=timedelta(minutes=5),  # Last 5 minutes
        recent_first=True
    )
    print(f"   Found {len(results.entries)} recent results:")
    for entry in results.entries:
        print(f"   - {entry.content}")
        print(f"     (stored: {entry.timestamp.strftime('%H:%M:%S')})")
    
    # 4. Hybrid Search
    print("\n4. Hybrid Search (semantic + temporal + metadata)...")
    results = retrieval.hybrid_search(
        query="programming",
        limit=3,
        metadata_filters={"language": "python"},
        recency_weight=0.3,
        relevance_weight=0.7
    )
    print(f"   Found {len(results.entries)} Python-related results:")
    for entry, score in zip(results.entries, results.scores):
        print(f"   - {entry.content}")
        print(f"     (hybrid score: {score:.3f}, lang: {entry.metadata.get('language')})")
    
    # 5. Get Recent Memories
    print("\n5. Get Most Recent Memories...")
    recent = retrieval.get_recent(limit=3)
    print(f"   Last {len(recent)} memories:")
    for i, entry in enumerate(recent, 1):
        print(f"   {i}. {entry.content}")
    
    print("\n✅ Advanced retrieval demo complete!")

if __name__ == "__main__":
    main()
