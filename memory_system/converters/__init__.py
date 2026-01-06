"""
Memory System Converters.

Content conversion and document processing utilities.

Components:
- DocumentConverter: Convert documents to text (PDF, HTML, Markdown)
- CodeConverter: Extract semantic information from source code
- ChunkConverter: Split content into semantic chunks

Usage:
    from memory_system.converters import DocumentConverter, ChunkConverter
    
    # Convert document to text
    doc = DocumentConverter()
    text = doc.convert("paper.pdf")
    
    # Split into chunks
    chunker = ChunkConverter(chunk_size=512)
    chunks = chunker.split(text)
"""

from .document import DocumentConverter, ConversionResult
from .code import CodeConverter, CodeChunk
from .chunk import ChunkConverter, Chunk

__all__ = [
    "DocumentConverter",
    "ConversionResult",
    "CodeConverter",
    "CodeChunk",
    "ChunkConverter",
    "Chunk",
]
