#!/usr/bin/env bash
#
# Run the Chrysalis TUI Chat interface
#
# Prerequisites:
#   1. System Agent API must be running: npm run service:system-agents
#   2. Go LLM Gateway should be running for real agent responses
#
# Usage:
#   ./scripts/run-tui-chat.sh [--agent ada|lea|phil|david] [--debug]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

# Check if system-agents API is running
if ! curl -s http://localhost:3200/api/v1/system-agents/health > /dev/null 2>&1; then
    echo "⚠️  System Agent API not detected at localhost:3200"
    echo "   Start it with: npm run service:system-agents"
    echo ""
    echo "Starting TUI anyway (will show connection errors)..."
    echo ""
fi

# Run TUI from the src/tui directory (which has package.json type:module)
cd src/tui
exec npx tsx app.tsx "$@"
