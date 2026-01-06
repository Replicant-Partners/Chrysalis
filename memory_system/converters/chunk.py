"""
Chunk Converter - Semantic text chunking.

Splits content into semantic chunks for embedding and retrieval:
- Sentence-based chunking
- Paragraph-based chunking
- Token-aware chunking
- Overlap handling

Ported from Ludwig's chunker.py with enhancements.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Callable
from enum import Enum

logger = logging.getLogger(__name__)


class ChunkStrategy(Enum):
    """Chunking strategy."""
    FIXED = "fixed"  # Fixed character size
    SENTENCE = "sentence"  # Sentence boundaries
    PARAGRAPH = "paragraph"  # Paragraph boundaries
    SEMANTIC = "semantic"  # Semantic boundaries (headings, etc.)
    TOKEN = "token"  # Token-based (requires tokenizer)


@dataclass
class Chunk:
    """A text chunk with metadata."""
    
    content: str
    index: int
    start_char: int
    end_char: int
    
    # Optional metadata
    source: Optional[str] = None
    section: Optional[str] = None
    
    # Token count (if calculated)
    token_count: Optional[int] = None
    
    # Overlap info
    overlap_start: int = 0
    overlap_end: int = 0
    
    def __len__(self) -> int:
        return len(self.content)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "content": self.content,
            "index": self.index,
            "start_char": self.start_char,
            "end_char": self.end_char,
            "source": self.source,
            "section": self.section,
            "token_count": self.token_count,
            "overlap_start": self.overlap_start,
            "overlap_end": self.overlap_end,
        }


class ChunkConverter:
    """
    Semantic text chunker.
    
    Splits text into chunks suitable for embedding and retrieval.
    Supports multiple strategies and handles overlap between chunks.
    
    Features:
    - Multiple chunking strategies
    - Configurable chunk size and overlap
    - Token-aware chunking
    - Metadata preservation
    
    Usage:
        chunker = ChunkConverter(
            chunk_size=512,
            overlap=50,
            strategy=ChunkStrategy.SENTENCE
        )
        
        # Split text
        chunks = chunker.split("Long document text...")
        for chunk in chunks:
            print(f"Chunk {chunk.index}: {len(chunk)} chars")
            
        # With tokenizer
        chunker = ChunkConverter(
            chunk_size=256,
            strategy=ChunkStrategy.TOKEN,
            tokenizer=my_tokenizer
        )
    """
    
    def __init__(
        self,
        chunk_size: int = 512,
        overlap: int = 50,
        strategy: ChunkStrategy = ChunkStrategy.SENTENCE,
        min_chunk_size: int = 50,
        tokenizer: Optional[Callable[[str], List[str]]] = None,
    ):
        """
        Initialize chunk converter.
        
        Args:
            chunk_size: Target chunk size (chars or tokens)
            overlap: Overlap between chunks
            strategy: Chunking strategy
            min_chunk_size: Minimum chunk size
            tokenizer: Token counter function (required for TOKEN strategy)
        """
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.strategy = strategy
        self.min_chunk_size = min_chunk_size
        self.tokenizer = tokenizer
        
        if strategy == ChunkStrategy.TOKEN and tokenizer is None:
            logger.warning("TOKEN strategy without tokenizer, falling back to SENTENCE")
            self.strategy = ChunkStrategy.SENTENCE
    
    def split(
        self, 
        text: str, 
        source: Optional[str] = None
    ) -> List[Chunk]:
        """
        Split text into chunks.
        
        Args:
            text: Text to split
            source: Source identifier for metadata
            
        Returns:
            List of Chunk objects
        """
        if not text or not text.strip():
            return []
        
        # Choose strategy
        if self.strategy == ChunkStrategy.FIXED:
            chunks = self._split_fixed(text)
        elif self.strategy == ChunkStrategy.SENTENCE:
            chunks = self._split_sentence(text)
        elif self.strategy == ChunkStrategy.PARAGRAPH:
            chunks = self._split_paragraph(text)
        elif self.strategy == ChunkStrategy.SEMANTIC:
            chunks = self._split_semantic(text)
        elif self.strategy == ChunkStrategy.TOKEN:
            chunks = self._split_token(text)
        else:
            chunks = self._split_fixed(text)
        
        # Add source metadata
        if source:
            for chunk in chunks:
                chunk.source = source
        
        return chunks
    
    def _split_fixed(self, text: str) -> List[Chunk]:
        """Split by fixed character size."""
        chunks = []
        start = 0
        index = 0
        
        while start < len(text):
            end = min(start + self.chunk_size, len(text))
            
            # Try to end at word boundary
            if end < len(text):
                space_idx = text.rfind(" ", start, end)
                if space_idx > start + self.min_chunk_size:
                    end = space_idx
            
            content = text[start:end].strip()
            
            if len(content) >= self.min_chunk_size:
                # Calculate overlap
                overlap_start = 0
                if index > 0 and self.overlap > 0:
                    overlap_start = self.overlap
                
                chunks.append(Chunk(
                    content=content,
                    index=index,
                    start_char=start,
                    end_char=end,
                    overlap_start=overlap_start,
                ))
                index += 1
            
            # Move start, accounting for overlap
            start = end - self.overlap if self.overlap < (end - start) else end
        
        return chunks
    
    def _split_sentence(self, text: str) -> List[Chunk]:
        """Split by sentence boundaries."""
        # Sentence splitting regex
        sentence_pattern = r'(?<=[.!?])\s+(?=[A-Z])'
        sentences = re.split(sentence_pattern, text)
        
        chunks = []
        current_chunk = ""
        current_start = 0
        index = 0
        char_pos = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # Check if adding this sentence exceeds chunk size
            if current_chunk and len(current_chunk) + len(sentence) + 1 > self.chunk_size:
                # Save current chunk
                if len(current_chunk) >= self.min_chunk_size:
                    chunks.append(Chunk(
                        content=current_chunk,
                        index=index,
                        start_char=current_start,
                        end_char=char_pos,
                    ))
                    index += 1
                
                # Start new chunk with overlap
                if self.overlap > 0 and current_chunk:
                    # Get last N characters for overlap
                    overlap_text = current_chunk[-self.overlap:]
                    # Try to start at word boundary
                    space_idx = overlap_text.find(" ")
                    if space_idx > 0:
                        overlap_text = overlap_text[space_idx:].strip()
                    current_chunk = overlap_text + " " + sentence
                    current_start = char_pos - len(overlap_text)
                else:
                    current_chunk = sentence
                    current_start = char_pos
            else:
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
                    current_start = char_pos
            
            char_pos += len(sentence) + 1
        
        # Add remaining chunk
        if current_chunk and len(current_chunk) >= self.min_chunk_size:
            chunks.append(Chunk(
                content=current_chunk,
                index=index,
                start_char=current_start,
                end_char=char_pos,
            ))
        
        return chunks
    
    def _split_paragraph(self, text: str) -> List[Chunk]:
        """Split by paragraph boundaries."""
        # Split on double newlines
        paragraphs = re.split(r'\n\s*\n', text)
        
        chunks = []
        current_chunk = ""
        current_start = 0
        index = 0
        char_pos = 0
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            # Check if adding this paragraph exceeds chunk size
            if current_chunk and len(current_chunk) + len(para) + 2 > self.chunk_size:
                # Save current chunk
                if len(current_chunk) >= self.min_chunk_size:
                    chunks.append(Chunk(
                        content=current_chunk,
                        index=index,
                        start_char=current_start,
                        end_char=char_pos,
                    ))
                    index += 1
                
                # Start new chunk
                current_chunk = para
                current_start = char_pos
            else:
                if current_chunk:
                    current_chunk += "\n\n" + para
                else:
                    current_chunk = para
                    current_start = char_pos
            
            char_pos += len(para) + 2
        
        # Add remaining chunk
        if current_chunk and len(current_chunk) >= self.min_chunk_size:
            chunks.append(Chunk(
                content=current_chunk,
                index=index,
                start_char=current_start,
                end_char=char_pos,
            ))
        
        return chunks
    
    def _split_semantic(self, text: str) -> List[Chunk]:
        """Split by semantic boundaries (headings, sections)."""
        # Identify semantic boundaries
        # - Markdown headings
        # - Section dividers
        # - List items
        
        boundary_pattern = r'(?=^#{1,6}\s|\n---\n|\n\*\*\*\n|\n___\n)'
        sections = re.split(boundary_pattern, text, flags=re.MULTILINE)
        
        chunks = []
        current_chunk = ""
        current_start = 0
        current_section = None
        index = 0
        char_pos = 0
        
        for section in sections:
            section = section.strip()
            if not section:
                continue
            
            # Detect section heading
            heading_match = re.match(r'^(#{1,6})\s+(.+?)$', section, re.MULTILINE)
            if heading_match:
                section_name = heading_match.group(2)
            else:
                section_name = None
            
            # Check if adding this section exceeds chunk size
            if current_chunk and len(current_chunk) + len(section) + 2 > self.chunk_size:
                # Save current chunk
                if len(current_chunk) >= self.min_chunk_size:
                    chunks.append(Chunk(
                        content=current_chunk,
                        index=index,
                        start_char=current_start,
                        end_char=char_pos,
                        section=current_section,
                    ))
                    index += 1
                
                # Start new chunk
                current_chunk = section
                current_start = char_pos
                current_section = section_name
            else:
                if current_chunk:
                    current_chunk += "\n\n" + section
                else:
                    current_chunk = section
                    current_start = char_pos
                    current_section = section_name
            
            char_pos += len(section) + 2
        
        # Add remaining chunk
        if current_chunk and len(current_chunk) >= self.min_chunk_size:
            chunks.append(Chunk(
                content=current_chunk,
                index=index,
                start_char=current_start,
                end_char=char_pos,
                section=current_section,
            ))
        
        return chunks
    
    def _split_token(self, text: str) -> List[Chunk]:
        """Split by token count."""
        if not self.tokenizer:
            return self._split_sentence(text)
        
        # Tokenize full text
        tokens = self.tokenizer(text)
        total_tokens = len(tokens)
        
        if total_tokens <= self.chunk_size:
            return [Chunk(
                content=text,
                index=0,
                start_char=0,
                end_char=len(text),
                token_count=total_tokens,
            )]
        
        # Split by sentences first, then group by token count
        sentence_pattern = r'(?<=[.!?])\s+(?=[A-Z])'
        sentences = re.split(sentence_pattern, text)
        
        chunks = []
        current_sentences = []
        current_tokens = 0
        index = 0
        char_pos = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            sentence_tokens = len(self.tokenizer(sentence))
            
            if current_tokens + sentence_tokens > self.chunk_size and current_sentences:
                # Save current chunk
                content = " ".join(current_sentences)
                if len(content) >= self.min_chunk_size:
                    chunks.append(Chunk(
                        content=content,
                        index=index,
                        start_char=char_pos - len(content),
                        end_char=char_pos,
                        token_count=current_tokens,
                    ))
                    index += 1
                
                # Reset
                current_sentences = [sentence]
                current_tokens = sentence_tokens
            else:
                current_sentences.append(sentence)
                current_tokens += sentence_tokens
            
            char_pos += len(sentence) + 1
        
        # Add remaining chunk
        if current_sentences:
            content = " ".join(current_sentences)
            if len(content) >= self.min_chunk_size:
                chunks.append(Chunk(
                    content=content,
                    index=index,
                    start_char=char_pos - len(content),
                    end_char=char_pos,
                    token_count=current_tokens,
                ))
        
        return chunks
    
    def estimate_chunks(self, text: str) -> int:
        """
        Estimate number of chunks without splitting.
        
        Args:
            text: Text to estimate
            
        Returns:
            Estimated chunk count
        """
        if not text:
            return 0
        
        if self.strategy == ChunkStrategy.TOKEN and self.tokenizer:
            tokens = len(self.tokenizer(text))
            return max(1, (tokens + self.chunk_size - 1) // self.chunk_size)
        else:
            return max(1, (len(text) + self.chunk_size - 1) // self.chunk_size)
    
    def merge_chunks(
        self, 
        chunks: List[Chunk], 
        separator: str = "\n\n"
    ) -> str:
        """
        Merge chunks back into text.
        
        Args:
            chunks: List of chunks to merge
            separator: Separator between chunks
            
        Returns:
            Merged text
        """
        # Handle overlap
        texts = []
        for i, chunk in enumerate(chunks):
            if i == 0:
                texts.append(chunk.content)
            else:
                # Skip overlap portion
                if chunk.overlap_start > 0:
                    texts.append(chunk.content[chunk.overlap_start:])
                else:
                    texts.append(chunk.content)
        
        return separator.join(texts)
