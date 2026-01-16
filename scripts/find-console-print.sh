#!/usr/bin/env bash
# Find stray console/print statements across the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Searching for console.* in TypeScript/JavaScript..."
rg "console\.(log|warn|error|debug|info)" --glob '*.{ts,tsx,js,jsx}' src projects || true

echo ""
echo "Searching for bare print() in Python..."
rg "\bprint\s*\(" --glob '*.py' src projects || true
