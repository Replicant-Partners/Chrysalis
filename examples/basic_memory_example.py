#!/usr/bin/env python3
"""
Basic memory system usage example
"""
import os
from memory_system import Memory, MemoryConfig

def main():
    """Demonstrate basic memory operations"""
    
    # Configure memory system
    config = MemoryConfig(
        embedding_model="openai/text-embedding-3-small",
        vector_store_type="chroma",
        storage_path="./example_memory_data",
        openai_api_key=os.getenv("OPENAI_API_KEY")
    )
    
    # Create memory instance
    memory = Memory(config)
    
    print("=== Agent Memory System Demo ===\n")
    
    # 1. Core Memory (persistent identity/facts)
    print("1. Setting Core Memory...")
    memory.set_core_memory("persona", "I am a helpful research assistant specializing in AI.")
    memory.set_core_memory("user_facts", "User is interested in agent architectures.")
    print("   ✓ Core memory set")
    
    # 2. Working Memory (recent context)
    print("\n2. Adding to Working Memory...")
    memory.add_to_working_memory("User asked about memory systems")
    memory.add_to_working_memory("I explained vector databases")
    memory.add_to_working_memory("User wants to see code examples")
    print(f"   ✓ Working memory: {len(memory.get_working_memory())} entries")
    
    # 3. Episodic Memory (experiences/events)
    print("\n3. Storing Episodic Memories...")
    memory.add_episodic(
        "User asked about MemGPT architecture on 2025-12-28",
        metadata={"topic": "architecture", "date": "2025-12-28"}
    )
    memory.add_episodic(
        "We discussed vector embeddings and their role in memory",
        metadata={"topic": "embeddings"}
    )
    print("   ✓ Episodic memories stored")
    
    # 4. Semantic Memory (facts/knowledge)
    print("\n4. Storing Semantic Memories...")
    memory.add_semantic(
        "Vector embeddings convert text into numerical representations for semantic search",
        metadata={"category": "definition"}
    )
    memory.add_semantic(
        "Chroma is a lightweight vector database suitable for small to medium deployments",
        metadata={"category": "technology"}
    )
    print("   ✓ Semantic memories stored")
    
    # 5. Retrieval
    print("\n5. Searching Memories...")
    
    # Search episodic
    results = memory.search_episodic("What did we discuss about embeddings?", limit=2)
    print(f"\n   Episodic search results ({len(results.entries)} found):")
    for i, entry in enumerate(results.entries, 1):
        print(f"   {i}. {entry.content[:80]}...")
        print(f"      (score: {results.scores[i-1]:.3f})")
    
    # Search semantic
    results = memory.search_semantic("What is a vector database?", limit=2)
    print(f"\n   Semantic search results ({len(results.entries)} found):")
    for i, entry in enumerate(results.entries, 1):
        print(f"   {i}. {entry.content[:80]}...")
        print(f"      (score: {results.scores[i-1]:.3f})")
    
    # 6. Context Assembly
    print("\n6. Assembling Context for LLM...")
    context = memory.get_context(query="What do I know about vector databases?")
    print("\n" + "="*60)
    print(context)
    print("="*60)
    
    # 7. Statistics
    print("\n7. Memory Statistics:")
    stats = memory.get_stats()
    print(f"   Working memory entries: {stats['working_memory_size']}")
    print(f"   Core memory blocks: {stats['core_memory_blocks']}")
    print(f"   Vector store count: {stats['vector_store_count']}")
    print(f"   Embedding model: {stats['config']['embedding_model']}")
    
    print("\n✅ Demo complete!")

if __name__ == "__main__":
    main()
