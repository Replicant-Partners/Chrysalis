#!/bin/bash
# Start Chrysalis System Agents Stack
#
# This script starts all services needed for chatting with system agents:
# 1. Go Gateway (LLM routing) - port 8080
# 2. Rust System Agents - port 3200
# 3. Python API Server (memory) - port 5000
#
# Prerequisites:
# - Ollama running with phi4-mini model: ollama run phi4-mini
# - Or set OPENROUTER_API_KEY for cloud LLM access
#
# Usage:
#   ./scripts/start-agents.sh
#   ./scripts/start-agents.sh --local  # Use Ollama only
#   ./scripts/start-agents.sh --cloud  # Use OpenRouter only

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Chrysalis System Agents Stack${NC}"
echo "========================================="

# Parse arguments
USE_LOCAL=true
USE_CLOUD=true

for arg in "$@"; do
    case $arg in
        --local)
            USE_CLOUD=false
            echo -e "${YELLOW}Mode: Local only (Ollama)${NC}"
            ;;
        --cloud)
            USE_LOCAL=false
            echo -e "${YELLOW}Mode: Cloud only (OpenRouter)${NC}"
            ;;
    esac
done

# Check prerequisites
echo ""
echo "Checking prerequisites..."

# Check Ollama if using local
if [ "$USE_LOCAL" = true ]; then
    if command -v ollama &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} Ollama installed"
        
        # Check if phi4-mini is available
        if ollama list 2>/dev/null | grep -q "phi4-mini"; then
            echo -e "  ${GREEN}✓${NC} phi4-mini model available"
        else
            echo -e "  ${YELLOW}!${NC} phi4-mini not found. Run: ollama pull phi4-mini"
        fi
    else
        echo -e "  ${YELLOW}!${NC} Ollama not installed (local inference unavailable)"
        USE_LOCAL=false
    fi
fi

# Check OpenRouter API key if using cloud
if [ "$USE_CLOUD" = true ]; then
    if [ -n "$OPENROUTER_API_KEY" ]; then
        echo -e "  ${GREEN}✓${NC} OPENROUTER_API_KEY set"
    else
        echo -e "  ${YELLOW}!${NC} OPENROUTER_API_KEY not set (cloud inference unavailable)"
        USE_CLOUD=false
    fi
fi

# Ensure at least one provider is available
if [ "$USE_LOCAL" = false ] && [ "$USE_CLOUD" = false ]; then
    echo -e "${RED}Error: No LLM provider available${NC}"
    echo "Either:"
    echo "  - Install Ollama and run: ollama pull phi4-mini"
    echo "  - Set OPENROUTER_API_KEY environment variable"
    exit 1
fi

# Set environment variables
export GATEWAY_PORT=${GATEWAY_PORT:-8080}
export SYSTEM_AGENTS_PORT=${SYSTEM_AGENTS_PORT:-3200}
export MEMORY_API_PORT=${MEMORY_API_PORT:-5000}
export OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://localhost:11434}

if [ "$USE_LOCAL" = true ]; then
    export LLM_PROVIDER="ollama"
    export LLM_MODEL="phi4-mini"
else
    export LLM_PROVIDER="openrouter"
    export LLM_MODEL="openai/gpt-5.2-codex"
fi

echo ""
echo "Configuration:"
echo "  Gateway Port: $GATEWAY_PORT"
echo "  System Agents Port: $SYSTEM_AGENTS_PORT"
echo "  Memory API Port: $MEMORY_API_PORT"
echo "  LLM Provider: $LLM_PROVIDER"
echo "  LLM Model: $LLM_MODEL"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    kill $(jobs -p) 2>/dev/null || true
}
trap cleanup EXIT

# Start services
echo ""
echo "Starting services..."

# 1. Start Go Gateway
echo -e "  Starting Go Gateway on port $GATEWAY_PORT..."
cd "$PROJECT_ROOT/go-services"
if [ -f "bin/gateway" ]; then
    ./bin/gateway &
elif command -v go &> /dev/null; then
    go run ./cmd/gateway &
else
    echo -e "  ${YELLOW}!${NC} Go not installed, skipping gateway"
fi
sleep 1

# 2. Start Rust System Agents
echo -e "  Starting Rust System Agents on port $SYSTEM_AGENTS_PORT..."
cd "$PROJECT_ROOT/src/native/rust-system-agents"
if [ -f "target/release/chrysalis-system-agents" ]; then
    PORT=$SYSTEM_AGENTS_PORT GATEWAY_BASE_URL="http://localhost:$GATEWAY_PORT" \
        ./target/release/chrysalis-system-agents &
elif [ -f "target/debug/chrysalis-system-agents" ]; then
    PORT=$SYSTEM_AGENTS_PORT GATEWAY_BASE_URL="http://localhost:$GATEWAY_PORT" \
        ./target/debug/chrysalis-system-agents &
elif command -v cargo &> /dev/null; then
    PORT=$SYSTEM_AGENTS_PORT GATEWAY_BASE_URL="http://localhost:$GATEWAY_PORT" \
        cargo run --release &
else
    echo -e "  ${YELLOW}!${NC} Rust not installed, skipping system agents"
fi
sleep 1

# 3. Start Python Memory API
echo -e "  Starting Python Memory API on port $MEMORY_API_PORT..."
cd "$PROJECT_ROOT"
if command -v python3 &> /dev/null; then
    python3 -m memory_system.api_server --port $MEMORY_API_PORT &
else
    echo -e "  ${YELLOW}!${NC} Python not installed, skipping memory API"
fi
sleep 1

echo ""
echo -e "${GREEN}Services started!${NC}"
echo ""
echo "Endpoints:"
echo "  System Agents: http://localhost:$SYSTEM_AGENTS_PORT/api/v1/system-agents/"
echo "  Gateway:       http://localhost:$GATEWAY_PORT/"
echo "  Memory API:    http://localhost:$MEMORY_API_PORT/"
echo ""
echo "Test with:"
echo "  curl -X POST http://localhost:$SYSTEM_AGENTS_PORT/api/v1/system-agents/chat \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"message\": \"Hello Ada, what can you help me with?\", \"targetAgent\": \"ada\"}'"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for all background jobs
wait
