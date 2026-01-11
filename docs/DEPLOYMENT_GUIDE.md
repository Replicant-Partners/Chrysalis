# Deployment Guide - Chrysalis Integration Platform

**Document Version:** 1.0  
**Last Updated:** January 11, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Configuration](#2-environment-configuration)
3. [Local Development](#3-local-development)
4. [Docker Deployment](#4-docker-deployment)
5. [Kubernetes Deployment](#5-kubernetes-deployment)
6. [Cloud Provider Guides](#6-cloud-provider-guides)
7. [Health Checks & Monitoring](#7-health-checks--monitoring)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.0.0 | 20.x LTS |
| npm | 9.x | 10.x |
| Memory | 512 MB | 2 GB |
| CPU | 1 core | 2+ cores |
| Disk | 1 GB | 5 GB |

### Required Dependencies

```bash
# Install Node.js (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Verify installation
node --version  # Should be v20.x.x
npm --version   # Should be 10.x.x
```

---

## 2. Environment Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# .env
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Security
WALLET_PASSWORD=your-secure-wallet-password
JWT_SECRET=your-jwt-secret-key

# API Keys (stored in ApiKeyWallet, these are for initialization)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# A2A Configuration
A2A_AUTH_TOKEN=your-a2a-token
A2A_TIMEOUT=30000
A2A_MAX_RETRIES=3

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Database (if applicable)
DATABASE_URL=postgresql://user:pass@host:5432/chrysalis

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
METRICS_ENABLED=true
```

### Configuration Files

The platform uses hierarchical configuration:

```
config/
├── default.json      # Base configuration
├── development.json  # Development overrides
├── production.json   # Production settings
└── custom-environment-variables.json  # Env var mapping
```

Example `config/production.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "cors": {
      "origins": ["https://app.chrysalis.dev"]
    }
  },
  "security": {
    "rateLimiting": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000
    },
    "headers": {
      "hsts": true,
      "noSniff": true,
      "xssProtection": true
    }
  },
  "logging": {
    "level": "info",
    "format": "json",
    "redactSecrets": true
  }
}
```

---

## 3. Local Development

### Quick Start

```bash
# Clone the repository
git clone https://github.com/chrysalis/chrysalis.git
cd chrysalis

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

### Development Server

```bash
# Start with hot reload
npm run dev

# Start specific services
npm run service:ledger
npm run service:projection
npm run service:grounding
npm run service:skillforge
npm run service:gateway
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# With coverage
npm test -- --coverage
```

---

## 4. Docker Deployment

### Building the Image

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

# Security: Run as non-root user
RUN addgroup -g 1001 -S chrysalis && \
    adduser -S chrysalis -u 1001 -G chrysalis

WORKDIR /app

COPY --from=builder --chown=chrysalis:chrysalis /app/dist ./dist
COPY --from=builder --chown=chrysalis:chrysalis /app/node_modules ./node_modules
COPY --from=builder --chown=chrysalis:chrysalis /app/package.json ./

USER chrysalis

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

### Build and Run

```bash
# Build the image
docker build -t chrysalis:latest .

# Run the container
docker run -d \
  --name chrysalis \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  chrysalis:latest

# View logs
docker logs -f chrysalis

# Stop the container
docker stop chrysalis
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  chrysalis:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  # Optional: Redis for caching
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

### Running with Docker Compose

```bash
# Start all services
docker-compose up -d

# Scale chrysalis service
docker-compose up -d --scale chrysalis=3

# View logs
docker-compose logs -f chrysalis

# Stop all services
docker-compose down
```

---

## 5. Kubernetes Deployment

### Namespace and ConfigMap

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: chrysalis
  labels:
    app: chrysalis

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chrysalis-config
  namespace: chrysalis
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
  RATE_LIMIT_MAX_REQUESTS: "100"
  RATE_LIMIT_WINDOW_MS: "60000"
```

### Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: chrysalis-secrets
  namespace: chrysalis
type: Opaque
stringData:
  WALLET_PASSWORD: "your-secure-password"
  JWT_SECRET: "your-jwt-secret"
  OPENAI_API_KEY: "sk-..."
  ANTHROPIC_API_KEY: "sk-ant-..."
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chrysalis
  namespace: chrysalis
  labels:
    app: chrysalis
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chrysalis
  template:
    metadata:
      labels:
        app: chrysalis
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: chrysalis
        image: chrysalis:latest
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        - configMapRef:
            name: chrysalis-config
        - secretRef:
            name: chrysalis-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
              - ALL
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir: {}
```

### Service and Ingress

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: chrysalis
  namespace: chrysalis
spec:
  selector:
    app: chrysalis
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: chrysalis
  namespace: chrysalis
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - api.chrysalis.dev
    secretName: chrysalis-tls
  rules:
  - host: api.chrysalis.dev
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: chrysalis
            port:
              number: 80
```

### Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: chrysalis
  namespace: chrysalis
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: chrysalis
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create ConfigMap and Secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Check deployment status
kubectl -n chrysalis get pods
kubectl -n chrysalis get svc
kubectl -n chrysalis get ingress

# View logs
kubectl -n chrysalis logs -f deployment/chrysalis

# Scale manually if needed
kubectl -n chrysalis scale deployment/chrysalis --replicas=5
```

---

## 6. Cloud Provider Guides

### AWS (ECS/Fargate)

```json
// task-definition.json
{
  "family": "chrysalis",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "chrysalis",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/chrysalis:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3000" }
      ],
      "secrets": [
        {
          "name": "WALLET_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:chrysalis/wallet"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/chrysalis",
          "awslogs-region": "REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --spider -q http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 10
      }
    }
  ]
}
```

### Google Cloud Run

```bash
# Deploy to Cloud Run
gcloud run deploy chrysalis \
  --image gcr.io/PROJECT/chrysalis:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --port 3000 \
  --set-env-vars NODE_ENV=production \
  --set-secrets WALLET_PASSWORD=chrysalis-wallet:latest
```

### Azure Container Apps

```bash
# Create Container App
az containerapp create \
  --name chrysalis \
  --resource-group chrysalis-rg \
  --environment chrysalis-env \
  --image chrysalis.azurecr.io/chrysalis:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 10 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --secrets wallet-password=secretref:chrysalis-wallet \
  --env-vars NODE_ENV=production
```

---

## 7. Health Checks & Monitoring

### Health Check Endpoints

The platform exposes the following health check endpoints:

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/health` | Basic liveness check | `200 OK` if alive |
| `/health/ready` | Readiness check | `200 OK` if ready to serve |
| `/health/live` | Liveness probe | `200 OK` if process is running |
| `/metrics` | Prometheus metrics | Metrics in Prometheus format |

### Example Health Check Response

```json
// GET /health
{
  "status": "healthy",
  "version": "3.1.0",
  "uptime": 3600,
  "timestamp": "2026-01-11T18:00:00.000Z",
  "checks": {
    "memory": {
      "status": "healthy",
      "heapUsed": 100000000,
      "heapTotal": 200000000
    },
    "connections": {
      "status": "healthy",
      "active": 10,
      "max": 1000
    }
  }
}
```

### Prometheus Metrics

```promql
# Key metrics to monitor
chrysalis_http_requests_total{method="POST", path="/tasks/send"}
chrysalis_http_request_duration_seconds_bucket{le="0.1"}
chrysalis_active_sessions_count
chrysalis_rate_limit_exceeded_total
chrysalis_errors_total{type="validation"}
```

### Grafana Dashboard

Import the provided dashboard from `monitoring/grafana-dashboard.json`.

### Alerting Rules

```yaml
# alertmanager/rules.yaml
groups:
- name: chrysalis
  rules:
  - alert: HighErrorRate
    expr: rate(chrysalis_errors_total[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      
  - alert: HighLatency
    expr: histogram_quantile(0.95, rate(chrysalis_http_request_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "P95 latency exceeds 1 second"
      
  - alert: RateLimitExceeded
    expr: rate(chrysalis_rate_limit_exceeded_total[1m]) > 10
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "Excessive rate limiting"
```

---

## 8. Troubleshooting

### Common Issues

#### Application Won't Start

```bash
# Check logs
docker logs chrysalis
# or
kubectl -n chrysalis logs deployment/chrysalis

# Common causes:
# 1. Missing environment variables
# 2. Port already in use
# 3. Insufficient permissions
```

#### Connection Refused

```bash
# Verify service is running
curl -v http://localhost:3000/health

# Check port binding
netstat -tlnp | grep 3000

# Verify firewall rules
iptables -L -n
```

#### Out of Memory

```bash
# Check memory usage
docker stats chrysalis

# Increase memory limits
docker run -m 2g chrysalis:latest

# Or in Kubernetes:
resources:
  limits:
    memory: "2Gi"
```

#### High CPU Usage

```bash
# Profile the application
node --prof dist/index.js

# Generate flame graph
npx clinic flame -- node dist/index.js
```

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=development LOG_LEVEL=debug npm run dev

# Enable Node.js debugging
node --inspect dist/index.js

# Connect Chrome DevTools to chrome://inspect
```

### Support

For production issues, contact:
- **Email**: support@chrysalis.dev
- **Slack**: #chrysalis-support
- **On-Call**: oncall@chrysalis.dev

---

## Appendix: Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Secrets stored securely
- [ ] TLS certificates configured
- [ ] Health checks verified
- [ ] Monitoring and alerting set up
- [ ] Backup and recovery tested

### Post-Deployment

- [ ] Health endpoints responding
- [ ] Metrics being collected
- [ ] Logs flowing to aggregator
- [ ] Error rates normal
- [ ] Latency within SLA
- [ ] Rate limiting functioning
- [ ] Scaling working correctly

---

*This guide is maintained by the Chrysalis Platform Team. For updates, check the [documentation repository](https://github.com/chrysalis/chrysalis).*
