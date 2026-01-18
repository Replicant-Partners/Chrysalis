#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="$ROOT/dist/src/cli/adapter-task.js"
DIAGNOSTICS_DIR="$ROOT/eval/tasks/diagnostics"
RESULTS_DIR="$ROOT/results/eval-suite/diagnostics"

echo "======================================"
echo "Ollama Diagnostic Suite"
echo "======================================"
echo ""

# Check if CLI exists
if [[ ! -f "$CLI" ]]; then
  echo "ERROR: CLI not found at $CLI"
  echo "Build with: npm run build"
  exit 1
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "ERROR: Ollama is not running or not accessible at http://localhost:11434"
  echo "Start Ollama with: ollama serve"
  exit 1
fi

echo "✓ Ollama is running"
echo "✓ CLI is available"
echo ""

mkdir -p "$RESULTS_DIR"

# Run progressive diagnostic suite
echo "Running Progressive Diagnostic Suite..."
echo "This will test increasing levels of complexity to isolate failure point."
echo ""

if [[ -f "$DIAGNOSTICS_DIR/diagnostic-suite.json" ]]; then
  echo "Executing: diagnostic-suite.json"
  echo "  - This suite stops on first error to identify the complexity threshold"
  echo ""
  
  node "$CLI" "$DIAGNOSTICS_DIR/diagnostic-suite.json" \
    --output "$RESULTS_DIR/diagnostic-suite.result.json" \
    --verbose
  
  echo ""
  echo "======================================"
  echo "Diagnostic Complete"
  echo "======================================"
  echo ""
  echo "Results saved to:"
  echo "  $RESULTS_DIR/diagnostic-suite.result.json"
  echo ""
  echo "Response files saved to:"
  echo "  results/eval-suite/responses/diagnostics/"
  echo ""
  
else
  echo "ERROR: diagnostic-suite.json not found at $DIAGNOSTICS_DIR"
  exit 1
fi

# Show summary
echo "======================================"
echo "Test Summary"
echo "======================================"
if [[ -f "$RESULTS_DIR/diagnostic-suite.result.json" ]]; then
  echo ""
  echo "Checking which tests passed..."
  echo ""
  
  # Use jq if available, otherwise python
  if command -v jq >/dev/null 2>&1; then
    jq -r '.result[] | "\(.metadata.test_id // "?"): \(if .success then "✓ PASS" else "✗ FAIL" end) - \(.taskName)"' \
      "$RESULTS_DIR/diagnostic-suite.result.json"
  else
    python3 - "$RESULTS_DIR/diagnostic-suite.result.json" <<'PY'
import json
import sys

with open(sys.argv[1], 'r') as f:
    data = json.load(f)

for task in data.get('result', []):
    test_id = task.get('metadata', {}).get('test_id', '?')
    success = task.get('success', False)
    name = task.get('taskName', '')
    status = '✓ PASS' if success else '✗ FAIL'
    print(f"{test_id}: {status} - {name}")
PY
  fi
  
  echo ""
  echo "Review the full results JSON and response files for details."
  echo ""
  echo "If all tests pass: Your Ollama setup is working correctly."
  echo "If tests fail: The failure point indicates the capability limit."
  echo ""
fi
