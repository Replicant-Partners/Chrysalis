# Swagger UI Deployment Guide

**Version**: 1.0  
**Last Updated**: 2026-01-11  
**Status**: Production

---

## Overview

This guide provides instructions for deploying Swagger UI to enable interactive API documentation for all Chrysalis services. Swagger UI allows developers to:

- **Explore APIs interactively**: Browse all endpoints with detailed documentation
- **Test APIs directly**: Execute API calls from the browser ("Try it out")
- **View request/response examples**: See real-world usage patterns
- **Understand authentication**: Test with actual API keys
- **Generate code snippets**: Get client code in multiple languages

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Deployment Options](#deployment-options)
3. [Service-Specific Setup](#service-specific-setup)
4. [Configuration](#configuration)
5. [Authentication Setup](#authentication-setup)
6. [Customization](#customization)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Option 1: Using Flasgger (Recommended for Flask)

Flasgger is already integrated into Chrysalis services via [`shared/api_core/swagger.py`](../../shared/api_core/swagger.py).

**Enable Swagger UI**:

```python
# In your service's server.py
from shared.api_core.swagger import setup_swagger

app = Flask(__name__)

# Enable Swagger UI
setup_swagger(
    app,
    title="AgentBuilder API",
    version="1.0.0",
    description="Agent orchestration and lifecycle management"
)

# Access Swagger UI at http://localhost:5000/apidocs
```

**Verify**:
```bash
# Start service
python projects/AgentBuilder/server.py

# Open browser
open http://localhost:5000/apidocs
```

---

### Option 2: Using Docker (Standalone)

Deploy Swagger UI as a standalone container:

```bash
# AgentBuilder
docker run -d \
  --name agentbuilder-swagger \
  -p 8080:8080 \
  -e SWAGGER_JSON=/specs/agentbuilder-openapi.yaml \
  -v $(pwd)/docs/api/openapi:/specs \
  swaggerapi/swagger-ui

# Access at http://localhost:8080
```

---

### Option 3: Using Swagger UI Static Files

Host Swagger UI as static files:

```bash
# Download Swagger UI
wget https://github.com/swagger-api/swagger-ui/archive/refs/tags/v5.10.0.tar.gz
tar -xzf v5.10.0.tar.gz
cd swagger-ui-5.10.0/dist

# Configure
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chrysalis API Documentation</title>
  <link rel="stylesheet" type="text/css" href="./swagger-ui.css" />
  <link rel="icon" type="image/png" href="./favicon-32x32.png" sizes="32x32" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="./swagger-ui-bundle.js"></script>
  <script src="./swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/api/openapi/agentbuilder-openapi.yaml",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      })
    }
  </script>
</body>
</html>
EOF

# Serve with Python
python -m http.server 8000
# Access at http://localhost:8000
```

---

## Deployment Options

### Comparison Matrix

| Option | Pros | Cons | Best For |
|--------|------|------|----------|
| **Flasgger** | Integrated, auto-updates, no extra setup | Requires Flask restart | Development, integrated docs |
| **Docker** | Isolated, easy deployment, version control | Extra container | Production, microservices |
| **Static Files** | Simple, no dependencies, fast | Manual updates | Static hosting, CDN |
| **Nginx** | Production-ready, caching, SSL | More configuration | Production, high traffic |

---

## Service-Specific Setup

### AgentBuilder (Port 5000)

**Using Flasgger**:

```python
# projects/AgentBuilder/server.py
from flask import Flask
from shared.api_core.swagger import setup_swagger

app = Flask(__name__)

# Configure Swagger
setup_swagger(
    app,
    title="AgentBuilder API",
    version="1.0.0",
    description="Agent orchestration and lifecycle management",
    openapi_spec_path="docs/api/openapi/agentbuilder-openapi.yaml"
)

# Swagger UI available at:
# http://localhost:5000/apidocs
# OpenAPI spec at:
# http://localhost:5000/apispec.json
```

**Using Docker**:

```bash
docker run -d \
  --name agentbuilder-swagger \
  -p 8080:8080 \
  -e SWAGGER_JSON=/specs/agentbuilder-openapi.yaml \
  -v $(pwd)/docs/api/openapi:/specs \
  --network chrysalis-network \
  swaggerapi/swagger-ui
```

---

### SkillBuilder (Port 5001)

**Using Flasgger**:

```python
# projects/SkillBuilder/server.py
from flask import Flask
from shared.api_core.swagger import setup_swagger

app = Flask(__name__)

setup_swagger(
    app,
    title="SkillBuilder API",
    version="1.0.0",
    description="Skill set generation and management",
    openapi_spec_path="docs/api/openapi/skillbuilder-openapi.yaml"
)

# Access at http://localhost:5001/apidocs
```

**Using Docker**:

```bash
docker run -d \
  --name skillbuilder-swagger \
  -p 8081:8080 \
  -e SWAGGER_JSON=/specs/skillbuilder-openapi.yaml \
  -v $(pwd)/docs/api/openapi:/specs \
  --network chrysalis-network \
  swaggerapi/swagger-ui
```

---

### KnowledgeBuilder (Port 5002)

**Using Flasgger**:

```python
# projects/KnowledgeBuilder/server.py
from flask import Flask
from shared.api_core.swagger import setup_swagger

app = Flask(__name__)

setup_swagger(
    app,
    title="KnowledgeBuilder API",
    version="1.0.0",
    description="Knowledge cloud generation and semantic search",
    openapi_spec_path="docs/api/openapi/knowledgebuilder-openapi.yaml"
)

# Access at http://localhost:5002/apidocs
```

**Using Docker**:

```bash
docker run -d \
  --name knowledgebuilder-swagger \
  -p 8082:8080 \
  -e SWAGGER_JSON=/specs/knowledgebuilder-openapi.yaml \
  -v $(pwd)/docs/api/openapi:/specs \
  --network chrysalis-network \
  swaggerapi/swagger-ui
```

---

## Configuration

### Flasgger Configuration

**Basic Configuration**:

```python
from flasgger import Swagger

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
    "specs_route": "/apidocs"
}

swagger = Swagger(app, config=swagger_config)
```

**Advanced Configuration**:

```python
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": 'apispec',
            "route": '/apispec.json',
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs",
    
    # UI Configuration
    "swagger_ui_config": {
        "docExpansion": "list",  # none, list, full
        "defaultModelsExpandDepth": 3,
        "defaultModelExpandDepth": 3,
        "displayRequestDuration": True,
        "filter": True,  # Enable search
        "showExtensions": True,
        "showCommonExtensions": True,
        "tryItOutEnabled": True,  # Enable "Try it out"
    },
    
    # Security
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT Authorization header using the Bearer scheme. Example: 'Bearer {token}'"
        }
    },
    
    # Metadata
    "info": {
        "title": "Chrysalis API",
        "version": "1.0.0",
        "description": "Complete API documentation",
        "contact": {
            "name": "API Support",
            "url": "https://docs.chrysalis.dev",
            "email": "support@chrysalis.dev"
        },
        "license": {
            "name": "MIT",
            "url": "https://opensource.org/licenses/MIT"
        }
    }
}
```

---

### Docker Configuration

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  agentbuilder-swagger:
    image: swaggerapi/swagger-ui:v5.10.0
    container_name: agentbuilder-swagger
    ports:
      - "8080:8080"
    environment:
      - SWAGGER_JSON=/specs/agentbuilder-openapi.yaml
      - BASE_URL=/docs
      - VALIDATOR_URL=null
      - DISPLAY_REQUEST_DURATION=true
      - FILTER=true
      - TRY_IT_OUT_ENABLED=true
    volumes:
      - ./docs/api/openapi:/specs:ro
    networks:
      - chrysalis-network
    restart: unless-stopped

  skillbuilder-swagger:
    image: swaggerapi/swagger-ui:v5.10.0
    container_name: skillbuilder-swagger
    ports:
      - "8081:8080"
    environment:
      - SWAGGER_JSON=/specs/skillbuilder-openapi.yaml
      - BASE_URL=/docs
    volumes:
      - ./docs/api/openapi:/specs:ro
    networks:
      - chrysalis-network
    restart: unless-stopped

  knowledgebuilder-swagger:
    image: swaggerapi/swagger-ui:v5.10.0
    container_name: knowledgebuilder-swagger
    ports:
      - "8082:8080"
    environment:
      - SWAGGER_JSON=/specs/knowledgebuilder-openapi.yaml
      - BASE_URL=/docs
    volumes:
      - ./docs/api/openapi:/specs:ro
    networks:
      - chrysalis-network
    restart: unless-stopped

networks:
  chrysalis-network:
    external: true
```

**Deploy**:

```bash
# Start all Swagger UI instances
docker-compose up -d

# Access:
# AgentBuilder: http://localhost:8080
# SkillBuilder: http://localhost:8081
# KnowledgeBuilder: http://localhost:8082
```

---

## Authentication Setup

### Configuring API Key Authentication

**Step 1: Add Authorization Header**

In Swagger UI, click "Authorize" button and enter:

```
Bearer admin-key-001.a1b2c3d4e5f6g7h8i9j0
```

**Step 2: Test Authenticated Endpoint**

1. Click "Try it out" on any protected endpoint
2. Fill in required parameters
3. Click "Execute"
4. View response

**Step 3: Persist Authentication**

Swagger UI stores the token in browser localStorage. It persists across page reloads.

---

### Pre-configuring API Key

**Option 1: Environment Variable**:

```bash
# Set default API key
export SWAGGER_API_KEY="admin-key-001.a1b2c3d4e5f6g7h8i9j0"

# Configure Swagger UI
docker run -d \
  -e API_KEY="${SWAGGER_API_KEY}" \
  swaggerapi/swagger-ui
```

**Option 2: Custom HTML**:

```html
<script>
window.onload = function() {
  window.ui = SwaggerUIBundle({
    url: "/api/openapi/agentbuilder-openapi.yaml",
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis],
    
    // Pre-configure authorization
    onComplete: function() {
      ui.preauthorizeApiKey("bearerAuth", "Bearer admin-key-001.secret");
    }
  })
}
</script>
```

---

## Customization

### Custom Branding

**Logo and Colors**:

```python
swagger_config = {
    # ... other config
    "swagger_ui_config": {
        "customCss": """
            .topbar { display: none; }
            .swagger-ui .info .title { color: #4A90E2; }
            .swagger-ui .info .description { font-size: 14px; }
        """,
        "customSiteTitle": "Chrysalis API Documentation",
        "customfavIcon": "/static/favicon.ico"
    }
}
```

**Custom CSS File**:

```css
/* static/swagger-custom.css */
.swagger-ui .topbar {
    background-color: #4A90E2;
}

.swagger-ui .info .title {
    color: #4A90E2;
    font-size: 36px;
}

.swagger-ui .scheme-container {
    background-color: #f7f7f7;
    padding: 20px;
}
```

---

### Adding Custom Endpoints

**Inject Custom Routes**:

```python
@app.route('/api/docs')
def custom_docs():
    """Redirect to Swagger UI."""
    return redirect('/apidocs')

@app.route('/api/openapi.yaml')
def openapi_spec():
    """Serve OpenAPI specification."""
    return send_file('docs/api/openapi/agentbuilder-openapi.yaml')
```

---

## Production Deployment

### Nginx Reverse Proxy

**nginx.conf**:

```nginx
server {
    listen 80;
    server_name api.chrysalis.dev;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.chrysalis.dev;

    ssl_certificate /etc/ssl/certs/chrysalis.crt;
    ssl_certificate_key /etc/ssl/private/chrysalis.key;

    # AgentBuilder API
    location /api/v1/agents {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # AgentBuilder Swagger UI
    location /docs/agentbuilder {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
    }

    # SkillBuilder Swagger UI
    location /docs/skillbuilder {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
    }

    # KnowledgeBuilder Swagger UI
    location /docs/knowledgebuilder {
        proxy_pass http://localhost:8082;
        proxy_set_header Host $host;
    }

    # OpenAPI Specs
    location /openapi {
        alias /var/www/chrysalis/docs/api/openapi;
        autoindex on;
    }
}
```

---

### CDN Deployment

**Using AWS S3 + CloudFront**:

```bash
# Build Swagger UI
npm install -g swagger-ui-dist
cp -r node_modules/swagger-ui-dist/* ./swagger-ui/

# Configure
cat > swagger-ui/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Chrysalis API</title>
  <link rel="stylesheet" href="swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: 'https://api.chrysalis.dev/openapi/agentbuilder-openapi.yaml',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>
EOF

# Upload to S3
aws s3 sync ./swagger-ui s3://chrysalis-api-docs/ --acl public-read

# Configure CloudFront
# Distribution domain: docs.chrysalis.dev
# Origin: chrysalis-api-docs.s3.amazonaws.com
```

---

## Troubleshooting

### Issue: Swagger UI Not Loading

**Symptoms**:
- Blank page
- "Failed to load API definition" error

**Solutions**:

1. **Check OpenAPI spec path**:
   ```bash
   # Verify file exists
   ls -la docs/api/openapi/agentbuilder-openapi.yaml
   
   # Validate spec
   swagger-cli validate docs/api/openapi/agentbuilder-openapi.yaml
   ```

2. **Check CORS headers**:
   ```python
   from flask_cors import CORS
   CORS(app, resources={r"/api/*": {"origins": "*"}})
   ```

3. **Check browser console**:
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Check Network tab for failed requests

---

### Issue: "Try it out" Not Working

**Symptoms**:
- Button disabled
- No response after clicking "Execute"

**Solutions**:

1. **Enable in configuration**:
   ```python
   swagger_config = {
       "swagger_ui_config": {
           "tryItOutEnabled": True
       }
   }
   ```

2. **Check CORS**:
   ```python
   # Allow Swagger UI origin
   CORS(app, origins=["http://localhost:8080"])
   ```

3. **Verify authentication**:
   - Click "Authorize" button
   - Enter valid API key
   - Check authorization header in request

---

### Issue: Authentication Not Working

**Symptoms**:
- 401 Unauthorized errors
- "Authorization header missing" errors

**Solutions**:

1. **Check security scheme**:
   ```yaml
   # In OpenAPI spec
   components:
     securitySchemes:
       bearerAuth:
         type: http
         scheme: bearer
         bearerFormat: JWT
   ```

2. **Verify API key format**:
   ```
   Bearer admin-key-001.a1b2c3d4e5f6g7h8i9j0
   ```

3. **Check service authentication**:
   ```bash
   # Test directly
   curl -X GET http://localhost:5000/api/v1/agents \
     -H "Authorization: Bearer ${API_KEY}"
   ```

---

## Related Documentation

- [OpenAPI Specifications](openapi/README.md)
- [Authentication Guide](AUTHENTICATION.md)
- [Integration Quick Start](INTEGRATION_QUICK_START.md)
- [API Reference Index](API_REFERENCE_INDEX.md)

---

## Support

**Documentation**: https://docs.chrysalis.dev  
**Swagger UI**: https://swagger.io/tools/swagger-ui/  
**Issues**: https://github.com/chrysalis/chrysalis/issues

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-11  
**Next Review**: 2026-02-11
