# Cross-Repo Scavenger Report (Chrysalis)
Scope: /home/mdz-axolotl/Documents/GitClones
Focus keywords: MCP, gRPC, gossip, CRDT, vector, embedding, memory, sync, Merkle, observability.
Skipped heavy directories (node_modules, dist, build, coverage) and capped snippet size.

## Inventory

| Repo | Focus | License | Notes |
| --- | --- | --- | --- |
| SkyPony | Agent orchestration, approval loops, contextual prompting | Unknown | Harvest approval/rollback patterns and terminal orchestration ideas. |
| SkyPrompt | Semantic intent compiler and Wave terminal integration | MIT License | Reuse semantic planner steps and Wave bridge patterns. |
| SkyManager | MCP server manager and registry | Unknown | Apply MCP pooling/registry concepts to Chrysalis adapters. |
| SemanticLadder | RAG and vector search configs | MIT License | Compare default embeddings/index tuning against Chrysalis memory. |
| KiloCodeSky | Agentic coding platform with guardrails | Apache License | Lift guardrail and rollback patterns for sync/merge safety. |
| Skyhook | Terminal/CLI safety patterns | Unknown | Borrow CLI safety/UX defaults for Chrysalis tooling. |
| PonyWaveTerm | Wave terminal UI | Apache License | Reference SSE/UI event handling for observability surfaces. |
| SkyWaveTerm | Wave terminal UI fork | Apache License | Check alternate UI blocks for dashboards. |
| code-mode-mcp | MCP servers for coding actions | Unknown | Use MCP tool patterns for Chrysalis fabric. |
| contextstream-mcp | Context streaming MCP server | Unknown | Inspect streaming patterns for sync pathways. |
| design_patterns_mcp | Reference MCP tool patterns | MIT License | Map design patterns into Chrysalis MCP layer. |

## Snippets and Concepts

### SkyPony

- `IMPLEMENTATION_PLAN.md:8` (keyword: sync)
```markdown

## Phase 1: Critical Stabilization (Immediate)
*Focus: Fixing async/sync gaps and sovereignty blockers.*

1.  **Fix Command Approval Loop**:
```
- `IMPLEMENTATION_PLAN.md:11` (keyword: sync)
```markdown

1.  **Fix Command Approval Loop**:
    *   Implement `ApprovalManager` to track `asyncio.Future` objects for requested commands.
    *   Update `inject_command` to `await` the approval future.
    *   Update WebSocket handler to `set_result` on the corresponding future.
```
- `IMPLEMENTATION_PLAN.md:14` (keyword: sync)
```markdown
    *   Update `inject_command` to `await` the approval future.
    *   Update WebSocket handler to `set_result` on the corresponding future.
2.  **Resolve Async Callback Warnings**:
    *   Wrap async callbacks in `asyncio.run_coroutine_threadsafe` where session manager (threaded) calls integration (async).
3.  **Implement WebSocket Receive Loop**:
```
- `IMPLEMENTATION_PLAN.md:15` (keyword: sync)
```markdown
    *   Update WebSocket handler to `set_result` on the corresponding future.
2.  **Resolve Async Callback Warnings**:
    *   Wrap async callbacks in `asyncio.run_coroutine_threadsafe` where session manager (threaded) calls integration (async).
3.  **Implement WebSocket Receive Loop**:
    *   Add a background task in `PonyWaveTermConnector` to continuously `recv()` messages.
```
- `IMPLEMENTATION_PLAN.md:37` (keyword: sync)
```markdown

1.  **Non-blocking CLI**:
    *   Refactor `GuideCLI` to use `prompt-toolkit` for `async` input handling.
2.  **Implement Resource Limits**:
    *   Complete the `TODO` in `TerminalSessionManager` using `resource` module (CPU time, memory, etc.).
```
- `IMPLEMENTATION_PLAN.md:39` (keyword: memory)
```markdown
    *   Refactor `GuideCLI` to use `prompt-toolkit` for `async` input handling.
2.  **Implement Resource Limits**:
    *   Complete the `TODO` in `TerminalSessionManager` using `resource` module (CPU time, memory, etc.).
3.  **Atomic State Transitions**:
    *   Refactor `create_agent_session` to ensure atomic completion or rollback on failure.
```
### SkyPrompt

- `codex-next.md:4` (keyword: embedding)
```markdown

## State to continue
- Goal: integrate SkyPrompt with WaveTerm using local embeddings (Ollama) and external graph from KiloCodeSky. Test SkyPrompt via WaveTerm preset (HTTP: `SKYPROMPT_BASE_URL=http://localhost:8000`).
- Current blockers: sandbox prevented `ollama serve` (couldn’t bind to 127.0.0.1:11434 or :12000/:12001; bind denied). Need a session with permissive sandbox/network to run Ollama.

```
- `codex-next.md:11` (keyword: embedding)
```markdown
  - SkyPrompt mode passes `windowid` into `WaveAIStreamRequest` and `skypromptbackend` (HTTP/CLI). SkyPrompt preset exists. NinjaTech preset added (OpenAI-compatible) but not required now.
- SkyPrompt:
  - `GraphStore` loads `embeddings` from external context JSON when present (`SKYPROMPT_EXTERNAL_CONTEXT`) and tracks provenance counts.
  - External context env documented; SkyPrompt CLI supports `--window-id`.
  - Optional bearer auth + request-id/response-time headers added (`SKYPROMPT_API_TOKEN`).
```
- `codex-next.md:15` (keyword: embedding)
```markdown
  - Optional bearer auth + request-id/response-time headers added (`SKYPROMPT_API_TOKEN`).
- KiloCodeSky:
  - Exporter `scripts/export-skyprompt-context.js` exports nodes/edges (edges placeholder) and optionally embeddings via Ollama when `EMBED_WITH_OLLAMA=true` (uses `OLLAMA_BASE_URL`, `OLLAMA_EMBED_MODEL`). Permission-friendly error messaging.
  - Settings importer `scripts/import-kilocode-settings.js`.
  - Bridge docs `docs/SKYPROMPT_BRIDGE.md` updated for embeddings.
```
- `codex-next.md:17` (keyword: embedding)
```markdown
  - Exporter `scripts/export-skyprompt-context.js` exports nodes/edges (edges placeholder) and optionally embeddings via Ollama when `EMBED_WITH_OLLAMA=true` (uses `OLLAMA_BASE_URL`, `OLLAMA_EMBED_MODEL`). Permission-friendly error messaging.
  - Settings importer `scripts/import-kilocode-settings.js`.
  - Bridge docs `docs/SKYPROMPT_BRIDGE.md` updated for embeddings.
  - Generated files (nodes-only because Ollama couldn’t run here):
    - `kilocode-context.json`
```
- `codex-next.md:20` (keyword: embedding)
```markdown
  - Generated files (nodes-only because Ollama couldn’t run here):
    - `kilocode-context.json`
    - `kilocode-context-with-embeddings.json` (embeddings=0)

## What to do next (after restart with permissive sandbox)
```
- `codex-next.md:26` (keyword: embedding)
```markdown
   - Example: `HOME=/path/to/writable OLLAMA_HOME=/path/to/writable/.ollama nohup ollama serve >/tmp/ollama.log 2>&1 &`
   - Verify: `curl http://localhost:11434/api/tags`
2) Regenerate context with embeddings:
   ```bash
   cd /home/mdz-axolotl/Documents/GitClones/KiloCodeSky
```
### SkyManager

- `TYPE_SYSTEM_COMPLETE.md:23` (keyword: sync)
```markdown

3. **Network Service (`network_service.py`)**
   - ✅ Added missing imports (`asyncio`, `ValidationError`, `ConnectionError`, `Any`)
   - ✅ All methods have return type annotations
   - ✅ Removed unnecessary `type: ignore` comments
```
- `README.md:3` (keyword: mcp)
```markdown
# SkyManager

**Unified Management Tool for Model Context Protocol (MCP) Servers**

[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
```
- `README.md:13` (keyword: mcp)
```markdown
## Overview

SkyManager is a comprehensive management tool for Model Context Protocol (MCP) servers, designed to work seamlessly with [Wave Terminal](https://www.waveterm.dev/) for an integrated AI-assisted development experience. It provides:

- **Unified MCP Server Management**: Discover, install, and manage MCP servers from multiple registries
```
- `README.md:15` (keyword: mcp)
```markdown
SkyManager is a comprehensive management tool for Model Context Protocol (MCP) servers, designed to work seamlessly with [Wave Terminal](https://www.waveterm.dev/) for an integrated AI-assisted development experience. It provides:

- **Unified MCP Server Management**: Discover, install, and manage MCP servers from multiple registries
- **Profile-Based Configuration**: Store and sync tool configurations across devices
- **Distributed Networking**: Hashgraph-inspired consensus for event ordering
```
- `README.md:16` (keyword: sync)
```markdown

- **Unified MCP Server Management**: Discover, install, and manage MCP servers from multiple registries
- **Profile-Based Configuration**: Store and sync tool configurations across devices
- **Distributed Networking**: Hashgraph-inspired consensus for event ordering
- **Multi-Provider LLM Integration**: Support for OpenAI, Anthropic, Ollama, HuggingFace, OpenRouter, and Kilocode
```
- `README.md:50` (keyword: mcp)
```markdown
sky profile create my-profile

# Discover MCP servers
sky catalog discover

```
### SemanticLadder

- `ARCHITECTURE.md:29` (keyword: embedding)
```markdown
│  Content Cleaning & Chunking                            │
│         ↓                                                │
│  Embedding Generation (sentence-transformers)           │
│         ↓                                                │
│  Vector Database (Qdrant)                               │
```
- `ARCHITECTURE.md:31` (keyword: vector)
```markdown
│  Embedding Generation (sentence-transformers)           │
│         ↓                                                │
│  Vector Database (Qdrant)                               │
│         + Metadata Store (SQLite)                       │
│                                                          │
```
- `ARCHITECTURE.md:42` (keyword: embedding)
```markdown
│  User Query (natural language)                          │
│         ↓                                                │
│  Query Embedding                                        │
│         ↓                                                │
│  Vector Search (Qdrant)                                 │
```
- `ARCHITECTURE.md:44` (keyword: vector)
```markdown
│  Query Embedding                                        │
│         ↓                                                │
│  Vector Search (Qdrant)                                 │
│         ↓                                                │
│  Result Ranking & Filtering                             │
```
- `ARCHITECTURE.md:66` (keyword: embedding)
```markdown
- **HTML Extraction**: `trafilatura` - lightweight, accurate text extraction
- **Text Processing**: `spaCy` (optional for NER/metadata)
- **Embeddings**: `sentence-transformers` (all-MiniLM-L6-v2 - 384 dim, fast)

### Storage
```
- `ARCHITECTURE.md:69` (keyword: vector)
```markdown

### Storage
- **Vector DB**: Qdrant (in-memory + persistent, Docker-friendly)
- **Metadata**: SQLite (simple, embedded)
- **File Storage**: Local filesystem for WARC files
```
### KiloCodeSky

- `README.md:34` (keyword: mcp)
```markdown
- **Task Automation:** Kilo can automate repetitive coding tasks.
- **Automated Refactoring:** Kilo can refactor and improve existing code.
- **MCP Server Marketplace**: Kilo can easily find, and use MCP servers to extend the agent capabilities.
- **Multi Mode**: Plan with Architect, Code with Coder, and Debug with Debugger, and make your own custom modes.

```
- `apps/web-evals/src/components/home/run.tsx:67` (keyword: sync)
```typescript
	const hasDescription = Boolean(run.description && run.description.trim().length > 0)

	const handleSaveDescription = useCallback(async () => {
		setIsSavingNotes(true)
		try {
```
- `apps/web-evals/src/components/home/run.tsx:86` (keyword: sync)
```typescript
	}, [run.id, editingDescription, router])

	const onExportFailedLogs = useCallback(async () => {
		if (run.failed === 0) {
			toast.error("No failed tasks to export")
```
- `apps/web-evals/src/components/home/run.tsx:122` (keyword: sync)
```typescript
	}, [run.id, run.failed])

	const onConfirmDelete = useCallback(async () => {
		if (!deleteRunId) {
			return
```
- `apps/web-evals/src/components/home/runs.tsx:180` (keyword: sync)
```typescript
	}, [runs])

	const handleDeleteIncompleteRuns = useCallback(async () => {
		setIsDeleting(true)
		try {
```
- `apps/web-evals/src/components/home/runs.tsx:202` (keyword: sync)
```typescript
	}, [router])

	const handleDeleteOldRuns = useCallback(async () => {
		setIsDeleting(true)
		try {
```
### Skyhook

- `WEB-SEARCH-COMPARISON.md:239` (keyword: mcp)
```markdown
**Claude Code:**
- [Claude Web Search Tool](https://docs.claude.com/en/docs/agents-and-tools/tool-use/web-search-tool)
- [MCP Servers for Claude Code](https://intuitionlabs.ai/articles/mcp-servers-claude-code-internet-search)

**GitHub Search:**
```
- `CLI-TOOLS-INTEGRATION.md:19` (keyword: mcp)
```markdown
- **File Operations** - Read, Write, Edit tools
- **Code Execution** - Bash, Python, Node.js
- **MCP Integration** - Model Context Protocol for extensibility

### Testing Claude Code Interfaces
```
- `CLI-TOOLS-INTEGRATION.md:44` (keyword: mcp)
```markdown
```

#### 4. Test MCP Servers
Claude Code can connect to MCP servers for extended functionality. Check your configuration:
```bash
```
- `CLI-TOOLS-INTEGRATION.md:45` (keyword: mcp)
```markdown

#### 4. Test MCP Servers
Claude Code can connect to MCP servers for extended functionality. Check your configuration:
```bash
# View MCP configuration
```
- `CLI-TOOLS-INTEGRATION.md:47` (keyword: mcp)
```markdown
Claude Code can connect to MCP servers for extended functionality. Check your configuration:
```bash
# View MCP configuration
cat ~/.config/claude-code/config.json

```
- `CLI-TOOLS-INTEGRATION.md:50` (keyword: mcp)
```markdown
cat ~/.config/claude-code/config.json

# MCP servers can provide additional tools like:
# - Database access
# - File system operations
```
### PonyWaveTerm

- `electron-builder.config.cjs:133` (keyword: sync)
```javascript

            // Reapply file permissions to the wavesrv binaries in the final app package
            fs.readdirSync(packageBinDir, {
                recursive: true,
                withFileTypes: true,
```
- `electron-builder.config.cjs:138` (keyword: sync)
```javascript
            })
                .filter((f) => f.isFile() && f.name.startsWith("wavesrv"))
                .forEach((f) => fs.chmodSync(path.resolve(f.parentPath ?? f.path, f.name), 0o755)); // 0o755 corresponds to -rwxr-xr-x
        }
    },
```
- `electron.vite.config.ts:66` (keyword: sync)
```typescript
            }
        },
        async resolveId(id: any, importer: any) {
            const r = await (this as any).resolve(id, importer, { skipSelf: true });
            if (r?.id === target) {
```
- `README.md:35` (keyword: sync)
```markdown
- Rich customization including tab themes, terminal styles, and background images
- Powerful `wsh` command system for managing your workspace from the CLI and sharing data between terminal sessions
- Connected file management with `wsh file` - seamlessly copy and sync files between local, remote SSH hosts, Wave filesystem, and S3

## Wave AI
```
- `version.cjs:69` (keyword: sync)
```javascript
        }
        packageJson.version = newVersion;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + "\n");
        console.log(newVersion);
    } else {
```
- `cmd/server/main-server.go:13` (keyword: sync)
```go

	"runtime"
	"sync"
	"time"

```
### SkyWaveTerm

- `electron-builder.config.cjs:133` (keyword: sync)
```javascript

            // Reapply file permissions to the wavesrv binaries in the final app package
            fs.readdirSync(packageBinDir, {
                recursive: true,
                withFileTypes: true,
```
- `electron-builder.config.cjs:138` (keyword: sync)
```javascript
            })
                .filter((f) => f.isFile() && f.name.startsWith("wavesrv"))
                .forEach((f) => fs.chmodSync(path.resolve(f.parentPath ?? f.path, f.name), 0o755)); // 0o755 corresponds to -rwxr-xr-x
        }
    },
```
- `electron.vite.config.ts:66` (keyword: sync)
```typescript
            }
        },
        async resolveId(id: any, importer: any) {
            const r = await (this as any).resolve(id, importer, { skipSelf: true });
            if (r?.id === target) {
```
- `README.md:35` (keyword: sync)
```markdown
- Rich customization including tab themes, terminal styles, and background images
- Powerful `wsh` command system for managing your workspace from the CLI and sharing data between terminal sessions
- Connected file management with `wsh file` - seamlessly copy and sync files between local, remote SSH hosts, Wave filesystem, and S3

## Wave AI
```
- `version.cjs:69` (keyword: sync)
```javascript
        }
        packageJson.version = newVersion;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + "\n");
        console.log(newVersion);
    } else {
```
- `cmd/server/main-server.go:13` (keyword: sync)
```go

	"runtime"
	"sync"
	"time"

```
### design_patterns_mcp

- `REFACTORING_GUIDE.md:1` (keyword: mcp)
```markdown
# 📚 Refactoring Guide - Design Patterns MCP Server

## 📊 Executive Summary
```
- `REFACTORING_GUIDE.md:5` (keyword: mcp)
```markdown
## 📊 Executive Summary

This refactoring applies SOLID principles and design patterns to improve the MCP Server architecture, resulting in more maintainable, testable, and performant code.

### Impact Metrics
```
- `REFACTORING_GUIDE.md:11` (keyword: mcp)
```markdown
| Metric                     | Before      | After  | Improvement    |
| -------------------------- | ----------- | ------ | -------------- |
| **Lines in mcp-server.ts** | 704         | 422    | **-40%**       |
| **SRP Violations**         | 7           | 0      | **-100%**      |
| **Singleton Patterns**     | 3 different | 1 (DI) | **-67%**       |
```
- `REFACTORING_GUIDE.md:15` (keyword: memory)
```markdown
| **Singleton Patterns**     | 3 different | 1 (DI) | **-67%**       |
| **Cache in handlers**      | 0%          | 100%   | **+100%**      |
| **Memory leak risk**       | High        | Zero   | **Eliminated** |
| **Testability**            | 6/10        | 9/10   | **+50%**       |
| **Maintainability**        | 6/10        | 9/10   | **+50%**       |
```
- `REFACTORING_GUIDE.md:29` (keyword: memory)
```markdown
### ✅ 2. Object Pool Pattern

- **Problem**: Unlimited prepared statements (memory leak)
- **Solution**: `StatementPool` with limit of 100 statements and LRU eviction
- **Files**: `src/services/statement-pool.ts`
```
- `REFACTORING_GUIDE.md:33` (keyword: memory)
```markdown
- **Files**: `src/services/statement-pool.ts`
- **Impact**:
  - Stable memory even under high load
  - Prevents memory leaks
  - Hit rate: 70-85% in production
```