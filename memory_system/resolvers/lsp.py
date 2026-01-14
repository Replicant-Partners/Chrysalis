"""
LSP Resolver - Language Server Protocol Integration.

Provides symbol resolution via LSP for accurate code understanding:
- Definition lookup
- Reference finding
- Symbol information retrieval
- Type inference

Ported from Ludwig's lsp_resolver.py with enhancements.
"""

import asyncio
import json
import logging
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


@dataclass
class Position:
    """Position in a text document."""
    line: int  # 0-indexed
    character: int  # 0-indexed


@dataclass
class Range:
    """Range in a text document."""
    start: Position
    end: Position

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start": {"line": self.start.line, "character": self.start.character},
            "end": {"line": self.end.line, "character": self.end.character},
        }


@dataclass
class Location:
    """Location in a document."""
    uri: str
    range: Range

    @property
    def file_path(self) -> str:
        """Get file path from URI."""
        if self.uri.startswith("file://"):
            return self.uri[7:]
        return self.uri

    def to_dict(self) -> Dict[str, Any]:
        return {
            "uri": self.uri,
            "range": self.range.to_dict(),
        }


@dataclass
class SymbolInfo:
    """Information about a symbol."""
    name: str
    kind: str  # function, class, variable, etc.
    location: Optional[Location] = None
    container_name: Optional[str] = None
    documentation: Optional[str] = None
    detail: Optional[str] = None  # signature, type, etc.

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "kind": self.kind,
            "location": self.location.to_dict() if self.location else None,
            "container_name": self.container_name,
            "documentation": self.documentation,
            "detail": self.detail,
        }


@dataclass
class LSPResult:
    """Result of an LSP operation."""
    success: bool
    data: Any = None
    error: Optional[str] = None
    method: str = ""
    elapsed_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "method": self.method,
            "elapsed_ms": self.elapsed_ms,
        }


# Symbol kind mapping (LSP spec)
SYMBOL_KINDS = {
    1: "file",
    2: "module",
    3: "namespace",
    4: "package",
    5: "class",
    6: "method",
    7: "property",
    8: "field",
    9: "constructor",
    10: "enum",
    11: "interface",
    12: "function",
    13: "variable",
    14: "constant",
    15: "string",
    16: "number",
    17: "boolean",
    18: "array",
    19: "object",
    20: "key",
    21: "null",
    22: "enum_member",
    23: "struct",
    24: "event",
    25: "operator",
    26: "type_parameter",
}


class LSPResolver:
    """
    Language Server Protocol resolver for symbol analysis.

    Communicates with language servers to provide accurate:
    - Definition lookup
    - Reference finding
    - Symbol information
    - Hover documentation
    - Type inference

    Supports multiple languages via configurable server commands:
    - Python: pylsp, pyright-langserver
    - TypeScript/JavaScript: typescript-language-server
    - Rust: rust-analyzer
    - Go: gopls

    Usage:
        resolver = LSPResolver(server_cmd=["pylsp"])
        await resolver.initialize("/path/to/project")

        # Find definition
        result = await resolver.find_definition("src/main.py", 10, 5)
        if result.success:
            print(f"Definition at: {result.data}")

        # Find references
        result = await resolver.find_references("src/main.py", 10, 5)

        await resolver.shutdown()
    """

    # Default language server commands (allowlisted for security)
    # Only known-safe executables are permitted
    SERVER_COMMANDS = {
        ".py": ["pylsp"],
        ".ts": ["typescript-language-server", "--stdio"],
        ".js": ["typescript-language-server", "--stdio"],
        ".rs": ["rust-analyzer"],
        ".go": ["gopls", "serve"],
    }

    # Allowlist of permitted executables for subprocess security
    ALLOWED_EXECUTABLES = frozenset([
        "pylsp",
        "pyright-langserver",
        "typescript-language-server",
        "rust-analyzer",
        "gopls",
        "clangd",
        "jdtls",
    ])

    def __init__(
        self,
        server_cmd: Optional[List[str]] = None,
        workspace_root: Optional[Path] = None,
        timeout: float = 5.0,
    ):
        """
        Initialize LSP resolver.

        Args:
            server_cmd: Language server command and args
            workspace_root: Root directory of workspace
            timeout: Request timeout in seconds
        """
        self.server_cmd = server_cmd
        self.workspace_root = workspace_root
        self.timeout = timeout

        self._process: Optional[subprocess.Popen] = None
        self._request_id = 0
        self._initialized = False
        self._pending_requests: Dict[int, asyncio.Future] = {}
        self._read_task: Optional[asyncio.Task] = None
        self._capabilities: Dict[str, Any] = {}

    async def initialize(self, workspace_path: Union[str, Path]) -> LSPResult:
        """
        Initialize connection to language server.

        Args:
            workspace_path: Path to workspace root

        Returns:
            LSPResult with server capabilities
        """
        import time
        start = time.perf_counter()

        self.workspace_root = Path(workspace_path).absolute()

        # Detect server command if not specified
        if not self.server_cmd:
            # Find a source file to detect language
            for ext, cmd in self.SERVER_COMMANDS.items():
                if list(self.workspace_root.rglob(f"*{ext}")):
                    self.server_cmd = cmd
                    break

            if not self.server_cmd:
                self.server_cmd = ["pylsp"]  # Default to Python

        # Validate server command against allowlist for security
        if not self.server_cmd:
            return LSPResult(
                success=False,
                error="No language server command specified",
                method="initialize",
            )

        executable = self.server_cmd[0]
        # Extract base name for allowlist check (handles paths like /usr/bin/pylsp)
        base_executable = Path(executable).name if "/" in executable or "\\" in executable else executable

        if base_executable not in self.ALLOWED_EXECUTABLES:
            return LSPResult(
                success=False,
                error=f"Language server '{base_executable}' is not in the allowlist of permitted executables. "
                      f"Allowed: {', '.join(sorted(self.ALLOWED_EXECUTABLES))}",
                method="initialize",
            )

        # Start server process
        try:
            self._process = subprocess.Popen(
                self.server_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=str(self.workspace_root),
            )
        except FileNotFoundError:
            return LSPResult(
                success=False,
                error=f"Language server not found: {self.server_cmd[0]}",
                method="initialize",
            )

        # Start reader task
        self._read_task = asyncio.create_task(self._read_loop())

        # Send initialize request
        workspace_uri = f"file://{self.workspace_root}"

        result = await self._request("initialize", {
            "processId": None,
            "rootUri": workspace_uri,
            "rootPath": str(self.workspace_root),
            "capabilities": {
                "textDocument": {
                    "definition": {"dynamicRegistration": True},
                    "references": {"dynamicRegistration": True},
                    "hover": {"contentFormat": ["plaintext", "markdown"]},
                    "documentSymbol": {
                        "hierarchicalDocumentSymbolSupport": True,
                    },
                },
                "workspace": {
                    "workspaceFolders": True,
                },
            },
            "workspaceFolders": [{"uri": workspace_uri, "name": self.workspace_root.name}],
        })

        if result.success:
            self._capabilities = result.data.get("capabilities", {})

            # Send initialized notification
            await self._notify("initialized", {})
            self._initialized = True

        result.elapsed_ms = (time.perf_counter() - start) * 1000
        return result

    async def shutdown(self) -> None:
        """Shutdown the language server."""
        if not self._process:
            return

        try:
            await self._request("shutdown", None)
            await self._notify("exit", None)
        except Exception:
            pass

        if self._read_task:
            self._read_task.cancel()
            try:
                await self._read_task
            except asyncio.CancelledError:
                pass

        if self._process:
            self._process.terminate()
            try:
                self._process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self._process.kill()

        self._initialized = False

    async def find_definition(
        self,
        file_path: str,
        line: int,
        character: int
    ) -> LSPResult:
        """
        Find definition of symbol at position.

        Args:
            file_path: Path to source file
            line: Line number (1-indexed for user convenience)
            character: Character position (0-indexed)

        Returns:
            LSPResult with Location or list of Locations
        """
        if not self._initialized:
            return LSPResult(success=False, error="Not initialized", method="textDocument/definition")

        # Open the document first
        await self._open_document(file_path)

        uri = f"file://{Path(file_path).absolute()}"
        result = await self._request("textDocument/definition", {
            "textDocument": {"uri": uri},
            "position": {"line": line - 1, "character": character},  # Convert to 0-indexed
        })

        if result.success and result.data:
            locations = self._parse_locations(result.data)
            result.data = [loc.to_dict() for loc in locations]

        return result

    async def find_references(
        self,
        file_path: str,
        line: int,
        character: int,
        include_declaration: bool = True,
    ) -> LSPResult:
        """
        Find all references to symbol at position.

        Args:
            file_path: Path to source file
            line: Line number (1-indexed)
            character: Character position (0-indexed)
            include_declaration: Include the declaration in results

        Returns:
            LSPResult with list of Locations
        """
        if not self._initialized:
            return LSPResult(success=False, error="Not initialized", method="textDocument/references")

        await self._open_document(file_path)

        uri = f"file://{Path(file_path).absolute()}"
        result = await self._request("textDocument/references", {
            "textDocument": {"uri": uri},
            "position": {"line": line - 1, "character": character},
            "context": {"includeDeclaration": include_declaration},
        })

        if result.success and result.data:
            locations = self._parse_locations(result.data)
            result.data = [loc.to_dict() for loc in locations]

        return result

    async def get_hover(
        self,
        file_path: str,
        line: int,
        character: int,
    ) -> LSPResult:
        """
        Get hover information for symbol at position.

        Args:
            file_path: Path to source file
            line: Line number (1-indexed)
            character: Character position

        Returns:
            LSPResult with hover contents
        """
        if not self._initialized:
            return LSPResult(success=False, error="Not initialized", method="textDocument/hover")

        await self._open_document(file_path)

        uri = f"file://{Path(file_path).absolute()}"
        result = await self._request("textDocument/hover", {
            "textDocument": {"uri": uri},
            "position": {"line": line - 1, "character": character},
        })

        if result.success and result.data:
            contents = result.data.get("contents", "")
            if isinstance(contents, dict):
                contents = contents.get("value", str(contents))
            elif isinstance(contents, list):
                contents = "\n".join(
                    c.get("value", str(c)) if isinstance(c, dict) else str(c)
                    for c in contents
                )
            result.data = {"contents": contents}

        return result

    async def get_document_symbols(
        self,
        file_path: str,
    ) -> LSPResult:
        """
        Get all symbols in a document.

        Args:
            file_path: Path to source file

        Returns:
            LSPResult with list of SymbolInfo
        """
        if not self._initialized:
            return LSPResult(success=False, error="Not initialized", method="textDocument/documentSymbol")

        await self._open_document(file_path)

        uri = f"file://{Path(file_path).absolute()}"
        result = await self._request("textDocument/documentSymbol", {
            "textDocument": {"uri": uri},
        })

        if result.success and result.data:
            symbols = self._parse_symbols(result.data, uri)
            result.data = [s.to_dict() for s in symbols]

        return result

    async def get_workspace_symbols(
        self,
        query: str = "",
    ) -> LSPResult:
        """
        Search for symbols in workspace.

        Args:
            query: Symbol name to search for

        Returns:
            LSPResult with list of SymbolInfo
        """
        if not self._initialized:
            return LSPResult(success=False, error="Not initialized", method="workspace/symbol")

        result = await self._request("workspace/symbol", {"query": query})

        if result.success and result.data:
            symbols = self._parse_symbols(result.data)
            result.data = [s.to_dict() for s in symbols]

        return result

    async def _open_document(self, file_path: str) -> None:
        """Open a document in the language server."""
        path = Path(file_path).absolute()
        uri = f"file://{path}"

        try:
            content = path.read_text()
        except FileNotFoundError:
            logger.warning(f"File not found: {file_path}")
            return

        # Detect language ID from extension
        lang_ids = {
            ".py": "python",
            ".ts": "typescript",
            ".js": "javascript",
            ".rs": "rust",
            ".go": "go",
            ".java": "java",
            ".c": "c",
            ".cpp": "cpp",
            ".h": "c",
            ".hpp": "cpp",
        }
        lang_id = lang_ids.get(path.suffix, "plaintext")

        await self._notify("textDocument/didOpen", {
            "textDocument": {
                "uri": uri,
                "languageId": lang_id,
                "version": 1,
                "text": content,
            }
        })

    async def _request(
        self,
        method: str,
        params: Optional[Dict[str, Any]]
    ) -> LSPResult:
        """Send a JSON-RPC request and wait for response."""
        import time
        start = time.perf_counter()

        self._request_id += 1
        request_id = self._request_id

        message = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params or {},
        }

        # Create future for response
        future: asyncio.Future = asyncio.Future()
        self._pending_requests[request_id] = future

        # Send request
        content = json.dumps(message)
        header = f"Content-Length: {len(content)}\r\n\r\n"

        if self._process and self._process.stdin:
            try:
                self._process.stdin.write((header + content).encode())
                self._process.stdin.flush()
            except BrokenPipeError:
                return LSPResult(
                    success=False,
                    error="Server connection lost",
                    method=method,
                )

        # Wait for response
        try:
            response = await asyncio.wait_for(future, timeout=self.timeout)
            elapsed = (time.perf_counter() - start) * 1000

            if "error" in response:
                error = response["error"]
                return LSPResult(
                    success=False,
                    error=f"{error.get('code')}: {error.get('message')}",
                    method=method,
                    elapsed_ms=elapsed,
                )

            return LSPResult(
                success=True,
                data=response.get("result"),
                method=method,
                elapsed_ms=elapsed,
            )

        except asyncio.TimeoutError:
            del self._pending_requests[request_id]
            return LSPResult(
                success=False,
                error="Request timed out",
                method=method,
            )

    async def _notify(
        self,
        method: str,
        params: Optional[Dict[str, Any]]
    ) -> None:
        """Send a JSON-RPC notification (no response expected)."""
        message = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
        }

        content = json.dumps(message)
        header = f"Content-Length: {len(content)}\r\n\r\n"

        if self._process and self._process.stdin:
            try:
                self._process.stdin.write((header + content).encode())
                self._process.stdin.flush()
            except BrokenPipeError:
                logger.warning("Server connection lost during notification")

    async def _read_loop(self) -> None:
        """Read responses from language server."""
        if not self._process or not self._process.stdout:
            return

        buffer = b""

        while True:
            try:
                # Read headers
                chunk = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self._process.stdout.read(1) if self._process and self._process.stdout else b""
                )

                if not chunk:
                    break

                buffer += chunk

                # Check for header separator
                if b"\r\n\r\n" in buffer:
                    header_end = buffer.index(b"\r\n\r\n")
                    headers = buffer[:header_end].decode()
                    buffer = buffer[header_end + 4:]

                    # Parse content length
                    content_length = 0
                    for line in headers.split("\r\n"):
                        if line.lower().startswith("content-length:"):
                            content_length = int(line.split(":")[1].strip())

                    # Read content
                    while len(buffer) < content_length:
                        chunk = await asyncio.get_event_loop().run_in_executor(
                            None,
                            lambda: self._process.stdout.read(content_length - len(buffer)) if self._process and self._process.stdout else b""
                        )
                        if not chunk:
                            break
                        buffer += chunk

                    content = buffer[:content_length].decode()
                    buffer = buffer[content_length:]

                    # Parse JSON
                    try:
                        message = json.loads(content)

                        # Handle response
                        if "id" in message:
                            request_id = message["id"]
                            if request_id in self._pending_requests:
                                self._pending_requests[request_id].set_result(message)
                                del self._pending_requests[request_id]

                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON from server: {content[:100]}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error reading from server: {e}")
                break

    def _parse_locations(
        self,
        data: Union[Dict, List]
    ) -> List[Location]:
        """Parse location(s) from LSP response."""
        locations = []

        if isinstance(data, dict):
            data = [data]

        for item in data:
            if "uri" in item:
                range_data = item.get("range", {})
                start = range_data.get("start", {})
                end = range_data.get("end", {})

                locations.append(Location(
                    uri=item["uri"],
                    range=Range(
                        start=Position(
                            line=start.get("line", 0),
                            character=start.get("character", 0),
                        ),
                        end=Position(
                            line=end.get("line", 0),
                            character=end.get("character", 0),
                        ),
                    ),
                ))

        return locations

    def _parse_symbols(
        self,
        data: List[Dict],
        uri: Optional[str] = None,
    ) -> List[SymbolInfo]:
        """Parse symbols from LSP response."""
        symbols = []

        def parse_symbol(item: Dict, container: Optional[str] = None) -> None:
            name = item.get("name", "")
            kind_num = item.get("kind", 0)
            kind = SYMBOL_KINDS.get(kind_num, f"unknown_{kind_num}")

            # Get location
            location = None
            if "location" in item:
                loc_data = item["location"]
                range_data = loc_data.get("range", {})
                start = range_data.get("start", {})
                end = range_data.get("end", {})

                location = Location(
                    uri=loc_data.get("uri", uri or ""),
                    range=Range(
                        start=Position(start.get("line", 0), start.get("character", 0)),
                        end=Position(end.get("line", 0), end.get("character", 0)),
                    ),
                )
            elif "range" in item:
                range_data = item["range"]
                start = range_data.get("start", {})
                end = range_data.get("end", {})

                location = Location(
                    uri=uri or "",
                    range=Range(
                        start=Position(start.get("line", 0), start.get("character", 0)),
                        end=Position(end.get("line", 0), end.get("character", 0)),
                    ),
                )

            symbols.append(SymbolInfo(
                name=name,
                kind=kind,
                location=location,
                container_name=container or item.get("containerName"),
                detail=item.get("detail"),
            ))

            # Process children (hierarchical symbols)
            for child in item.get("children", []):
                parse_symbol(child, name)

        for item in data:
            parse_symbol(item)

        return symbols
