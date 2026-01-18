#!/bin/bash
# Auto-generated LLM Evaluation Execution Script
# Generated: 2026-01-18T07:07:48.727Z
# Models: 32
# Tests per model: 10
# Total evaluations: 320

set -e

echo "🚀 Starting LLM Evaluation Suite"
echo "================================="
echo ""
echo "Models to evaluate: 32"
echo "Tests per model: 10"
echo "Total evaluations: 320"
echo ""

# Create results directory
mkdir -p ./results

# Execute batch evaluation
echo "Running batch evaluation..."
npm run task ../examples/tasks/generated/batch-eval-all-models.json

echo ""
echo "✅ Evaluation complete!"
echo "Results saved to: ./results"
