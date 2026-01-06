"""
Memory System MCP Server.

Model Context Protocol server exposing semantic services as tools.

Components:
- SemanticServer: MCP server implementation
- Tool definitions for all semantic operations

Tools exposed:
- decompose_text: Extract semantic triples from text
- analyze_entropy: Calculate information metrics
- query_graph: Query knowledge graph
- embed_text: Generate embeddings
- resolve_entity: Resolve to YAGO entities

Usage:
    from memory_system.mcp import SemanticServer
    
    server = SemanticServer()
    await server.run()
    
    # Or with stdio transport
    server.run_stdio()
"""

from .server import SemanticServer, create_server

__all__ = [
    "SemanticServer",
    "create_server",
]
