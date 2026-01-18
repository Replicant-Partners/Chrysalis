#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="$ROOT/dist/src/cli/adapter-task.js"
RUNS_DIR="$ROOT/results/eval-suite/runs"
RESOLVED_DIR="$ROOT/results/eval-suite/resolved-tasks"

BATCH_COUNT=5
BATCH_INDEX=""
RUN_LOCAL=1
INCLUDE_BENCHMARKS=1
RUN_HEALTH=1
DO_SCORE=1

usage() {
  cat <<'USAGE'
Usage: scripts/eval/run_eval_suite.sh [options]

Options:
  --batch <n>           Run batch n (1-based) out of --batches (default 5)
  --batches <count>     Total number of batches (default 5)
  --skip-benchmarks     Do not run benchmark tasks
  --benchmarks-only     Run only benchmark tasks
  --skip-health         Skip health check
  --skip-score          Skip scoring summary
  -h, --help            Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --batch)
      BATCH_INDEX="$2"
      shift 2
      ;;
    --batches)
      BATCH_COUNT="$2"
      shift 2
      ;;
    --skip-benchmarks)
      INCLUDE_BENCHMARKS=0
      shift
      ;;
    --benchmarks-only)
      RUN_LOCAL=0
      INCLUDE_BENCHMARKS=1
      shift
      ;;
    --skip-health)
      RUN_HEALTH=0
      shift
      ;;
    --skip-score)
      DO_SCORE=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

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

if [[ "$RUN_LOCAL" -eq 1 && ! -d "$ROOT/eval/tasks/local" ]]; then
  echo "Missing eval tasks. Generate with: scripts/eval/generate_eval_tasks.py"
  exit 1
fi

if [[ "$RUN_HEALTH" -eq 1 ]]; then
  # Health check (CLI + local provider)
  if [[ -f "$ROOT/eval/tasks/health/health-check.json" ]]; then
    echo "Running health check..."
    resolved="$RESOLVED_DIR/health-check.json"
    python3 "$ROOT/scripts/eval/resolve_api_keys.py" "$ROOT/eval/tasks/health/health-check.json" "$resolved"

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
      echo "Skipping health check (missing API key)."
    elif [[ "$status" -ne 0 ]]; then
      exit "$status"
    else
      node "$CLI" "$resolved" --output "$RUNS_DIR/health-check.json"
    fi
  else
    echo "Health check task missing. Generate with: scripts/eval/generate_eval_tasks.py"
  fi
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

if [[ "$RUN_LOCAL" -eq 1 ]]; then
  mapfile -t local_tasks < <(ROOT="$ROOT" python3 - <<'PY'
import glob
import json
import os

root = os.environ["ROOT"]
files = glob.glob(os.path.join(root, "eval", "tasks", "local", "*.json"))

def get_size(path):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if data.get("type") == "batch":
            tasks = data.get("tasks") or []
            if tasks:
                size = tasks[0].get("metadata", {}).get("modelSizeGB")
                if size is not None:
                    return float(size)
        size = data.get("metadata", {}).get("modelSizeGB")
        if size is not None:
            return float(size)
    except Exception:
        pass
    return 1e9

for path in sorted(files, key=lambda p: (get_size(p), p)):
    print(path)
PY
)

  total=${#local_tasks[@]}
  if [[ "$total" -eq 0 ]]; then
    echo "No local tasks found."
  else
    if [[ -n "$BATCH_INDEX" ]]; then
      if [[ "$BATCH_COUNT" -le 0 ]]; then
        echo "Invalid --batches value: $BATCH_COUNT"
        exit 1
      fi
      if [[ "$BATCH_INDEX" -le 0 || "$BATCH_INDEX" -gt "$BATCH_COUNT" ]]; then
        echo "Invalid --batch value: $BATCH_INDEX"
        exit 1
      fi

      batch_size=$(( (total + BATCH_COUNT - 1) / BATCH_COUNT ))
      start=$(( (BATCH_INDEX - 1) * batch_size ))
      end=$(( start + batch_size - 1 ))

      echo "Running local batch $BATCH_INDEX/$BATCH_COUNT (models $((start + 1))..$((end + 1)) of $total)"
      for (( idx = start; idx <= end; idx++ )); do
        if [[ "$idx" -ge "$total" ]]; then
          break
        fi
        run_task_file "${local_tasks[$idx]}"
      done
    else
      for task in "${local_tasks[@]}"; do
        run_task_file "$task"
      done
    fi
  fi
fi

if [[ "$INCLUDE_BENCHMARKS" -eq 1 ]]; then
  for task in "$ROOT/eval/tasks/benchmarks"/*.json; do
    [[ -e "$task" ]] || continue
    run_task_file "$task"
  done
fi

if [[ "$DO_SCORE" -eq 1 ]]; then
  python3 "$ROOT/scripts/eval/score_eval_results.py" \
    --runs "$RUNS_DIR" \
    --output "$ROOT/results/eval-suite/summaries/summary.json"
fi

if [[ "$DO_SCORE" -eq 1 ]]; then
  echo "Evaluation complete. Summary: $ROOT/results/eval-suite/summaries/summary.json"
else
  echo "Evaluation complete. Scoring skipped."
fi
