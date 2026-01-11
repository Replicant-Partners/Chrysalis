#!/bin/bash
set -e

echo "Validating OpenAPI specifications..."

SPECS=(
  "docs/api/openapi/agentbuilder-openapi.yaml"
  "docs/api/openapi/skillbuilder-openapi.yaml"
  "docs/api/openapi/knowledgebuilder-openapi.yaml"
)

FAILED=0

for spec in "${SPECS[@]}"; do
  if [ ! -f "$spec" ]; then
    echo "❌ Spec not found: $spec"
    FAILED=1
    continue
  fi
  
  echo "Validating $spec..."
  
  # Basic YAML syntax check with Python
  if python -c "import yaml; yaml.safe_load(open('$spec'))" 2>&1; then
    echo "✅ $spec has valid YAML syntax"
  else
    echo "❌ $spec has invalid YAML syntax"
    FAILED=1
    continue
  fi
  
  # Check for required OpenAPI fields
  if grep -q "openapi: 3.0" "$spec" && \
     grep -q "info:" "$spec" && \
     grep -q "paths:" "$spec"; then
    echo "✅ $spec has required OpenAPI fields"
  else
    echo "❌ $spec missing required OpenAPI fields"
    FAILED=1
  fi
  
  # Validate with swagger-cli if available
  if command -v swagger-cli &> /dev/null; then
    if swagger-cli validate "$spec" 2>&1; then
      echo "✅ $spec is valid (swagger-cli)"
    else
      echo "❌ $spec validation failed (swagger-cli)"
      FAILED=1
    fi
  fi
  
  # Lint with spectral if available
  if command -v spectral &> /dev/null; then
    if [ -f ".spectral.yaml" ]; then
      if spectral lint "$spec" --ruleset .spectral.yaml 2>&1; then
        echo "✅ $spec passed linting (spectral)"
      else
        echo "⚠️  $spec has linting warnings (spectral)"
        # Don't fail on linting warnings
      fi
    else
      if spectral lint "$spec" 2>&1; then
        echo "✅ $spec passed linting (spectral)"
      else
        echo "⚠️  $spec has linting warnings (spectral)"
      fi
    fi
  fi
done

if [ $FAILED -eq 0 ]; then
  echo "✅ All OpenAPI specs valid"
  exit 0
else
  echo "❌ Some OpenAPI specs failed validation"
  exit 1
fi
