# Chrysalis Deployment Guide

**Version**: 3.1.1  
**Date**: January 15, 2026  
**Status**: Production Ready

---

## Overview

This guide covers deploying Chrysalis for user testing and production use.

---

## Prerequisites

### System Requirements

- **Node.js**: ≥18.0.0
- **Python**: 3.10+
- **npm**: ≥9.0
- **Memory**: 2GB minimum
- **Storage**: 1GB minimum

### Optional Dependencies

- **PostgreSQL**: For production feedback storage
- **Redis**: For session management
- **SMTP Server**: For email notifications

---

## Quick Start (Development)

### 1. Install Dependencies

```bash
# Core dependencies
npm install

# UI dependencies
cd ui && npm install && cd ..

# Python dependencies
cd memory_system && pip install -e . && cd ..
```

### 2. Build All Components

```bash
# TypeScript core
npm run build

# UI
cd ui && npm run build && cd ..

# Python (if needed)
cd memory_system && python setup.py build && cd ..
```

### 3. Start Services

```bash
# Terminal 1: Terminal WebSocket Server
npm run service:terminal

# Terminal 2: Feedback API Server
npm run service:feedback

# Terminal 3: UI Development Server
cd ui && npm run dev
```

### 4. Verify Services

- **Terminal WebSocket**: `ws://localhost:3001`
- **Feedback API**: `http://localhost:3002/api/feedback`
- **UI**: `http://localhost:5173`

---

## Production Deployment

### Environment Variables

Create `.env` file:

```bash
# Core
NODE_ENV=production
LOG_LEVEL=info

# API Keys
VOYAGE_API_KEY=your_voyage_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Terminal WebSocket
TERMINAL_WS_PORT=3001
TERMINAL_SHELL=/bin/bash

# Feedback API
FEEDBACK_API_PORT=3002
FEEDBACK_WEBHOOK_URL=https://your-webhook.com/feedback

# UI
VITE_TERMINAL_WS_URL=wss://your-domain.com/terminal
VITE_VOYEUR_SSE_URL=https://your-domain.com/voyeur
VITE_FEEDBACK_API_URL=https://your-domain.com/api/feedback

# Error Tracking (Optional)
SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_token

# Analytics (Optional)
PLAUSIBLE_DOMAIN=your-domain.com
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ui/package*.json ./ui/

# Install dependencies
RUN npm ci && cd ui && npm ci

# Copy source
COPY . .

# Build
RUN npm run build && cd ui && npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ui/dist ./ui/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm install --production

EXPOSE 3001 3002 8787

# Start services
CMD ["node", "dist/api/terminal/run-terminal-server.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  terminal-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - TERMINAL_WS_PORT=3001
      - TERMINAL_SHELL=/bin/bash
    restart: unless-stopped

  feedback-api:
    build: .
    command: node dist/api/feedback/run-feedback-server.js
    ports:
      - "3002:3002"
    environment:
      - FEEDBACK_API_PORT=3002
    restart: unless-stopped

  ui:
    build: .
    command: npx serve -s ui/dist -l 8080
    ports:
      - "8080:8080"
    environment:
      - VITE_TERMINAL_WS_URL=ws://localhost:3001
      - VITE_FEEDBACK_API_URL=http://localhost:3002/api/feedback
    restart: unless-stopped
```

### Start with Docker Compose

```bash
docker-compose up -d
```

---

## Reverse Proxy (Nginx)

```nginx
# /etc/nginx/sites-available/chrysalis
server {
    listen 80;
    server_name your-domain.com;

    # UI
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Terminal WebSocket
    location /terminal {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Feedback API
    location /api/feedback {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # VoyeurBus SSE
    location /voyeur {
        proxy_pass http://localhost:8787;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
    }
}
```

---

## Monitoring

### Health Checks

```bash
# Terminal WebSocket
curl -I http://localhost:3001/health

# Feedback API
curl http://localhost:3002/api/feedback

# UI
curl http://localhost:8080
```

### Logs

```bash
# View logs
docker-compose logs -f

# Filter by service
docker-compose logs -f terminal-server
```

### Metrics (Prometheus)

Enable Prometheus metrics:

```bash
export METRICS_PROMETHEUS=true
export METRICS_PROM_PORT=9464
```

Scrape configuration:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'chrysalis'
    static_configs:
      - targets: ['localhost:9464']
```

---

## Backup & Recovery

### Feedback Data

```bash
# Export feedback
curl http://localhost:3002/api/feedback > feedback-backup.json

# Import feedback
# (Implement import endpoint if needed)
```

### Configuration

```bash
# Backup environment
cp .env .env.backup

# Backup Docker volumes
docker-compose down
tar -czf volumes-backup.tar.gz /var/lib/docker/volumes
```

---

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  terminal-server:
    deploy:
      replicas: 3
    # ... rest of config
```

### Load Balancing

```nginx
upstream terminal_backend {
    least_conn;
    server localhost:3001;
    server localhost:3011;
    server localhost:3021;
}

location /terminal {
    proxy_pass http://terminal_backend;
    # ... rest of config
}
```

---

## Security Checklist

- [ ] HTTPS enabled with valid SSL certificate
- [ ] API keys stored in environment variables (not in code)
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Authentication implemented for feedback API
- [ ] WebSocket connections validated
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive information
- [ ] Logs don't contain sensitive data
- [ ] Dependencies regularly updated

---

## Troubleshooting

### Terminal WebSocket Not Connecting

1. Check if server is running:
   ```bash
   netstat -an | grep 3001
   ```

2. Verify firewall allows WebSocket connections

3. Check logs for errors:
   ```bash
   docker-compose logs terminal-server
   ```

### Feedback API Errors

1. Check API is accessible:
   ```bash
   curl http://localhost:3002/api/feedback
   ```

2. Verify CORS headers
3. Check request payload format

### UI Not Loading

1. Verify build completed:
   ```bash
   ls -la ui/dist
   ```

2. Check environment variables
3. Inspect browser console for errors

---

## Performance Optimization

### UI Bundle Size

Target: <600 kB

```bash
# Analyze bundle
cd ui && npm run build -- --report
```

### WebSocket Connections

Limit: 100 concurrent sessions (configurable)

```typescript
maxSessions: 100  // Adjust based on server capacity
```

### Feedback Storage

Switch to PostgreSQL for production:

```typescript
import { PostgresFeedbackStorage } from './storage/postgres';

const handler = new FeedbackHandler({
  storage: new PostgresFeedbackStorage(dbConfig)
});
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [USER_TESTING_SETUP](../integration/USER_TESTING_SETUP.md) | Development setup |
| [ARCHITECTURE](../../ARCHITECTURE.md) | System design |
| [STATUS](../STATUS.md) | Current status |

---

**Document Owner**: DevOps Team  
**Last Updated**: January 15, 2026