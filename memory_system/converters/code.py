"""
Code Converter - Source code semantic extraction.

Extracts semantic information from source code:
- Function/class definitions
- Imports and dependencies
- Comments and docstrings
- Call relationships

Ported from Ludwig's code_analyzer.py with enhancements.
"""

import ast
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


@dataclass
class CodeChunk:
    """A semantic chunk of code."""
    
    name: str
    kind: str  # function, class, method, import, comment
    content: str
    start_line: int
    end_line: int
    docstring: Optional[str] = None
    decorators: List[str] = field(default_factory=list)
    parent: Optional[str] = None
    calls: List[str] = field(default_factory=list)
    imports: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "kind": self.kind,
            "content": self.content,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "docstring": self.docstring,
            "decorators": self.decorators,
            "parent": self.parent,
            "calls": self.calls,
            "imports": self.imports,
        }


class CodeConverter:
    """
    Source code semantic extractor.
    
    Extracts semantic information from source code files
    for knowledge graph construction and semantic search.
    
    Features:
    - AST-based analysis for Python
    - Regex-based fallback for other languages
    - Docstring extraction
    - Call graph construction
    - Import dependency tracking
    
    Usage:
        converter = CodeConverter()
        
        # Extract chunks from file
        chunks = converter.extract("src/main.py")
        for chunk in chunks:
            print(f"{chunk.kind}: {chunk.name}")
            
        # Get imports
        imports = converter.get_imports("src/main.py")
    """
    
    # Language detection by extension
    LANGUAGE_MAP = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".jsx": "javascript",
        ".tsx": "typescript",
        ".java": "java",
        ".c": "c",
        ".cpp": "cpp",
        ".h": "c",
        ".hpp": "cpp",
        ".rs": "rust",
        ".go": "go",
        ".rb": "ruby",
        ".php": "php",
        ".swift": "swift",
        ".kt": "kotlin",
        ".scala": "scala",
        ".clj": "clojure",
        ".cs": "csharp",
    }
    
    def __init__(
        self,
        include_comments: bool = True,
        extract_calls: bool = True,
        max_chunk_lines: int = 200,
    ):
        """
        Initialize code converter.
        
        Args:
            include_comments: Include standalone comments
            extract_calls: Extract function calls
            max_chunk_lines: Maximum lines per chunk
        """
        self.include_comments = include_comments
        self.extract_calls = extract_calls
        self.max_chunk_lines = max_chunk_lines
    
    def extract(
        self, 
        source: str, 
        language: Optional[str] = None
    ) -> List[CodeChunk]:
        """
        Extract semantic chunks from source code.
        
        Args:
            source: File path or code string
            language: Override language detection
            
        Returns:
            List of CodeChunk objects
        """
        # Check if source is a file
        path = Path(source)
        if path.is_file():
            content = path.read_text(encoding="utf-8", errors="replace")
            if language is None:
                language = self.LANGUAGE_MAP.get(path.suffix.lower(), "unknown")
        else:
            content = source
            language = language or "python"
        
        # Extract based on language
        if language == "python":
            return self._extract_python(content)
        else:
            return self._extract_generic(content, language)
    
    def get_imports(
        self, 
        source: str, 
        language: Optional[str] = None
    ) -> List[str]:
        """
        Extract imports from source code.
        
        Args:
            source: File path or code string
            language: Override language detection
            
        Returns:
            List of imported module/package names
        """
        path = Path(source)
        if path.is_file():
            content = path.read_text(encoding="utf-8", errors="replace")
            if language is None:
                language = self.LANGUAGE_MAP.get(path.suffix.lower(), "unknown")
        else:
            content = source
            language = language or "python"
        
        if language == "python":
            return self._get_python_imports(content)
        elif language in ("javascript", "typescript"):
            return self._get_js_imports(content)
        else:
            return []
    
    def get_definitions(
        self, 
        source: str, 
        language: Optional[str] = None
    ) -> Dict[str, List[str]]:
        """
        Get all definitions grouped by kind.
        
        Args:
            source: File path or code string
            language: Override language detection
            
        Returns:
            Dict mapping kind to list of names
        """
        chunks = self.extract(source, language)
        
        definitions: Dict[str, List[str]] = {}
        for chunk in chunks:
            if chunk.kind not in definitions:
                definitions[chunk.kind] = []
            definitions[chunk.kind].append(chunk.name)
        
        return definitions
    
    def _extract_python(self, content: str) -> List[CodeChunk]:
        """Extract chunks from Python code using AST."""
        chunks = []
        lines = content.split("\n")

        try:
            tree = ast.parse(content)
        except SyntaxError as e:
            logger.warning(f"Python syntax error: {e}")
            return self._extract_generic(content, "python")

        # Extract module-level docstring
        if (tree.body and isinstance(tree.body[0], ast.Expr) and 
            isinstance(tree.body[0].value, (ast.Str, ast.Constant))):
            doc_node = tree.body[0]
            if isinstance(doc_node.value, ast.Str):
                docstring = doc_node.value.s
            else:
                docstring = str(doc_node.value.value)

            chunks.append(CodeChunk(
                name="__module__",
                kind="docstring",
                content=docstring,
                start_line=doc_node.lineno,
                end_line=doc_node.end_lineno or doc_node.lineno,
                docstring=docstring,
            ))

        # Extract imports
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    chunks.append(CodeChunk(
                        name=alias.asname or alias.name,
                        kind="import",
                        content=f"import {alias.name}" + (f" as {alias.asname}" if alias.asname else ""),
                        start_line=node.lineno,
                        end_line=node.lineno,
                        imports=[alias.name],
                    ))

            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                for alias in node.names:
                    full_name = f"{module}.{alias.name}" if module else alias.name
                    chunks.append(CodeChunk(
                        name=alias.asname or alias.name,
                        kind="import",
                        content=f"from {module} import {alias.name}" + (f" as {alias.asname}" if alias.asname else ""),
                        start_line=node.lineno,
                        end_line=node.lineno,
                        imports=[full_name],
                    ))

        # Extract classes and functions
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.ClassDef):
                chunks.extend(self._extract_python_class(node, lines))
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                chunks.append(self._extract_python_function(node, lines))

        return chunks
    
    def _extract_python_class(
        self, 
        node: ast.ClassDef, 
        lines: List[str]
    ) -> List[CodeChunk]:
        """Extract class and its methods."""
        # Class chunk
        start = node.lineno
        end = node.end_lineno or start
        content = "\n".join(lines[start - 1:end])

        # Get docstring
        docstring = ast.get_docstring(node)

        # Get decorators
        decorators = []
        for dec in node.decorator_list:
            if isinstance(dec, ast.Name):
                decorators.append(dec.id)
            elif isinstance(dec, ast.Call) and isinstance(dec.func, ast.Name):
                decorators.append(dec.func.id)
            elif isinstance(dec, ast.Attribute):
                decorators.append(dec.attr)

        chunks = [
            CodeChunk(
                name=node.name,
                kind="class",
                content=content,
                start_line=start,
                end_line=end,
                docstring=docstring,
                decorators=decorators,
            )
        ]
        # Extract methods
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                method_chunk = self._extract_python_function(item, lines)
                method_chunk.parent = node.name
                method_chunk.kind = "method"
                chunks.append(method_chunk)

        return chunks
    
    def _extract_python_function(
        self, 
        node: ast.FunctionDef | ast.AsyncFunctionDef, 
        lines: List[str]
    ) -> CodeChunk:
        """Extract function definition."""
        start = node.lineno
        end = node.end_lineno or start
        content = "\n".join(lines[start - 1:end])
        
        # Get docstring
        docstring = ast.get_docstring(node)
        
        # Get decorators
        decorators = []
        for dec in node.decorator_list:
            if isinstance(dec, ast.Name):
                decorators.append(dec.id)
            elif isinstance(dec, ast.Call) and isinstance(dec.func, ast.Name):
                decorators.append(dec.func.id)
            elif isinstance(dec, ast.Attribute):
                decorators.append(dec.attr)
        
        # Extract calls if enabled
        calls = []
        if self.extract_calls:
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    if isinstance(child.func, ast.Name):
                        calls.append(child.func.id)
                    elif isinstance(child.func, ast.Attribute):
                        calls.append(child.func.attr)
        
        kind = "function"
        if isinstance(node, ast.AsyncFunctionDef):
            kind = "async_function"
        
        return CodeChunk(
            name=node.name,
            kind=kind,
            content=content,
            start_line=start,
            end_line=end,
            docstring=docstring,
            decorators=decorators,
            calls=list(set(calls)),
        )
    
    def _get_python_imports(self, content: str) -> List[str]:
        """Extract Python imports."""
        imports = []

        try:
            tree = ast.parse(content)

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    imports.extend(alias.name.split(".")[0] for alias in node.names)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports.append(node.module.split(".")[0])

        except SyntaxError:
            # Fallback to regex
            import_pattern = r'^(?:from\s+(\w+)|import\s+(\w+))'
            for match in re.finditer(import_pattern, content, re.MULTILINE):
                if match.group(1):
                    imports.append(match.group(1))
                elif match.group(2):
                    imports.append(match.group(2))

        return list(set(imports))
    
    def _get_js_imports(self, content: str) -> List[str]:
        """Extract JavaScript/TypeScript imports."""
        imports = []
        
        # ES6 imports
        es6_pattern = r"import\s+(?:.*?\s+from\s+)?['\"]([^'\"]+)['\"]"
        for match in re.finditer(es6_pattern, content):
            module = match.group(1)
            # Get base module name
            if module.startswith("."):
                imports.append(module)
            else:
                imports.append(module.split("/")[0])
        
        # CommonJS requires
        cjs_pattern = r"require\(['\"]([^'\"]+)['\"]\)"
        for match in re.finditer(cjs_pattern, content):
            module = match.group(1)
            if module.startswith("."):
                imports.append(module)
            else:
                imports.append(module.split("/")[0])
        
        return list(set(imports))
    
    def _extract_generic(
        self, 
        content: str, 
        language: str
    ) -> List[CodeChunk]:
        """Extract chunks using regex for non-Python languages."""
        chunks = []
        lines = content.split("\n")
        
        # Language-specific patterns
        patterns = self._get_language_patterns(language)
        
        # Extract functions/methods
        for match in re.finditer(patterns["function"], content, re.MULTILINE):
            name = match.group(1) if match.lastindex else "unknown"
            start_line = content[:match.start()].count("\n") + 1
            
            # Find end of function (simple brace matching)
            end_line = self._find_block_end(lines, start_line - 1)
            block_content = "\n".join(lines[start_line - 1:end_line])
            
            chunks.append(CodeChunk(
                name=name,
                kind="function",
                content=block_content,
                start_line=start_line,
                end_line=end_line,
            ))
        
        # Extract classes
        for match in re.finditer(patterns["class"], content, re.MULTILINE):
            name = match.group(1) if match.lastindex else "unknown"
            start_line = content[:match.start()].count("\n") + 1
            end_line = self._find_block_end(lines, start_line - 1)
            block_content = "\n".join(lines[start_line - 1:end_line])
            
            chunks.append(CodeChunk(
                name=name,
                kind="class",
                content=block_content,
                start_line=start_line,
                end_line=end_line,
            ))
        
        return chunks
    
    def _get_language_patterns(self, language: str) -> Dict[str, str]:
        """Get regex patterns for a language."""
        patterns = {
            "python": {
                "function": r"^\s*(?:async\s+)?def\s+(\w+)\s*\(",
                "class": r"^\s*class\s+(\w+)\s*[:\(]",
            },
            "javascript": {
                "function": r"(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))",
                "class": r"class\s+(\w+)",
            },
            "typescript": {
                "function": r"(?:function\s+(\w+)|(?:const|let|var|export\s+(?:const|let|var|default))\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))",
                "class": r"(?:export\s+)?class\s+(\w+)",
            },
            "java": {
                "function": r"(?:public|private|protected|static|\s)+\s+\w+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+(?:\s*,\s*\w+)*)?\s*\{",
                "class": r"(?:public|private|protected|abstract|final|\s)*class\s+(\w+)",
            },
            "rust": {
                "function": r"(?:pub\s+)?fn\s+(\w+)",
                "class": r"(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)",
            },
            "go": {
                "function": r"func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(",
                "class": r"type\s+(\w+)\s+struct",
            },
        }
        
        return patterns.get(language, {
            "function": r"function\s+(\w+)|def\s+(\w+)",
            "class": r"class\s+(\w+)",
        })
    
    def _find_block_end(
        self, 
        lines: List[str], 
        start_index: int
    ) -> int:
        """Find the end of a code block using brace matching."""
        brace_count = 0
        in_block = False
        
        for i, line in enumerate(lines[start_index:], start=start_index):
            brace_count += line.count("{") - line.count("}")
            
            if brace_count > 0:
                in_block = True
            
            if in_block and brace_count <= 0:
                return i + 1
            
            # Safety limit
            if i - start_index > self.max_chunk_lines:
                return i + 1
        
        return len(lines)
