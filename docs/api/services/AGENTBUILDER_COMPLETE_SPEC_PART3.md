# AgentBuilder Service - Complete API Specification (Part 3)

**Continuation of**: [AGENTBUILDER_COMPLETE_SPEC_PART2.md](./AGENTBUILDER_COMPLETE_SPEC_PART2.md)

---

## Troubleshooting Guide (Continued)

### Debugging Tools

#### Enable Debug Logging

```python
# In server.py or via environment
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Run server with debug mode
app.run(port=5000, debug=True)
```

#### Request Tracing

Every request includes a unique `request_id` for tracing:

```python
# Extract request_id from response
response = client.create_agent(...)
request_id = response['meta']['request_id']

# Use request_id to search logs
# grep "request_id: 550e8400-e29b-41d4-a716-446655440000" /var/log/agentbuilder/*.log
```

#### Health Check Monitoring

```python
import time
import requests

def monitor_service_health(base_url, interval=30):
    """Continuously monitor service health."""
    while True:
        try:
            response = requests.get(f"{base_url}/health", timeout=5)
            data = response.json()
            
            if data['success'] and data['data']['status'] == 'healthy':
                print(f"✓ Service healthy at {data['meta']['timestamp']}")
            else:
                print(f"✗ Service unhealthy: {data}")
                
        except Exception as e:
            print(f"✗ Health check failed: {e}")
        
        time.sleep(interval)
```

### Performance Profiling

#### Measure Request Duration

```python
import time

def profile_agent_creation(client, agent_id, name, occupation):
    """Profile agent creation performance."""
    start = time.time()
    
    try:
        result = client.create_agent(
            agent_id=agent_id,
            name=name,
            occupation=occupation,
            deepening_cycles=3
        )
        
        duration = time.time() - start
        
        return {
            'success': True,
            'duration': duration,
            'skills_count': len(result['data']['generated_skills']),
            'knowledge_count': len(result['data']['generated_knowledge'])
        }
    except Exception as e:
        duration = time.time() - start
        return {
            'success': False,
            'duration': duration,
            'error': str(e)
        }

# Run profiling
results = []
for i in range(10):
    result = profile_agent_creation(
        client,
        f"test-agent-{i}",
        "Test Person",
        "Developer"
    )
    results.append(result)
    print(f"Attempt {i+1}: {result['duration']:.2f}s - {'✓' if result['success'] else '✗'}")

# Calculate statistics
successful = [r for r in results if r['success']]
avg_duration = sum(r['duration'] for r in successful) / len(successful)
print(f"\nAverage duration: {avg_duration:.2f}s")
```

---

## Deployment & Operations

### Deployment Architecture

#### Single-Server Deployment

```
┌─────────────────────────────────────┐
│         Application Server          │
│  ┌──────────────────────────────┐  │
│  │  AgentBuilder (Port 5000)    │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  SkillBuilder (Port 5001)    │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  KnowledgeBuilder (Port 5002)│  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Pros**: Simple setup, low cost  
**Cons**: Single point of failure, limited scalability  
**Use Case**: Development, testing, small deployments

#### Multi-Server Deployment (Recommended)

```
                    ┌─────────────┐
                    │ Load Balancer│
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │ Agent   │       │ Agent   │       │ Agent   │
   │ Builder │       │ Builder │       │ Builder │
   │ Node 1  │       │ Node 2  │       │ Node 3  │
   └────┬────┘       └────┬────┘       └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐
   │Knowledge│       │  Skill  │
   │ Builder │       │ Builder │
   │ Cluster │       │ Cluster │
   └─────────┘       └─────────┘
```

**Pros**: High availability, horizontal scaling  
**Cons**: Complex setup, higher cost  
**Use Case**: Production environments

### Docker Deployment

#### Dockerfile

```dockerfile
# Dockerfile for AgentBuilder
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY projects/AgentBuilder/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared modules
COPY shared/ /app/shared/

# Copy service code
COPY projects/AgentBuilder/ /app/

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5000/health').raise_for_status()"

# Run service
CMD ["python", "server.py"]
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  agentbuilder:
    build:
      context: .
      dockerfile: projects/AgentBuilder/Dockerfile
    ports:
      - "5000:5000"
    environment:
      - SKILL_BUILDER_URL=http://skillbuilder:5001
      - KNOWLEDGE_BUILDER_URL=http://knowledgebuilder:5002
      - JWT_SECRET=${JWT_SECRET}
      - FLASK_ENV=production
    depends_on:
      - skillbuilder
      - knowledgebuilder
    restart: unless-stopped
    networks:
      - chrysalis-network

  skillbuilder:
    build:
      context: .
      dockerfile: projects/SkillBuilder/Dockerfile
    ports:
      - "5001:5001"
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - FLASK_ENV=production
    restart: unless-stopped
    networks:
      - chrysalis-network

  knowledgebuilder:
    build:
      context: .
      dockerfile: projects/KnowledgeBuilder/Dockerfile
    ports:
      - "5002:5002"
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - FLASK_ENV=production
    restart: unless-stopped
    networks:
      - chrysalis-network

networks:
  chrysalis-network:
    driver: bridge
```

#### Deployment Commands

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f agentbuilder

# Scale AgentBuilder
docker-compose up -d --scale agentbuilder=3

# Stop services
docker-compose down
```

### Kubernetes Deployment

#### Deployment Manifest

```yaml
# agentbuilder-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentbuilder
  labels:
    app: agentbuilder
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agentbuilder
  template:
    metadata:
      labels:
        app: agentbuilder
    spec:
      containers:
      - name: agentbuilder
        image: chrysalis/agentbuilder:1.0.0
        ports:
        - containerPort: 5000
        env:
        - name: SKILL_BUILDER_URL
          value: "http://skillbuilder-service:5001"
        - name: KNOWLEDGE_BUILDER_URL
          value: "http://knowledgebuilder-service:5002"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: chrysalis-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: agentbuilder-service
spec:
  selector:
    app: agentbuilder
  ports:
  - protocol: TCP
    port: 5000
    targetPort: 5000
  type: LoadBalancer
```

#### Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace chrysalis

# Create secrets
kubectl create secret generic chrysalis-secrets \
  --from-literal=jwt-secret=your-secret-key \
  -n chrysalis

# Deploy services
kubectl apply -f agentbuilder-deployment.yaml -n chrysalis
kubectl apply -f skillbuilder-deployment.yaml -n chrysalis
kubectl apply -f knowledgebuilder-deployment.yaml -n chrysalis

# Check status
kubectl get pods -n chrysalis
kubectl get services -n chrysalis

# View logs
kubectl logs -f deployment/agentbuilder -n chrysalis

# Scale deployment
kubectl scale deployment agentbuilder --replicas=5 -n chrysalis
```

### Environment Configuration

#### Production Environment Variables

```bash
# .env.production
# Service Configuration
FLASK_ENV=production
FLASK_DEBUG=False
PORT=5000

# Service URLs
SKILL_BUILDER_URL=http://skillbuilder:5001
KNOWLEDGE_BUILDER_URL=http://knowledgebuilder:5002

# Authentication
JWT_SECRET=<strong-random-secret>
JWT_EXPIRATION_HOURS=24
ADMIN_KEY_IDS=admin-key-001,admin-key-002

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=/var/log/agentbuilder/server.log

# Performance
WORKER_TIMEOUT=300
MAX_WORKERS=4
KEEP_ALIVE=5

# Database (when implemented)
DATABASE_URL=postgresql://user:pass@localhost:5432/agentbuilder
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
SENTRY_DSN=https://...
```

### Monitoring & Observability

#### Prometheus Metrics

```python
# Add to server.py
from prometheus_client import Counter, Histogram, generate_latest

# Metrics
agent_creation_counter = Counter(
    'agentbuilder_agents_created_total',
    'Total number of agents created'
)

agent_creation_duration = Histogram(
    'agentbuilder_agent_creation_duration_seconds',
    'Time spent creating agents'
)

@app.route('/metrics')
def metrics():
    """Prometheus metrics endpoint."""
    return generate_latest()

# Instrument endpoints
@agent_creation_duration.time()
def create_agent():
    # ... existing code ...
    agent_creation_counter.inc()
    # ... rest of code ...
```

#### Health Check Endpoint Enhancement

```python
@app.route('/health/detailed', methods=['GET'])
def health_detailed():
    """Detailed health check with dependency status."""
    health_status = {
        'service': 'agentbuilder',
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'dependencies': {}
    }
    
    # Check SkillBuilder
    try:
        resp = requests.get(f"{SKILL_BUILDER_URL}/health", timeout=5)
        health_status['dependencies']['skillbuilder'] = {
            'status': 'healthy' if resp.status_code == 200 else 'unhealthy',
            'url': SKILL_BUILDER_URL
        }
    except:
        health_status['dependencies']['skillbuilder'] = {
            'status': 'unreachable',
            'url': SKILL_BUILDER_URL
        }
        health_status['status'] = 'degraded'
    
    # Check KnowledgeBuilder
    try:
        resp = requests.get(f"{KNOWLEDGE_BUILDER_URL}/health", timeout=5)
        health_status['dependencies']['knowledgebuilder'] = {
            'status': 'healthy' if resp.status_code == 200 else 'unhealthy',
            'url': KNOWLEDGE_BUILDER_URL
        }
    except:
        health_status['dependencies']['knowledgebuilder'] = {
            'status': 'unreachable',
            'url': KNOWLEDGE_BUILDER_URL
        }
        health_status['status'] = 'degraded'
    
    status_code = 200 if health_status['status'] == 'healthy' else 503
    return json_response(health_status), status_code
```

### Logging Configuration

#### Structured Logging

```python
import logging
import json
from datetime import datetime, timezone

class JSONFormatter(logging.Formatter):
    """Format logs as JSON."""
    
    def format(self, record):
        log_data = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add request context if available
        if hasattr(flask.g, 'request_id'):
            log_data['request_id'] = flask.g.request_id
        
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        return json.dumps(log_data)

# Configure logging
handler = logging.FileHandler('/var/log/agentbuilder/server.log')
handler.setFormatter(JSONFormatter())
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)
```

### Backup & Recovery

#### Data Backup Strategy

```python
import json
from datetime import datetime

def backup_agents(output_file=None):
    """Backup all agents to JSON file."""
    if output_file is None:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = f"agents_backup_{timestamp}.json"
    
    backup_data = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'version': '1.0',
        'agents': list(agents_store.values())
    }
    
    with open(output_file, 'w') as f:
        json.dump(backup_data, f, indent=2)
    
    return output_file

def restore_agents(backup_file):
    """Restore agents from backup file."""
    with open(backup_file, 'r') as f:
        backup_data = json.load(f)
    
    restored_count = 0
    for agent in backup_data['agents']:
        agent_id = agent['agent_id']
        agents_store[agent_id] = agent
        restored_count += 1
    
    return restored_count
```

### Security Hardening

#### Production Security Checklist

- [ ] Use HTTPS/TLS for all communications
- [ ] Rotate JWT secrets regularly
- [ ] Implement API key rotation policies
- [ ] Enable rate limiting per API key
- [ ] Use environment variables for secrets (never commit)
- [ ] Implement request signing for service-to-service calls
- [ ] Enable CORS with whitelist
- [ ] Add request size limits
- [ ] Implement audit logging
- [ ] Use security headers (HSTS, CSP, etc.)
- [ ] Regular security updates for dependencies
- [ ] Implement IP whitelisting for admin endpoints

#### Security Headers

```python
@app.after_request
def add_security_headers(response):
    """Add security headers to all responses."""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    return response
```

---

## Database Migration (Production Recommendation)

### Current State

The service uses in-memory storage (`agents_store = {}`), which:
- ❌ Loses data on restart
- ❌ Cannot scale horizontally
- ❌ No persistence or backup
- ❌ Limited query capabilities

### Recommended: PostgreSQL Implementation

#### Schema Design

```sql
-- agents table
CREATE TABLE agents (
    agent_id VARCHAR(100) PRIMARY KEY,
    role_model JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    deepening_cycles INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    CONSTRAINT valid_status CHECK (status IN ('completed', 'pending', 'failed'))
);

-- skills table
CREATE TABLE skills (
    skill_id SERIAL PRIMARY KEY,
    agent_id VARCHAR(100) REFERENCES agents(agent_id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- knowledge_items table
CREATE TABLE knowledge_items (
    knowledge_id SERIAL PRIMARY KEY,
    agent_id VARCHAR(100) REFERENCES agents(agent_id) ON DELETE CASCADE,
    entity JSONB NOT NULL,
    source VARCHAR(200),
    confidence DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_created_at ON agents(created_at);
CREATE INDEX idx_skills_agent_id ON skills(agent_id);
CREATE INDEX idx_knowledge_agent_id ON knowledge_items(agent_id);
```

#### SQLAlchemy Models

```python
from sqlalchemy import create_engine, Column, String, Integer, DateTime, JSON, ForeignKey, Numeric
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, timezone

Base = declarative_base()

class Agent(Base):
    __tablename__ = 'agents'
    
    agent_id = Column(String(100), primary_key=True)
    role_model = Column(JSON, nullable=False)
    status = Column(String(20), default='pending')
    deepening_cycles = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    created_by = Column(String(100))
    
    skills = relationship("Skill", back_populates="agent", cascade="all, delete-orphan")
    knowledge_items = relationship("KnowledgeItem", back_populates="agent", cascade="all, delete-orphan")

class Skill(Base):
    __tablename__ = 'skills'
    
    skill_id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(100), ForeignKey('agents.agent_id'))
    name = Column(String(200), nullable=False)
    description = Column(String)
    category = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    agent = relationship("Agent", back_populates="skills")

class KnowledgeItem(Base):
    __tablename__ = 'knowledge_items'
    
    knowledge_id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(100), ForeignKey('agents.agent_id'))
    entity = Column(JSON, nullable=False)
    source = Column(String(200))
    confidence = Column(Numeric(3, 2))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    agent = relationship("Agent", back_populates="knowledge_items")

# Database setup
engine = create_engine(os.getenv('DATABASE_URL'))
SessionLocal = sessionmaker(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## API Testing

### Unit Tests

See [`projects/AgentBuilder/tests/test_api.py`](../../../projects/AgentBuilder/tests/test_api.py) for comprehensive test suite.

### Integration Tests

```python
import pytest
import requests
import time

class TestAgentBuilderIntegration:
    """Integration tests for AgentBuilder service."""
    
    @pytest.fixture
    def base_url(self):
        return "http://localhost:5000"
    
    @pytest.fixture
    def api_key(self):
        return "admin-key-001.secret123"
    
    def test_complete_agent_lifecycle(self, base_url, api_key):
        """Test complete agent creation, retrieval, update, and deletion."""
        headers = {"Authorization": f"Bearer {api_key}"}
        agent_id = f"test-agent-{int(time.time())}"
        
        # 1. Create agent
        create_response = requests.post(
            f"{base_url}/api/v1/agents",
            json={
                "agent_id": agent_id,
                "role_model": {
                    "name": "Test Agent",
                    "occupation": "Tester"
                },
                "deepening_cycles": 0
            },
            headers=headers
        )
        assert create_response.status_code == 201
        data = create_response.json()
        assert data['success'] == True
        assert data['data']['agent_id'] == agent_id
        
        # 2. Retrieve agent
        get_response = requests.get(
            f"{base_url}/api/v1/agents/{agent_id}",
            headers=headers
        )
        assert get_response.status_code == 200
        
        # 3. Update agent
        update_response = requests.patch(
            f"{base_url}/api/v1/agents/{agent_id}",
            json={"deepening_cycles": 2},
            headers=headers
        )
        assert update_response.status_code == 200
        
        # 4. Get capabilities
        caps_response = requests.get(
            f"{base_url}/api/v1/agents/{agent_id}/capabilities",
            headers=headers
        )
        assert caps_response.status_code == 200
        
        # 5. Delete agent
        delete_response = requests.delete(
            f"{base_url}/api/v1/agents/{agent_id}",
            headers=headers
        )
        assert delete_response.status_code == 200
        
        # 6. Verify deletion
        verify_response = requests.get(
            f"{base_url}/api/v1/agents/{agent_id}",
            headers=headers
        )
        assert verify_response.status_code == 404
```

### Load Testing

```python
import concurrent.futures
import time

def load_test_agent_creation(base_url, api_key, num_requests=100):
    """Load test agent creation endpoint."""
    
    def create_agent(index):
        start = time.time()
        try:
            response = requests.post(
                f"{base_url}/api/v1/agents",
                json={
                    "agent_id": f"load-test-agent-{index}",
                    "role_model": {
                        "name": f"Agent {index}",
                        "occupation": "Tester"
                    },
                    "deepening_cycles": 0
                },
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=60
            )
            duration = time.time() - start
            return {
                'index': index,
                'status': response.status_code,
                'duration': duration,
                'success': response.status_code == 201
            }
        except Exception as e:
            duration = time.time() - start
            return {
                'index': index,
                'status': 0,
                'duration': duration,
                'success': False,
                'error': str(e)
            }
    
    # Run concurrent requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(create_agent, i) for i in range(num_requests)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
    
    # Analyze results
    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    
    print(f"\nLoad Test Results:")
    print(f"Total Requests: {num_requests}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")
    print(f"Success Rate: {len(successful)/num_requests*100:.2f}%")
    
    if successful:
        avg_duration = sum(r['duration'] for r in successful) / len(successful)
        print(f"Average Duration: {avg_duration:.2f}s")
        print(f"Min Duration: {min(r['duration'] for r in successful):.2f}s")
        print(f"Max Duration: {max(r['duration'] for r in successful):.2f}s")
```

---

## Summary & Quick Reference

### Service Information

| Property | Value |
|----------|-------|
| **Service Name** | AgentBuilder |
| **Version** | 1.0.0 |
| **Port** | 5000 |
| **API Version** | v1 |
| **Base Path** | `/api/v1` |
| **Protocol** | HTTP/REST |
| **Authentication** | Bearer Token (JWT/API Key) |
| **Data Format** | JSON |

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/v1/agents` | POST | Create agent |
| `/api/v1/agents` | GET | List agents |
| `/api/v1/agents/{id}` | GET | Get agent |
| `/api/v1/agents/{id}` | PATCH | Update agent |
| `/api/v1/agents/{id}` | DELETE | Delete agent |
| `/api/v1/agents/{id}/capabilities` | GET | Get capabilities |

### Dependencies

- **KnowledgeBuilder** (Port 5002): Knowledge cloud generation
- **SkillBuilder** (Port 5001): Skill set generation
- **shared/api_core**: Common API utilities

### Quick Start

```bash
# 1. Install dependencies
pip install -r projects/AgentBuilder/requirements.txt

# 2. Set environment variables
export SKILL_BUILDER_URL=http://localhost:5001
export KNOWLEDGE_BUILDER_URL=http://localhost:5002
export JWT_SECRET=your-secret-key

# 3. Start service
cd projects/AgentBuilder
python server.py

# 4. Test health
curl http://localhost:5000/health

# 5. Create agent
curl -X POST http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"test-001","role_model":{"name":"Test","occupation":"Tester"}}'
```

### Common Issues

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Check upstream services are running |
| 401 Unauthorized | Verify API key format and validity |
| 409 Conflict | Agent ID already exists, use different ID |
| Timeout | Reduce deepening_cycles or increase timeout |
| Empty skills/knowledge | Check upstream service responses |

### Performance Tips

1. Use `deepening_cycles=0` for fastest creation
2. Implement connection pooling for high throughput
3. Cache frequently accessed agents
4. Use async/await for concurrent operations
5. Monitor upstream service health

### Security Checklist

- ✅ Use HTTPS in production
- ✅ Rotate JWT secrets regularly
- ✅ Implement rate limiting
- ✅ Never commit secrets to version control
- ✅ Use environment variables for configuration
- ✅ Enable audit logging
- ✅ Implement request signing for service-to-service calls

---

## Related Documentation

- [AgentBuilder OpenAPI Spec](../openapi-template.yaml)
- [Authentication Guide](../AUTHENTICATION.md)
- [Error Handling Reference](../ERROR_HANDLING.md)
- [Integration Workflows](../INTEGRATION_GUIDE.md)
- [KnowledgeBuilder API](./KNOWLEDGEBUILDER_COMPLETE_SPEC.md)
- [SkillBuilder API](./SKILLBUILDER_COMPLETE_SPEC.md)

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-11  
**Maintained By**: Chrysalis Documentation Team  
**Next Review**: 2026-02-11
