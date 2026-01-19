"""
Memory System HTTP API Server

Exposes the Rust-backed memory system via HTTP for TypeScript clients.
Replaces the old beads-based API with high-performance CRDT storage.

Endpoints:
    POST   /memory              - Store a memory
    GET    /memory/:id          - Get memory by ID
    DELETE /memory/:id          - Delete memory
    POST   /memory/search       - Search memories
    GET    /memory/recent       - Get recent memories
    POST   /memory/update/:id   - Update memory (CRDT merge)
    GET    /health              - Health check
    GET    /stats               - Memory statistics

Usage:
    uvicorn memory_system.api_server:app --port 8082
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import Rust-backed memory system
try:
    from memory_system import (
        MemoryDocument,
        MemoryStorage,
        AgentMemory,
        RUST_AVAILABLE,
        _BACKEND,
        get_backend_info,
    )
except ImportError:
    RUST_AVAILABLE = False
    _BACKEND = "unavailable"
    
    def get_backend_info():
        return {"backend": "unavailable", "rust_available": False}

logger = logging.getLogger(__name__)

# --- Pydantic Models ---

class StoreMemoryRequest(BaseModel):
    """Request to store a memory."""
    content: str
    agent_id: str = "default"
    memory_type: str = "episodic"
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    role: str = "assistant"
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UpdateMemoryRequest(BaseModel):
    """Request to update a memory (CRDT merge)."""
    importance: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    tags_add: Optional[List[str]] = None
    tags_remove: Optional[List[str]] = None


class SearchRequest(BaseModel):
    """Search request."""
    query: str
    limit: int = Field(default=10, ge=1, le=100)
    namespace: str = "default"
    memory_type: Optional[str] = None
    min_importance: Optional[float] = None
    tags: Optional[List[str]] = None


class MemoryResponse(BaseModel):
    """Memory response."""
    id: str
    content: str
    memory_type: str
    importance: float
    confidence: float
    tags: List[str]
    timestamp: float
    agent_id: str
    role: str = "assistant"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    backend: str
    rust_available: bool
    version: str
    beads_count: int


class StatsResponse(BaseModel):
    """Memory statistics response."""
    total_memories: int
    memories_by_type: Dict[str, int]
    memories_by_agent: Dict[str, int]
    backend: str
    sync_enabled: bool


# --- Application State ---

class MemoryState:
    """Global memory state."""
    
    def __init__(self):
        self.storages: Dict[str, MemoryStorage] = {}
        self.db_base_path = os.getenv("MEMORY_DB_PATH", "./data")
        
    def get_storage(self, agent_id: str) -> MemoryStorage:
        """Get or create storage for an agent."""
        if agent_id not in self.storages:
            db_path = f"{self.db_base_path}/{agent_id}_memory.db"
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
            self.storages[agent_id] = MemoryStorage(db_path, agent_id)
            logger.info(f"Created storage for agent: {agent_id}")
        return self.storages[agent_id]
    
    def get_all_stats(self) -> Dict[str, Any]:
        """Get statistics across all storages."""
        total = 0
        by_agent = {}
        
        for agent_id, storage in self.storages.items():
            count = storage.count()
            total += count
            by_agent[agent_id] = count
        
        return {
            "total_memories": total,
            "memories_by_agent": by_agent,
        }


state = MemoryState()


# --- Lifespan ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting Memory API Server")
    logger.info(f"Backend: {_BACKEND}, Rust Available: {RUST_AVAILABLE}")
    yield
    logger.info("Shutting down Memory API Server")


# --- FastAPI App ---

app = FastAPI(
    title="Chrysalis Memory API",
    description="High-performance CRDT-based memory system for autonomous agents",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS for TypeScript clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Endpoints ---

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    info = get_backend_info()
    
    total_count = sum(s.count() for s in state.storages.values())
    
    return HealthResponse(
        status="healthy" if RUST_AVAILABLE else "degraded",
        backend=info.get("backend", "unknown"),
        rust_available=info.get("rust_available", False),
        version=info.get("version", "0.0.0"),
        beads_count=total_count,
    )


@app.get("/stats", response_model=StatsResponse)
async def stats():
    """Get memory statistics."""
    all_stats = state.get_all_stats()
    
    return StatsResponse(
        total_memories=all_stats["total_memories"],
        memories_by_type={},  # TODO: implement type breakdown
        memories_by_agent=all_stats["memories_by_agent"],
        backend=_BACKEND,
        sync_enabled=os.getenv("FIREPROOF_SYNC_ENABLED", "false").lower() == "true",
    )


@app.post("/memory", response_model=MemoryResponse)
@app.post("/beads", response_model=MemoryResponse)  # Backward compatibility
async def store_memory(request: StoreMemoryRequest):
    """Store a new memory."""
    if not RUST_AVAILABLE:
        raise HTTPException(status_code=503, detail="Rust memory backend unavailable")
    
    storage = state.get_storage(request.agent_id)
    
    # Create memory document
    mem = MemoryDocument(
        content=request.content,
        memory_type=request.memory_type,
        source_instance=request.agent_id,
    )
    
    mem.set_importance(request.importance, request.agent_id)
    mem.set_confidence(request.confidence, request.agent_id)
    
    for tag in request.tags:
        mem.add_tag(tag)
    
    # Store (auto-merges if exists)
    mem_id = storage.put(mem)
    
    # Retrieve stored memory
    stored = storage.get(mem_id)
    
    return _memory_to_response(stored, request.agent_id, request.role)


@app.get("/memory/{memory_id}", response_model=MemoryResponse)
@app.get("/beads/{memory_id}", response_model=MemoryResponse)  # Backward compatibility
async def get_memory(memory_id: str, agent_id: str = Query(default="default")):
    """Get a memory by ID."""
    if not RUST_AVAILABLE:
        raise HTTPException(status_code=503, detail="Rust memory backend unavailable")
    
    storage = state.get_storage(agent_id)
    mem = storage.get(memory_id)
    
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    return _memory_to_response(mem, agent_id)


@app.delete("/memory/{memory_id}")
@app.delete("/beads/{memory_id}")  # Backward compatibility
async def delete_memory(memory_id: str, agent_id: str = Query(default="default")):
    """Delete a memory."""
    if not RUST_AVAILABLE:
        raise HTTPException(status_code=503, detail="Rust memory backend unavailable")
    
    storage = state.get_storage(agent_id)
    
    if not storage.get(memory_id):
        raise HTTPException(status_code=404, detail="Memory not found")
    
    storage.delete(memory_id)
    
    return {"status": "deleted", "id": memory_id}


@app.post("/memory/update/{memory_id}", response_model=MemoryResponse)
async def update_memory(memory_id: str, request: UpdateMemoryRequest, agent_id: str = Query(default="default")):
    """Update a memory (CRDT merge semantics)."""
    if not RUST_AVAILABLE:
        raise HTTPException(status_code=503, detail="Rust memory backend unavailable")
    
    storage = state.get_storage(agent_id)
    mem = storage.get(memory_id)
    
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    # Apply updates (CRDT merge)
    if request.importance is not None:
        mem.set_importance(request.importance, agent_id)
    
    if request.confidence is not None:
        mem.set_confidence(request.confidence, agent_id)
    
    if request.tags_add:
        for tag in request.tags_add:
            mem.add_tag(tag)
    
    if request.tags_remove:
        for tag in request.tags_remove:
            mem.remove_tag(tag)
    
    # Save (triggers merge)
    storage.put(mem)
    
    return _memory_to_response(mem, agent_id)


@app.post("/memory/search", response_model=List[MemoryResponse])
@app.post("/beads/search", response_model=List[MemoryResponse])  # Backward compatibility
async def search_memories(request: SearchRequest):
    """Search for memories."""
    if not RUST_AVAILABLE:
        raise HTTPException(status_code=503, detail="Rust memory backend unavailable")
    
    storage = state.get_storage(request.namespace)
    
    # Query by type or tags
    if request.memory_type:
        memories = storage.query_by_type(request.memory_type)
    elif request.min_importance:
        memories = storage.query_by_importance(request.min_importance)
    elif request.tags:
        memories = []
        for tag in request.tags:
            memories.extend(storage.query_by_tag(tag))
    else:
        memories = storage.recent(request.limit)
    
    # Limit results
    memories = memories[:request.limit]
    
    return [_memory_to_response(m, request.namespace) for m in memories]


@app.get("/memory", response_model=List[MemoryResponse])
@app.get("/beads", response_model=List[MemoryResponse])  # Backward compatibility
async def get_recent_memories(
    limit: int = Query(default=20, ge=1, le=100),
    agent_id: str = Query(default="default"),
):
    """Get recent memories."""
    if not RUST_AVAILABLE:
        raise HTTPException(status_code=503, detail="Rust memory backend unavailable")
    
    storage = state.get_storage(agent_id)
    memories = storage.recent(limit)
    
    return [_memory_to_response(m, agent_id) for m in memories]


# --- Helpers ---

def _memory_to_response(mem: Any, agent_id: str, role: str = "assistant") -> MemoryResponse:
    """Convert MemoryDocument to response model."""
    return MemoryResponse(
        id=mem.id,
        content=mem.content,
        memory_type=mem.memory_type,
        importance=mem.get_importance(),
        confidence=mem.get_confidence(),
        tags=mem.get_tags(),
        timestamp=mem.updated_at if hasattr(mem, 'updated_at') else datetime.utcnow().timestamp(),
        agent_id=agent_id,
        role=role,
        metadata={
            "version": mem.version if hasattr(mem, 'version') else 1,
            "source_instance": mem.source_instance if hasattr(mem, 'source_instance') else agent_id,
        },
    )


# --- CLI ---

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("MEMORY_API_PORT", "8082"))
    host = os.getenv("MEMORY_API_HOST", "0.0.0.0")
    
    uvicorn.run(app, host=host, port=port)
