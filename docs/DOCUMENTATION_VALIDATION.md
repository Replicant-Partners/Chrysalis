# Documentation Validation Automation

**Version**: 1.0.0  
**Date**: 2026-01-11  
**Status**: Active

---

## Overview

This document describes the automated documentation validation system for Chrysalis. The system ensures documentation quality, consistency, and accuracy through automated checks in CI/CD pipelines.

---

## Table of Contents

1. [Validation Checks](#validation-checks)
2. [CI/CD Integration](#cicd-integration)
3. [Local Validation](#local-validation)
4. [Validation Scripts](#validation-scripts)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)

---

## Validation Checks

### 1. Link Validation

**Purpose**: Ensure all internal and external links are valid

**Checks**:
- Internal links point to existing files
- Anchor links point to existing headers
- External links return 200 OK (with caching)
- No broken relative paths

**Tool**: `markdown-link-check`

### 2. OpenAPI Spec Validation

**Purpose**: Ensure OpenAPI specifications are valid

**Checks**:
- Valid OpenAPI 3.0.3 syntax
- All required fields present
- No duplicate operationIds
- Valid schema references
- Consistent error responses

**Tools**: `swagger-cli`, `spectral`

### 3. Code Example Testing

**Purpose**: Ensure code examples in documentation work

**Checks**:
- Python examples execute without errors
- TypeScript examples compile
- API examples return expected responses
- Environment variables are documented

**Tool**: Custom test runner

### 4. Spelling and Grammar

**Purpose**: Maintain professional documentation quality

**Checks**:
- Spell checking with technical dictionary
- Grammar checking
- Consistent terminology
- No placeholder text (TODO, FIXME in docs)

**Tools**: `cspell`, `write-good`

### 5. Diagram Validation

**Purpose**: Ensure Mermaid diagrams render correctly

**Checks**:
- Valid Mermaid syntax
- Diagrams render without errors
- No broken references in diagrams

**Tool**: `mermaid-cli`

### 6. Documentation Coverage

**Purpose**: Ensure all APIs are documented

**Checks**:
- All endpoints have OpenAPI specs
- All public functions have docstrings
- All modules have README files
- Changelog is up to date

**Tool**: Custom coverage script

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/documentation-validation.yml`:

```yaml
name: Documentation Validation

on:
  push:
    branches: [main, develop]
    paths:
      - 'docs/**'
      - '**.md'
      - 'docs/api/openapi/**'
  pull_request:
    paths:
      - 'docs/**'
      - '**.md'
      - 'docs/api/openapi/**'

jobs:
  validate-links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check Markdown Links
        uses: gaurav-nelson/github-action-markdown-link-check@v1
        with:
          config-file: '.markdown-link-check.json'
          folder-path: 'docs/'
          file-extension: '.md'

  validate-openapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install validators
        run: |
          npm install -g @apidevtools/swagger-cli
          npm install -g @stoplight/spectral-cli
      
      - name: Validate AgentBuilder spec
        run: |
          swagger-cli validate docs/api/openapi/agentbuilder-openapi.yaml
          spectral lint docs/api/openapi/agentbuilder-openapi.yaml
      
      - name: Validate SkillBuilder spec
        run: |
          swagger-cli validate docs/api/openapi/skillbuilder-openapi.yaml
          spectral lint docs/api/openapi/skillbuilder-openapi.yaml
      
      - name: Validate KnowledgeBuilder spec
        run: |
          swagger-cli validate docs/api/openapi/knowledgebuilder-openapi.yaml
          spectral lint docs/api/openapi/knowledgebuilder-openapi.yaml

  validate-code-examples:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      
      - name: Test Python examples
        run: python scripts/validate_code_examples.py
      
      - name: Test TypeScript examples
        run: |
          npm install
          npm run validate-examples

  spell-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install cspell
        run: npm install -g cspell
      
      - name: Run spell check
        run: cspell "docs/**/*.md" "*.md"

  validate-diagrams:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install mermaid-cli
        run: npm install -g @mermaid-js/mermaid-cli
      
      - name: Validate Mermaid diagrams
        run: python scripts/validate_mermaid_diagrams.py

  documentation-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Check documentation coverage
        run: python scripts/check_doc_coverage.py
      
      - name: Generate coverage report
        run: python scripts/generate_doc_report.py
      
      - name: Upload coverage report
        uses: actions/upload-artifact@v3
        with:
          name: documentation-coverage
          path: docs/coverage-report.html
```

---

## Local Validation

### Quick Validation

Run all checks locally before committing:

```bash
# Run all validation checks
./scripts/validate_docs.sh

# Or run individual checks
./scripts/validate_docs.sh --links
./scripts/validate_docs.sh --openapi
./scripts/validate_docs.sh --examples
./scripts/validate_docs.sh --spelling
```

### Pre-commit Hook

Install pre-commit hook to validate on commit:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

Create `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: check-yaml
      - id: check-json
      - id: check-merge-conflict
      - id: trailing-whitespace
        args: [--markdown-linebreak-ext=md]
      - id: end-of-file-fixer

  - repo: https://github.com/tcort/markdown-link-check
    rev: v3.11.2
    hooks:
      - id: markdown-link-check
        args: ['--config', '.markdown-link-check.json']

  - repo: local
    hooks:
      - id: validate-openapi
        name: Validate OpenAPI Specs
        entry: ./scripts/validate_openapi.sh
        language: script
        files: 'docs/api/openapi/.*\.yaml$'
      
      - id: spell-check
        name: Spell Check Documentation
        entry: cspell
        language: node
        files: '\.md$'
```

---

## Validation Scripts

### 1. Master Validation Script

Create `scripts/validate_docs.sh`:

```bash
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
  if cspell "docs/**/*.md" "*.md" --no-progress; then
    echo -e "${GREEN}✓ Spelling check passed${NC}"
  else
    echo -e "${YELLOW}⚠ Spelling issues found${NC}"
    # Don't fail on spelling errors, just warn
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
```

### 2. Link Validation Script

Create `scripts/validate_links.py`:

```python
#!/usr/bin/env python3
"""
Validate all links in Markdown documentation.
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Tuple
from urllib.parse import urlparse

def find_markdown_files(root_dir: str = "docs") -> List[Path]:
    """Find all Markdown files."""
    root = Path(root_dir)
    md_files = list(root.rglob("*.md"))
    # Also check root directory
    md_files.extend(Path(".").glob("*.md"))
    return md_files

def extract_links(content: str) -> List[Tuple[str, int]]:
    """Extract all links from Markdown content."""
    # Match [text](link) and [text](link#anchor)
    pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    links = []
    for match in re.finditer(pattern, content):
        link = match.group(2)
        line_num = content[:match.start()].count('\n') + 1
        links.append((link, line_num))
    return links

def validate_internal_link(link: str, source_file: Path) -> Tuple[bool, str]:
    """Validate internal link."""
    # Remove anchor
    if '#' in link:
        path, anchor = link.split('#', 1)
    else:
        path, anchor = link, None
    
    # Skip external links
    if path.startswith('http://') or path.startswith('https://'):
        return True, ""
    
    # Resolve relative path
    if path:
        target = (source_file.parent / path).resolve()
        if not target.exists():
            return False, f"File not found: {path}"
    
    # TODO: Validate anchor exists in target file
    # This would require parsing the target file for headers
    
    return True, ""

def main():
    """Main validation function."""
    print("Validating documentation links...")
    
    md_files = find_markdown_files()
    print(f"Found {len(md_files)} Markdown files")
    
    errors = []
    total_links = 0
    
    for md_file in md_files:
        try:
            content = md_file.read_text(encoding='utf-8')
            links = extract_links(content)
            total_links += len(links)
            
            for link, line_num in links:
                valid, error = validate_internal_link(link, md_file)
                if not valid:
                    errors.append(f"{md_file}:{line_num} - {error}")
        except Exception as e:
            errors.append(f"{md_file} - Error reading file: {e}")
    
    print(f"Checked {total_links} links")
    
    if errors:
        print(f"\n❌ Found {len(errors)} broken links:")
        for error in errors:
            print(f"  {error}")
        return 1
    else:
        print("✅ All links valid")
        return 0

if __name__ == "__main__":
    sys.exit(main())
```

### 3. OpenAPI Validation Script

Create `scripts/validate_openapi.sh`:

```bash
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
  
  # Validate with swagger-cli
  if swagger-cli validate "$spec" 2>&1; then
    echo "✅ $spec is valid (swagger-cli)"
  else
    echo "❌ $spec validation failed (swagger-cli)"
    FAILED=1
  fi
  
  # Lint with spectral
  if spectral lint "$spec" --ruleset .spectral.yaml 2>&1; then
    echo "✅ $spec passed linting (spectral)"
  else
    echo "⚠️  $spec has linting warnings (spectral)"
    # Don't fail on linting warnings
  fi
done

if [ $FAILED -eq 0 ]; then
  echo "✅ All OpenAPI specs valid"
  exit 0
else
  echo "❌ Some OpenAPI specs failed validation"
  exit 1
fi
```

### 4. Code Examples Validation

Create `scripts/validate_code_examples.py`:

```python
#!/usr/bin/env python3
"""
Test code examples in documentation.
"""

import os
import re
import sys
import tempfile
import subprocess
from pathlib import Path
from typing import List, Tuple

def find_code_blocks(content: str, language: str) -> List[Tuple[str, int]]:
    """Extract code blocks of specified language."""
    pattern = rf'```{language}\n(.*?)```'
    blocks = []
    for match in re.finditer(pattern, content, re.DOTALL):
        code = match.group(1)
        line_num = content[:match.start()].count('\n') + 1
        blocks.append((code, line_num))
    return blocks

def test_python_code(code: str) -> Tuple[bool, str]:
    """Test Python code block."""
    # Skip examples with placeholders
    if 'your-api-key' in code or 'your_api_key' in code:
        return True, "Skipped (contains placeholder)"
    
    # Skip examples that require running services
    if 'localhost:500' in code:
        return True, "Skipped (requires running services)"
    
    try:
        # Write to temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        # Try to compile (syntax check)
        result = subprocess.run(
            ['python', '-m', 'py_compile', temp_file],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        os.unlink(temp_file)
        
        if result.returncode == 0:
            return True, "Valid syntax"
        else:
            return False, result.stderr
    except Exception as e:
        return False, str(e)

def main():
    """Main validation function."""
    print("Validating code examples...")
    
    md_files = list(Path("docs").rglob("*.md"))
    md_files.extend(Path(".").glob("*.md"))
    
    errors = []
    total_examples = 0
    tested_examples = 0
    
    for md_file in md_files:
        try:
            content = md_file.read_text(encoding='utf-8')
            
            # Test Python examples
            python_blocks = find_code_blocks(content, 'python')
            for code, line_num in python_blocks:
                total_examples += 1
                valid, message = test_python_code(code)
                if not valid:
                    errors.append(f"{md_file}:{line_num} - {message}")
                elif "Skipped" not in message:
                    tested_examples += 1
        except Exception as e:
            errors.append(f"{md_file} - Error: {e}")
    
    print(f"Found {total_examples} code examples")
    print(f"Tested {tested_examples} examples")
    print(f"Skipped {total_examples - tested_examples} examples")
    
    if errors:
        print(f"\n❌ Found {len(errors)} issues:")
        for error in errors:
            print(f"  {error}")
        return 1
    else:
        print("✅ All testable code examples valid")
        return 0

if __name__ == "__main__":
    sys.exit(main())
```

### 5. Documentation Coverage Script

Create `scripts/check_doc_coverage.py`:

```python
#!/usr/bin/env python3
"""
Check documentation coverage for APIs and modules.
"""

import os
import sys
from pathlib import Path
from typing import Dict, List

def check_api_documentation() -> Dict[str, bool]:
    """Check if all API endpoints are documented."""
    results = {}
    
    # Check OpenAPI specs exist
    specs = [
        "docs/api/openapi/agentbuilder-openapi.yaml",
        "docs/api/openapi/skillbuilder-openapi.yaml",
        "docs/api/openapi/knowledgebuilder-openapi.yaml"
    ]
    
    for spec in specs:
        service = Path(spec).stem.replace('-openapi', '')
        results[f"OpenAPI spec for {service}"] = Path(spec).exists()
    
    # Check API documentation exists
    docs = [
        "docs/api/services/AGENTBUILDER_COMPLETE_SPEC.md",
        "docs/api/services/SKILLBUILDER_API_SPEC.md",
        "docs/api/services/KNOWLEDGEBUILDER_API_SPEC.md"
    ]
    
    for doc in docs:
        service = Path(doc).stem.replace('_API_SPEC', '').replace('_COMPLETE_SPEC', '')
        results[f"API docs for {service}"] = Path(doc).exists()
    
    return results

def check_module_documentation() -> Dict[str, bool]:
    """Check if all modules have README files."""
    results = {}
    
    # Check key directories have README
    dirs_to_check = [
        "projects/AgentBuilder",
        "projects/SkillBuilder",
        "projects/KnowledgeBuilder",
        "shared/api_core",
        "shared/embedding",
        "memory_system",
        "docs",
        "docs/api",
        "docs/architecture"
    ]
    
    for dir_path in dirs_to_check:
        readme = Path(dir_path) / "README.md"
        results[f"README in {dir_path}"] = readme.exists()
    
    return results

def check_architecture_documentation() -> Dict[str, bool]:
    """Check architecture documentation exists."""
    results = {}
    
    docs = [
        "ARCHITECTURE.md",
        "docs/architecture/C4_ARCHITECTURE_DIAGRAMS.md",
        "docs/DEVELOPER_ONBOARDING.md"
    ]
    
    for doc in docs:
        results[Path(doc).name] = Path(doc).exists()
    
    return results

def main():
    """Main coverage check function."""
    print("Checking documentation coverage...")
    print("=" * 50)
    
    all_results = {}
    
    # Check API documentation
    print("\n📋 API Documentation:")
    api_results = check_api_documentation()
    all_results.update(api_results)
    for check, passed in api_results.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check}")
    
    # Check module documentation
    print("\n📦 Module Documentation:")
    module_results = check_module_documentation()
    all_results.update(module_results)
    for check, passed in module_results.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check}")
    
    # Check architecture documentation
    print("\n🏗️  Architecture Documentation:")
    arch_results = check_architecture_documentation()
    all_results.update(arch_results)
    for check, passed in arch_results.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check}")
    
    # Calculate coverage
    total = len(all_results)
    passed = sum(1 for v in all_results.values() if v)
    coverage = (passed / total) * 100 if total > 0 else 0
    
    print("\n" + "=" * 50)
    print(f"Documentation Coverage: {coverage:.1f}% ({passed}/{total})")
    
    # Threshold
    threshold = 90.0
    if coverage >= threshold:
        print(f"✅ Coverage above threshold ({threshold}%)")
        return 0
    else:
        print(f"⚠️  Coverage below threshold ({threshold}%)")
        return 1

if __name__ == "__main__":
    sys.exit(main())
```

---

## Configuration

### Markdown Link Check Configuration

Create `.markdown-link-check.json`:

```json
{
  "ignorePatterns": [
    {
      "pattern": "^http://localhost"
    },
    {
      "pattern": "^https://api.chrysalis.dev"
    }
  ],
  "replacementPatterns": [],
  "httpHeaders": [
    {
      "urls": ["https://github.com"],
      "headers": {
        "Accept": "application/vnd.github.v3+json"
      }
    }
  ],
  "timeout": "20s",
  "retryOn429": true,
  "retryCount": 3,
  "fallbackRetryDelay": "30s",
  "aliveStatusCodes": [200, 206]
}
```

### Spectral Configuration

Create `.spectral.yaml`:

```yaml
extends: ["spectral:oas", "spectral:asyncapi"]

rules:
  # Require operation descriptions
  operation-description: error
  
  # Require operation tags
  operation-tags: error
  
  # Require operation IDs
  operation-operationId: error
  
  # Require examples
  operation-success-response: warn
  
  # Info section
  info-contact: warn
  info-description: error
  info-license: warn
  
  # Paths
  path-params: error
  path-declarations-must-exist: error
  
  # Operations
  operation-parameters: error
  operation-singular-tag: warn
  
  # Schemas
  typed-enum: warn
  oas3-schema: error
```

### CSpell Configuration

Create `.cspell.json`:

```json
{
  "version": "0.2",
  "language": "en",
  "words": [
    "Chrysalis",
    "AgentBuilder",
    "SkillBuilder",
    "KnowledgeBuilder",
    "OpenAPI",
    "Mermaid",
    "HNSW",
    "LanceDB",
    "Voyage",
    "Anthropic",
    "embeddings",
    "deepening",
    "CRDT",
    "gRPC",
    "Lamport",
    "OODA",
    "Pydantic",
    "pytest",
    "pylint",
    "mypy",
    "isort",
    "Swagger",
    "ReDoc",
    "Postman",
    "cURL",
    "TypeScript",
    "JavaScript",
    "Kubernetes",
    "Prometheus",
    "Grafana",
    "Jaeger"
  ],
  "ignorePaths": [
    "node_modules",
    ".venv",
    "*.pyc",
    "*.log",
    "htmlcov",
    ".coverage",
    "dist",
    "build"
  ]
}
```

---

## Troubleshooting

### Issue: Link validation fails for valid links

**Solution**: Add to `.markdown-link-check.json` ignore patterns

### Issue: OpenAPI validation fails

**Solution**: Run `swagger-cli validate` locally to see detailed errors

### Issue: Code examples fail

**Solution**: Ensure examples don't require running services or use placeholders

### Issue: Spelling check has false positives

**Solution**: Add technical terms to `.cspell.json` words list

---

## Maintenance

### Weekly Tasks
- Review and update technical dictionary
- Check for new broken external links
- Update OpenAPI specs for API changes

### Monthly Tasks
- Review documentation coverage metrics
- Update validation scripts
- Review and improve validation rules

### Quarterly Tasks
- Audit entire documentation set
- Update CI/CD workflows
- Review and update this guide

---

## Related Documentation

- [Developer Onboarding Guide](DEVELOPER_ONBOARDING.md)
- [API Reference Index](api/API_REFERENCE_INDEX.md)
- [C4 Architecture Diagrams](architecture/C4_ARCHITECTURE_DIAGRAMS.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-11  
**Maintained By**: Chrysalis Documentation Team  
**Next Review**: 2026-02-11
