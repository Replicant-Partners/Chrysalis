#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Chrysalis Documentation Validation"
echo "======================================"

# Parse arguments
RUN_ALL=true
RUN_LINKS=false
RUN_OPENAPI=false
RUN_EXAMPLES=false
RUN_SPELLING=false
RUN_DIAGRAMS=false
RUN_COVERAGE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --links) RUN_LINKS=true; RUN_ALL=false ;;
    --openapi) RUN_OPENAPI=true; RUN_ALL=false ;;
    --examples) RUN_EXAMPLES=true; RUN_ALL=false ;;
    --spelling) RUN_SPELLING=true; RUN_ALL=false ;;
    --diagrams) RUN_DIAGRAMS=true; RUN_ALL=false ;;
    --coverage) RUN_COVERAGE=true; RUN_ALL=false ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# Set all to true if running all
if [ "$RUN_ALL" = true ]; then
  RUN_LINKS=true
  RUN_OPENAPI=true
  RUN_EXAMPLES=true
  RUN_SPELLING=true
  RUN_DIAGRAMS=true
  RUN_COVERAGE=true
fi

FAILED=0

# 1. Link Validation
if [ "$RUN_LINKS" = true ]; then
  echo ""
  echo "📎 Validating Links..."
  if python scripts/validate_links.py; then
    echo -e "${GREEN}✓ Links validation passed${NC}"
  else
    echo -e "${RED}✗ Links validation failed${NC}"
    FAILED=1
  fi
fi

# 2. OpenAPI Validation
if [ "$RUN_OPENAPI" = true ]; then
  echo ""
  echo "📋 Validating OpenAPI Specs..."
  if ./scripts/validate_openapi.sh; then
    echo -e "${GREEN}✓ OpenAPI validation passed${NC}"
  else
    echo -e "${RED}✗ OpenAPI validation failed${NC}"
    FAILED=1
  fi
fi

# 3. Code Examples
if [ "$RUN_EXAMPLES" = true ]; then
  echo ""
  echo "💻 Testing Code Examples..."
  if python scripts/validate_code_examples.py; then
    echo -e "${GREEN}✓ Code examples passed${NC}"
  else
    echo -e "${RED}✗ Code examples failed${NC}"
    FAILED=1
  fi
fi

# 4. Spelling
if [ "$RUN_SPELLING" = true ]; then
  echo ""
  echo "📝 Checking Spelling..."
  if command -v cspell &> /dev/null; then
    if cspell "docs/**/*.md" "*.md" --no-progress; then
      echo -e "${GREEN}✓ Spelling check passed${NC}"
    else
      echo -e "${YELLOW}⚠ Spelling issues found${NC}"
      # Don't fail on spelling errors, just warn
    fi
  else
    echo -e "${YELLOW}⚠ cspell not installed, skipping${NC}"
  fi
fi

# 5. Diagrams
if [ "$RUN_DIAGRAMS" = true ]; then
  echo ""
  echo "📊 Validating Diagrams..."
  if python scripts/validate_mermaid_diagrams.py; then
    echo -e "${GREEN}✓ Diagram validation passed${NC}"
  else
    echo -e "${RED}✗ Diagram validation failed${NC}"
    FAILED=1
  fi
fi

# 6. Coverage
if [ "$RUN_COVERAGE" = true ]; then
  echo ""
  echo "📈 Checking Documentation Coverage..."
  if python scripts/check_doc_coverage.py; then
    echo -e "${GREEN}✓ Documentation coverage passed${NC}"
  else
    echo -e "${YELLOW}⚠ Documentation coverage below threshold${NC}"
    # Don't fail on coverage, just warn
  fi
fi

echo ""
echo "======================================"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All validation checks passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some validation checks failed${NC}"
  exit 1
fi
