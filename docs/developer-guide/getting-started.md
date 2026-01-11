# Getting Started with Chrysalis

**Version**: 1.0.0
**Last Updated**: 2025-01-XX
**Status**: Current

## Overview

This guide helps developers get started with the Chrysalis project. Following the complex learner pattern, this documentation serves as a learning interface that helps developers understand the system through progressive discovery and investigation.

## Prerequisites

### Required

- **Python**: 3.10 or higher
- **Node.js**: 20.x or higher (for TypeScript services)
- **Git**: Latest version
- **Docker**: Latest version (optional, for containerized deployment)

### Recommended

- **Python Virtual Environment**: `venv` or `virtualenv`
- **Node Version Manager**: `nvm` (for Node.js)
- **IDE**: VS Code, PyCharm, or similar
- **API Client**: Postman, Insomnia, or `curl`

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/chrysalis.git
cd chrysalis
```

### 2. Set Up Python Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Linux/macOS
# or
venv\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt

# Install shared API core
cd shared/api_core
pip install -e .
cd ../..
```

### 3. Set Up Node.js Environment (if working with TypeScript services)

```bash
# Install Node.js dependencies
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# API Keys (if needed)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Service URLs (defaults provided)
AGENT_BUILDER_URL=http://localhost:5000
KNOWLEDGE_BUILDER_URL=http://localhost:5002
SKILL_BUILDER_URL=http://localhost:5001

# Error Tracking (optional)
SENTRY_DSN=your_sentry_dsn_here
ERROR_TRACKING_ENABLED=true

# Environment
ENVIRONMENT=development
```

### 5. Start Services

#### Start AgentBuilder

```bash
cd projects/AgentBuilder
python server.py
# Service runs on http://localhost:5000
```

#### Start KnowledgeBuilder

```bash
cd projects/KnowledgeBuilder
python server.py
# Service runs on http://localhost:5002
```

#### Start SkillBuilder

```bash
cd projects/SkillBuilder
python server.py
# Service runs on http://localhost:5001
```

### 6. Verify Installation

```bash
# Check AgentBuilder health
curl http://localhost:5000/health

# Check KnowledgeBuilder health
curl http://localhost:5002/health

# Check SkillBuilder health
curl http://localhost:5001/health
```

All services should return:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-XXT...",
  "checks": { ... }
}
```

## Project Structure

```
chrysalis/
├── projects/
│   ├── AgentBuilder/          # Agent orchestration service
│   ├── KnowledgeBuilder/      # Knowledge collection service
│   └── SkillBuilder/          # Skill generation service
├── shared/
│   └── api_core/              # Shared API utilities
│       ├── models.py          # Request/response models
│       ├── middleware.py      # Flask middleware
│       ├── monitoring.py      # Health checks & metrics
│       ├── security_headers.py # Security headers
│       ├── error_tracking.py  # Error tracking (Sentry)
│       └── audit_logging.py   # Audit logging
├── src/                       # TypeScript source code
├── docs/                      # Documentation
│   ├── api/                   # API documentation
│   ├── architecture/          # Architecture docs
│   └── developer-guide/       # Developer guides
├── tests/                     # Tests
└── .github/workflows/         # CI/CD workflows
```

## Development Workflow

### 1. Make Changes

Follow the complex learner pattern:
- **Discovery**: Understand the problem
- **Investigation**: Gather evidence
- **Synthesis**: Design solution
- **Reporting**: Implement and document

### 2. Run Tests

```bash
# Run Python tests
pytest

# Run TypeScript tests
npm test

# Run with coverage
pytest --cov=shared/api_core --cov-report=html
```

### 3. Check Code Quality

```bash
# Lint Python code
flake8 shared/api_core
black --check shared/api_core

# Type check Python code
mypy shared/api_core

# Lint TypeScript code
npm run lint
```

### 4. Commit Changes

Follow conventional commits:

```bash
git add .
git commit -m "feat: add new feature"
# or
git commit -m "fix: fix bug"
# or
git commit -m "docs: update documentation"
```

### 5. Create Pull Request

1. Push to your branch
2. Create pull request
3. CI/CD will run automatically
4. Address review comments
5. Merge when approved

## API Development

### Using the Shared API Core

All services use the shared API core library:

```python
from shared.api_core import (
    APIResponse,
    APIError,
    json_response,
    error_response,
    require_resource_exists,
    create_all_middleware,
)

# Create Flask app
app = Flask(__name__)

# Setup middleware (includes monitoring, security headers, error tracking, audit logging)
create_all_middleware(app, api_version="v1")

# Use standard response helpers
@app.route('/api/v1/endpoint', methods=['GET'])
@require_auth
def my_endpoint():
    return json_response({"data": "value"})
```

### Adding New Endpoints

1. **Define Route**: Use `@app.route()` decorator
2. **Add Authentication**: Use `@require_auth` if needed
3. **Validate Request**: Use `RequestValidator` or Pydantic models
4. **Process Request**: Implement business logic
5. **Return Response**: Use `json_response()` or `error_response()`
6. **Document**: Add OpenAPI/Swagger docstrings

Example:

```python
@app.route('/api/v1/example', methods=['POST'])
@require_auth
def create_example():
    """
    Create example resource.
    ---
    tags:
      - Examples
    summary: Create example
    description: Creates a new example resource
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required:
            - name
          properties:
            name:
              type: string
    responses:
      201:
        description: Created
      400:
        description: Validation error
    """
    data = request.get_json() or {}
    # Validate
    name = RequestValidator.require_string(data, 'name')
    # Process
    # ...
    # Return
    return json_response({"id": "example-id"}, status=201)
```

## Testing

### Unit Tests

```python
# tests/test_example.py
import pytest
from shared.api_core import APIResponse, APIError

def test_example():
    response = APIResponse.success_response({"data": "value"})
    assert response.success is True
    assert response.data == {"data": "value"}
```

### Integration Tests

```python
# tests/test_integration.py
import pytest
from flask import Flask

@pytest.fixture
def client():
    app = Flask(__name__)
    # Setup app
    return app.test_client()

def test_endpoint(client):
    response = client.get('/api/v1/endpoint')
    assert response.status_code == 200
```

### Running Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_example.py

# Run with verbose output
pytest -v

# Run with coverage
pytest --cov=shared/api_core --cov-report=html
```

## Debugging

### Logging

All services use Python's standard logging:

```python
import logging
logger = logging.getLogger(__name__)

logger.debug("Debug message")
logger.info("Info message")
logger.warning("Warning message")
logger.error("Error message")
```

### Health Checks

Check service health:

```bash
# Health check
curl http://localhost:5000/health

# Metrics
curl http://localhost:5000/metrics
```

### Error Tracking

If Sentry is configured, errors are automatically tracked:

- Check Sentry dashboard for errors
- Errors include request context, user info, and stack traces

### Audit Logging

Security events are logged to audit log:

- Check audit log file (if configured)
- Events include user, action, resource, and outcome

## Common Tasks

### Adding a New Endpoint

1. Define route in `server.py`
2. Add authentication if needed
3. Implement business logic
4. Add OpenAPI documentation
5. Write tests
6. Update API documentation

### Adding Middleware

Use `create_all_middleware()` which includes:

- Request ID tracking
- CORS
- Response headers
- Rate limiting
- Health checks
- Metrics
- Security headers
- Error tracking
- Audit logging

### Adding Custom Health Checks

```python
from shared.api_core import register_health_check, HealthCheck

def check_database():
    # Check database connection
    return (True, None)

register_health_check(app, HealthCheck("database", check_database, required=True))
```

## Next Steps

1. **Read Architecture Documentation**: See `docs/architecture/overview.md`
2. **Explore API Documentation**: See `docs/api/openapi-specification.md`
3. **Review Code Examples**: See `examples/` directory
4. **Join the Community**: See `CONTRIBUTING.md`

## Getting Help

- **Documentation**: See `docs/` directory
- **API Documentation**: Interactive docs at `/api/v1/docs` for each service
- **Issues**: Report issues on GitHub
- **Discussions**: Join discussions on GitHub

## Learning Path

Following the complex learner pattern:

1. **Discovery**: Explore the codebase, understand the structure
2. **Investigation**: Read documentation, examine code, run examples
3. **Synthesis**: Understand patterns, relationships, and principles
4. **Reporting**: Start making contributions, document your learning

Each step builds on the previous, enabling progressive understanding and mastery.
