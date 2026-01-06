"""
Document Converter - Multi-format document processing.

Converts documents to plain text for semantic processing:
- PDF extraction
- HTML stripping
- Markdown parsing
- Plain text passthrough

Ported from Ludwig's document_processor.py with enhancements.
"""

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Conditional imports for optional dependencies
try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False
    pypdf = None

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False
    BeautifulSoup = None

try:
    import markdown
    MARKDOWN_AVAILABLE = True
except ImportError:
    MARKDOWN_AVAILABLE = False
    markdown = None


@dataclass
class ConversionResult:
    """Result of document conversion."""
    
    success: bool
    content: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    format: str = ""
    error: Optional[str] = None
    
    # Statistics
    char_count: int = 0
    word_count: int = 0
    line_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "success": self.success,
            "content": self.content[:500] + "..." if len(self.content) > 500 else self.content,
            "metadata": self.metadata,
            "format": self.format,
            "error": self.error,
            "char_count": self.char_count,
            "word_count": self.word_count,
            "line_count": self.line_count,
        }


class DocumentConverter:
    """
    Multi-format document converter.
    
    Converts various document formats to plain text for
    semantic processing and knowledge extraction.
    
    Supported formats:
    - PDF (.pdf) - requires pypdf
    - HTML (.html, .htm) - requires beautifulsoup4
    - Markdown (.md) - optional markdown library
    - Plain text (.txt)
    - Code files (most extensions)
    
    Usage:
        converter = DocumentConverter()
        
        # Convert a file
        result = converter.convert("paper.pdf")
        if result.success:
            print(f"Extracted {result.word_count} words")
            
        # Convert from string
        result = converter.convert_html("<html><body>Hello</body></html>")
    """
    
    # File extension to format mapping
    FORMAT_MAP = {
        ".pdf": "pdf",
        ".html": "html",
        ".htm": "html",
        ".md": "markdown",
        ".markdown": "markdown",
        ".txt": "text",
        ".rst": "text",
        ".json": "text",
        ".yaml": "text",
        ".yml": "text",
        ".xml": "text",
    }
    
    # Code file extensions
    CODE_EXTENSIONS = {
        ".py", ".js", ".ts", ".jsx", ".tsx",
        ".java", ".c", ".cpp", ".h", ".hpp",
        ".rs", ".go", ".rb", ".php", ".swift",
        ".kt", ".scala", ".clj", ".cs", ".fs",
        ".sh", ".bash", ".zsh", ".fish",
        ".sql", ".r", ".m", ".jl",
    }
    
    def __init__(
        self,
        strip_whitespace: bool = True,
        preserve_structure: bool = True,
    ):
        """
        Initialize document converter.
        
        Args:
            strip_whitespace: Remove excessive whitespace
            preserve_structure: Keep paragraph/section breaks
        """
        self.strip_whitespace = strip_whitespace
        self.preserve_structure = preserve_structure
    
    def convert(
        self, 
        source: str, 
        format: Optional[str] = None
    ) -> ConversionResult:
        """
        Convert document to plain text.
        
        Args:
            source: File path or content string
            format: Override format detection
            
        Returns:
            ConversionResult with extracted text
        """
        # Determine if source is a file path
        path = Path(source)
        is_file = path.exists() and path.is_file()
        
        if is_file:
            return self._convert_file(path, format)
        else:
            # Treat as content string
            return self._convert_content(source, format or "text")
    
    def _convert_file(
        self, 
        path: Path, 
        format: Optional[str] = None
    ) -> ConversionResult:
        """Convert a file to text."""
        # Detect format
        if format is None:
            ext = path.suffix.lower()
            format = self.FORMAT_MAP.get(ext)
            
            if format is None:
                if ext in self.CODE_EXTENSIONS:
                    format = "code"
                else:
                    format = "text"
        
        # Read and convert based on format
        try:
            if format == "pdf":
                return self._convert_pdf(path)
            elif format == "html":
                content = path.read_text(encoding="utf-8", errors="replace")
                return self._convert_html(content)
            elif format == "markdown":
                content = path.read_text(encoding="utf-8", errors="replace")
                return self._convert_markdown(content)
            else:
                content = path.read_text(encoding="utf-8", errors="replace")
                return self._convert_text(content, format)
                
        except Exception as e:
            return ConversionResult(
                success=False,
                error=str(e),
                format=format,
            )
    
    def _convert_content(
        self, 
        content: str, 
        format: str
    ) -> ConversionResult:
        """Convert content string to text."""
        if format == "html":
            return self._convert_html(content)
        elif format == "markdown":
            return self._convert_markdown(content)
        else:
            return self._convert_text(content, format)
    
    def _convert_pdf(self, path: Path) -> ConversionResult:
        """Extract text from PDF."""
        if not PYPDF_AVAILABLE:
            return ConversionResult(
                success=False,
                error="pypdf not installed. Install with: pip install pypdf",
                format="pdf",
            )
        
        try:
            reader = pypdf.PdfReader(str(path))
            
            # Extract metadata
            metadata = {}
            if reader.metadata:
                metadata = {
                    "title": reader.metadata.get("/Title", ""),
                    "author": reader.metadata.get("/Author", ""),
                    "subject": reader.metadata.get("/Subject", ""),
                    "creator": reader.metadata.get("/Creator", ""),
                    "pages": len(reader.pages),
                }
            
            # Extract text from all pages
            pages = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            
            content = "\n\n".join(pages)
            
            if self.strip_whitespace:
                content = self._clean_whitespace(content)
            
            return ConversionResult(
                success=True,
                content=content,
                metadata=metadata,
                format="pdf",
                char_count=len(content),
                word_count=len(content.split()),
                line_count=content.count("\n") + 1,
            )
            
        except Exception as e:
            return ConversionResult(
                success=False,
                error=f"PDF extraction failed: {e}",
                format="pdf",
            )
    
    def _convert_html(self, content: str) -> ConversionResult:
        """Extract text from HTML."""
        if not BS4_AVAILABLE:
            # Fallback: basic regex stripping
            text = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<[^>]+>', ' ', text)
            text = re.sub(r'&nbsp;', ' ', text)
            text = re.sub(r'&[a-z]+;', ' ', text)
            
            if self.strip_whitespace:
                text = self._clean_whitespace(text)
            
            return ConversionResult(
                success=True,
                content=text,
                format="html",
                char_count=len(text),
                word_count=len(text.split()),
                line_count=text.count("\n") + 1,
            )
        
        try:
            soup = BeautifulSoup(content, "html.parser")
            
            # Remove scripts, styles, and navigation
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            
            # Extract text
            if self.preserve_structure:
                # Preserve some structure with newlines
                for br in soup.find_all("br"):
                    br.replace_with("\n")
                for p in soup.find_all("p"):
                    p.insert_after("\n\n")
                for heading in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
                    heading.insert_after("\n\n")
                    heading.insert_before("\n\n")
            
            text = soup.get_text(separator=" ")
            
            # Extract metadata
            metadata = {}
            title = soup.find("title")
            if title:
                metadata["title"] = title.get_text()
            
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc:
                metadata["description"] = meta_desc.get("content", "")
            
            if self.strip_whitespace:
                text = self._clean_whitespace(text)
            
            return ConversionResult(
                success=True,
                content=text,
                metadata=metadata,
                format="html",
                char_count=len(text),
                word_count=len(text.split()),
                line_count=text.count("\n") + 1,
            )
            
        except Exception as e:
            return ConversionResult(
                success=False,
                error=f"HTML parsing failed: {e}",
                format="html",
            )
    
    def _convert_markdown(self, content: str) -> ConversionResult:
        """Convert Markdown to plain text."""
        if MARKDOWN_AVAILABLE:
            try:
                # Convert to HTML first, then strip
                html = markdown.markdown(content)
                return self._convert_html(html)
            except Exception:
                pass
        
        # Fallback: regex-based conversion
        text = content
        
        # Remove headers (keep text)
        text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
        
        # Remove emphasis markers
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
        text = re.sub(r'\*([^*]+)\*', r'\1', text)
        text = re.sub(r'__([^_]+)__', r'\1', text)
        text = re.sub(r'_([^_]+)_', r'\1', text)
        
        # Remove inline code markers
        text = re.sub(r'`([^`]+)`', r'\1', text)
        
        # Remove code blocks
        text = re.sub(r'```[^`]*```', '', text, flags=re.DOTALL)
        
        # Remove links (keep text)
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
        
        # Remove images
        text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', r'\1', text)
        
        # Remove list markers
        text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
        
        # Remove blockquote markers
        text = re.sub(r'^>\s*', '', text, flags=re.MULTILINE)
        
        if self.strip_whitespace:
            text = self._clean_whitespace(text)
        
        return ConversionResult(
            success=True,
            content=text,
            format="markdown",
            char_count=len(text),
            word_count=len(text.split()),
            line_count=text.count("\n") + 1,
        )
    
    def _convert_text(self, content: str, format: str) -> ConversionResult:
        """Process plain text content."""
        if self.strip_whitespace:
            content = self._clean_whitespace(content)
        
        return ConversionResult(
            success=True,
            content=content,
            format=format,
            char_count=len(content),
            word_count=len(content.split()),
            line_count=content.count("\n") + 1,
        )
    
    def _clean_whitespace(self, text: str) -> str:
        """Clean excessive whitespace while preserving structure."""
        # Replace tabs with spaces
        text = text.replace("\t", " ")
        
        # Collapse multiple spaces
        text = re.sub(r' +', ' ', text)
        
        # Collapse excessive newlines
        if self.preserve_structure:
            text = re.sub(r'\n{3,}', '\n\n', text)
        else:
            text = re.sub(r'\n+', ' ', text)
        
        # Strip lines
        lines = [line.strip() for line in text.split("\n")]
        text = "\n".join(lines)
        
        return text.strip()
    
    def convert_html(self, content: str) -> ConversionResult:
        """Convenience method for HTML conversion."""
        return self._convert_html(content)
    
    def convert_markdown(self, content: str) -> ConversionResult:
        """Convenience method for Markdown conversion."""
        return self._convert_markdown(content)
