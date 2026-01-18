#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GATEWAY_PORT="${GATEWAY_PORT:-8080}"
SYSTEM_AGENT_PORT="${SYSTEM_AGENT_PORT:-3200}"
GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://localhost:${GATEWAY_PORT}}"
SYSTEM_AGENT_BASE_URL="${SYSTEM_AGENT_BASE_URL:-http://localhost:${SYSTEM_AGENT_PORT}}"
SYSTEM_AGENT_API_BASE_URL="${SYSTEM_AGENT_API_BASE_URL:-${SYSTEM_AGENT_BASE_URL}/api/v1/system-agents}"

export LLM_PROVIDER="${LLM_PROVIDER:-ollama}"
export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
export SYSTEM_AGENT_PREFER_LOCAL="${SYSTEM_AGENT_PREFER_LOCAL:-true}"

pids=()

cleanup() {
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

if ! command -v go >/dev/null 2>&1; then
  echo "go not found in PATH. Install Go to run the gateway." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found in PATH. Install Node.js/npm to run Chrysalis." >&2
  exit 1
fi

echo "Starting Go gateway on :${GATEWAY_PORT} (provider=${LLM_PROVIDER})..."
(
  cd "${ROOT_DIR}/go-services"
  export GATEWAY_PORT
  go run ./cmd/gateway
) &
pids+=("$!")

echo "Building TypeScript..."
(
  cd "${ROOT_DIR}"
  npm run build
)

echo "Starting System Agents API on :${SYSTEM_AGENT_PORT}..."
(
  cd "${ROOT_DIR}"
  export GATEWAY_BASE_URL
  export HOST="0.0.0.0"
  export PORT="${SYSTEM_AGENT_PORT}"
  node dist/api/system-agents/run-system-agents-server.js
) &
pids+=("$!")

echo "Launching TUI (SYSTEM_AGENT_API_BASE_URL=${SYSTEM_AGENT_API_BASE_URL})..."
(
  cd "${ROOT_DIR}"
  export SYSTEM_AGENT_API_BASE_URL
  node dist/cli/chrysalis-cli.js chat
)
