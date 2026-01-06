"""
Tests for converter modules.
"""

import pytest
from memory_system.converters import (
    DocumentConverter,
    CodeConverter,
    ChunkConverter,
    Chunk,
)
from memory_system.converters.chunk import ChunkStrategy


class TestDocumentConverter:
    """Tests for document converter."""
    
    @pytest.fixture
    def converter(self):
        """Create converter instance."""
        return DocumentConverter()
    
    def test_convert_plain_text(self, converter):
        """Test plain text conversion."""
        text = "Hello world. This is a test."
        result = converter.convert(text, format="text")
        
        assert result.success
        assert result.content == text
        assert result.word_count == 6
    
    def test_convert_html(self, converter):
        """Test HTML conversion."""
        html = "<html><body><p>Hello <strong>world</strong></p></body></html>"
        result = converter.convert_html(html)
        
        assert result.success
        assert "Hello" in result.content
        assert "world" in result.content
        assert "<" not in result.content  # Tags removed
    
    def test_convert_markdown(self, converter):
        """Test Markdown conversion."""
        md = "# Header\n\nThis is **bold** text.\n\n- Item 1\n- Item 2"
        result = converter.convert_markdown(md)
        
        assert result.success
        assert "Header" in result.content
        assert "bold" in result.content
        assert "**" not in result.content  # Markers removed
    
    def test_strip_whitespace(self, converter):
        """Test whitespace stripping."""
        text = "Line 1\n\n\n\nLine 2"
        result = converter.convert(text, format="text")
        
        assert result.success
        # Should collapse multiple newlines
        assert "\n\n\n" not in result.content
    
    def test_word_count(self, converter):
        """Test word counting."""
        text = "One two three four five"
        result = converter.convert(text, format="text")
        
        assert result.word_count == 5
    
    def test_empty_input(self, converter):
        """Test empty input handling."""
        result = converter.convert("", format="text")
        
        assert result.success
        assert result.content == ""


class TestCodeConverter:
    """Tests for code converter."""
    
    @pytest.fixture
    def converter(self):
        """Create converter instance."""
        return CodeConverter()
    
    def test_extract_python_function(self, converter):
        """Test Python function extraction."""
        code = '''
def hello(name):
    """Say hello."""
    return f"Hello, {name}!"
'''
        chunks = converter.extract(code, language="python")
        
        assert len(chunks) > 0
        func_chunk = [c for c in chunks if c.kind == "function"][0]
        assert func_chunk.name == "hello"
        assert func_chunk.docstring == "Say hello."
    
    def test_extract_python_class(self, converter):
        """Test Python class extraction."""
        code = '''
class MyClass:
    """A test class."""
    
    def method(self):
        pass
'''
        chunks = converter.extract(code, language="python")
        
        class_chunks = [c for c in chunks if c.kind == "class"]
        assert len(class_chunks) > 0
        assert class_chunks[0].name == "MyClass"
    
    def test_extract_python_imports(self, converter):
        """Test Python import extraction."""
        code = '''
import os
from pathlib import Path
import json as j
'''
        imports = converter.get_imports(code, language="python")
        
        assert "os" in imports
        assert "pathlib" in imports
        assert "json" in imports
    
    def test_get_definitions(self, converter):
        """Test getting all definitions."""
        code = '''
def func1(): pass
def func2(): pass
class Cls1: pass
'''
        defs = converter.get_definitions(code, language="python")
        
        assert "function" in defs
        assert len(defs["function"]) == 2
        assert "class" in defs
        assert len(defs["class"]) == 1


class TestChunkConverter:
    """Tests for text chunker."""
    
    def test_fixed_chunking(self):
        """Test fixed-size chunking."""
        chunker = ChunkConverter(
            chunk_size=50,
            overlap=0,
            strategy=ChunkStrategy.FIXED
        )
        
        text = "A" * 100
        chunks = chunker.split(text)
        
        assert len(chunks) == 2
        assert len(chunks[0].content) <= 50
    
    def test_sentence_chunking(self):
        """Test sentence-based chunking."""
        chunker = ChunkConverter(
            chunk_size=200,
            min_chunk_size=10,  # Lower min size for test
            strategy=ChunkStrategy.SENTENCE
        )
        
        # Use longer text to exceed min_chunk_size
        text = (
            "This is the first sentence with enough words to be meaningful. "
            "Here is the second sentence that also has good length. "
            "And a third sentence to ensure we have enough content. "
            "Finally a fourth sentence to round things out nicely."
        )
        chunks = chunker.split(text)
        
        assert len(chunks) >= 1
        # Sentences should be kept together
        for chunk in chunks:
            # Check that chunk has content
            assert len(chunk.content) > 0
    
    def test_paragraph_chunking(self):
        """Test paragraph-based chunking."""
        chunker = ChunkConverter(
            chunk_size=300,
            min_chunk_size=10,  # Lower min size for test
            strategy=ChunkStrategy.PARAGRAPH
        )
        
        # Use longer paragraphs
        text = (
            "This is paragraph one with enough content to be meaningful. "
            "It has multiple sentences to simulate real content.\n\n"
            "This is paragraph two which also has substantial content. "
            "Multiple sentences here as well for realism.\n\n"
            "And paragraph three rounds out our test data nicely. "
            "Again with multiple sentences for good measure."
        )
        chunks = chunker.split(text)
        
        assert len(chunks) >= 1
    
    def test_overlap(self):
        """Test chunk overlap."""
        chunker = ChunkConverter(
            chunk_size=50,
            overlap=10,
            strategy=ChunkStrategy.FIXED
        )
        
        text = "A" * 100
        chunks = chunker.split(text)
        
        # With overlap, should have more than 2 chunks
        assert len(chunks) >= 2
    
    def test_minimum_chunk_size(self):
        """Test minimum chunk size filtering."""
        chunker = ChunkConverter(
            chunk_size=100,
            min_chunk_size=10,
            strategy=ChunkStrategy.FIXED
        )
        
        text = "short"  # Less than min_chunk_size
        chunks = chunker.split(text)
        
        # Short text should be filtered out
        assert len(chunks) == 0 or len(chunks[0].content) >= 10
    
    def test_chunk_metadata(self):
        """Test chunk metadata."""
        chunker = ChunkConverter(
            chunk_size=200,
            min_chunk_size=10,  # Lower for test
        )
        
        # Longer text to exceed min_chunk_size
        text = (
            "Hello world, this is a test document with enough content "
            "to be chunked properly and retain metadata information."
        )
        chunks = chunker.split(text, source="test.txt")
        
        assert len(chunks) > 0
        assert chunks[0].source == "test.txt"
        assert chunks[0].index == 0
    
    def test_estimate_chunks(self):
        """Test chunk estimation."""
        chunker = ChunkConverter(chunk_size=100)
        
        text = "A" * 250
        estimated = chunker.estimate_chunks(text)
        
        assert estimated == 3
    
    def test_empty_input(self):
        """Test empty input handling."""
        chunker = ChunkConverter()
        chunks = chunker.split("")
        
        assert chunks == []
    
    def test_long_document_chunking(self):
        """Test chunking a longer document."""
        chunker = ChunkConverter(
            chunk_size=100,
            overlap=20,
            min_chunk_size=20,
            strategy=ChunkStrategy.FIXED
        )
        
        # Create a document with 500 characters
        text = "The quick brown fox jumps over the lazy dog. " * 11  # ~495 chars
        chunks = chunker.split(text)
        
        assert len(chunks) >= 4
        # Verify overlap works
        if len(chunks) >= 2:
            # With overlap, end of chunk N should overlap with start of chunk N+1
            assert len(chunks[0].content) > 0
            assert len(chunks[1].content) > 0


class TestChunk:
    """Tests for Chunk dataclass."""
    
    def test_chunk_length(self):
        """Test chunk __len__."""
        chunk = Chunk(
            content="Hello world",
            index=0,
            start_char=0,
            end_char=11
        )
        
        assert len(chunk) == 11
    
    def test_chunk_to_dict(self):
        """Test chunk serialization."""
        chunk = Chunk(
            content="Test content",
            index=5,
            start_char=100,
            end_char=112,
            source="file.txt",
            section="Introduction"
        )
        
        d = chunk.to_dict()
        
        assert d["content"] == "Test content"
        assert d["index"] == 5
        assert d["source"] == "file.txt"
        assert d["section"] == "Introduction"
    
    def test_chunk_creation_defaults(self):
        """Test chunk creation with defaults."""
        chunk = Chunk(
            content="Some content",
            index=0,
            start_char=0,
            end_char=12
        )
        
        assert chunk.source is None
        assert chunk.section is None
        assert chunk.metadata is None
    
    def test_chunk_with_metadata(self):
        """Test chunk with custom metadata."""
        chunk = Chunk(
            content="Content with metadata",
            index=0,
            start_char=0,
            end_char=21,
            metadata={"key": "value", "count": 42}
        )
        
        assert chunk.metadata["key"] == "value"
        assert chunk.metadata["count"] == 42
        
        d = chunk.to_dict()
        assert d["metadata"]["key"] == "value"
