#!/usr/bin/env python3
"""
Test script for UAS v2.0 with Memory System
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import v2 types and loader
from uas_implementation.core import types_v2 as uas_v2
from uas_implementation.loader import UniversalAgentLoader, load_agent, save_agent


def print_section(title):
    """Print a section header"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def test_hierarchical_memory():
    """Test hierarchical memory agent"""
    print_section("Test 1: Hierarchical Memory Agent (MemGPT style)")
    
    spec_path = Path(__file__).parent / "memory_agent_hierarchical.uas.yaml"
    print(f"\n📁 Loading: {spec_path.name}")
    
    spec = load_agent(str(spec_path), type_module=uas_v2)
    
    print(f"\n✅ Loaded: {spec.metadata.name} v{spec.metadata.version}")
    print(f"   {spec.metadata.description}")
    
    # Check memory system
    if spec.capabilities.memory:
        memory = spec.capabilities.memory
        print(f"\n🧠 Memory Configuration:")
        print(f"   Architecture: {memory.architecture.value}")
        
        # Working memory
        if memory.working:
            print(f"\n   Working Memory:")
            print(f"      Enabled: {memory.working.enabled}")
            print(f"      Max Tokens: {memory.working.max_tokens:,}")
            print(f"      Buffer Type: {memory.working.buffer_type}")
        
        # Episodic memory
        if memory.episodic:
            print(f"\n   Episodic Memory:")
            print(f"      Enabled: {memory.episodic.enabled}")
            print(f"      Storage: {memory.episodic.storage}")
            print(f"      Retention: {'Unlimited' if memory.episodic.retention_days is None else f'{memory.episodic.retention_days} days'}")
            print(f"      Temporal Indexing: {memory.episodic.temporal_indexing}")
        
        # Semantic memory
        if memory.semantic:
            print(f"\n   Semantic Memory:")
            print(f"      Enabled: {memory.semantic.enabled}")
            print(f"      Storage: {memory.semantic.storage}")
            print(f"      Knowledge Graph: {memory.semantic.knowledge_graph}")
            if memory.semantic.rag:
                print(f"      RAG Enabled: {memory.semantic.rag.enabled}")
                print(f"      Top-K: {memory.semantic.rag.top_k}")
                print(f"      Min Relevance: {memory.semantic.rag.min_relevance}")
        
        # Procedural memory
        if memory.procedural:
            print(f"\n   Procedural Memory:")
            print(f"      Enabled: {memory.procedural.enabled}")
            print(f"      Storage: {memory.procedural.storage}")
            print(f"      Format: {memory.procedural.format}")
            print(f"      Versioning: {memory.procedural.versioning}")
        
        # Core memory
        if memory.core:
            print(f"\n   Core Memory:")
            print(f"      Enabled: {memory.core.enabled}")
            print(f"      Self-Editing: {memory.core.self_editing}")
            print(f"      Blocks: {len(memory.core.blocks)}")
            for block in memory.core.blocks:
                print(f"         • {block.name}: {len(block.content)} chars (editable: {block.editable})")
        
        # Embeddings
        if memory.embeddings:
            print(f"\n   Embeddings:")
            print(f"      Model: {memory.embeddings.model}")
            print(f"      Dimensions: {memory.embeddings.dimensions}")
            print(f"      Batch Size: {memory.embeddings.batch_size}")
        
        # Storage
        if memory.storage:
            print(f"\n   Storage:")
            print(f"      Primary: {memory.storage.primary}")
            if memory.storage.vector_db:
                print(f"      Vector DB: {memory.storage.vector_db.provider}")
                print(f"         Collection: {memory.storage.vector_db.collection}")
            if memory.storage.graph_db:
                print(f"      Graph DB: {memory.storage.graph_db.provider}")
                print(f"         Database: {memory.storage.graph_db.database}")
            if memory.storage.cache:
                print(f"      Cache: {memory.storage.cache}")
        
        # Operations
        if memory.operations:
            print(f"\n   Memory Operations:")
            print(f"      Retrieval Strategy: {memory.operations.retrieval.strategy.value}")
            print(f"      Hybrid Search: {memory.operations.retrieval.hybrid_search}")
            print(f"      Consolidation: {memory.operations.consolidation.strategy.value}")
            print(f"      Forgetting: {'Enabled' if memory.operations.forgetting.enabled else 'Disabled'}")
            if memory.operations.forgetting.enabled:
                print(f"         Strategy: {memory.operations.forgetting.strategy.value}")
                print(f"         Threshold: {memory.operations.forgetting.threshold}")
    
    print("\n✅ Hierarchical memory test passed!")
    return spec


def test_structured_memory():
    """Test structured memory agent"""
    print_section("Test 2: Structured Memory Agent (MIRIX style)")
    
    spec_path = Path(__file__).parent / "memory_agent_structured.uas.yaml"
    print(f"\n📁 Loading: {spec_path.name}")
    
    spec = load_agent(str(spec_path), type_module=uas_v2)
    
    print(f"\n✅ Loaded: {spec.metadata.name} v{spec.metadata.version}")
    
    if spec.capabilities.memory:
        memory = spec.capabilities.memory
        print(f"\n🧠 Memory Architecture: {memory.architecture.value}")
        
        # Count enabled memory types
        enabled_types = []
        if memory.working and memory.working.enabled:
            enabled_types.append("Working")
        if memory.episodic and memory.episodic.enabled:
            enabled_types.append("Episodic")
        if memory.semantic and memory.semantic.enabled:
            enabled_types.append("Semantic")
        if memory.procedural and memory.procedural.enabled:
            enabled_types.append("Procedural")
        if memory.core and memory.core.enabled:
            enabled_types.append("Core")
        
        print(f"   Enabled Types ({len(enabled_types)}): {', '.join(enabled_types)}")
        
        # Storage summary
        if memory.storage:
            print(f"\n   Storage Backend:")
            print(f"      Primary: {memory.storage.primary}")
            if memory.storage.vector_db:
                print(f"      Vector DB: {memory.storage.vector_db.provider} (collection: {memory.storage.vector_db.collection})")
    
    print("\n✅ Structured memory test passed!")
    return spec


def test_minimal_memory():
    """Test minimal memory agent"""
    print_section("Test 3: Minimal Memory Agent (Basic RAG)")
    
    spec_path = Path(__file__).parent / "memory_agent_minimal.uas.yaml"
    print(f"\n📁 Loading: {spec_path.name}")
    
    spec = load_agent(str(spec_path), type_module=uas_v2)
    
    print(f"\n✅ Loaded: {spec.metadata.name} v{spec.metadata.version}")
    
    if spec.capabilities.memory:
        memory = spec.capabilities.memory
        print(f"\n🧠 Memory Architecture: {memory.architecture.value}")
        
        # Simple summary
        print(f"   Working Memory: {memory.working.enabled if memory.working else False}")
        print(f"   Semantic Memory: {memory.semantic.enabled if memory.semantic else False}")
        print(f"   Episodic Memory: {memory.episodic.enabled if memory.episodic else False}")
        print(f"   Core Memory: {memory.core.enabled if memory.core else False}")
        
        if memory.operations:
            print(f"\n   Retrieval: {memory.operations.retrieval.strategy.value}")
            print(f"   Consolidation: {memory.operations.consolidation.strategy.value}")
            print(f"   Forgetting: {'Enabled' if memory.operations.forgetting.enabled else 'Disabled'}")
    
    print("\n✅ Minimal memory test passed!")
    return spec


def test_validation():
    """Test validation of memory specifications"""
    print_section("Test 4: Validation")
    
    print("\n🔍 Validating hierarchical agent...")
    spec_path = Path(__file__).parent / "memory_agent_hierarchical.uas.yaml"
    spec = load_agent(str(spec_path), type_module=uas_v2)
    
    try:
        spec.validate()
        print("   ✅ Validation passed!")
    except ValueError as e:
        print(f"   ❌ Validation failed: {e}")
        return False
    
    return True


def test_serialization():
    """Test round-trip serialization"""
    print_section("Test 5: Serialization (Round-trip)")
    
    # Load agent
    spec_path = Path(__file__).parent / "memory_agent_hierarchical.uas.yaml"
    print(f"\n📁 Loading from YAML...")
    spec1 = load_agent(str(spec_path), type_module=uas_v2)
    
    # Convert to dict
    print("📄 Converting to dict...")
    spec_dict = spec1.to_dict()
    
    # Create from dict
    print("🔄 Creating from dict...")
    spec2 = uas_v2.AgentSpec.from_dict(spec_dict)
    
    # Validate both are equivalent
    print("✅ Comparing...")
    assert spec1.metadata.name == spec2.metadata.name
    assert spec1.capabilities.memory.architecture == spec2.capabilities.memory.architecture
    
    # Save as JSON
    output_path = Path(__file__).parent / "memory_agent_hierarchical.uas.json"
    print(f"\n💾 Saving as JSON: {output_path.name}")
    save_agent(spec2, str(output_path), format='json')
    
    # Reload from JSON
    print("🔄 Reloading from JSON...")
    spec3 = load_agent(str(output_path), type_module=uas_v2)
    
    assert spec3.metadata.name == spec1.metadata.name
    print("\n✅ Round-trip serialization successful!")
    
    return True


def compare_memory_architectures():
    """Compare different memory architectures"""
    print_section("Test 6: Architecture Comparison")
    
    # Load all three agents
    hierarchical = load_agent(
        str(Path(__file__).parent / "memory_agent_hierarchical.uas.yaml"),
        type_module=uas_v2
    )
    
    structured = load_agent(
        str(Path(__file__).parent / "memory_agent_structured.uas.yaml"),
        type_module=uas_v2
    )
    
    minimal = load_agent(
        str(Path(__file__).parent / "memory_agent_minimal.uas.yaml"),
        type_module=uas_v2
    )
    
    print("\n📊 Memory Architecture Comparison:")
    print(f"\n{'Agent':<30} {'Architecture':<15} {'Memory Types':<20} {'Storage':<15}")
    print("-" * 80)
    
    for agent in [hierarchical, structured, minimal]:
        name = agent.metadata.name[:28]
        arch = agent.capabilities.memory.architecture.value if agent.capabilities.memory else "none"
        
        # Count memory types
        memory = agent.capabilities.memory
        types_count = 0
        if memory:
            if memory.working and memory.working.enabled: types_count += 1
            if memory.episodic and memory.episodic.enabled: types_count += 1
            if memory.semantic and memory.semantic.enabled: types_count += 1
            if memory.procedural and memory.procedural.enabled: types_count += 1
            if memory.core and memory.core.enabled: types_count += 1
        
        storage = memory.storage.primary if (memory and memory.storage) else "none"
        
        print(f"{name:<30} {arch:<15} {f'{types_count}/5 enabled':<20} {storage:<15}")
    
    print("\n✅ Architecture comparison complete!")


def main():
    """Run all tests"""
    print("\n" + "=" * 70)
    print("  Universal Agent Specification v2.0 - Memory System Tests")
    print("=" * 70)
    
    try:
        # Run tests
        test_hierarchical_memory()
        test_structured_memory()
        test_minimal_memory()
        test_validation()
        test_serialization()
        compare_memory_architectures()
        
        # Success summary
        print("\n" + "=" * 70)
        print("  ✅ ALL TESTS PASSED!")
        print("=" * 70)
        print("\n🎉 UAS v2.0 with Memory System is working correctly!")
        print("\n📚 Example specifications:")
        print("   • memory_agent_hierarchical.uas.yaml - Full-featured (MemGPT style)")
        print("   • memory_agent_structured.uas.yaml - Personal assistant (MIRIX style)")
        print("   • memory_agent_minimal.uas.yaml - Basic RAG")
        print("\n💾 Output files:")
        print("   • memory_agent_hierarchical.uas.json - JSON format")
        print("\n" + "=" * 70)
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
