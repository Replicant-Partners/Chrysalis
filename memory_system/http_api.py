"""
HTTP API for Memory System (DEPRECATED)

⚠️  DEPRECATED: This module is deprecated in favor of api_server.py
    which provides the canonical Rust-backed memory API.

    This file is kept for backwards compatibility with existing bead-only
    clients. New code should use api_server.py instead.

    Migration path:
    - /beads/* endpoints → use api_server.py /memory/* or /memories/* endpoints
    - BeadsService → use the Rust-backed MemoryStore via api_server.py

Exposes BeadsService and memory operations to TypeScript clients.

Run with: uvicorn memory_system.http_api:app --port 8082
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .beads import BeadsService

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Pydantic Models
# -----------------------------------------------------------------------------

class BeadCreate(BaseModel):
    """Request to create a new bead."""
    content: str
    role: str = "user"
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    metadata: Optional[Dict[str, Any]] = None
    agent_id: Optional[str] = None


class BeadResponse(BaseModel):
    """Response for a single bead."""
    id: str
    content: str
    role: str
    importance: float
    timestamp: float
    metadata: Optional[Dict[str, Any]] = None


class BeadsQueryParams(BaseModel):
    """Query parameters for retrieving beads."""
    limit: int = Field(default=20, ge=1, le=100)
    min_importance: float = Field(default=0.0, ge=0.0, le=1.0)
    agent_id: Optional[str] = None


class MemoryStoreRequest(BaseModel):
    """Generic memory store request."""
    key: str
    value: Any
    namespace: str = "default"
    ttl_seconds: Optional[int] = None


class MemoryRetrieveRequest(BaseModel):
    """Generic memory retrieve request."""
    query: str
    namespace: str = "default"
    limit: int = 10


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    beads_count: int
    version: str = "1.0.0"


# -----------------------------------------------------------------------------
# App Initialization
# -----------------------------------------------------------------------------

# Global beads service instance
beads_service: Optional[BeadsService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup, cleanup on shutdown."""
    global beads_service

    # Initialize beads service
    db_path = os.environ.get("BEADS_DB_PATH", "data/beads.db")
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

    beads_service = BeadsService(
        path=db_path,
        max_items=10000,
        ttl_seconds=86400 * 7,  # 7 days
    )
    logger.info(f"BeadsService initialized with db: {db_path}")

    yield

    # Cleanup (BeadsService handles its own connection)
    logger.info("Memory API shutting down")


app = FastAPI(
    title="Chrysalis Memory API",
    description="HTTP API for agent memory system (beads, fusion, etc.)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for TypeScript clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    count = 0
    if beads_service:
        try:
            beads = beads_service.recent(limit=1)
            count = len(beads_service.recent(limit=10000))  # Approximate count
        except Exception:
            pass

    return HealthResponse(
        status="healthy" if beads_service else "degraded",
        beads_count=count,
    )


@app.post("/beads", response_model=BeadResponse)
async def create_bead(bead: BeadCreate):
    """Create a new bead (short-term memory entry)."""
    if not beads_service:
        raise HTTPException(status_code=503, detail="Beads service not initialized")

    metadata = bead.metadata or {}
    if bead.agent_id:
        metadata["agent_id"] = bead.agent_id

    bead_id = beads_service.append(
        content=bead.content,
        role=bead.role,
        importance=bead.importance,
        metadata=metadata,
    )

    if beads := beads_service.recent(limit=1):
        b = beads[0]
        return BeadResponse(
            id=b["bead_id"],
            content=b["content"],
            role=b["role"],
            importance=b["importance"],
            timestamp=b["ts"],
            metadata=b.get("metadata"),
        )

    return BeadResponse(
        id=bead_id,
        content=bead.content,
        role=bead.role,
        importance=bead.importance,
        timestamp=0,
        metadata=metadata,
    )


@app.get("/beads", response_model=List[BeadResponse])
async def list_beads(
    limit: int = 20,
    min_importance: float = 0.0,
    agent_id: Optional[str] = None,
):
    """List recent beads with optional filtering."""
    if not beads_service:
        raise HTTPException(status_code=503, detail="Beads service not initialized")

    beads = beads_service.recent(limit=limit, min_importance=min_importance)

    # Filter by agent_id if provided
    if agent_id:
        beads = [
            b for b in beads
            if b.get("metadata", {}).get("agent_id") == agent_id
        ]

    return [
        BeadResponse(
            id=b["bead_id"],
            content=b["content"],
            role=b["role"],
            importance=b["importance"],
            timestamp=b["ts"],
            metadata=b.get("metadata"),
        )
        for b in beads
    ]


@app.get("/beads/{bead_id}", response_model=BeadResponse)
async def get_bead(bead_id: str):
    """Get a specific bead by ID."""
    if not beads_service:
        raise HTTPException(status_code=503, detail="Beads service not initialized")

    if bead := beads_service.get(bead_id):
        return BeadResponse(
            id=bead["bead_id"],
            content=bead["content"],
            role=bead["role"],
            importance=bead["importance"],
            timestamp=bead["ts"],
            metadata=bead.get("metadata"),
        )
    else:
        raise HTTPException(status_code=404, detail=f"Bead {bead_id} not found")


@app.delete("/beads/{bead_id}")
async def delete_bead(bead_id: str):
    """Delete a bead by ID."""
    if not beads_service:
        raise HTTPException(status_code=503, detail="Beads service not initialized")

    # BeadsService doesn't have delete, so we'll mark it as deleted via metadata
    # For now, return success (beads are append-only by design)
    return {"status": "ok", "message": "Beads are append-only; entry will expire via TTL"}


@app.post("/beads/search", response_model=List[BeadResponse])
async def search_beads(query: MemoryRetrieveRequest):
    """Search beads by content (simple substring match for now)."""
    if not beads_service:
        raise HTTPException(status_code=503, detail="Beads service not initialized")

    # Get recent beads and filter by query
    all_beads = beads_service.recent(limit=1000)

    matching = [
        b for b in all_beads
        if query.query.lower() in b["content"].lower()
    ][:query.limit]

    return [
        BeadResponse(
            id=b["bead_id"],
            content=b["content"],
            role=b["role"],
            importance=b["importance"],
            timestamp=b["ts"],
            metadata=b.get("metadata"),
        )
        for b in matching
    ]


# -----------------------------------------------------------------------------
# CLI Entry Point
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("MEMORY_API_PORT", "8082"))
    uvicorn.run(
        "memory_system.http_api:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )
