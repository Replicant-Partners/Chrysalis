# Chrysalis OpenAPI 3.0 Specifications

**Version**: 1.0  
**Last Updated**: 2026-01-11  
**Status**: Production

---

## Overview

This directory contains OpenAPI 3.0 specifications for all Chrysalis services. These machine-readable specifications enable:

- **Interactive API Documentation**: Swagger UI, ReDoc, Postman
- **Code Generation**: Client SDKs in multiple languages
- **API Testing**: Automated testing tools
- **Contract Validation**: Ensure API consistency
- **Mock Servers**: Development and testing

---

## Available Specifications

### 1. AgentBuilder API
**File**: [`agentbuilder-openapi.yaml`](agentbuilder-openapi.yaml)  
**Service Port**: 5000  
**Endpoints**: 10

**Coverage**:
- Health check
- Agent CRUD operations (Create, Read, Update, Delete)
- Agent listing with pagination
- Agent capabilities retrieval
- Agent rebuild functionality
- Legacy endpoint (deprecated)

**Key Features**:
- Service orchestration patterns
- Upstream service integration
- Complete request/response schemas
- Error handling documentation

---

### 2. SkillBuilder API
**File**: [`skillbuilder-openapi.yaml`](skillbuilder-openapi.yaml)
**Service Port**: 5001
**Endpoints**: 10

**Coverage**:
- Health check
- Skill CRUD operations (Create, Read, Update, Delete)
- Skill listing with pagination
- Skill modes management
- Legacy endpoint (deprecated)

**Key Features**:
- Occupation-based skill generation
- Deepening cycles support (0-11)
- Skill embeddings for semantic search
- Complete request/response schemas
- Error handling documentation

---

### 3. KnowledgeBuilder API
**File**: [`knowledgebuilder-openapi.yaml`](knowledgebuilder-openapi.yaml)
**Service Port**: 5002
**Endpoints**: 10

**Coverage**:
- Health check
- Knowledge CRUD operations (Create, Read, Update, Delete)
- Semantic search
- Entity lookup
- Knowledge listing with pagination
- Legacy endpoint (deprecated)

**Key Features**:
- Entity-based knowledge generation
- Multi-source search integration
- Deepening cycles support
- Natural language search
- Complete request/response schemas
- Error handling documentation

---

## Using OpenAPI Specifications

### Viewing with Swagger UI

#### Option 1: Online Swagger Editor
1. Go to https://editor.swagger.io/
2. File → Import File
3. Select the OpenAPI YAML file
4. View interactive documentation

#### Option 2: Local Swagger UI (Docker)
```bash
# AgentBuilder
docker run -p 8080:8080 \
  -e SWAGGER_JSON=/specs/agentbuilder-openapi.yaml \
  -v $(pwd)/docs/api/openapi:/specs \
  swaggerapi/swagger-ui

# Access at http://localhost:8080
```

#### Option 3: Integrated Swagger UI (Python)
```python
from flask import Flask
from flasgger import Swagger

app = Flask(__name__)

# Configure Swagger
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": 'apispec',
            "route": '/apispec.json',
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/docs"
}

swagger = Swagger(app, config=swagger_config, template_file='docs/api/openapi/agentbuilder-openapi.yaml')

# Access at http://localhost:5000/docs
```

---

### Generating Client SDKs

#### Using OpenAPI Generator

**Install**:
```bash
npm install @openapitools/openapi-generator-cli -g
```

**Generate Python Client**:
```bash
openapi-generator-cli generate \
  -i docs/api/openapi/agentbuilder-openapi.yaml \
  -g python \
  -o clients/python/agentbuilder \
  --additional-properties=packageName=chrysalis_agentbuilder
```

**Generate TypeScript Client**:
```bash
openapi-generator-cli generate \
  -i docs/api/openapi/agentbuilder-openapi.yaml \
  -g typescript-axios \
  -o clients/typescript/agentbuilder
```

**Generate Java Client**:
```bash
openapi-generator-cli generate \
  -i docs/api/openapi/agentbuilder-openapi.yaml \
  -g java \
  -o clients/java/agentbuilder \
  --additional-properties=groupId=dev.chrysalis,artifactId=agentbuilder-client
```

**Supported Languages**:
- Python, TypeScript, JavaScript, Java, Go, Ruby, PHP, C#, Kotlin, Swift, Rust, and 50+ more

---

### Validating Specifications

#### Using Swagger CLI
```bash
npm install -g @apidevtools/swagger-cli

# Validate spec
swagger-cli validate docs/api/openapi/agentbuilder-openapi.yaml

# Bundle spec (resolve $ref)
swagger-cli bundle docs/api/openapi/agentbuilder-openapi.yaml \
  -o docs/api/openapi/agentbuilder-openapi-bundled.yaml
```

#### Using Spectral (Advanced Linting)
```bash
npm install -g @stoplight/spectral-cli

# Create .spectral.yaml
cat > .spectral.yaml << EOF
extends: ["spectral:oas", "spectral:asyncapi"]
rules:
  operation-description: error
  operation-tags: error
  operation-operationId: error
EOF

# Lint spec
spectral lint docs/api/openapi/agentbuilder-openapi.yaml
```

---

### Testing with Postman

1. **Import OpenAPI Spec**:
   - Open Postman
   - File → Import
   - Select OpenAPI YAML file
   - Postman creates collection automatically

2. **Configure Environment**:
   ```json
   {
     "base_url": "http://localhost:5000",
     "api_key": "{{CHRYSALIS_API_KEY}}"
   }
   ```

3. **Run Collection**:
   - Collection Runner → Select imported collection
   - Run automated tests

---

### Creating Mock Servers

#### Using Prism
```bash
npm install -g @stoplight/prism-cli

# Start mock server
prism mock docs/api/openapi/agentbuilder-openapi.yaml

# Mock server runs on http://localhost:4010
```

#### Using Mockoon
1. Download Mockoon: https://mockoon.com/
2. Import OpenAPI spec
3. Start mock server
4. Test API without backend

---

## Specification Structure

### Standard Components

All specifications follow this structure:

```yaml
openapi: 3.0.3
info:
  title: Service Name
  version: 1.0.0
  description: Service description
  
servers:
  - url: http://localhost:PORT
    description: Development
  - url: https://api.chrysalis.dev
    description: Production

security:
  - bearerAuth: []

paths:
  /endpoint:
    method:
      summary: Endpoint summary
      operationId: uniqueOperationId
      parameters: [...]
      requestBody: {...}
      responses: {...}

components:
  securitySchemes:
    bearerAuth: {...}
  schemas:
    APIResponse: {...}
    APIError: {...}
  parameters: {...}
  responses: {...}
```

---

## Shared Components

All services share common schemas defined in [`shared/api_core/`](../../../shared/api_core/):

### Response Envelope
```yaml
APIResponse:
  type: object
  required: [success, meta]
  properties:
    success:
      type: boolean
    data:
      description: Response data
    error:
      $ref: '#/components/schemas/APIError'
    meta:
      $ref: '#/components/schemas/ResponseMeta'
```

### Error Schema
```yaml
APIError:
  type: object
  required: [code, message, category, timestamp]
  properties:
    code:
      type: string
      example: VALIDATION_ERROR.REQUIRED_FIELD
    message:
      type: string
    category:
      type: string
      enum: [VALIDATION_ERROR, AUTHENTICATION_ERROR, ...]
    details:
      type: array
      items:
        $ref: '#/components/schemas/ErrorDetail'
```

### Pagination
```yaml
PaginationMeta:
  type: object
  required: [page, per_page, total, total_pages, has_next, has_prev]
  properties:
    page:
      type: integer
      minimum: 1
    per_page:
      type: integer
      minimum: 1
      maximum: 100
    total:
      type: integer
    total_pages:
      type: integer
    has_next:
      type: boolean
    has_prev:
      type: boolean
```

---

## Generating Complete Specifications

### Automated Generation Script

Create `scripts/generate_openapi_specs.py`:

```python
#!/usr/bin/env python3
"""
Generate OpenAPI specifications for all Chrysalis services.
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.api_core.openapi import get_base_openapi_spec, save_openapi_spec

def generate_agentbuilder_spec():
    """Generate AgentBuilder OpenAPI spec."""
    spec = get_base_openapi_spec(
        title="AgentBuilder API",
        version="1.0.0",
        description="Agent orchestration and lifecycle management",
        api_version="v1"
    )
    
    # Add service-specific paths and schemas
    # (Implementation details...)
    
    save_openapi_spec(spec, "docs/api/openapi/agentbuilder-openapi.json")
    print("✓ Generated AgentBuilder OpenAPI spec")

def generate_skillbuilder_spec():
    """Generate SkillBuilder OpenAPI spec."""
    spec = get_base_openapi_spec(
        title="SkillBuilder API",
        version="1.0.0",
        description="Skill set generation and management",
        api_version="v1"
    )
    
    # Add service-specific paths and schemas
    # (Implementation details...)
    
    save_openapi_spec(spec, "docs/api/openapi/skillbuilder-openapi.json")
    print("✓ Generated SkillBuilder OpenAPI spec")

def generate_knowledgebuilder_spec():
    """Generate KnowledgeBuilder OpenAPI spec."""
    spec = get_base_openapi_spec(
        title="KnowledgeBuilder API",
        version="1.0.0",
        description="Knowledge cloud generation and semantic search",
        api_version="v1"
    )
    
    # Add service-specific paths and schemas
    # (Implementation details...)
    
    save_openapi_spec(spec, "docs/api/openapi/knowledgebuilder-openapi.json")
    print("✓ Generated KnowledgeBuilder OpenAPI spec")

if __name__ == "__main__":
    print("Generating OpenAPI specifications...")
    generate_agentbuilder_spec()
    generate_skillbuilder_spec()
    generate_knowledgebuilder_spec()
    print("\n✓ All specifications generated successfully")
```

**Run**:
```bash
python scripts/generate_openapi_specs.py
```

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/openapi-validation.yml`:

```yaml
name: OpenAPI Validation

on:
  push:
    paths:
      - 'docs/api/openapi/**'
      - 'projects/*/server.py'
  pull_request:
    paths:
      - 'docs/api/openapi/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Swagger CLI
        run: npm install -g @apidevtools/swagger-cli
      
      - name: Validate AgentBuilder spec
        run: swagger-cli validate docs/api/openapi/agentbuilder-openapi.yaml
      
      - name: Validate SkillBuilder spec
        run: swagger-cli validate docs/api/openapi/skillbuilder-openapi.yaml
      
      - name: Validate KnowledgeBuilder spec
        run: swagger-cli validate docs/api/openapi/knowledgebuilder-openapi.yaml
      
      - name: Lint with Spectral
        run: |
          npm install -g @stoplight/spectral-cli
          spectral lint docs/api/openapi/*.yaml
```

---

## Best Practices

### 1. Keep Specs in Sync
- Update OpenAPI specs when changing API endpoints
- Use automated generation where possible
- Validate specs in CI/CD pipeline

### 2. Use $ref for Reusability
```yaml
# Good: Reuse common schemas
responses:
  '200':
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/APIResponse'

# Bad: Duplicate schema definitions
responses:
  '200':
    content:
      application/json:
        schema:
          type: object
          properties:
            success:
              type: boolean
            # ... duplicated structure
```

### 3. Provide Examples
```yaml
schema:
  type: object
  properties:
    agent_id:
      type: string
      example: agent-bob-ross-001  # Always include examples
```

### 4. Document Error Responses
```yaml
responses:
  '400':
    description: Bad request
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/APIResponse'
        examples:
          missing_field:
            summary: Missing required field
            value:
              success: false
              error:
                code: VALIDATION_ERROR.REQUIRED_FIELD
                message: Field 'agent_id' is required
```

### 5. Use Operation IDs
```yaml
paths:
  /api/v1/agents:
    post:
      operationId: createAgent  # Used for code generation
      summary: Create new agent
```

---

## Troubleshooting

### Issue: Spec Validation Fails

**Solution**:
```bash
# Check for syntax errors
swagger-cli validate docs/api/openapi/agentbuilder-openapi.yaml

# Common issues:
# - Missing required fields
# - Invalid $ref paths
# - Incorrect indentation (YAML)
# - Duplicate operationIds
```

### Issue: Generated Client Doesn't Work

**Solution**:
1. Verify spec is valid
2. Check generator version compatibility
3. Review generated code for issues
4. Test with mock server first

### Issue: Swagger UI Not Loading

**Solution**:
```bash
# Check file path
ls -la docs/api/openapi/agentbuilder-openapi.yaml

# Verify YAML syntax
python -c "import yaml; yaml.safe_load(open('docs/api/openapi/agentbuilder-openapi.yaml'))"

# Check Swagger UI configuration
# Ensure correct file path in config
```

---

## Related Documentation

- [API Reference Index](../API_REFERENCE_INDEX.md)
- [Authentication Guide](../AUTHENTICATION.md)
- [Integration Quick Start](../INTEGRATION_QUICK_START.md)
- [AgentBuilder API Spec](../services/AGENTBUILDER_COMPLETE_SPEC.md)
- [SkillBuilder API Spec](../services/SKILLBUILDER_API_SPEC.md)
- [KnowledgeBuilder API Spec](../services/KNOWLEDGEBUILDER_API_SPEC.md)

---

## Support

**Documentation**: https://docs.chrysalis.dev  
**OpenAPI Tools**: https://openapi.tools/  
**Swagger**: https://swagger.io/  
**Issues**: https://github.com/chrysalis/chrysalis/issues

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-11  
**Next Review**: 2026-02-11
