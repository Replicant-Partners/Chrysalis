#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="$ROOT/dist/src/cli/adapter-task.js"
RUNS_DIR="$ROOT/results/eval-suite/runs"
RESOLVED_DIR="$ROOT/results/eval-suite/resolved-tasks"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
fi

if [[ ! -f "$CLI" ]]; then
  echo "Missing $CLI. Build with: npm run build"
  exit 1
fi

mkdir -p "$RUNS_DIR" "$RESOLVED_DIR"

if [[ ! -d "$ROOT/eval/tasks/local" ]]; then
  echo "Missing eval tasks. Generate with: scripts/eval/generate_eval_tasks.py"
  exit 1
fi

# Health check (CLI + local provider)
if [[ -f "$ROOT/eval/tasks/health/health-check.json" ]]; then
  echo "Running health check..."
  node "$CLI" "$ROOT/eval/tasks/health/health-check.json" --output "$RUNS_DIR/health-check.json"
else
  echo "Health check task missing. Generate with: scripts/eval/generate_eval_tasks.py"
fi

run_task_file() {
  local task_file="$1"
  local base
  base="$(basename "$task_file" .json)"
  local resolved="$RESOLVED_DIR/${base}.json"

  python3 "$ROOT/scripts/eval/resolve_api_keys.py" "$task_file" "$resolved"

  set +e
  python3 - "$resolved" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as handle:
    task = json.load(handle)

def needs_key(node):
    if node.get('type') == 'batch':
        return any(needs_key(t) for t in node.get('tasks', []))
    if node.get('type') != 'evaluate':
        return False
    model = node.get('model', {})
    provider = str(model.get('provider', '')).lower()
    if provider == 'ollama':
        return False
    return not bool(model.get('apiKey'))

if needs_key(task):
    print('SKIP_MISSING_API_KEY')
    sys.exit(2)
PY
  status=$?
  set -e
  if [[ "$status" -eq 2 ]]; then
    echo "Skipping $task_file (missing API key)."
    return
  elif [[ "$status" -ne 0 ]]; then
    exit "$status"
  fi

  echo "Running $task_file..."
  node "$CLI" "$resolved" --output "$RUNS_DIR/${base}.result.json"
}

for task in "$ROOT/eval/tasks/local"/*.json; do
  [[ -e "$task" ]] || continue
  run_task_file "$task"
done

for task in "$ROOT/eval/tasks/benchmarks"/*.json; do
  [[ -e "$task" ]] || continue
  run_task_file "$task"
done

python3 "$ROOT/scripts/eval/score_eval_results.py" \
  --runs "$RUNS_DIR" \
  --output "$ROOT/results/eval-suite/summaries/summary.json"

echo "Evaluation complete. Summary: $ROOT/results/eval-suite/summaries/summary.json"
