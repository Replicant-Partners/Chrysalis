#!/usr/bin/env python3
"""
Seed Memory System with Test Data for UI Testing

Creates test memories for all system agents (Ada, Lea, Phil, David, Milton)
to enable comprehensive UI testing.
"""

import asyncio
import os
import sys
import logging
from typing import List, Dict

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from Agents.system_agents.memory_bridge import SystemAgentMemoryBridge

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Test agents
AGENTS = ["ada", "lea", "phil", "david", "milton"]

# Test memory data
TEST_MEMORIES = {
    "semantic": [
        {
            "content": "User prefers Python for backend development",
            "importance": 0.9,
            "tags": ["preference", "language", "backend"]
        },
        {
            "content": "Project uses TypeScript for frontend components",
            "importance": 0.8,
            "tags": ["tech-stack", "frontend"]
        },
        {
            "content": "Database is PostgreSQL with SQLAlchemy ORM",
            "importance": 0.7,
            "tags": ["database", "orm"]
        },
        {
            "content": "API endpoints use FastAPI framework",
            "importance": 0.8,
            "tags": ["api", "framework"]
        },
        {
            "content": "User values code readability over performance",
            "importance": 0.6,
            "tags": ["philosophy", "preference"]
        },
    ],
    "episodic": [
        {
            "content": "Fixed authentication bug in auth.py that was causing 401 errors",
            "importance": 0.7,
            "tags": ["bug-fix", "authentication"]
        },
        {
            "content": "Implemented new user registration flow with email verification",
            "importance": 0.8,
            "tags": ["feature", "registration"]
        },
        {
            "content": "Refactored database connection pooling to improve performance",
            "importance": 0.6,
            "tags": ["refactoring", "performance"]
        },
        {
            "content": "Added comprehensive test suite for API endpoints",
            "importance": 0.7,
            "tags": ["testing", "quality"]
        },
        {
            "content": "Debugged memory leak in background task scheduler",
            "importance": 0.9,
            "tags": ["debugging", "critical"]
        },
    ],
    "procedural": [
        {
            "content": "To debug Python: use pdb.set_trace() or breakpoint()",
            "importance": 0.7,
            "tags": ["debugging", "python", "skill"]
        },
        {
            "content": "To optimize SQL queries: use EXPLAIN ANALYZE and add appropriate indexes",
            "importance": 0.8,
            "tags": ["database", "optimization", "skill"]
        },
        {
            "content": "To write effective tests: follow AAA pattern (Arrange, Act, Assert)",
            "importance": 0.6,
            "tags": ["testing", "best-practices", "skill"]
        },
        {
            "content": "To handle async operations: use asyncio.gather() for concurrent tasks",
            "importance": 0.7,
            "tags": ["async", "python", "skill"]
        },
    ]
}


async def seed_agent_memories(agent_id: str, zep_api_key: str) -> Dict[str, int]:
    """
    Seed memories for a single agent
    
    Args:
        agent_id: Agent ID
        zep_api_key: Zep API key
        
    Returns:
        Dictionary with counts of memories created by type
    """
    logger.info(f"Seeding memories for agent: {agent_id}")
    
    # Create memory bridge
    bridge = SystemAgentMemoryBridge(
        agent_id=agent_id,
        zep_api_key=zep_api_key,
        enable_cloud_sync=True
    )
    
    await bridge.start()
    
    counts = {"semantic": 0, "episodic": 0, "procedural": 0}
    
    try:
        # Seed each memory type
        for memory_type, memories in TEST_MEMORIES.items():
            for memory_data in memories:
                try:
                    memory_id = await bridge.store(
                        content=memory_data["content"],
                        memory_type=memory_type,
                        importance=memory_data["importance"],
                        tags=memory_data["tags"]
                    )
                    counts[memory_type] += 1
                    logger.debug(f"Created {memory_type} memory: {memory_id[:8]}...")
                
                except Exception as e:
                    logger.error(f"Failed to create memory: {e}")
        
        logger.info(f"Created {sum(counts.values())} memories for {agent_id}: {counts}")
        
        # Get stats
        stats = bridge.get_stats()
        logger.info(f"Agent {agent_id} stats: {stats}")
    
    finally:
        await bridge.stop()
    
    return counts


async def seed_all_agents(zep_api_key: str):
    """Seed memories for all agents"""
    logger.info("=" * 60)
    logger.info("Starting memory system seeding")
    logger.info("=" * 60)
    
    total_counts = {"semantic": 0, "episodic": 0, "procedural": 0}
    
    for agent_id in AGENTS:
        try:
            counts = await seed_agent_memories(agent_id, zep_api_key)
            for memory_type, count in counts.items():
                total_counts[memory_type] += count
        
        except Exception as e:
            logger.error(f"Failed to seed agent {agent_id}: {e}", exc_info=True)
    
    logger.info("=" * 60)
    logger.info("Seeding completed")
    logger.info(f"Total memories created: {sum(total_counts.values())}")
    logger.info(f"By type: {total_counts}")
    logger.info(f"Agents seeded: {len(AGENTS)}")
    logger.info("=" * 60)


async def verify_seeding():
    """Verify that memories were created"""
    logger.info("Verifying seeded data...")
    
    zep_api_key = os.getenv("ZEP_API_KEY")
    if not zep_api_key:
        logger.error("ZEP_API_KEY not found in environment")
        return False
    
    # Check one agent
    bridge = SystemAgentMemoryBridge(
        agent_id="ada",
        zep_api_key=zep_api_key,
        enable_cloud_sync=False
    )
    
    await bridge.start()
    
    try:
        # Search for some memories
        results = await bridge.retrieve("Python", limit=10)
        logger.info(f"Found {len(results)} Python-related memories")
        
        if len(results) > 0:
            logger.info("✅ Verification successful")
            return True
        else:
            logger.warning("⚠️  No memories found - verification failed")
            return False
    
    finally:
        await bridge.stop()


async def main():
    """Main entry point"""
    # Check for ZEP_API_KEY
    zep_api_key = os.getenv("ZEP_API_KEY")
    if not zep_api_key:
        logger.error("ZEP_API_KEY not found in environment")
        logger.error("Please set ZEP_API_KEY in .env file")
        sys.exit(1)
    
    logger.info(f"Using ZEP API key: {zep_api_key[:8]}...")
    
    # Seed memories
    await seed_all_agents(zep_api_key)
    
    # Wait a bit for any background sync
    logger.info("Waiting 5 seconds for background sync...")
    await asyncio.sleep(5)
    
    # Verify
    success = await verify_seeding()
    
    if success:
        logger.info("🎉 Memory system seeding completed successfully!")
        logger.info("You can now proceed with UI testing")
        sys.exit(0)
    else:
        logger.error("❌ Memory system seeding verification failed")
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Seeding interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
