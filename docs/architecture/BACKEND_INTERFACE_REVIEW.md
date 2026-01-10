# Chrysalis Backend Architecture & Interface Review

**Date**: 2026-01-09
**Review Scope**: Comprehensive technical analysis of backend services, API/CLI interfaces, and unified framework proposal

---

## Executive Summary

Chrysalis functions as an interactive bridge system facilitating information flows between teams, roles, and communication channels. This review documents the current state of all backend services, evaluates interface maturity, identifies gaps, and proposes a unified interface framework for consistent API and CLI consumption by both frontend UI components and AI agents.

**Key Findings**:
- **8 identified backend services** (5 TypeScript/Node.js, 3 Python/Flask)
- **Inconsistent API patterns** across services
- **Limited CLI coverage** (only 2 services have comprehensive CLI)
- **No unified authentication** (mixed approaches: Bearer tokens, API keys, none)
- **Varying error handling** patterns
- **Inconsistent data formats** and response structures

---

## 1. Current Service Inventory

### 1.1 TypeScript/Node.js Services

#### 1.1.1 LedgerService
- **Port**: 9443 (HTTPS)
- **Protocol**: HTTPS
- **Purpose**: Event sourcing, append-only ledger for agent events
- **Status**: ✅ Implemented
- **Location**: `src/services/ledger/LedgerService.ts`

**API Endpoints**:
- `GET /health` - Health check
- `POST /registry/register` - Register instance with public key
- `POST /ledger/commit` - Commit event to ledger
- `POST /ledger/keyrotate` - Rotate instance key
- `GET /ledger/query?txId=<id>` - Query transaction by ID
- `GET /ledger/query?hash=<hash>` - Query transaction by hash
- `GET /ledger/tail?afterTxId=<id>&limit=<n>` - Get recent transactions (pagination)
- `POST /agents/register` - Register new agent
- `GET /agents/get?agentId=<id>` - Get agent by ID

**CLI Interface**: ❌ None

**Authentication**: Ed25519 signature-based (public key verification)

**Error Handling**:
- Structured JSON errors: `{ error: 'error_code', message?: string }`
- HTTP status codes: 200, 400, 401, 403, 404, 500

**Data Format**: JSON request/response bodies

**Gaps**:
- No CLI interface
- No OpenAPI/Swagger documentation
- Limited querying capabilities (no filtering by agent, time range, event type)
- No rate limiting

---

#### 1.1.2 ProjectionService
- **Port**: 1234 (WebSocket)
- **Protocol**: WebSocket (Yjs CRDT)
- **Purpose**: Real-time state projection from ledger events to CRDT documents
- **Status**: ✅ Implemented
- **Location**: `src/services/projection/ProjectionService.ts`

**API Endpoints**:
- WebSocket connection (no REST endpoints)
- Room-based CRDT documents (one per agent/context)

**CLI Interface**: ❌ None (WebSocket-only service)

**Authentication**: ❌ None (relies on network isolation)

**Error Handling**: WebSocket error frames (non-standardized)

**Data Format**: Yjs binary protocol

**Gaps**:
- No REST API for querying current state
- No authentication/authorization
- No monitoring/health endpoints
- No documentation of room naming conventions

---

#### 1.1.3 GroundingService
- **Port**: Not specified (likely HTTP)
- **Protocol**: HTTP (implied)
- **Purpose**: Context grounding for agents
- **Status**: ⚠️ Stubbed/Incomplete
- **Location**: Referenced in `package.json` but implementation not found

**API Endpoints**: ❓ Unknown

**CLI Interface**: ❌ None

**Authentication**: ❓ Unknown

**Gaps**:
- Service not fully implemented
- No API endpoints defined
- No documentation

---

#### 1.1.4 SkillForgeService
- **Port**: Not specified (likely HTTP)
- **Protocol**: HTTP (implied)
- **Purpose**: Skill building pipeline orchestration
- **Status**: ⚠️ Stubbed/Incomplete
- **Location**: Referenced in `package.json` but implementation not found

**API Endpoints**: ❓ Unknown

**CLI Interface**: ❌ None

**Authentication**: ❓ Unknown

**Gaps**:
- Service not fully implemented
- No API endpoints defined
- No documentation

---

#### 1.1.5 CapabilityGatewayService
- **Port**: Configurable (default not specified)
- **Protocol**: HTTP
- **Purpose**: Agent-facing API for learning capabilities (grounding, skillforge), routes to AgentBuilder
- **Status**: ✅ Implemented
- **Location**: `src/services/capability-gateway/CapabilityGatewayService.ts`

**API Endpoints**:
- `GET /health` - Health check
- `POST /auth/bootstrap` - One-time API key creation (returns token once)
- `POST /capabilities/build` - Build agent capabilities (requires auth)

**CLI Interface**: ❌ None

**Authentication**:
- Bearer token: `Authorization: Bearer <keyId>.<secret>`
- API key store with admin roles
- Rate limiting per key

**Error Handling**:
- Structured JSON: `{ error: 'error_code', message?: string, reason?: string, retryAfterMs?: number }`
- HTTP status codes: 200, 401, 403, 409, 429, 500

**Data Format**: JSON request/response

**Gaps**:
- No CLI interface
- Limited endpoints (only build capability)
- No documentation of API key lifecycle management
- No OpenAPI spec

---

### 1.2 Python/Flask Services

#### 1.2.1 AgentBuilder Service
- **Port**: 5000
- **Protocol**: HTTP (Flask)
- **Purpose**: Orchestrates KnowledgeBuilder and SkillBuilder to build complete agents
- **Status**: ✅ Implemented (minimal)
- **Location**: `projects/AgentBuilder/server.py`

**API Endpoints**:
- `POST /build` - Build agent from role model

**CLI Interface**: ❌ None

**Authentication**: ❌ None

**Error Handling**:
- Basic JSON errors: `{ error: 'message' }`
- HTTP status codes: 200, 400, 500

**Request Format**:
```json
{
  "roleModel": {
    "name": "string",
    "occupation": "string"
  },
  "agentId": "string",
  "deepeningCycles": 0,
  "apiKeys": {}
}
```

**Response Format**:
```json
{
  "agentId": "string",
  "roleModel": {},
  "generated_skills": [],
  "generated_knowledge": []
}
```

**Gaps**:
- Single endpoint (insufficient for production)
- No authentication
- Hardcoded service URLs (not configurable)
- No error details or request IDs
- No validation (Pydantic models missing)
- No OpenAPI documentation
- Missing endpoints: health, status, cancellation, history

---

#### 1.2.2 KnowledgeBuilder Service
- **Port**: 5002
- **Protocol**: HTTP (Flask)
- **Purpose**: Collect and structure knowledge about entities using multi-source search and fact extraction
- **Status**: ✅ Implemented (mature)
- **Location**: `projects/KnowledgeBuilder/server.py`

**API Endpoints**:
- `POST /knowledge` - Collect knowledge for an entity

**CLI Interface**: ❌ None (but has Python module API)

**Authentication**: ❌ None

**Error Handling**:
- Basic JSON errors: `{ error: 'message' }`
- HTTP status codes: 200, 400, 500

**Request Format**:
```json
{
  "identifier": "string",
  "entity_type": "string",
  "deepening_cycles": 0,
  "apiKeys": {}
}
```

**Response Format**:
```json
{
  "knowledge_items": []
}
```

**Gaps**:
- Single endpoint (should have: list, get, search, delete)
- No authentication
- API keys passed in request body (security risk)
- No pagination for knowledge items
- No query/search capabilities
- No telemetry/observability endpoints
- Missing endpoints: health, status, search, export, import

---

#### 1.2.3 SkillBuilder Service
- **Port**: 5001
- **Protocol**: HTTP (Flask)
- **Purpose**: Generate agent skills from occupation and corpus text using exemplar-driven research
- **Status**: ✅ Implemented (mature with CLI)
- **Location**: `projects/SkillBuilder/server.py`

**API Endpoints**:
- `POST /skills` - Generate skills from occupation

**CLI Interface**: ✅ Comprehensive (`skill_builder/cli.py`)
- `skill_builder create` - Interactive wizard
- `skill_builder setup` - Check dependencies
- `skill_builder batch-merge` - Merge mode YAMLs
- `skill_builder calibrate` - Train calibration model

**Authentication**: ❌ None (API level)

**Error Handling**:
- Basic JSON errors: `{ error: 'message' }`
- HTTP status codes: 200, 400, 500

**Request Format**:
```json
{
  "occupation": "string",
  "deepening_cycles": 0,
  "apiKeys": {},
  "corpus_text": "string"
}
```

**Response Format**:
```json
{
  "skills": [
    {
      "skill": "yaml_block",
      "embedding": [0.1, 0.2, ...]
    }
  ]
}
```

**Gaps**:
- Single endpoint (should have: list, get, search, update, delete)
- No authentication
- API keys passed in request body
- No pagination
- CLI not documented in main API docs
- Missing endpoints: health, status, search, export

---

### 1.3 Memory System Services (Python)

The `memory_system` module provides semantic processing capabilities but is not exposed as a standalone service. It's used by other services internally.

**Status**: ✅ Implemented (library, not service)
- Semantic decomposition
- Knowledge graph storage
- Embedding generation
- Document processing
- MCP server interface

**Gaps**:
- No REST API (only library API)
- No CLI (MCP protocol only)
- Should be exposed as a service for distributed deployments

---

## 2. CLI Interface Analysis

### 2.1 Existing CLI Tools

#### 2.1.1 agent-morph-v2 (TypeScript/Node.js)
- **Location**: `src/cli/agent-morph-v2.ts`
- **Tool**: Commander.js
- **Commands**:
  - `morph` - Morph agent to target type
  - `sync` - Sync experiences from instance
  - `merge` - Merge experiences from multiple instances
  - `instances` - List agent instances
  - `adapters` - List available adapters
  - `keygen` - Generate RSA key pair

**Status**: ✅ Comprehensive
**Pattern**: Consistent use of Commander.js, good error handling

---

#### 2.1.2 agent-morph (TypeScript/Node.js)
- **Location**: `src/cli/agent-morph.ts`
- **Tool**: Commander.js
- **Commands**:
  - `convert` - Convert between frameworks
  - `restore` - Restore agent
  - `validate` - Validate agent configuration
  - `keygen` - Generate key pair

**Status**: ✅ Functional (legacy v1)
**Pattern**: Similar to v2, but older interface

---

#### 2.1.3 skill_builder CLI (Python)
- **Location**: `projects/SkillBuilder/skill_builder/cli.py`
- **Tool**: argparse
- **Commands**:
  - `create` - Interactive wizard
  - `setup` - Dependency check
  - `batch-merge` - Merge modes
  - `calibrate` - Train calibration

**Status**: ✅ Comprehensive
**Pattern**: argparse with subcommands, interactive mode support

---

#### 2.1.4 chrysalis CLI (TypeScript/Node.js)
- **Location**: Referenced in `package.json` bin
- **Status**: ❓ Not found in codebase search

---

### 2.2 CLI Gaps

1. **No CLI for**:
   - LedgerService (query, tail, commit operations)
   - ProjectionService (state inspection)
   - CapabilityGatewayService (auth, build operations)
   - AgentBuilder (build, status, history)
   - KnowledgeBuilder (collect, search, manage)

2. **Inconsistent Patterns**:
   - TypeScript uses Commander.js (good)
   - Python uses argparse (good, but different from TS)
   - No unified CLI framework

3. **Missing Features**:
   - No interactive modes for most services
   - No output format options (JSON, YAML, table, etc.)
   - No configuration file support (all flags)
   - No autocomplete/help improvements

---

## 3. Authentication & Authorization Analysis

### 3.1 Current State

| Service | Auth Method | Status | Notes |
|---------|-------------|--------|-------|
| LedgerService | Ed25519 signatures | ✅ Implemented | Per-instance public keys |
| ProjectionService | None | ❌ Missing | Relies on network isolation |
| CapabilityGatewayService | Bearer tokens (API keys) | ✅ Implemented | Admin/owner roles |
| AgentBuilder | None | ❌ Missing | |
| KnowledgeBuilder | None | ❌ Missing | |
| SkillBuilder | None | ❌ Missing | |

### 3.2 Gaps

1. **No unified authentication framework**
   - Different methods per service
   - No single sign-on (SSO)
   - No token refresh mechanisms

2. **Authorization inconsistencies**:
   - CapabilityGateway has role-based access (admin/owner)
   - LedgerService has no authorization (anyone with key can commit)
   - Other services have no authorization

3. **Security issues**:
   - API keys passed in request bodies (should be headers)
   - No key rotation policies
   - No audit logging of auth events

---

## 4. Error Handling Analysis

### 4.1 Current Patterns

**LedgerService** (TypeScript):
```typescript
{ error: 'error_code', message?: string }
// HTTP: 200, 400, 401, 403, 404, 500
```

**CapabilityGatewayService** (TypeScript):
```typescript
{ error: 'error_code', message?: string, reason?: string, retryAfterMs?: number }
// HTTP: 200, 401, 403, 409, 429, 500
```

**Python Services** (Flask):
```python
{ error: 'message' }
# HTTP: 200, 400, 500
```

### 4.2 Inconsistencies

1. **Error structure varies**:
   - TypeScript services include `error` code
   - Python services only have `message`
   - No standard error codes

2. **HTTP status code usage**:
   - Inconsistent (some use 400 for validation, others use 500)
   - Missing status codes (422 for validation, 429 for rate limits)

3. **Missing error details**:
   - No request IDs for tracing
   - No timestamps
   - No suggestions for resolution
   - No field-level validation errors

---

## 5. Data Format & Schema Analysis

### 5.1 Request Formats

**Inconsistent naming**:
- `apiKeys` vs `api_keys`
- `deepening_cycles` vs `deepeningCycles`
- `agentId` vs `agent_id`

**Inconsistent structures**:
- Some use nested objects, others flat
- No standard pagination parameters
- No standard filtering syntax

### 5.2 Response Formats

**Inconsistent structures**:
- Some return `{ data: [...] }`, others return arrays directly
- No standard metadata wrapper (pagination, timestamps, etc.)
- No standard success/error envelope

**Missing fields**:
- No request IDs
- No timestamps
- No version information
- No pagination metadata

---

## 6. Gaps & Inconsistencies Summary

### 6.1 Critical Gaps

1. **Service Completeness**:
   - GroundingService and SkillForgeService not implemented
   - Memory system not exposed as service

2. **API Coverage**:
   - Most services have single endpoints (CRUD incomplete)
   - No search/filter capabilities
   - No batch operations

3. **Documentation**:
   - No OpenAPI/Swagger specs
   - No API versioning strategy
   - Limited inline documentation

4. **Observability**:
   - Missing health/status endpoints (some services)
   - No metrics endpoints
   - No distributed tracing

### 6.2 Inconsistencies

1. **Naming Conventions**:
   - Mixed camelCase and snake_case
   - Inconsistent resource naming

2. **HTTP Methods**:
   - Not following RESTful conventions (should use GET for queries, POST for mutations)
   - Missing PATCH, DELETE, PUT methods

3. **Pagination**:
   - No standard pagination pattern
   - Some use `limit/offset`, others don't paginate

4. **Filtering/Querying**:
   - No standard query parameter syntax
   - No field selection

---

## 7. Unified Interface Framework Proposal

### 7.1 Design Principles

1. **Semantic Clarity**: Domain-specific vocabulary that maps to business concepts
2. **Consistency**: Uniform patterns across all services
3. **Extensibility**: Support for future services without breaking changes
4. **Usability**: Intuitive for both humans and AI agents
5. **Standards Compliance**: Follow REST, OpenAPI, and CLI best practices

---

### 7.2 Domain Vocabulary

#### 7.2.1 Core Nouns (Resources)

| Noun | Description | Example Resources |
|------|-------------|-------------------|
| **Agent** | An AI agent instance or profile | `/agents/{agentId}`, `/agents/{agentId}/profile` |
| **Capability** | Agent skills or knowledge | `/agents/{agentId}/capabilities`, `/capabilities/{capabilityId}` |
| **Knowledge** | Structured knowledge about entities | `/knowledge/{knowledgeId}`, `/knowledge/entities/{entityId}` |
| **Skill** | Actionable skills derived from exemplars | `/skills/{skillId}`, `/skills/modes/{modeId}` |
| **Memory** | Agent memories (episodic, semantic, etc.) | `/agents/{agentId}/memories`, `/memories/{memoryId}` |
| **Event** | Event log entries | `/events/{eventId}`, `/agents/{agentId}/events` |
| **Transaction** | Ledger transactions | `/transactions/{txId}`, `/ledger/transactions` |
| **Projection** | Real-time state projections | `/projections/{roomId}`, `/agents/{agentId}/projection` |
| **Instance** | Agent instance in a framework | `/agents/{agentId}/instances/{instanceId}` |
| **Sync** | Experience synchronization state | `/agents/{agentId}/syncs`, `/syncs/{syncId}` |
| **Task** | Background job or operation | `/tasks/{taskId}`, `/agents/{agentId}/tasks` |

#### 7.2.2 Core Verbs (Operations)

| Verb | HTTP Method | Description | Example |
|------|-------------|-------------|---------|
| **create** | POST | Create new resource | `POST /agents` |
| **get** | GET | Retrieve single resource | `GET /agents/{agentId}` |
| **list** | GET | Retrieve collection | `GET /agents` |
| **update** | PATCH | Partial update | `PATCH /agents/{agentId}` |
| **replace** | PUT | Full replacement | `PUT /agents/{agentId}` |
| **delete** | DELETE | Remove resource | `DELETE /agents/{agentId}` |
| **search** | POST | Complex search query | `POST /knowledge/search` |
| **commit** | POST | Commit event/transaction | `POST /ledger/commit` |
| **sync** | POST | Trigger synchronization | `POST /agents/{agentId}/sync` |
| **morph** | POST | Transform agent | `POST /agents/{agentId}/morph` |
| **build** | POST | Build capabilities | `POST /agents/{agentId}/capabilities/build` |

#### 7.2.3 Extended Operations

| Operation | Pattern | Description |
|-----------|---------|-------------|
| **query** | `GET /{resource}?filter=...&sort=...` | Filtered listing |
| **aggregate** | `GET /{resource}/stats` | Aggregation endpoints |
| **export** | `GET /{resource}/export?format=json` | Export data |
| **import** | `POST /{resource}/import` | Import data |
| **validate** | `POST /{resource}/validate` | Validate without creating |

---

### 7.3 REST API Specification

#### 7.3.1 Base URL Structure

```
https://api.chrysalis.dev/v1/{service}/{resource}
```

Examples:
- `https://api.chrysalis.dev/v1/agents`
- `https://api.chrysalis.dev/v1/ledger/transactions`
- `https://api.chrysalis.dev/v1/knowledge/entities`

#### 7.3.2 Endpoint Naming Conventions

**Resources (Plural Nouns)**:
- `/agents` - Collection of agents
- `/skills` - Collection of skills
- `/knowledge` - Collection of knowledge entries
- `/transactions` - Collection of transactions

**Nested Resources**:
- `/agents/{agentId}/capabilities` - Agent's capabilities
- `/agents/{agentId}/memories` - Agent's memories
- `/agents/{agentId}/instances/{instanceId}/events` - Instance events

**Actions (Verbs as URL segments)**:
- `/agents/{agentId}/morph` - Morph agent
- `/agents/{agentId}/sync` - Sync agent
- `/knowledge/{knowledgeId}/embed` - Generate embedding

#### 7.3.3 HTTP Method Usage

| Method | Usage | Idempotent | Body |
|--------|-------|------------|------|
| **GET** | Retrieve resources, queries | ✅ Yes | No |
| **POST** | Create resources, actions | ❌ No | Yes |
| **PUT** | Full resource replacement | ✅ Yes | Yes |
| **PATCH** | Partial resource update | ❌ No | Yes |
| **DELETE** | Remove resources | ✅ Yes | No |
| **HEAD** | Resource metadata | ✅ Yes | No |
| **OPTIONS** | CORS preflight | ✅ Yes | No |

#### 7.3.4 Request Payload Structure

**Standard Request Envelope** (Optional, for actions):
```json
{
  "request_id": "req_abc123",
  "action": "create",
  "parameters": {
    // Action-specific parameters
  },
  "metadata": {
    "client_version": "1.0.0",
    "correlation_id": "corr_xyz789"
  }
}
```

**Resource Creation** (POST /{resource}):
```json
{
  "data": {
    // Resource attributes
  },
  "options": {
    // Optional creation options
  }
}
```

**Resource Update** (PATCH /{resource}/{id}):
```json
{
  "data": {
    // Only fields to update
  }
}
```

#### 7.3.5 Response Payload Structure

**Success Response (Single Resource)**:
```json
{
  "success": true,
  "data": {
    // Resource object
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-01-09T10:00:00Z",
    "version": "v1"
  }
}
```

**Success Response (Collection)**:
```json
{
  "success": true,
  "data": [
    // Array of resources
  ],
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-01-09T10:00:00Z",
    "version": "v1",
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 150,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": [
      {
        "field": "agentId",
        "code": "REQUIRED",
        "message": "agentId is required"
      }
    ],
    "request_id": "req_abc123",
    "timestamp": "2026-01-09T10:00:00Z",
    "documentation_url": "https://docs.chrysalis.dev/errors/VALIDATION_ERROR"
  }
}
```

#### 7.3.6 Query Parameters

**Pagination**:
- `page` (integer, default: 1) - Page number
- `per_page` (integer, default: 20, max: 100) - Items per page
- `cursor` (string) - Cursor-based pagination (alternative to page)

**Filtering**:
- `filter[{field}]` (string) - Filter by field value
- `filter[{field}][op]` (string) - Operator (eq, ne, gt, gte, lt, lte, in, contains)
- Example: `?filter[status]=active&filter[created_at][gte]=2026-01-01`

**Sorting**:
- `sort` (string) - Sort field(s), comma-separated
- `order` (string) - Sort order: `asc` or `desc` (default: `asc`)
- Prefix field with `-` for descending: `?sort=-created_at,agentId`

**Field Selection**:
- `fields` (string) - Comma-separated field list
- `include` (string) - Include related resources (comma-separated)

**Search**:
- `q` (string) - Full-text search query
- `search_fields` (string) - Fields to search (comma-separated)

**Example Query**:
```
GET /agents?page=1&per_page=20&filter[status]=active&sort=-created_at&fields=agentId,name,status
```

#### 7.3.7 Standard Headers

**Request Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
Accept: application/json
X-Request-ID: {request_id}  # Optional, for tracing
X-Client-Version: {version}
```

**Response Headers**:
```
Content-Type: application/json
X-Request-ID: {request_id}
X-API-Version: v1
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1641736800
```

#### 7.3.8 HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| **200** | OK | Successful GET, PUT, PATCH, DELETE |
| **201** | Created | Successful POST (resource created) |
| **202** | Accepted | Request accepted, processing async |
| **204** | No Content | Successful DELETE (no body) |
| **400** | Bad Request | Invalid request syntax/parameters |
| **401** | Unauthorized | Missing/invalid authentication |
| **403** | Forbidden | Authenticated but not authorized |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Resource conflict (e.g., duplicate) |
| **422** | Unprocessable Entity | Valid syntax but semantic error |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server error |
| **502** | Bad Gateway | Upstream service error |
| **503** | Service Unavailable | Service temporarily down |

---

### 7.4 CLI Command Syntax Guidelines

#### 7.4.1 Command Structure

```
chrysalis [global-options] <command> [command-options] [arguments]
```

**Global Options** (available for all commands):
```
--config <file>          Configuration file path
--output <format>        Output format: json, yaml, table, plain
--verbose, -v            Verbose logging
--quiet, -q              Suppress non-error output
--api-url <url>          Override API base URL
--auth-token <token>     Authentication token
```

#### 7.4.2 Command Naming

**Resource Commands** (CRUD operations):
```
chrysalis {resource} create   # Create resource
chrysalis {resource} get      # Get single resource
chrysalis {resource} list     # List resources
chrysalis {resource} update   # Update resource
chrysalis {resource} delete   # Delete resource
```

**Action Commands** (domain-specific operations):
```
chrysalis agent morph         # Morph agent
chrysalis agent sync          # Sync agent
chrysalis knowledge search    # Search knowledge
chrysalis ledger commit       # Commit to ledger
```

#### 7.4.3 Argument Patterns

**Resource Identifiers**:
```
chrysalis agent get <agent-id>
chrysalis skill get <skill-id>
chrysalis knowledge get <knowledge-id>
```

**Resource Collections**:
```
chrysalis agent list [--filter status=active] [--sort -created_at] [--page 1] [--per-page 20]
```

**Action Commands**:
```
chrysalis agent morph <agent-id> --type mcp --framework cline
chrysalis knowledge search "Bob Ross" --type Person --limit 10
```

#### 7.4.4 Flag Conventions

**Standard Flags**:
- `--output, -o` - Output format (json, yaml, table)
- `--format, -f` - Alternative format specification
- `--filter, -F` - Filter criteria (key=value)
- `--sort, -s` - Sort field(s)
- `--limit, -l` - Limit results
- `--page, -p` - Page number
- `--verbose, -v` - Verbose output
- `--quiet, -q` - Quiet mode
- `--yes, -y` - Auto-confirm prompts
- `--dry-run` - Preview without executing

**Resource-Specific Flags**:
- `--agent-id, -a` - Agent identifier
- `--skill-id, -s` - Skill identifier (context-dependent)
- `--knowledge-id, -k` - Knowledge identifier

#### 7.4.5 Output Formatting

**JSON Format** (default for scripts):
```bash
chrysalis agent get abc123 --output json
```

**YAML Format**:
```bash
chrysalis agent get abc123 --output yaml
```

**Table Format** (human-readable, default for interactive):
```bash
chrysalis agent list --output table
```

**Plain Format** (single values):
```bash
chrysalis agent get abc123 --output plain --field agentId
```

#### 7.4.6 Interactive vs Non-Interactive Mode

**Interactive Mode** (default when TTY detected):
- Prompts for missing required arguments
- Confirmation prompts for destructive operations
- Progress indicators for long operations
- Colorized output

**Non-Interactive Mode** (when `--quiet` or output redirected):
- No prompts (fails if required args missing)
- No confirmation (use `--yes` flag)
- No progress indicators
- Plain text output

**Example**:
```bash
# Interactive
chrysalis agent create
> Agent name: Bob Ross Agent
> Occupation: Artist
> [Creates agent with prompts]

# Non-interactive
chrysalis agent create --name "Bob Ross Agent" --occupation "Artist" --yes
```

#### 7.4.7 Configuration Files

**Default Locations**:
- `~/.config/chrysalis/config.yaml` (user config)
- `./.chrysalis/config.yaml` (project config)
- `$CHRYSALIS_CONFIG` (env override)

**Config Structure**:
```yaml
api:
  base_url: "https://api.chrysalis.dev/v1"
  auth_token: "${CHRYSALIS_TOKEN}"

output:
  default_format: "table"
  color: true

logging:
  level: "info"
  file: "~/.local/share/chrysalis/logs/chrysalis.log"
```

---

### 7.5 Authentication & Authorization Framework

#### 7.5.1 Unified Authentication

**Bearer Token Authentication** (primary method):
```
Authorization: Bearer {token}
```

**Token Format**:
- JWT tokens for stateless auth
- API keys for service-to-service
- Short-lived access tokens with refresh tokens

**Token Types**:
1. **User Tokens** - For human users (from OAuth/SSO)
2. **Service Tokens** - For service-to-service (API keys)
3. **Agent Tokens** - For agent instances (Ed25519 signatures)

#### 7.5.2 Authorization Model

**Role-Based Access Control (RBAC)**:
- `admin` - Full system access
- `agent_owner` - Own agent resources
- `agent_reader` - Read agent resources
- `service` - Service-to-service access

**Resource-Level Permissions**:
- Agents: `agents:read`, `agents:write`, `agents:delete`
- Capabilities: `capabilities:read`, `capabilities:write`
- Knowledge: `knowledge:read`, `knowledge:write`

**Permission Model**:
```
{resource}:{action}
Examples:
- agents:read
- agents:write
- knowledge:delete
- ledger:commit
```

#### 7.5.3 API Key Management

**Key Lifecycle**:
1. Create: `POST /auth/api-keys`
2. List: `GET /auth/api-keys`
3. Rotate: `POST /auth/api-keys/{keyId}/rotate`
4. Revoke: `DELETE /auth/api-keys/{keyId}`
5. Audit: `GET /auth/api-keys/{keyId}/audit`

**Key Format**:
```
{keyId}.{secret}
Example: key_abc123.secret_xyz789
```

---

### 7.6 Error Handling Standards

#### 7.6.1 Error Code Taxonomy

**Error Categories**:
- `VALIDATION_ERROR` - Input validation failed
- `AUTHENTICATION_ERROR` - Auth failure
- `AUTHORIZATION_ERROR` - Permission denied
- `NOT_FOUND_ERROR` - Resource not found
- `CONFLICT_ERROR` - Resource conflict
- `RATE_LIMIT_ERROR` - Rate limit exceeded
- `SERVICE_ERROR` - Internal service error
- `UPSTREAM_ERROR` - Upstream service error

**Specific Error Codes**:
```
VALIDATION_ERROR.REQUIRED_FIELD
VALIDATION_ERROR.INVALID_FORMAT
AUTHENTICATION_ERROR.INVALID_TOKEN
AUTHENTICATION_ERROR.EXPIRED_TOKEN
AUTHORIZATION_ERROR.INSUFFICIENT_PERMISSIONS
NOT_FOUND_ERROR.RESOURCE_NOT_FOUND
CONFLICT_ERROR.DUPLICATE_RESOURCE
RATE_LIMIT_ERROR.TOO_MANY_REQUESTS
SERVICE_ERROR.INTERNAL_ERROR
UPSTREAM_ERROR.SERVICE_UNAVAILABLE
```

#### 7.6.2 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR.REQUIRED_FIELD",
    "message": "The 'agentId' field is required",
    "category": "VALIDATION_ERROR",
    "details": [
      {
        "field": "agentId",
        "code": "REQUIRED",
        "message": "agentId is required",
        "path": ["agentId"]
      }
    ],
    "request_id": "req_abc123",
    "timestamp": "2026-01-09T10:00:00Z",
    "documentation_url": "https://docs.chrysalis.dev/errors/VALIDATION_ERROR.REQUIRED_FIELD",
    "retry_after": null,
    "suggestions": [
      "Provide the 'agentId' field in the request",
      "Check the API documentation for required fields"
    ]
  }
}
```

---

## 8. Phased Refactoring Strategy

### 8.1 Migration Phases Overview

**Phase 1: Foundation** (Weeks 1-2)
- Establish unified framework
- Create shared libraries
- Define standards documentation

**Phase 2: High-Priority Services** (Weeks 3-6)
- AgentBuilder
- KnowledgeBuilder
- SkillBuilder

**Phase 3: Core Services** (Weeks 7-10)
- LedgerService
- CapabilityGatewayService

**Phase 4: Advanced Services** (Weeks 11-14)
- ProjectionService (REST API)
- GroundingService (implementation + API)
- SkillForgeService (implementation + API)

**Phase 5: CLI & Tooling** (Weeks 15-16)
- Unified CLI framework
- Service-specific CLIs
- Documentation

**Phase 6: Integration & Testing** (Weeks 17-18)
- End-to-end testing
- Migration validation
- Performance optimization

---

### 8.2 Phase 1: Foundation (Weeks 1-2)

#### 8.2.1 Tasks

1. **Create Shared Libraries**
   - `chrysalis-api-core` (Python) - Request/response models, error handling
   - `@chrysalis/api-core` (TypeScript) - Same for TS services
   - Shared authentication middleware
   - Shared validation schemas

2. **Documentation**
   - API specification (OpenAPI 3.0)
   - CLI specification document
   - Migration guide
   - Style guide

3. **Infrastructure**
   - API gateway setup (optional, for unified routing)
   - Authentication service (JWT issuer)
   - Rate limiting service

#### 8.2.2 Deliverables

- ✅ Shared library packages published
- ✅ OpenAPI specification v1.0
- ✅ Authentication service deployed
- ✅ Migration documentation

---

### 8.3 Phase 2: High-Priority Services (Weeks 3-6)

#### 8.3.1 AgentBuilder Service

**Current State**: Single endpoint, no auth, minimal error handling

**Migration Tasks**:
1. Add full CRUD endpoints:
   - `GET /agents` - List agents
   - `POST /agents` - Create agent
   - `GET /agents/{agentId}` - Get agent
   - `PATCH /agents/{agentId}` - Update agent
   - `DELETE /agents/{agentId}` - Delete agent
   - `GET /agents/{agentId}/status` - Build status
   - `POST /agents/{agentId}/cancel` - Cancel build

2. Add action endpoints:
   - `POST /agents/{agentId}/build` - Trigger build (rename from `/build`)
   - `GET /agents/{agentId}/capabilities` - Get capabilities
   - `POST /agents/{agentId}/morph` - Morph agent

3. Implement:
   - Authentication middleware
   - Request validation (Pydantic models)
   - Standard error responses
   - Pagination for list endpoints
   - Request ID tracking

4. Add:
   - OpenAPI documentation
   - Health endpoint
   - Metrics endpoint

**Backwards Compatibility**:
- Keep `/build` endpoint with deprecation warning
- Redirect to `/agents/{agentId}/build` with migration guide

**Testing**:
- Unit tests for all endpoints
- Integration tests with KnowledgeBuilder/SkillBuilder
- Load testing

**Estimated Effort**: 2 weeks

---

#### 8.3.2 KnowledgeBuilder Service

**Current State**: Single endpoint, no auth, mature backend logic

**Migration Tasks**:
1. Add CRUD endpoints:
   - `GET /knowledge` - List knowledge entries
   - `POST /knowledge` - Create knowledge (existing, refactor)
   - `GET /knowledge/{knowledgeId}` - Get knowledge entry
   - `PATCH /knowledge/{knowledgeId}` - Update knowledge
   - `DELETE /knowledge/{knowledgeId}` - Delete knowledge

2. Add query endpoints:
   - `POST /knowledge/search` - Advanced search
   - `GET /knowledge/entities/{entityId}` - Get by entity
   - `GET /knowledge/types/{type}` - Get by entity type

3. Implement:
   - Authentication
   - Request validation
   - Standard responses
   - Pagination
   - Filtering/sorting

4. Refactor:
   - Move API key handling to headers
   - Standardize request/response formats
   - Add telemetry endpoints

**Backwards Compatibility**:
- Keep `/knowledge` POST with deprecation notice
- Support both old and new request formats during transition

**Estimated Effort**: 2 weeks

---

#### 8.3.3 SkillBuilder Service

**Current State**: Single endpoint, no auth, comprehensive CLI

**Migration Tasks**:
1. Add CRUD endpoints:
   - `GET /skills` - List skills
   - `POST /skills` - Create skill (existing, refactor)
   - `GET /skills/{skillId}` - Get skill
   - `PATCH /skills/{skillId}` - Update skill
   - `DELETE /skills/{skillId}` - Delete skill

2. Add mode endpoints:
   - `GET /skills/modes` - List modes
   - `GET /skills/modes/{modeId}` - Get mode
   - `POST /skills/modes/{modeId}/merge` - Batch merge

3. Implement:
   - Authentication
   - Request validation
   - Standard responses
   - Align CLI with new API

**Backwards Compatibility**:
- Keep `/skills` POST endpoint
- Update CLI to use new endpoints gradually

**Estimated Effort**: 2 weeks

---

### 8.4 Phase 3: Core Services (Weeks 7-10)

#### 8.4.1 LedgerService

**Current State**: Well-implemented, Ed25519 auth, good error handling

**Migration Tasks**:
1. Standardize endpoints:
   - Keep existing functionality
   - Align error responses with standard format
   - Add standard metadata to responses

2. Enhance:
   - Add filtering to `/ledger/tail` endpoint
   - Add `/ledger/stats` aggregation endpoint
   - Add request ID tracking

3. Add:
   - OpenAPI documentation
   - CLI interface (see Phase 5)

**Backwards Compatibility**:
- All existing endpoints remain functional
- Only response format enhancements (additive)

**Estimated Effort**: 1 week

---

#### 8.4.2 CapabilityGatewayService

**Current State**: Good auth, limited endpoints

**Migration Tasks**:
1. Expand endpoints:
   - `GET /capabilities` - List capabilities
   - `GET /capabilities/{capabilityId}` - Get capability
   - `POST /capabilities/{capabilityId}/execute` - Execute capability

2. Enhance auth:
   - Align with unified auth framework
   - Add token refresh
   - Improve API key management endpoints

3. Add:
   - Standard error responses
   - OpenAPI documentation
   - CLI interface

**Backwards Compatibility**:
- Existing endpoints unchanged
- Additive changes only

**Estimated Effort**: 2 weeks

---

### 8.5 Phase 4: Advanced Services (Weeks 11-14)

#### 8.5.1 ProjectionService

**Current State**: WebSocket only, no REST API

**Migration Tasks**:
1. Add REST API:
   - `GET /projections/{roomId}` - Get current projection state
   - `GET /projections` - List active projections
   - `POST /projections/{roomId}/subscribe` - Subscribe to updates (returns WebSocket URL)
   - `GET /projections/{roomId}/history` - Get projection history

2. Add authentication:
   - Bearer token auth for REST
   - Room-based authorization

3. Document:
   - WebSocket protocol
   - Room naming conventions
   - State schema

**Estimated Effort**: 2 weeks

---

#### 8.5.2 GroundingService

**Current State**: Not implemented

**Migration Tasks**:
1. Implement service:
   - Core grounding logic
   - Knowledge graph integration
   - Context resolution

2. Add API:
   - `POST /grounding/ground` - Ground context
   - `GET /grounding/contexts/{contextId}` - Get grounded context
   - `POST /grounding/verify` - Verify grounding

3. Add:
   - Authentication
   - Full CRUD if needed
   - CLI interface

**Estimated Effort**: 2 weeks

---

#### 8.5.3 SkillForgeService

**Current State**: Not implemented

**Migration Tasks**:
1. Implement service:
   - Orchestrate SkillBuilder pipeline
   - Manage skill generation jobs
   - Track skill provenance

2. Add API:
   - `POST /skillforge/jobs` - Create skill generation job
   - `GET /skillforge/jobs/{jobId}` - Get job status
   - `GET /skillforge/jobs/{jobId}/skills` - Get generated skills
   - `POST /skillforge/jobs/{jobId}/cancel` - Cancel job

3. Add:
   - Authentication
   - Full job management
   - CLI interface

**Estimated Effort**: 2 weeks

---

### 8.6 Phase 5: CLI & Tooling (Weeks 15-16)

#### 8.6.1 Unified CLI Framework

**Tasks**:
1. Create `chrysalis` CLI tool:
   - Unified command structure
   - Shared authentication
   - Consistent output formatting
   - Configuration management

2. Implement service commands:
   ```bash
   chrysalis agent [create|get|list|update|delete|morph|sync]
   chrysalis knowledge [create|get|list|search|delete]
   chrysalis skill [create|get|list|update|delete]
   chrysalis ledger [commit|query|tail|stats]
   chrysalis capability [list|get|build|execute]
   chrysalis projection [get|list|subscribe]
   ```

3. Add utilities:
   - `chrysalis auth login` - Authenticate
   - `chrysalis auth status` - Check auth status
   - `chrysalis config` - Manage configuration
   - `chrysalis completion` - Shell completion

**Technology**:
- TypeScript: Commander.js (consistent with existing)
- Python: Click or Typer (modern alternative to argparse)

**Estimated Effort**: 2 weeks

---

### 8.7 Phase 6: Integration & Testing (Weeks 17-18)

#### 8.7.1 Testing Requirements

1. **Unit Tests**:
   - All endpoints
   - Authentication/authorization
   - Validation logic
   - Error handling

2. **Integration Tests**:
   - Service-to-service communication
   - End-to-end workflows
   - CLI-to-API integration

3. **Performance Tests**:
   - Load testing
   - Stress testing
   - Latency benchmarks

4. **Security Tests**:
   - Authentication bypass attempts
   - Authorization boundary testing
   - Input validation fuzzing

#### 8.7.2 Migration Validation

1. **Backwards Compatibility Checks**:
   - Old clients still work
   - Deprecation warnings present
   - Migration paths documented

2. **Data Migration** (if needed):
   - Existing data accessible via new APIs
   - No data loss
   - Performance maintained

3. **Documentation**:
   - Migration guides per service
   - API changelog
   - CLI migration guide

---

### 8.8 Impact Assessment by Service

#### 8.8.1 AgentBuilder

**Impact**: High
- Currently used by frontend
- Needs immediate migration for production readiness
- Breaking changes acceptable (early stage)

**Risks**:
- Frontend integration disruption
- Mitigation: Phased rollout with feature flags

#### 8.8.2 KnowledgeBuilder

**Impact**: Medium
- Mature backend, less API usage
- Migration mainly affects API layer
- Internal usage may not need migration

**Risks**:
- API consumers need updates
- Mitigation: Maintain old endpoint during transition

#### 8.8.3 SkillBuilder

**Impact**: Low
- Comprehensive CLI already exists
- API less critical
- Migration mainly standardization

**Risks**: Minimal

#### 8.8.4 LedgerService

**Impact**: Low
- Well-implemented already
- Mainly standardization
- No breaking changes needed

**Risks**: Minimal

#### 8.8.5 CapabilityGatewayService

**Impact**: Medium
- Used by agents
- Needs expansion
- Auth already good

**Risks**:
- Agent clients need updates
- Mitigation: Backwards compatible changes

---

### 8.9 Backwards Compatibility Strategy

#### 8.9.1 Deprecation Process

1. **Deprecation Notice**:
   - Add `X-Deprecated` header
   - Include deprecation date in response
   - Document migration path

2. **Deprecation Period**:
   - Minimum 3 months
   - Support both old and new during transition
   - Monitor usage metrics

3. **Removal**:
   - Remove after deprecation period
   - Major version bump
   - Migration guide required

#### 8.9.2 Versioning Strategy

**API Versioning**:
- URL-based: `/v1/`, `/v2/`, etc.
- Header-based: `Accept: application/vnd.chrysalis.v1+json`
- Default to latest stable version

**Semantic Versioning for CLI**:
- Major: Breaking changes
- Minor: New features (backwards compatible)
- Patch: Bug fixes

---

### 8.10 Rollout Timeline

**Week 1-2**: Foundation
- Shared libraries
- Documentation
- Standards definition

**Week 3-4**: AgentBuilder migration
- New endpoints
- Testing
- Documentation

**Week 5-6**: KnowledgeBuilder & SkillBuilder
- Parallel migration
- Testing
- Integration validation

**Week 7-8**: LedgerService & CapabilityGateway
- Standardization
- Enhancements
- Testing

**Week 9-10**: Buffer for delays/issues

**Week 11-12**: ProjectionService REST API
- Implementation
- Testing

**Week 13-14**: GroundingService & SkillForgeService
- Full implementation
- API development
- Testing

**Week 15-16**: Unified CLI
- Framework implementation
- Service-specific commands
- Documentation

**Week 17-18**: Integration & Testing
- End-to-end testing
- Performance validation
- Security testing
- Final documentation

**Total Duration**: 18 weeks (4.5 months)

---

## 9. Success Criteria

### 9.1 API Standards

- ✅ All services follow unified REST API specification
- ✅ Consistent error handling across all services
- ✅ Standard authentication/authorization
- ✅ OpenAPI documentation for all services
- ✅ 95%+ API test coverage

### 9.2 CLI Standards

- ✅ Unified CLI framework for all services
- ✅ Consistent command syntax
- ✅ Comprehensive help/documentation
- ✅ Interactive and non-interactive modes
- ✅ Shell completion support

### 9.3 Documentation

- ✅ Complete API documentation (OpenAPI)
- ✅ CLI usage guides
- ✅ Migration guides for each service
- ✅ Architecture diagrams
- ✅ Code examples

### 9.4 Quality Metrics

- ✅ All services have health endpoints
- ✅ Response time p95 < 200ms (non-AI endpoints)
- ✅ 99.9% uptime (target)
- ✅ Zero critical security vulnerabilities
- ✅ Backwards compatibility maintained where required

---

## 10. Risks & Mitigations

### 10.1 Technical Risks

**Risk**: Breaking existing integrations
**Mitigation**: Phased rollout, backwards compatibility, feature flags

**Risk**: Performance degradation
**Mitigation**: Load testing, performance benchmarks, optimization

**Risk**: Incomplete migration
**Mitigation**: Clear success criteria, thorough testing, phased approach

### 10.2 Operational Risks

**Risk**: Resource constraints
**Mitigation**: Prioritized migration order, incremental delivery

**Risk**: Knowledge gaps
**Mitigation**: Documentation, training, code reviews

### 10.3 Business Risks

**Risk**: User disruption
**Mitigation**: Communication, migration guides, support channels

---

## 11. Recommendations

### 11.1 Immediate Actions

1. **Establish Foundation** (Week 1):
   - Create shared library structure
   - Define OpenAPI specification
   - Set up authentication service

2. **Start with AgentBuilder** (Week 3):
   - Highest impact service
   - Used by frontend
   - Establishes patterns for others

3. **Parallel Development**:
   - KnowledgeBuilder and SkillBuilder can migrate in parallel
   - Different teams can own different services

### 11.2 Long-Term Considerations

1. **API Gateway**:
   - Consider introducing API gateway for unified routing
   - Centralized authentication/rate limiting
   - Request/response transformation

2. **GraphQL Alternative**:
   - Consider GraphQL for complex queries
   - Especially for knowledge/skill relationships
   - Can coexist with REST

3. **Event-Driven Architecture**:
   - Consider event sourcing for state changes
   - WebSocket subscriptions for real-time updates
   - Already partially implemented (ProjectionService)

4. **Service Mesh**:
   - For distributed deployments
   - Service discovery, load balancing, tracing
   - Consider Istio/Linkerd if scaling

---

## 12. Conclusion

This review identifies significant inconsistencies in the Chrysalis backend architecture but also recognizes strong foundations in several services. The proposed unified interface framework provides a clear path forward with:

- **Semantic clarity** through domain-specific vocabulary
- **Consistency** across all services
- **Extensibility** for future growth
- **Usability** for both humans and AI agents

The phased migration strategy minimizes risk while ensuring production-ready interfaces. Success depends on:

1. Strong foundation in Phase 1
2. Incremental migration with backwards compatibility
3. Comprehensive testing and validation
4. Clear documentation and migration guides

**Next Steps**:
1. Review and approve this proposal
2. Assign teams to Phase 1 tasks
3. Begin foundation development
4. Schedule regular progress reviews

---

**Document Version**: 1.0
**Last Updated**: 2026-01-09
**Reviewers**: [TBD]
**Status**: Proposal - Awaiting Approval
