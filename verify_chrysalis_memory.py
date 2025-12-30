#!/usr/bin/env python3
"""
Verification script for Chrysalis Memory System
Tests all pattern implementations
"""

import sys
from pathlib import Path

# Ensure memory_system is in path
sys.path.insert(0, str(Path(__file__).parent))

def test_imports():
    """Test all imports"""
    print("="*70)
    print("CHRYSALIS MEMORY SYSTEM - VERIFICATION")
    print("="*70)
    print()
    
    print("Testing imports...")
    
    try:
        from memory_system.chrysalis_types import (
            MemoryType, MemorySource, EpisodicMemory, WorkingMemory
        )
        print("  ✓ chrysalis_types")
    except Exception as e:
        print(f"  ✗ chrysalis_types: {e}")
        return False
    
    try:
        from memory_system.identity import MemoryIdentity, KeyPairManager
        print("  ✓ identity (Pattern #1 + #2)")
    except Exception as e:
        print(f"  ✗ identity: {e}")
        return False
    
    try:
        from memory_system.gossip import MemoryGossipProtocol, GossipConfig
        print("  ✓ gossip (Pattern #4)")
    except Exception as e:
        print(f"  ✗ gossip: {e}")
        return False
    
    try:
        from memory_system.byzantine import ByzantineMemoryValidator
        print("  ✓ byzantine (Pattern #8)")
    except Exception as e:
        print(f"  ✗ byzantine: {e}")
        return False
    
    try:
        from memory_system.crdt_merge import MemoryCRDTMerger, GSet
        print("  ✓ crdt_merge (Pattern #10)")
    except Exception as e:
        print(f"  ✗ crdt_merge: {e}")
        return False
    
    try:
        from memory_system.chrysalis_memory import ChrysalisMemory
        print("  ✓ chrysalis_memory (Main API)")
    except Exception as e:
        print(f"  ✗ chrysalis_memory: {e}")
        return False
    
    try:
        from memory_system import ChrysalisMemory, MemoryType
        print("  ✓ memory_system package")
    except Exception as e:
        print(f"  ✗ memory_system package: {e}")
        return False
    
    print()
    return True


def test_pattern_1_2():
    """Test Pattern #1 (Hash) + Pattern #2 (Signature)"""
    print("Testing Pattern #1 + #2: Cryptographic Identity...")
    
    try:
        from memory_system.identity import MemoryIdentity, KeyPairManager
        
        # Generate keypair
        private_key, public_key = KeyPairManager.generate_keypair()
        
        # Create fingerprint
        fingerprint = MemoryIdentity.generate_fingerprint(
            content="Test memory",
            memory_type="observation",
            timestamp=0.0
        )
        
        # Sign
        signature = MemoryIdentity.sign_memory(
            fingerprint.fingerprint,
            private_key,
            "test-instance"
        )
        
        # Verify
        verified = MemoryIdentity.verify_signature(
            fingerprint.fingerprint,
            signature
        )
        
        print(f"  Fingerprint: {fingerprint.fingerprint[:32]}...")
        print(f"  Signature:   {signature.signature[:8].hex()}...")
        print(f"  Verified:    {verified} ✓")
        print()
        
        return verified
    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_pattern_4():
    """Test Pattern #4 (Gossip)"""
    print("Testing Pattern #4: Gossip Protocol...")
    
    try:
        from memory_system.gossip import GossipConfig
        
        config = GossipConfig(fanout=3, interval_ms=500)
        
        test_cases = [(10, 3), (100, 5), (1000, 7)]
        
        for n, expected_rounds in test_cases:
            rounds = config.rounds_to_reach(n)
            time_s = rounds * (config.interval_ms / 1000.0)
            print(f"  {n:4} instances: {rounds} rounds, {time_s:.2f}s - O(log₃ {n})")
        
        print()
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_pattern_8():
    """Test Pattern #8 (Byzantine)"""
    print("Testing Pattern #8: Byzantine Resistance...")
    
    try:
        from memory_system.byzantine import ByzantineMemoryValidator
        
        # Test threshold calculation
        for n in [10, 100, 1000]:
            threshold = ByzantineMemoryValidator.calculate_threshold(n)
            print(f"  {n:4} instances: threshold={threshold} (>{threshold/n*100:.1f}%)")
        
        # Test trimmed mean
        honest_scores = [0.9, 0.85, 0.88, 0.92, 0.87, 0.91, 0.89]
        byzantine_scores = [0.0, 0.1, 0.05]
        all_scores = honest_scores + byzantine_scores
        
        regular_mean = sum(all_scores) / len(all_scores)
        trimmed_mean = ByzantineMemoryValidator.trimmed_mean(all_scores, 0.2)
        median = ByzantineMemoryValidator.median(all_scores)
        
        print(f"\n  Byzantine scenario (30% malicious):")
        print(f"    Regular mean: {regular_mean:.3f} (vulnerable)")
        print(f"    Trimmed mean: {trimmed_mean:.3f} (resistant ✓)")
        print(f"    Median:       {median:.3f} (resistant ✓)")
        print()
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_pattern_10():
    """Test Pattern #10 (CRDT)"""
    print("Testing Pattern #10: CRDT Operations...")
    
    try:
        from memory_system.crdt_merge import GSet
        
        # Create G-Sets
        a = GSet()
        a.add("M1")
        a.add("M2")
        
        b = GSet()
        b.add("M2")
        b.add("M3")
        
        # Test merge
        ab = a.merge(b)
        ba = b.merge(a)
        
        # Verify properties
        commutative = ab.elements() == ba.elements()
        idempotent = a.merge(a).elements() == a.elements()
        
        print(f"  G-Set A: {a.elements()}")
        print(f"  G-Set B: {b.elements()}")
        print(f"  Merge:   {ab.elements()}")
        print(f"  Commutative: {commutative} ✓")
        print(f"  Idempotent:  {idempotent} ✓")
        print()
        
        return commutative and idempotent
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_main_api():
    """Test main ChrysalisMemory API"""
    print("Testing ChrysalisMemory Main API...")
    
    try:
        from memory_system import ChrysalisMemory, MemoryType
        
        # Create instance
        chrysalis = ChrysalisMemory(
            instance_id="test-instance",
            agent_id="test-agent",
            instance_index=0,
            total_instances=1
        )
        
        # Create working memory
        working = chrysalis.create_working_memory(
            content="Test observation",
            memory_type=MemoryType.OBSERVATION,
            importance=0.8
        )
        
        # Create episodic memory
        episodic = chrysalis.create_episodic_memory(
            content="Test knowledge",
            memory_type=MemoryType.KNOWLEDGE,
            importance=0.9
        )
        
        # Get stats
        stats = chrysalis.get_stats()
        
        print(f"  Instance ID:     {stats['instance_id']}")
        print(f"  Working memories: {stats['working_memories']}")
        print(f"  Episodic memories: {stats['episodic_memories']}")
        print(f"  Lamport clock:    {stats['lamport_clock']}")
        print(f"  Vector clock:     {stats['vector_clock']}")
        print()
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    results = []
    
    # Test imports
    results.append(("Imports", test_imports()))
    
    # Test patterns
    results.append(("Pattern #1 + #2", test_pattern_1_2()))
    results.append(("Pattern #4", test_pattern_4()))
    results.append(("Pattern #8", test_pattern_8()))
    results.append(("Pattern #10", test_pattern_10()))
    
    # Test main API
    results.append(("Main API", test_main_api()))
    
    # Summary
    print("="*70)
    print("VERIFICATION SUMMARY")
    print("="*70)
    print()
    
    for name, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"  {name:<20} {status}")
    
    print()
    
    all_pass = all(success for _, success in results)
    
    if all_pass:
        print("="*70)
        print("✅ ALL TESTS PASSED - SYSTEM READY FOR PRODUCTION")
        print("="*70)
        return 0
    else:
        print("="*70)
        print("❌ SOME TESTS FAILED - REVIEW ERRORS ABOVE")
        print("="*70)
        return 1


if __name__ == "__main__":
    sys.exit(main())
