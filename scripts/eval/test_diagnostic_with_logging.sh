#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "======================================"
echo "Diagnostic Test with Full Logging"
echo "======================================"
echo ""

# Find node
NODE_CMD=""
if command -v node >/dev/null 2>&1; then
  NODE_CMD="node"
elif command -v nodejs >/dev/null 2>&1; then
  NODE_CMD="nodejs"
elif [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  # Try NVM
  source "$HOME/.nvm/nvm.sh"
  NODE_CMD="node"
elif [[ -d "$HOME/.volta" ]]; then
  export PATH="$HOME/.volta/bin:$PATH"
  NODE_CMD="node"
else
  echo "ERROR: Node.js not found in PATH"
  echo "Please install Node.js or add it to PATH"
  echo ""
  echo "Trying common locations..."
  for path in /usr/bin/node /usr/local/bin/node ~/.nvm/versions/node/*/bin/node; do
    if [[ -x "$path" ]]; then
      echo "Found: $path"
      NODE_CMD="$path"
      break
    fi
  done
  
  if [[ -z "$NODE_CMD" ]]; then
    echo "No Node.js executable found."
    exit 1
  fi
fi

echo "Using Node: $NODE_CMD"
echo "Version: $($NODE_CMD --version)"
echo ""

# Check CLI
CLI="$ROOT/dist/src/cli/adapter-task.js"
if [[ ! -f "$CLI" ]]; then
  echo "ERROR: CLI not found at $CLI"
  echo "Build with: npm run build"
  exit 1
fi

# Check Ollama
if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "ERROR: Ollama not accessible at http://localhost:11434"
  echo "Is Ollama running?"
  exit 1
fi

echo "✓ All prerequisites met"
echo ""
echo "Running diagnostic suite..."
echo "  Task: eval/tasks/diagnostics/diagnostic-suite.json"
echo "  Model: deepseek-r1:1.5b"
echo "  Stops on first error to isolate capability ceiling"
echo ""

# Run with full logging
"$NODE_CMD" "$CLI" "$ROOT/eval/tasks/diagnostics/diagnostic-suite.json" \
  --output "$ROOT/results/eval-suite/diagnostics/diagnostic-suite.result.json" \
  --verbose

EXIT_CODE=$?

echo ""
echo "======================================"
echo "Test Complete"
echo "======================================"
echo ""

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✓ All tests passed!"
else
  echo "⚠ Some tests failed (this is expected - helps identify capability ceiling)"
fi

echo ""
echo "Results: results/eval-suite/diagnostics/diagnostic-suite.result.json"
echo "Responses: results/eval-suite/responses/diagnostics/"
echo ""
echo "Review the result JSON to see which test failed first."
echo ""

exit $EXIT_CODE
