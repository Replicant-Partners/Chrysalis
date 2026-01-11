# C4 Model Architecture Documentation

**Version**: 1.0.0
**Last Updated**: 2025-01-XX
**Status**: Current

## Overview

This document provides a comprehensive C4 model architecture documentation for the Chrysalis system. Following the complex learner pattern, architecture documentation serves as a learning interface that helps developers understand system structure, relationships, and evolution over time.

The C4 model uses four levels of abstraction:
1. **System Context** (Level 1): System and its relationships with users and external systems
2. **Container** (Level 2): High-level technical building blocks
3. **Component** (Level 3): Components within containers
4. **Code** (Level 4): Classes, functions, and data structures

## Level 1: System Context

### System: Chrysalis

Chrysalis is a **Uniform Semantic Agent Transformation System** that enables AI agents to operate as independent, evolving entities.

### Actors

- **Developers**: Build and deploy agents
- **End Users**: Interact with agents via applications
- **System Administrators**: Monitor and maintain the system

### External Systems

- **AI/LLM Providers**: OpenAI, Anthropic, etc. (for agent execution)
- **Knowledge Sources**: Web search APIs, databases (for knowledge collection)
- **Storage Systems**: Vector databases, relational databases (for memory storage)
- **Monitoring Systems**: Sentry, Prometheus, Grafana (for observability)
- **Authentication Providers**: JWT, OAuth providers (for authentication)

### Key Relationships

```
┌─────────────┐
│  Developers │
└──────┬──────┘
       │
       │ Uses
       │
┌──────▼─────────────────────────────────────────┐
│            Chrysalis System                     │
│  ┌──────────────────────────────────────────┐  │
│  │  Agent Transformation & Memory System    │  │
│  └──────────────────────────────────────────┘  │
└──────┬──────┬──────┬──────┬──────┬──────┬──────┘
       │      │      │      │      │      │
       │      │      │      │      │      │ Interacts with
       │      │      │      │      │      │
┌──────▼──────▼──────▼──────▼──────▼──────▼──────┐
│  AI Providers │ Knowledge │ Storage │ Monitoring│
└─────────────────────────────────────────────────┘
```

## Level 2: Container Diagram

### Containers

1. **AgentBuilder Service** (Flask/Python)
   - Orchestrates agent creation
   - Coordinates KnowledgeBuilder and SkillBuilder
   - Provides REST API

2. **KnowledgeBuilder Service** (Flask/Python)
   - Collects knowledge from multiple sources
   - Structures knowledge using Schema.org
   - Provides REST API

3. **SkillBuilder Service** (Flask/Python)
   - Generates agent skills from occupation and corpus
   - Uses exemplar-driven research
   - Provides REST API

4. **Shared API Core** (Python Library)
   - Common API utilities (middleware, models, helpers)
   - Used by all services

5. **Agent Transformation System** (TypeScript)
   - Morphs agents between frameworks (ElizaOS, CrewAI, MCP-native)
   - Preserves identity and experience
   - CLI and programmatic interfaces

6. **Memory System** (Python)
   - Distributed memory with Byzantine consensus
   - Pattern-based memory (Hash, Signature, Gossip, DAG, CRDT)
   - Experience synchronization

7. **Frontend** (TypeScript/React) (optional)
   - User interface for agent management
   - Visualizes agent state and evolution

### Container Relationships

```
┌─────────────────────────────────────────────────────────┐
│                    External Users                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP/REST
                     │
┌────────────────────▼────────────────────────────────────┐
│              AgentBuilder Service                        │
│              (Flask/Python :5000)                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  - Agent orchestration                           │  │
│  │  - Coordinates KnowledgeBuilder & SkillBuilder   │  │
│  │  - REST API endpoints                            │  │
│  └──────────────────────────────────────────────────┘  │
└──────┬──────────────────┬───────────────────────────────┘
       │                  │
       │ HTTP/REST        │ HTTP/REST
       │                  │
┌──────▼──────────┐  ┌────▼──────────────┐
│ KnowledgeBuilder│  │  SkillBuilder     │
│  (Flask/Python  │  │  (Flask/Python    │
│   :5002)        │  │   :5001)          │
└─────────────────┘  └───────────────────┘
       │                  │
       │                  │
       └──────────┬───────┘
                  │
                  │ Uses
                  │
        ┌─────────▼───────────────┐
        │   Shared API Core       │
        │   (Python Library)      │
        │  - Middleware           │
        │  - Models               │
        │  - Helpers              │
        └─────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│          Agent Transformation System                    │
│          (TypeScript)                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │  - Framework morphing                            │  │
│  │  - Identity preservation                         │  │
│  │  - Experience preservation                       │  │
│  └──────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────────┘
       │
       │ Uses
       │
┌──────▼──────────────────────────────────────────────────┐
│          Memory System                                  │
│          (Python)                                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  - Distributed memory                            │  │
│  │  - Byzantine consensus                           │  │
│  │  - Pattern-based (Hash, Signature, Gossip, etc.)│  │
│  │  - Experience sync                               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Level 3: Component Diagram

### AgentBuilder Service Components

1. **API Routes** (`server.py`)
   - Endpoint handlers
   - Request/response processing
   - Authentication/authorization

2. **Orchestration Logic**
   - Coordinates KnowledgeBuilder and SkillBuilder
   - Manages agent lifecycle
   - Handles errors and retries

3. **Store** (in-memory, replace with database)
   - Agent storage
   - Agent retrieval
   - Agent updates

### KnowledgeBuilder Service Components

1. **API Routes** (`server.py`)
   - Endpoint handlers
   - Request/response processing

2. **Pipeline** (`src/pipeline/`)
   - Multi-source collection
   - Knowledge structuring
   - Schema.org integration

3. **Collectors** (`src/collectors/`)
   - Web search collectors
   - API collectors
   - Data source adapters

4. **Storage** (`src/storage/`)
   - Vector database (LanceDB)
   - SQLite cache
   - Knowledge indexing

### SkillBuilder Service Components

1. **API Routes** (`server.py`)
   - Endpoint handlers
   - Request/response processing

2. **Pipeline** (`skill_builder/pipeline/`)
   - Search pipeline
   - Synthesis engine
   - Mode management

3. **Storage** (in-memory, replace with database)
   - Skill storage
   - Mode storage

### Shared API Core Components

1. **Models** (`models.py`)
   - `APIResponse`
   - `APIError`
   - Request/response models

2. **Middleware** (`middleware.py`)
   - Error handling
   - CORS
   - Request ID tracking
   - Response headers

3. **Monitoring** (`monitoring.py`)
   - Health checks
   - Metrics collection

4. **Security** (`security_headers.py`)
   - Security headers middleware

5. **Error Tracking** (`error_tracking.py`)
   - Sentry integration
   - Error contextualization

6. **Audit Logging** (`audit_logging.py`)
   - Security event logging
   - Audit trail

7. **Authentication** (`auth.py`)
   - JWT verification
   - API key verification
   - Auth context

8. **Rate Limiting** (`rate_limiting.py`)
   - Token bucket algorithm
   - Per-IP/per-endpoint limiting

9. **Validation** (`validation.py`, `schemas.py`)
   - Request validation
   - Pydantic models

10. **Helpers** (`utils.py`, `list_helpers.py`, `filtering.py`)
    - Response helpers
    - List processing
    - Filtering/sorting

## Level 4: Code Structure

### Key Classes and Functions

#### Shared API Core

**Models**:
- `APIResponse`: Standard response wrapper
- `APIError`: Error model with code, message, category
- `PaginationParams`: Pagination parameters
- `FilterParams`: Filtering parameters
- `SortParams`: Sorting parameters

**Middleware**:
- `create_all_middleware()`: Sets up all middleware
- `create_error_handler()`: Error handling
- `create_cors_middleware()`: CORS
- `create_request_id_middleware()`: Request ID tracking
- `create_response_headers_middleware()`: Response headers

**Monitoring**:
- `HealthRegistry`: Health check registry
- `HealthCheck`: Health check definition
- `MetricsCollector`: Metrics collection

**Error Tracking**:
- `ErrorTrackingConfig`: Error tracking configuration
- `create_error_tracking_middleware()`: Error tracking setup
- `capture_message()`: Capture message
- `capture_exception()`: Capture exception

**Audit Logging**:
- `AuditEvent`: Audit event model
- `AuditLogger`: Audit logger
- `create_audit_logging_middleware()`: Audit logging setup

## Technology Stack

### Backend Services
- **Language**: Python 3.10+
- **Framework**: Flask
- **Validation**: Pydantic
- **Documentation**: flasgger (Swagger/OpenAPI)
- **Error Tracking**: Sentry (optional)
- **Monitoring**: Custom health checks and metrics

### Agent Transformation
- **Language**: TypeScript
- **Runtime**: Node.js 20.x+
- **Frameworks**: Various (ElizaOS, CrewAI, etc.)

### Memory System
- **Language**: Python
- **Patterns**: Hash, Signature, Gossip, DAG, CRDT, Byzantine consensus
- **Storage**: Vector databases, relational databases

### Infrastructure
- **CI/CD**: GitHub Actions
- **Containerization**: Docker (optional)
- **Monitoring**: Prometheus, Grafana (optional)

## Data Flow

### Agent Creation Flow

1. **Request**: Developer sends POST `/api/v1/agents`
2. **AgentBuilder**: Receives request, validates
3. **KnowledgeBuilder**: AgentBuilder calls KnowledgeBuilder to collect knowledge
4. **SkillBuilder**: AgentBuilder calls SkillBuilder to generate skills
5. **Response**: AgentBuilder returns complete agent with knowledge and skills

### Experience Synchronization Flow

1. **Deployed Instance**: Agent instance learns from interactions
2. **Experience Events**: Instance generates experience events
3. **Sync Protocol**: Events synchronized via streaming/lumped/check-in
4. **Memory System**: Events merged into distributed memory
5. **Skill Accumulation**: Skills accumulated across instances
6. **Knowledge Integration**: Knowledge integrated with trust scoring

## Security Architecture

### Authentication
- **JWT Tokens**: Stateless authentication
- **API Keys**: Alternative authentication method
- **Bearer Token Format**: `Authorization: Bearer <token>`

### Authorization
- **Role-Based**: Roles and permissions
- **Resource-Based**: Per-resource permissions
- **Context-Aware**: Request context for authorization

### Security Headers
- **HSTS**: Strict-Transport-Security
- **CSP**: Content-Security-Policy
- **X-Frame-Options**: Frame protection
- **X-Content-Type-Options**: MIME type protection

### Audit Logging
- **Security Events**: All security-relevant events logged
- **Structured Logging**: JSON format for parsing
- **Context**: User, action, resource, outcome

## Deployment Architecture

### Development
- Services run locally
- In-memory storage
- Basic monitoring

### Production
- Containerized services (Docker)
- Database storage
- Full monitoring and observability
- Error tracking (Sentry)
- Audit logging
- Security hardening

## Evolution and Patterns

Following the complex learner pattern, the architecture evolves through:

1. **Pattern Recognition**: Identifying recurring patterns
2. **Pattern Application**: Applying universal patterns (Hash, Signature, Gossip, etc.)
3. **Pattern Refinement**: Improving pattern implementations
4. **Pattern Emergence**: New patterns emerging from interactions

The architecture documents these patterns and their evolution over time.

## Further Reading

- **System Purpose**: See `ARCHITECTURE.md`
- **API Documentation**: See `docs/api/openapi-specification.md`
- **Developer Guide**: See `docs/developer-guide/getting-started.md`
- **Pattern Documentation**: See `docs/research/universal-patterns/`
