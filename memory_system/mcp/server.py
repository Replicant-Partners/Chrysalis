"""
Semantic MCP Server - Model Context Protocol server for semantic services.

Exposes memory system capabilities as MCP tools for AI agent integration.
"""

import asyncio
import json
import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# Conditional MCP SDK import
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False
    Server = None


@dataclass
class ToolDefinition:
    """Definition of an MCP tool."""
    name: str
    description: str
    input_schema: Dict[str, Any]
    handler: Callable


def create_server(
    data_path: Optional[Path] = None,
    ollama_url: str = "http://localhost:11434",
    embedding_model: str = "nomic-embed-text",
) -> "SemanticServer":
    """
    Create and configure a semantic server instance.
    
    Args:
        data_path: Path for persistent data storage
        ollama_url: Ollama server URL
        embedding_model: Embedding model to use
        
    Returns:
        Configured SemanticServer instance
    """
    return SemanticServer(
        data_path=data_path,
        ollama_url=ollama_url,
        embedding_model=embedding_model,
    )


class SemanticServer:
    """
    MCP server exposing semantic services.
    
    Provides tools for:
    - Semantic decomposition (text → triples)
    - Knowledge graph operations
    - Embedding generation
    - Information-theoretic analysis
    - External knowledge queries
    
    Usage:
        server = SemanticServer()
        
        # Run with stdio transport
        server.run_stdio()
        
        # Or run async
        await server.run()
    """
    
    def __init__(
        self,
        name: str = "semantic-services",
        data_path: Optional[Path] = None,
        ollama_url: str = "http://localhost:11434",
        embedding_model: str = "nomic-embed-text",
    ):
        """
        Initialize semantic server.
        
        Args:
            name: Server name
            data_path: Path for persistent storage
            ollama_url: Ollama server URL
            embedding_model: Embedding model name
        """
        self.name = name
        self.data_path = data_path or Path("./data")
        self.ollama_url = ollama_url
        self.embedding_model = embedding_model
        
        # Lazy-loaded services
        self._decomposer = None
        self._graph_store = None
        self._embedding_service = None
        self._analyzer = None
        self._yago_client = None
        
        # MCP server instance
        self._server = None
        if MCP_AVAILABLE:
            self._server = Server(name)
            self._register_handlers()
        
        # Tool registry
        self._tools = self._define_tools()
    
    def _define_tools(self) -> List[ToolDefinition]:
        """Define available tools."""
        return [
            ToolDefinition(
                name="decompose_text",
                description="Extract semantic triples (subject-predicate-object) from natural language text. Returns structured knowledge representation.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "Text to decompose into semantic triples"
                        },
                        "strategy": {
                            "type": "string",
                            "enum": ["ollama", "spacy", "heuristic", "auto"],
                            "description": "Decomposition strategy (default: auto)"
                        }
                    },
                    "required": ["text"]
                },
                handler=self._handle_decompose,
            ),
            ToolDefinition(
                name="analyze_entropy",
                description="Calculate Shannon entropy and information metrics for a distribution or knowledge graph.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of items to analyze distribution"
                        }
                    },
                    "required": ["items"]
                },
                handler=self._handle_analyze_entropy,
            ),
            ToolDefinition(
                name="store_triple",
                description="Store a semantic triple in the knowledge graph.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "subject": {"type": "string", "description": "Subject entity"},
                        "predicate": {"type": "string", "description": "Relationship type"},
                        "object": {"type": "string", "description": "Object entity"},
                        "confidence": {"type": "number", "description": "Confidence score 0-1"}
                    },
                    "required": ["subject", "predicate", "object"]
                },
                handler=self._handle_store_triple,
            ),
            ToolDefinition(
                name="query_graph",
                description="Query the knowledge graph for entities or relationships.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "subject": {"type": "string", "description": "Subject to query (optional)"},
                        "predicate": {"type": "string", "description": "Predicate to filter (optional)"},
                        "object": {"type": "string", "description": "Object to query (optional)"},
                        "limit": {"type": "integer", "description": "Maximum results (default: 10)"}
                    }
                },
                handler=self._handle_query_graph,
            ),
            ToolDefinition(
                name="embed_text",
                description="Generate embedding vector for text using local Ollama model.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "Text to embed"},
                        "texts": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Multiple texts to embed (batch)"
                        }
                    }
                },
                handler=self._handle_embed,
            ),
            ToolDefinition(
                name="resolve_entity",
                description="Resolve an entity name to YAGO knowledge base entries.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Entity name to resolve"},
                        "limit": {"type": "integer", "description": "Maximum results (default: 5)"}
                    },
                    "required": ["name"]
                },
                handler=self._handle_resolve_entity,
            ),
            ToolDefinition(
                name="convert_document",
                description="Convert a document (PDF, HTML, Markdown) to plain text.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "Document content or file path"},
                        "format": {
                            "type": "string",
                            "enum": ["pdf", "html", "markdown", "text", "auto"],
                            "description": "Document format (default: auto)"
                        }
                    },
                    "required": ["content"]
                },
                handler=self._handle_convert_document,
            ),
            ToolDefinition(
                name="chunk_text",
                description="Split text into semantic chunks for embedding.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "Text to chunk"},
                        "chunk_size": {"type": "integer", "description": "Target chunk size (default: 512)"},
                        "overlap": {"type": "integer", "description": "Overlap between chunks (default: 50)"},
                        "strategy": {
                            "type": "string",
                            "enum": ["fixed", "sentence", "paragraph", "semantic"],
                            "description": "Chunking strategy (default: sentence)"
                        }
                    },
                    "required": ["text"]
                },
                handler=self._handle_chunk_text,
            ),
        ]
    
    def _register_handlers(self) -> None:
        """Register MCP handlers."""
        if not MCP_AVAILABLE or not self._server:
            return
        
        @self._server.list_tools()
        async def list_tools() -> List[Tool]:
            return [
                Tool(
                    name=tool.name,
                    description=tool.description,
                    inputSchema=tool.input_schema,
                )
                for tool in self._tools
            ]
        
        @self._server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            for tool in self._tools:
                if tool.name == name:
                    result = await tool.handler(arguments)
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
            
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
    
    # Service getters (lazy initialization)
    
    def _get_decomposer(self):
        """Get or create decomposer instance."""
        if self._decomposer is None:
            from ..semantic import SemanticDecomposer
            self._decomposer = SemanticDecomposer(ollama_url=self.ollama_url)
        return self._decomposer
    
    def _get_graph_store(self):
        """Get or create graph store instance."""
        if self._graph_store is None:
            from ..graph import GraphStore
            db_path = self.data_path / "graph.db"
            self._graph_store = GraphStore(backend="sqlite", path=db_path)
        return self._graph_store
    
    def _get_embedding_service(self):
        """Get or create embedding service instance."""
        if self._embedding_service is None:
            from ..embedding import EmbeddingService
            cache_path = self.data_path / "embeddings.db"
            self._embedding_service = EmbeddingService(
                provider="ollama",
                model=self.embedding_model,
                cache_path=cache_path,
            )
        return self._embedding_service
    
    def _get_analyzer(self):
        """Get or create Shannon analyzer instance."""
        if self._analyzer is None:
            from ..analysis import ShannonAnalyzer
            self._analyzer = ShannonAnalyzer()
        return self._analyzer
    
    def _get_yago_client(self):
        """Get or create YAGO client instance."""
        if self._yago_client is None:
            from ..analysis import YAGOClient
            cache_path = self.data_path / "yago_cache.db"
            self._yago_client = YAGOClient(cache_path=cache_path)
        return self._yago_client
    
    # Tool handlers
    
    async def _handle_decompose(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle decompose_text tool call."""
        text = args.get("text", "")
        strategy = args.get("strategy", "auto")
        
        try:
            decomposer = self._get_decomposer()
            result = await decomposer.decompose(text)
            
            return {
                "success": True,
                "triples": [t.to_dict() for t in result.triples],
                "entities": result.entities,
                "confidence": result.confidence,
                "strategy": result.strategy_used,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _handle_analyze_entropy(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle analyze_entropy tool call."""
        items = args.get("items", [])
        
        try:
            analyzer = self._get_analyzer()
            result = analyzer.analyze_distribution(items)
            
            return {
                "success": True,
                "entropy": result.entropy,
                "max_entropy": result.max_entropy,
                "normalized_entropy": result.normalized_entropy,
                "unique_types": result.unique_types,
                "total_items": result.total_items,
                "level": result.level,
                "summary": result.summary,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _handle_store_triple(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle store_triple tool call."""
        subject = args.get("subject", "")
        predicate = args.get("predicate", "")
        obj = args.get("object", "")
        confidence = args.get("confidence", 1.0)
        
        try:
            store = self._get_graph_store()
            
            # Add nodes
            store.add_node(subject, {"type": "entity"})
            store.add_node(obj, {"type": "entity"})
            
            # Add edge
            store.add_edge(subject, obj, {
                "type": predicate,
                "confidence": confidence,
            })
            
            return {
                "success": True,
                "stored": {
                    "subject": subject,
                    "predicate": predicate,
                    "object": obj,
                    "confidence": confidence,
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _handle_query_graph(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle query_graph tool call."""
        subject = args.get("subject")
        predicate = args.get("predicate")
        obj = args.get("object")
        limit = args.get("limit", 10)
        
        try:
            store = self._get_graph_store()
            results = []
            
            if subject:
                # Get outgoing edges from subject
                for neighbor in store.neighbors(subject):
                    edge = store.get_edge(subject, neighbor)
                    if edge:
                        if predicate and edge.get("type") != predicate:
                            continue
                        if obj and neighbor != obj:
                            continue
                        results.append({
                            "subject": subject,
                            "predicate": edge.get("type", "related_to"),
                            "object": neighbor,
                            "confidence": edge.get("confidence", 1.0),
                        })
            elif obj:
                # Find edges pointing to object
                for node_id in store.nodes():
                    edge = store.get_edge(node_id, obj)
                    if edge:
                        if predicate and edge.get("type") != predicate:
                            continue
                        results.append({
                            "subject": node_id,
                            "predicate": edge.get("type", "related_to"),
                            "object": obj,
                            "confidence": edge.get("confidence", 1.0),
                        })
            else:
                # Return all edges (limited)
                count = 0
                for source, target in store.edges():
                    if count >= limit:
                        break
                    edge = store.get_edge(source, target)
                    if edge:
                        if predicate and edge.get("type") != predicate:
                            continue
                        results.append({
                            "subject": source,
                            "predicate": edge.get("type", "related_to"),
                            "object": target,
                            "confidence": edge.get("confidence", 1.0),
                        })
                        count += 1
            
            return {
                "success": True,
                "results": results[:limit],
                "count": len(results[:limit]),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _handle_embed(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle embed_text tool call."""
        text = args.get("text")
        texts = args.get("texts", [])
        
        if text:
            texts = [text]
        
        if not texts:
            return {"success": False, "error": "No text provided"}
        
        try:
            service = self._get_embedding_service()
            result = await service.embed_with_result(texts)
            
            return {
                "success": result.success,
                "dimensions": result.dimensions,
                "vectors_count": len(result.vectors),
                "vectors": result.vectors,  # Include actual vectors
                "model": result.model,
                "cache_hits": result.cache_hits,
                "elapsed_ms": result.elapsed_ms,
                "error": result.error,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _handle_resolve_entity(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle resolve_entity tool call."""
        name = args.get("name", "")
        limit = args.get("limit", 5)
        
        try:
            client = self._get_yago_client()
            entities = client.resolve_entity(name, limit=limit)
            
            return {
                "success": True,
                "entities": [e.to_dict() for e in entities],
                "count": len(entities),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _handle_convert_document(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle convert_document tool call."""
        content = args.get("content", "")
        format_type = args.get("format", "auto")
        
        try:
            from ..converters import DocumentConverter
            converter = DocumentConverter()
            
            result = converter.convert(content, format=format_type if format_type != "auto" else None)
            
            return {
                "success": result.success,
                "content": result.content,
                "format": result.format,
                "char_count": result.char_count,
                "word_count": result.word_count,
                "metadata": result.metadata,
                "error": result.error,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _handle_chunk_text(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle chunk_text tool call."""
        text = args.get("text", "")
        chunk_size = args.get("chunk_size", 512)
        overlap = args.get("overlap", 50)
        strategy = args.get("strategy", "sentence")
        
        try:
            from ..converters import ChunkConverter, ChunkStrategy
            
            strategy_map = {
                "fixed": ChunkStrategy.FIXED,
                "sentence": ChunkStrategy.SENTENCE,
                "paragraph": ChunkStrategy.PARAGRAPH,
                "semantic": ChunkStrategy.SEMANTIC,
            }
            
            chunker = ChunkConverter(
                chunk_size=chunk_size,
                overlap=overlap,
                strategy=strategy_map.get(strategy, ChunkStrategy.SENTENCE),
            )
            
            chunks = chunker.split(text)
            
            return {
                "success": True,
                "chunks": [c.to_dict() for c in chunks],
                "count": len(chunks),
                "strategy": strategy,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # Server execution
    
    def run_stdio(self) -> None:
        """Run server with stdio transport (blocking)."""
        if not MCP_AVAILABLE:
            logger.error("MCP SDK not installed. Install with: pip install mcp")
            return
        
        asyncio.run(self._run_stdio_async())
    
    async def _run_stdio_async(self) -> None:
        """Run server with stdio transport (async)."""
        if not MCP_AVAILABLE or not self._server:
            return
        
        async with stdio_server() as (read_stream, write_stream):
            await self._server.run(
                read_stream,
                write_stream,
                self._server.create_initialization_options(),
            )
    
    async def run(self) -> None:
        """Run server (async context)."""
        await self._run_stdio_async()
    
    def get_tool_list(self) -> List[Dict[str, Any]]:
        """Get list of available tools."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
            }
            for tool in self._tools
        ]
    
    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a tool directly (for testing/integration).
        
        Args:
            name: Tool name
            arguments: Tool arguments
            
        Returns:
            Tool result
        """
        for tool in self._tools:
            if tool.name == name:
                return await tool.handler(arguments)
        
        return {"success": False, "error": f"Unknown tool: {name}"}
    
    def close(self) -> None:
        """Close all service connections."""
        if self._embedding_service:
            self._embedding_service.close()
        if self._yago_client:
            self._yago_client.close()


# CLI entry point
def main():
    """Main entry point for CLI."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Semantic Services MCP Server")
    parser.add_argument("--data-path", type=Path, default=Path("./data"),
                       help="Data storage path")
    parser.add_argument("--ollama-url", default="http://localhost:11434",
                       help="Ollama server URL")
    parser.add_argument("--embedding-model", default="nomic-embed-text",
                       help="Embedding model name")
    
    args = parser.parse_args()
    
    server = SemanticServer(
        data_path=args.data_path,
        ollama_url=args.ollama_url,
        embedding_model=args.embedding_model,
    )
    
    server.run_stdio()


if __name__ == "__main__":
    main()
