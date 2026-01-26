# Test Environment Setup Guide

## Overview

This guide walks through setting up a complete test environment for the Chrysalis workspace.

---

## Prerequisites

### Required

- **Node.js**: ≥18.0.0 (v22 recommended)
- **npm**: ≥9.0.0
- **Python**: 3.10+ (for memory service)
- **Go**: 1.24+ (for gateway service)

### Optional

- **Docker**: For running services in containers
- **Ollama**: For local LLM testing

---

## Quick Start

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/Replicant-Partners/Chrysalis.git
cd Chrysalis

# Install TypeScript dependencies
npm install

# Install Python dependencies (optional)
cd memory_system
pip install -r requirements.txt
cd ..

# Build Go gateway (optional)
cd go-services
go build -o bin/gateway ./services/gateway
cd ..
```

### 2. Configure Environment

```bash
# Copy test environment template
cp .env.test .env.local

# Edit .env.local with your API keys (optional)
nano .env.local
```

### 3. Build

```bash
# Build TypeScript core
npm run build

# Build UI
npx vite build
```

### 4. Start Services

```bash
# Terminal 1: Memory Service (optional)
cd memory_system
python api_server.py

# Terminal 2: Go Gateway (optional)
cd go-services
./bin/gateway

# Terminal 3: UI Development Server
npm run dev
```

---

## Detailed Setup

### TypeScript Core

```bash
# Install dependencies
npm install

# Build core
npm run build

# Verify build
ls -la dist/

# Run tests
npm run test:unit
```

**Build Outputs**:
- `dist/` - Compiled TypeScript core
- `dist/cli/` - CLI tools
- `dist/canvas-ui/` - UI bundle (after Vite build)

### UI Application

```bash
# Install UI dependencies (included in root npm install)
# No additional install needed

# Development mode (HMR enabled)
npm run dev
# Opens http://localhost:3000

# Production build
npx vite build
# Output: dist/canvas-ui/

# Preview production build
npx vite preview
```

### Python Memory Service

```bash
cd memory_system

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run tests
pytest tests/ -v

# Start API server
python api_server.py
# Listens on http://localhost:8082
```

**Service Endpoints**:
- `POST /memory/store` - Store memory
- `POST /memory/recall` - Recall memories
- `GET /memory/health` - Health check

### Go LLM Gateway

```bash
cd go-services

# Build gateway
go build -o bin/gateway ./services/gateway

# Run gateway
./bin/gateway
# Listens on http://localhost:8080

# Test health
curl http://localhost:8080/health
```

**Gateway Features**:
- Multi-provider LLM support
- Circuit breaker
- Prometheus metrics (`/metrics`)

---

## Environment Variables

### Core Variables

```bash
# Memory Service
MEMORY_API_URL=http://localhost:8082
MEMORY_API_ENABLED=true

# System Agents
SYSTEM_AGENTS_URL=http://localhost:3200

# Gateway LLM
GATEWAY_LLM_URL=http://localhost:8080
GATEWAY_LLM_MODEL=gpt-4
```

### Feature Flags

```bash
# Enable/disable features
ENABLE_MEMORY=true
ENABLE_LEARNING=false
ENABLE_DOCUMENT_DROP=true
SHOW_MEMORY_INDICATORS=true

# YJS collaboration
YJS_ENABLED=false
YJS_WEBSOCKET_URL=ws://localhost:1234
```

### API Keys (Optional)

```bash
# Embeddings
VOYAGE_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# LLM
ANTHROPIC_API_KEY=your_key_here

# Fireproof
FIREPROOF_ENABLED=false
```

---

## Docker Setup (Alternative)

```bash
# Build images
docker-compose build

# Start all services
docker-compose up

# Start specific service
docker-compose up memory-service

# Stop all services
docker-compose down
```

**Services in Docker**:
- `ui`: Vite dev server (port 3000)
- `memory-service`: Python API (port 8082)
- `gateway`: Go LLM gateway (port 8080)

---

## Testing

### Unit Tests

```bash
# TypeScript tests
npm run test:unit

# Python tests
cd memory_system
pytest tests/ -v

# Go tests
cd go-services
go test ./...
```

### Integration Tests

```bash
# MCP servers
npm run test:mcp

# All tests
npm run test:all
```

### UI Tests

```bash
# Run Vitest (when implemented)
npm run test:ui
```

### Manual Testing Checklist

- [ ] UI loads without errors
- [ ] Left chat pane renders
- [ ] Right chat pane renders
- [ ] Canvas renders in center
- [ ] Can send messages
- [ ] Agent responds (or shows fallback)
- [ ] Canvas tabs switch
- [ ] Panel resizing works
- [ ] Theme toggle works (if applicable)
- [ ] No console errors

---

## Troubleshooting

### Build Failures

**TypeScript errors**:
```bash
# Clear build cache
rm -rf dist/
npm run build
```

**Module not found**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Runtime Errors

**Memory service not connecting**:
```bash
# Check if service is running
curl http://localhost:8082/health

# Check logs
cd memory_system
python api_server.py
```

**Gateway service not responding**:
```bash
# Check if Go service is running
curl http://localhost:8080/health

# Rebuild
cd go-services
go build -o bin/gateway ./services/gateway
./bin/gateway
```

**UI not loading**:
```bash
# Check Vite dev server logs
npm run dev

# Try different port
PORT=5173 npm run dev

# Clear Vite cache
rm -rf node_modules/.vite
```

### Common Issues

**Port already in use**:
```bash
# Kill process on port
lsof -ti:3000 | xargs kill -9  # Mac/Linux
# Or change port in vite.config.ts
```

**Python version mismatch**:
```bash
# Check Python version
python --version  # Should be 3.10+

# Use specific version
python3.12 -m venv .venv
```

**Go version mismatch**:
```bash
# Check Go version
go version  # Should be 1.24+

# Update Go
# See: https://golang.org/doc/install
```

---

## Smoke Test Script

```bash
#!/bin/bash

# smoke-test.sh
# Basic smoke test for Chrysalis

echo "🔍 Running Chrysalis Smoke Tests..."

# Check Node version
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
  echo "❌ Node.js version must be ≥18"
  exit 1
fi
echo "✅ Node.js version OK"

# Check if dependencies installed
if [ ! -d "node_modules" ]; then
  echo "❌ Dependencies not installed. Run: npm install"
  exit 1
fi
echo "✅ Dependencies installed"

# Check if build exists
if [ ! -d "dist" ]; then
  echo "⚠️  Build not found. Running build..."
  npm run build
fi
echo "✅ Build exists"

# Check TypeScript compilation
echo "🔨 Checking TypeScript compilation..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript compilation failed"
  exit 1
fi
echo "✅ TypeScript compilation OK"

# Check for critical files
files=(
  "src/main.tsx"
  "src/components/ChrysalisWorkspace/ChrysalisWorkspace.tsx"
  "src/components/ChrysalisWorkspace/ChatPane.tsx"
  "src/services/browser/BrowserService.ts"
  "vite.config.ts"
  "package.json"
)

for file in "${files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing critical file: $file"
    exit 1
  fi
done
echo "✅ Critical files present"

# Start dev server in background
echo "🚀 Starting dev server..."
npm run dev &
server_pid=$!

# Wait for server to start
sleep 5

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "❌ Dev server not responding"
  kill $server_pid
  exit 1
fi
echo "✅ Dev server responding"

# Kill dev server
kill $server_pid

echo ""
echo "✅ All smoke tests passed!"
echo ""
echo "Next steps:"
echo "1. Start dev server: npm run dev"
echo "2. Open http://localhost:3000"
echo "3. Test UI manually"
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Run tests
        run: npm run test:unit
      
      - name: Type check
        run: npx tsc --noEmit
```

---

## Performance Monitoring

### Lighthouse

```bash
# Install Lighthouse
npm install -g lighthouse

# Run audit
lighthouse http://localhost:3000 --view
```

### Bundle Analysis

```bash
# Install analyzer
npm install --save-dev rollup-plugin-visualizer

# Add to vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [react(), visualizer()],
});

# Build and analyze
npm run build
# Opens stats.html
```

---

## Next Steps

After setup:

1. **Validate Build**: Run smoke test script
2. **Start Services**: Launch memory and gateway services
3. **Start UI**: Run `npm run dev`
4. **Manual Testing**: Follow manual testing checklist
5. **Integration Testing**: Test with actual LLM services

---

## Resources

- [INTEGRATION_ANALYSIS_2026-01-25.md](./INTEGRATION_ANALYSIS_2026-01-25.md)
- [BROWSER_INTEGRATION_PLAN.md](./BROWSER_INTEGRATION_PLAN.md)
- [README.md](../README.md)
- [STATUS.md](./STATUS.md)

---

*Environment setup complete. Ready for testing!*
