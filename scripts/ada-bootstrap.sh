#!/usr/bin/env bash
#
# Ada Bootstrap Script
# Chrysalis Project - Autonomous Agent Configuration
#
# This script initializes the complete Chrysalis environment:
# 1. Checks/installs dependencies (Ollama, Node, Go)
# 2. Pulls code-focused open-weights model
# 3. Builds TypeScript core
# 4. Starts Go LLM Gateway
# 5. Starts System Agents API
# 6. Launches the workspace interface
#
# Usage: ./scripts/ada-bootstrap.sh [--model MODEL] [--headless]
#
set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/logs"
mkdir -p "${LOG_DIR}"

# Default model - Qwen2.5-Coder is excellent for code generation
# Alternatives: deepseek-coder:6.7b, codellama:7b, starcoder2:7b
DEFAULT_MODEL="${ADA_MODEL:-qwen2.5-coder:7b}"

# Ports
GATEWAY_PORT="${GATEWAY_PORT:-8080}"
SYSTEM_AGENT_PORT="${SYSTEM_AGENT_PORT:-3200}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"

# URLs
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:${OLLAMA_PORT}}"
GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://localhost:${GATEWAY_PORT}}"
SYSTEM_AGENT_BASE_URL="${SYSTEM_AGENT_BASE_URL:-http://localhost:${SYSTEM_AGENT_PORT}}"

# Flags
HEADLESS=false
SKIP_BUILD=false
MODEL="${DEFAULT_MODEL}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --model)
      MODEL="$2"
      shift 2
      ;;
    --headless)
      HEADLESS=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--model MODEL] [--headless] [--skip-build]"
      echo ""
      echo "Options:"
      echo "  --model MODEL    Ollama model to use (default: ${DEFAULT_MODEL})"
      echo "  --headless       Run without launching UI"
      echo "  --skip-build     Skip TypeScript build step"
      echo ""
      echo "Recommended models for code generation:"
      echo "  qwen2.5-coder:7b     - Excellent code generation (default)"
      echo "  qwen2.5-coder:14b    - Better reasoning, needs more VRAM"
      echo "  deepseek-coder:6.7b  - Strong at code completion"
      echo "  codellama:7b         - Meta's code model"
      echo "  starcoder2:7b        - BigCode's latest"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# =============================================================================
# Utility Functions
# =============================================================================

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

log_error() {
  echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2
}

check_command() {
  command -v "$1" >/dev/null 2>&1
}

wait_for_service() {
  local url="$1"
  local name="$2"
  local max_attempts="${3:-30}"
  local attempt=0
  
  log "Waiting for ${name} at ${url}..."
  while [[ $attempt -lt $max_attempts ]]; do
    if curl -s "${url}" >/dev/null 2>&1; then
      log "${name} is ready"
      return 0
    fi
    sleep 1
    ((attempt++))
  done
  
  log_error "${name} failed to start after ${max_attempts} seconds"
  return 1
}

cleanup() {
  log "Cleaning up..."
  # Kill background processes
  if [[ -n "${GATEWAY_PID:-}" ]]; then
    kill "${GATEWAY_PID}" 2>/dev/null || true
  fi
  if [[ -n "${AGENT_PID:-}" ]]; then
    kill "${AGENT_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

# =============================================================================
# Dependency Checks
# =============================================================================

log "=== Ada Bootstrap: Chrysalis Agent System ==="
log "Model: ${MODEL}"
log "Root: ${ROOT_DIR}"
log ""

# Check Node.js
if ! check_command node; then
  log_error "Node.js not found. Install Node.js >= 18.0.0"
  exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "${NODE_VERSION}" -lt 18 ]]; then
  log_error "Node.js version ${NODE_VERSION} too old. Need >= 18.0.0"
  exit 1
fi
log "✓ Node.js $(node -v)"

# Check npm
if ! check_command npm; then
  log_error "npm not found. Install npm >= 9.0"
  exit 1
fi
log "✓ npm $(npm -v)"

# Check Go
if ! check_command go; then
  log_error "Go not found. Install Go >= 1.21"
  exit 1
fi
log "✓ Go $(go version | awk '{print $3}')"

# Check Ollama
if ! check_command ollama; then
  log_error "Ollama not found."
  log "Install Ollama: curl -fsSL https://ollama.com/install.sh | sh"
  exit 1
fi
log "✓ Ollama installed"

# =============================================================================
# Start Ollama (if not running)
# =============================================================================

if ! curl -s "${OLLAMA_BASE_URL}/api/tags" >/dev/null 2>&1; then
  log "Starting Ollama service..."
  ollama serve >"${LOG_DIR}/ollama.log" 2>&1 &
  OLLAMA_PID=$!
  sleep 2
  
  if ! wait_for_service "${OLLAMA_BASE_URL}/api/tags" "Ollama" 30; then
    log_error "Failed to start Ollama"
    exit 1
  fi
else
  log "✓ Ollama already running"
fi

# =============================================================================
# Pull Model (if needed)
# =============================================================================

log "Checking model: ${MODEL}..."
if ! ollama list | grep -q "^${MODEL}"; then
  log "Pulling model ${MODEL} (this may take a while)..."
  ollama pull "${MODEL}"
else
  log "✓ Model ${MODEL} available"
fi

# Quick model test
log "Testing model..."
RESPONSE=$(echo "Return only the word 'ready'" | ollama run "${MODEL}" 2>/dev/null | head -1)
if [[ -z "${RESPONSE}" ]]; then
  log_error "Model test failed"
  exit 1
fi
log "✓ Model responding"

# =============================================================================
# Install Dependencies
# =============================================================================

cd "${ROOT_DIR}"

if [[ ! -d "node_modules" ]] || [[ ! -f "node_modules/.package-lock.json" ]]; then
  log "Installing npm dependencies..."
  npm install --silent
fi
log "✓ Dependencies installed"

# =============================================================================
# Build TypeScript
# =============================================================================

if [[ "${SKIP_BUILD}" == "false" ]]; then
  log "Building TypeScript core..."
  npm run build >"${LOG_DIR}/build.log" 2>&1 || {
    log_error "TypeScript build failed. See ${LOG_DIR}/build.log"
    exit 1
  }
  log "✓ TypeScript built"
else
  log "Skipping TypeScript build (--skip-build)"
fi

# =============================================================================
# Start Go LLM Gateway
# =============================================================================

log "Starting Go LLM Gateway on :${GATEWAY_PORT}..."
(
  cd "${ROOT_DIR}/go-services"
  export GATEWAY_PORT
  export LLM_PROVIDER="ollama"
  export OLLAMA_BASE_URL
  export LLM_DEFAULT_MODEL="${MODEL}"
  go run ./cmd/gateway
) >"${LOG_DIR}/gateway.log" 2>&1 &
GATEWAY_PID=$!

if ! wait_for_service "${GATEWAY_BASE_URL}/healthz" "Gateway" 30; then
  log_error "Gateway failed to start. See ${LOG_DIR}/gateway.log"
  cat "${LOG_DIR}/gateway.log"
  exit 1
fi
log "✓ Gateway running (PID: ${GATEWAY_PID})"

# =============================================================================
# Start System Agents API
# =============================================================================

log "Starting System Agents API on :${SYSTEM_AGENT_PORT}..."
(
  cd "${ROOT_DIR}"
  export GATEWAY_BASE_URL
  export HOST="0.0.0.0"
  export PORT="${SYSTEM_AGENT_PORT}"
  export LLM_PROVIDER="ollama"
  export LLM_DEFAULT_MODEL="${MODEL}"
  node dist/api/system-agents/run-system-agents-server.js
) >"${LOG_DIR}/system-agents.log" 2>&1 &
AGENT_PID=$!

sleep 3
if ! kill -0 "${AGENT_PID}" 2>/dev/null; then
  log_error "System Agents API failed to start. See ${LOG_DIR}/system-agents.log"
  cat "${LOG_DIR}/system-agents.log"
  exit 1
fi
log "✓ System Agents API running (PID: ${AGENT_PID})"

# =============================================================================
# Summary
# =============================================================================

echo ""
log "=== Ada Bootstrap Complete ==="
echo ""
echo "Services running:"
echo "  • Ollama:        ${OLLAMA_BASE_URL}"
echo "  • LLM Gateway:   ${GATEWAY_BASE_URL}"
echo "  • System Agents: ${SYSTEM_AGENT_BASE_URL}"
echo ""
echo "Model: ${MODEL}"
echo ""
echo "Logs:"
echo "  • ${LOG_DIR}/gateway.log"
echo "  • ${LOG_DIR}/system-agents.log"
echo "  • ${LOG_DIR}/ollama.log"
echo ""

if [[ "${HEADLESS}" == "true" ]]; then
  log "Running in headless mode. Press Ctrl+C to stop."
  wait
else
  # Launch CLI chat interface
  log "Launching Ada chat interface..."
  export SYSTEM_AGENT_API_BASE_URL="${SYSTEM_AGENT_BASE_URL}/api/v1/system-agents"
  node dist/cli/chrysalis-cli.js chat
fi
