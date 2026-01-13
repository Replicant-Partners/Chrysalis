"""
Chrysalis Memory System - Gossip Protocol
Pattern #4: Epidemic Information Spread

Provides O(log N) memory propagation across agent instances
"""

import secrets
import asyncio
from typing import List, Set, Optional, Callable, Dict
from datetime import datetime, timedelta
from dataclasses import dataclass, field

from .chrysalis_types import (
    EpisodicMemory,
    GossipMetadata,
    MemoryState
)


@dataclass
class GossipConfig:
    """Configuration for gossip protocol"""
    fanout: int = 3  # Gossip to 3 random peers
    interval_ms: int = 500  # Gossip every 500ms
    max_retries: int = 3  # Retry failed gossips
    anti_entropy_enabled: bool = True  # Repair missing memories
    anti_entropy_interval_ms: int = 5000  # Every 5 seconds
    
    def rounds_to_reach(self, n_instances: int) -> int:
        """
        Calculate rounds needed to reach N instances
        O(log_fanout N)
        """
        if n_instances <= 1:
            return 0
        import math
        return math.ceil(math.log(n_instances) / math.log(self.fanout))


@dataclass
class GossipPeer:
    """Represents a gossip peer (another agent instance)"""
    instance_id: str
    endpoint: str  # Network endpoint
    last_seen: float = field(default_factory=lambda: datetime.now().timestamp())
    active: bool = True
    
    def mark_seen(self):
        """Update last seen timestamp"""
        self.last_seen = datetime.now().timestamp()


class MemoryGossipProtocol:
    """
    Pattern #4: Gossip-based memory propagation
    
    Memories spread exponentially:
    - Round 1: fanout instances
    - Round 2: fanout^2 instances
    - Round k: fanout^k instances
    
    Reaches all N instances in O(log N) rounds!
    """
    
    def __init__(
        self,
        instance_id: str,
        config: GossipConfig = None
    ):
        self.instance_id = instance_id
        self.config = config or GossipConfig()
        self.peers: Dict[str, GossipPeer] = {}
        self.current_round = 0
        self.gossip_history: Dict[str, Set[str]] = {}  # memory_id -> set of peer_ids
        
        # Callbacks
        self._send_callback: Optional[Callable] = None
        self._receive_callback: Optional[Callable] = None
    
    def add_peer(self, peer: GossipPeer):
        """Add a gossip peer"""
        self.peers[peer.instance_id] = peer
    
    def remove_peer(self, instance_id: str):
        """Remove a gossip peer"""
        if instance_id in self.peers:
            del self.peers[instance_id]
    
    def select_random_peers(self, count: int = None) -> List[GossipPeer]:
        """
        Pattern #4: Random peer selection for gossip
        
        Uses cryptographic randomness (Pattern #3) via secrets module
        for unpredictable peer selection.
        """
        if count is None:
            count = self.config.fanout
        
        active_peers = [p for p in self.peers.values() if p.active]
        
        if len(active_peers) <= count:
            return active_peers
        
        # Use secrets.SystemRandom for cryptographically secure selection
        secure_random = secrets.SystemRandom()
        return secure_random.sample(active_peers, count)
    
    async def gossip_memory(
        self,
        memory: EpisodicMemory,
        fanout: int = None
    ) -> Dict[str, bool]:
        """
        Pattern #4: Gossip single memory to random peers
        
        Returns: {peer_id: success}
        """
        if fanout is None:
            fanout = self.config.fanout
        
        # Select random peers
        targets = self.select_random_peers(fanout)
        
        if not targets:
            return {}
        
        # Update gossip metadata
        if not memory.gossip:
            memory.gossip = GossipMetadata(
                originInstance=self.instance_id,
                seenBy={self.instance_id},
                fanout=fanout,
                propagationRound=self.current_round
            )
        else:
            memory.gossip.mark_seen(self.instance_id)
            memory.gossip.propagationRound = self.current_round
        
        # Record gossip history
        if memory.memoryId not in self.gossip_history:
            self.gossip_history[memory.memoryId] = set()
        
        # Send to targets
        results = {}
        for peer in targets:
            if peer.instance_id not in self.gossip_history[memory.memoryId]:
                success = await self._send_memory(peer, memory)
                results[peer.instance_id] = success
                
                if success:
                    self.gossip_history[memory.memoryId].add(peer.instance_id)
                    memory.gossip.mark_seen(peer.instance_id)
                    peer.mark_seen()
        
        return results
    
    async def push_gossip(
        self,
        memories: List[EpisodicMemory]
    ) -> Dict[str, int]:
        """
        Push gossip: Send memories to random peers
        
        Returns: {peer_id: count_sent}
        """
        targets = self.select_random_peers()
        
        results = {}
        for peer in targets:
            count = 0
            for memory in memories:
                # Ensure gossip metadata exists
                if not memory.gossip:
                    memory.gossip = GossipMetadata(
                        originInstance=self.instance_id,
                        seenBy={self.instance_id},
                        fanout=self.config.fanout,
                        propagationRound=self.current_round
                    )
                # Only send if peer hasn't seen it
                if peer.instance_id not in memory.gossip.seenBy:
                    success = await self._send_memory(peer, memory)
                    if success:
                        count += 1
                        memory.gossip.mark_seen(peer.instance_id)
            
            results[peer.instance_id] = count
        
        return results
    
    async def pull_gossip(
        self,
        our_memory_ids: Set[str]
    ) -> Dict[str, List[EpisodicMemory]]:
        """
        Pull gossip: Request missing memories from random peers
        
        Returns: {peer_id: [memories]}
        """
        targets = self.select_random_peers()
        
        results = {}
        for peer in targets:
            # Request memories we don't have
            missing = await self._request_memories(peer, our_memory_ids)
            if missing:
                results[peer.instance_id] = missing
        
        return results
    
    async def push_pull_gossip(
        self,
        our_memories: List[EpisodicMemory],
        our_memory_ids: Set[str]
    ) -> tuple[Dict[str, int], Dict[str, List[EpisodicMemory]]]:
        """
        Push-pull gossip: Most efficient
        
        Combines push and pull in single round:
        - Push our new memories to peers
        - Pull missing memories from peers
        
        Returns: (push_results, pull_results)
        """
        push_results = await self.push_gossip(our_memories)
        pull_results = await self.pull_gossip(our_memory_ids)
        
        return (push_results, pull_results)
    
    async def anti_entropy(
        self,
        our_memory_ids: Set[str],
        all_memory_ids: Set[str]
    ) -> Dict[str, List[str]]:
        """
        Anti-entropy: Repair missing memories
        
        Compares our memories with peers to find and repair gaps
        This ensures eventual delivery even if gossip messages were lost
        
        Returns: {peer_id: [repaired_memory_ids]}
        """
        if not self.config.anti_entropy_enabled:
            return {}
        
        results = {}
        
        for peer in self.peers.values():
            if not peer.active:
                continue
            
            # Get peer's memory IDs
            peer_memory_ids = await self._get_peer_memory_ids(peer)
            
            # Find memories we're missing
            missing_from_us = peer_memory_ids - our_memory_ids
            
            # Request missing memories
            if missing_from_us:
                repaired = await self._request_specific_memories(peer, missing_from_us)
                if repaired:
                    results[peer.instance_id] = repaired
        
        return results
    
    def calculate_coverage(
        self,
        memory: EpisodicMemory,
        total_instances: int
    ) -> float:
        """
        Calculate what percentage of instances have this memory
        """
        if not memory.gossip or total_instances == 0:
            return 0.0
        
        return memory.gossip.coverage_percent(total_instances)
    
    def estimate_propagation_time(
        self,
        total_instances: int
    ) -> float:
        """
        Estimate time (in seconds) to propagate memory to all instances
        
        Uses O(log N) formula
        """
        rounds = self.config.rounds_to_reach(total_instances)
        return rounds * (self.config.interval_ms / 1000.0)
    
    # ==================================================================
    # Callback implementations (to be set by integrator)
    # ==================================================================
    
    async def _send_memory(
        self,
        peer: GossipPeer,
        memory: EpisodicMemory
    ) -> bool:
        """Send memory to peer (implement via callback)"""
        if self._send_callback:
            return await self._send_callback(peer, memory)
        # Simulate success in testing
        return True
    
    async def _request_memories(
        self,
        peer: GossipPeer,
        our_memory_ids: Set[str]
    ) -> List[EpisodicMemory]:
        """Request memories from peer (implement via callback)"""
        if self._receive_callback:
            return await self._receive_callback(peer, our_memory_ids)
        return []
    
    async def _get_peer_memory_ids(
        self,
        peer: GossipPeer
    ) -> Set[str]:
        """Get memory IDs from peer for anti-entropy"""
        # Implement via callback or API call
        return set()
    
    async def _request_specific_memories(
        self,
        peer: GossipPeer,
        memory_ids: Set[str]
    ) -> List[str]:
        """Request specific memories by ID"""
        # Implement via callback or API call
        return []


class GossipScheduler:
    """
    Manages periodic gossip rounds
    
    Runs gossip protocol at configured intervals
    """
    
    def __init__(
        self,
        protocol: MemoryGossipProtocol,
        memory_state: MemoryState
    ):
        self.protocol = protocol
        self.memory_state = memory_state
        self.running = False
        self._tasks: List[asyncio.Task] = []
    
    async def start(self):
        """Start periodic gossip"""
        if self.running:
            return
        
        self.running = True
        
        # Start gossip task
        gossip_task = asyncio.create_task(self._gossip_loop())
        self._tasks.append(gossip_task)
        
        # Start anti-entropy task
        if self.protocol.config.anti_entropy_enabled:
            anti_entropy_task = asyncio.create_task(self._anti_entropy_loop())
            self._tasks.append(anti_entropy_task)
    
    async def stop(self):
        """Stop periodic gossip"""
        self.running = False
        
        # Cancel tasks
        for task in self._tasks:
            task.cancel()
        
        # Wait for cancellation
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
    
    async def _gossip_loop(self):
        """Main gossip loop"""
        while self.running:
            try:
                # Get memories to gossip
                memories = self.memory_state.episodicMemories
                
                if memories:
                    # Push-pull gossip
                    memory_ids = {m.memoryId for m in memories}
                    await self.protocol.push_pull_gossip(memories, memory_ids)
                
                # Increment round
                self.protocol.current_round += 1
                
                # Wait for next interval
                await asyncio.sleep(self.protocol.config.interval_ms / 1000.0)
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Gossip loop error: {e}")
                await asyncio.sleep(1.0)  # Back off on error
    
    async def _anti_entropy_loop(self):
        """Anti-entropy repair loop"""
        while self.running:
            try:
                # Wait for anti-entropy interval
                await asyncio.sleep(self.protocol.config.anti_entropy_interval_ms / 1000.0)
                
                # Get our memory IDs
                our_memory_ids = {m.memoryId for m in self.memory_state.episodicMemories}
                
                # Get all memory IDs (from some global registry)
                all_memory_ids = our_memory_ids  # Placeholder
                
                # Run anti-entropy
                await self.protocol.anti_entropy(our_memory_ids, all_memory_ids)
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Anti-entropy loop error: {e}")


# ==============================================================================
# Example Usage
# ==============================================================================

if __name__ == "__main__":
    print("=== Chrysalis Gossip Protocol Demo ===\n")
    
    # Calculate propagation
    config = GossipConfig(fanout=3, interval_ms=500)
    
    instances_counts = [10, 100, 1000, 10000]
    
    print("Propagation analysis (fanout=3):\n")
    for n in instances_counts:
        rounds = config.rounds_to_reach(n)
        time_seconds = rounds * (config.interval_ms / 1000.0)
        
        print(f"  {n:5} instances:")
        print(f"    Rounds: {rounds}")
        print(f"    Time:   {time_seconds:.2f} seconds")
        print(f"    O(log N) = O(log_{config.fanout} {n}) = O({rounds})")
        print()
    
    print("=== Pattern #4: O(log N) propagation achieved ===")
