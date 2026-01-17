# Automated Quality Enforcement Guide

> **Purpose**: Configure and implement automated quality gates for the Chrysalis codebase  
> **Scope**: Static analysis, testing, CI/CD, and code quality metrics  
> **Status**: Implementation Guide

---

## Executive Summary

This document defines the automated quality enforcement infrastructure for Chrysalis. The goal is to **catch type safety, security, and quality issues before they reach the main branch** through a combination of:

1. **Pre-commit hooks** - Local enforcement before commits
2. **CI/CD pipelines** - Automated checks on pull requests
3. **Static analysis** - Type checking, linting, security scanning
4. **Test automation** - Unit, integration, and end-to-end tests
5. **Quality metrics** - Coverage, complexity, dependency audits

---

## Table of Contents

1. [Pre-commit Configuration](#1-pre-commit-configuration)
2. [TypeScript Quality Gates](#2-typescript-quality-gates)
3. [Python Quality Gates](#3-python-quality-gates)
4. [Rust Quality Gates](#4-rust-quality-gates)
5. [CI/CD Pipeline Configuration](#5-cicd-pipeline-configuration)
6. [Security Scanning](#6-security-scanning)
7. [Quality Metrics Dashboard](#7-quality-metrics-dashboard)
8. [Implementation Checklist](#8-implementation-checklist)

---

## 1. Pre-commit Configuration

### 1.1 Install Pre-commit Framework

```bash
# Install pre-commit (already in project)
pip install pre-commit

# Install hooks
pre-commit install
pre-commit install --hook-type commit-msg
```

### 1.2 Updated Pre-commit Configuration

```yaml
# .pre-commit-config.yaml
repos:
  # ==========
  # GENERAL
  # ==========
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
      - id: check-toml
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-merge-conflict
      - id: detect-private-key
      - id: no-commit-to-branch
        args: ['--branch', 'main']

  # ==========
  # TYPESCRIPT
  # ==========
  - repo: local
    hooks:
      - id: typescript-check
        name: TypeScript Type Check
        entry: npx tsc --noEmit
        language: system
        types: [ts, tsx]
        pass_filenames: false
        
      - id: eslint
        name: ESLint
        entry: npx eslint --max-warnings=0
        language: system
        types: [ts, tsx]
        
      - id: prettier-ts
        name: Prettier (TypeScript)
        entry: npx prettier --check
        language: system
        types: [ts, tsx, json]

  # ==========
  # PYTHON
  # ==========
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.9
    hooks:
      - id: ruff
        args: ['--fix']
      - id: ruff-format

  - repo: local
    hooks:
      - id: mypy
        name: mypy Type Check
        entry: mypy --strict
        language: system
        types: [python]
        files: ^(memory_system|shared)/
        pass_filenames: false

  # ==========
  # RUST
  # ==========
  - repo: local
    hooks:
      - id: cargo-check
        name: Cargo Check
        entry: cargo check --workspace
        language: system
        files: \.rs$
        pass_filenames: false
        
      - id: cargo-clippy
        name: Clippy
        entry: cargo clippy --workspace -- -D warnings
        language: system
        files: \.rs$
        pass_filenames: false
        
      - id: cargo-fmt
        name: Rustfmt
        entry: cargo fmt --all -- --check
        language: system
        files: \.rs$
        pass_filenames: false

  # ==========
  # SECURITY
  # ==========
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']

  - repo: local
    hooks:
      - id: npm-audit
        name: npm audit
        entry: npm audit --audit-level=high
        language: system
        files: package\.json$
        pass_filenames: false

# Commit message format enforcement
  - repo: https://github.com/commitizen-tools/commitizen
    rev: v3.13.0
    hooks:
      - id: commitizen
        stages: [commit-msg]
```

---

## 2. TypeScript Quality Gates

### 2.1 TSConfig - Strict Mode

```json
// tsconfig.json
{
  "compilerOptions": {
    // Strict type checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    
    // Additional checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    
    // Module resolution
    "moduleResolution": "node",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    
    // Output
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    
    // Target
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "commonjs"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 2.2 ESLint Configuration

```javascript
// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    plugins: {
      security,
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      // Type safety - CRITICAL
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      
      // Strictness
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      
      // Code quality
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      
      // Security
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      
      // Disabled for migration period
      // '@typescript-eslint/no-explicit-any': 'off', // Enable after migration
    },
  },
  {
    // Relaxed rules for test files
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
```

### 2.3 Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
    // Stricter thresholds for critical modules
    './src/security/**/*.ts': {
      branches: 90,
      functions: 90,
      lines: 95,
      statements: 95,
    },
    './src/converter/**/*.ts': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
```

---

## 3. Python Quality Gates

### 3.1 Pyproject.toml Configuration

```toml
# pyproject.toml

[project]
name = "chrysalis-memory"
version = "0.1.0"
requires-python = ">=3.11"

[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_configs = true
warn_redundant_casts = true
warn_unused_ignores = true
no_implicit_optional = true
check_untyped_defs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
disallow_untyped_decorators = true
disallow_any_explicit = true
disallow_any_generics = true
disallow_subclassing_any = true

# Per-module overrides for gradual migration
[[tool.mypy.overrides]]
module = "memory_system.hooks.*"
disallow_any_explicit = false

[[tool.mypy.overrides]]
module = "memory_system.fireproof.*"
disallow_any_explicit = false

[tool.ruff]
target-version = "py311"
line-length = 100
select = [
    "E",      # pycodestyle errors
    "W",      # pycodestyle warnings
    "F",      # Pyflakes
    "I",      # isort
    "B",      # flake8-bugbear
    "C4",     # flake8-comprehensions
    "UP",     # pyupgrade
    "ARG",    # flake8-unused-arguments
    "SIM",    # flake8-simplify
    "TCH",    # flake8-type-checking
    "PTH",    # flake8-use-pathlib
    "ERA",    # eradicate (commented code)
    "PL",     # Pylint
    "RUF",    # Ruff-specific rules
    "S",      # flake8-bandit (security)
    "ANN",    # flake8-annotations
]
ignore = [
    "ANN101",  # Missing type annotation for self
    "ANN102",  # Missing type annotation for cls
    "PLR0913", # Too many arguments (allow for now)
]

[tool.ruff.per-file-ignores]
"**/tests/**" = ["S101", "ANN"]  # Allow asserts in tests

[tool.pytest.ini_options]
minversion = "7.0"
addopts = "-ra -q --strict-markers --strict-config"
testpaths = ["memory_system/tests", "shared/api_core/tests"]
filterwarnings = [
    "error",
    "ignore::DeprecationWarning",
]

[tool.coverage.run]
branch = true
source = ["memory_system", "shared"]
omit = ["**/tests/**", "**/__pycache__/**"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise NotImplementedError",
    "if TYPE_CHECKING:",
    "if __name__ == .__main__.:",
]
fail_under = 75
show_missing = true
```

### 3.2 Safety and Security Checks

```bash
# Install security tools
pip install safety bandit pip-audit

# Check for known vulnerabilities
safety check --full-report

# Static security analysis
bandit -r memory_system shared -ll

# Audit pip packages
pip-audit
```

---

## 4. Rust Quality Gates

### 4.1 Clippy Configuration

```toml
# src/native/clippy.toml
cognitive-complexity-threshold = 25
too-many-arguments-threshold = 7
type-complexity-threshold = 250
```

```toml
# src/native/Cargo.toml

[workspace.lints.rust]
unsafe_code = "forbid"
missing_docs = "warn"

[workspace.lints.clippy]
# Strictness
all = "warn"
pedantic = "warn"
nursery = "warn"
cargo = "warn"

# Critical - deny these
unwrap_used = "deny"
expect_used = "deny"  
panic = "deny"
todo = "deny"
unimplemented = "deny"
unreachable = "deny"

# Security
cast_possible_truncation = "warn"
cast_sign_loss = "warn"
cast_possible_wrap = "warn"
integer_arithmetic = "warn"

# Performance
inefficient_to_string = "warn"
redundant_clone = "warn"
unnecessary_box_returns = "warn"

# Style (allow some)
module_name_repetitions = "allow"
must_use_candidate = "allow"
missing_errors_doc = "allow"
```

### 4.2 Rust Test Configuration

```toml
# src/native/Cargo.toml

[profile.test]
opt-level = 0
debug = true

[profile.bench]
opt-level = 3
lto = true

# Test dependencies
[workspace.dependencies]
proptest = "1.4"
quickcheck = "1.0"
criterion = "0.5"
```

```rust
// src/native/rust-crypto/tests/property_tests.rs
use proptest::prelude::*;

proptest! {
    #[test]
    fn encrypt_decrypt_roundtrip(plaintext: Vec<u8>, key: [u8; 32]) {
        let ciphertext = encrypt(&plaintext, &key)?;
        let decrypted = decrypt(&ciphertext, &key)?;
        prop_assert_eq!(plaintext, decrypted);
    }
}
```

---

## 5. CI/CD Pipeline Configuration

### 5.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: Continuous Integration

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  CARGO_TERM_COLOR: always
  NODE_VERSION: '20'
  PYTHON_VERSION: '3.11'
  RUST_VERSION: 'stable'

jobs:
  # ==========
  # TypeScript
  # ==========
  typescript:
    name: TypeScript Quality Gates
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npx tsc --noEmit
      
      - name: Lint
        run: npx eslint src --max-warnings=0
      
      - name: Format check
        run: npx prettier --check "src/**/*.ts"
      
      - name: Test
        run: npm test -- --coverage --coverageReporters=lcov
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: typescript
          fail_ci_if_error: true

  # ==========
  # Python
  # ==========
  python:
    name: Python Quality Gates
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          pip install -e ./memory_system[dev]
          pip install mypy ruff pytest pytest-cov safety bandit
      
      - name: Type check (mypy)
        run: mypy memory_system shared --strict
      
      - name: Lint (ruff)
        run: ruff check memory_system shared
      
      - name: Format check (ruff)
        run: ruff format --check memory_system shared
      
      - name: Security check (bandit)
        run: bandit -r memory_system shared -ll
      
      - name: Dependency audit
        run: safety check
      
      - name: Test
        run: pytest --cov=memory_system --cov=shared --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
          flags: python
          fail_ci_if_error: true

  # ==========
  # Rust
  # ==========
  rust:
    name: Rust Quality Gates
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/native
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt
          targets: wasm32-unknown-unknown
      
      - name: Cache cargo
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src/native
      
      - name: Check
        run: cargo check --workspace --all-targets
      
      - name: Clippy
        run: cargo clippy --workspace --all-targets -- -D warnings
      
      - name: Format
        run: cargo fmt --all -- --check
      
      - name: Test
        run: cargo test --workspace
      
      - name: Build WASM
        run: |
          cargo install wasm-pack
          cd rust-crypto && wasm-pack build --target web
      
      - name: Security audit
        run: |
          cargo install cargo-audit
          cargo audit

  # ==========
  # Integration
  # ==========
  integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: [typescript, python, rust]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup all runtimes
        run: |
          # Setup commands for all languages
          
      - name: Build all modules
        run: |
          npm ci
          npm run build
          cd src/native && cargo build --release
      
      - name: Run integration tests
        run: npm run test:integration
      
  # ==========
  # Security Scan
  # ==========
  security:
    name: Security Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: npm audit
        run: npm audit --audit-level=high
        
      - name: Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
      
      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          languages: typescript, python

  # ==========
  # Quality Gate
  # ==========
  quality-gate:
    name: Quality Gate
    runs-on: ubuntu-latest
    needs: [typescript, python, rust, integration, security]
    steps:
      - name: All checks passed
        run: echo "All quality gates passed!"
```

### 5.2 Branch Protection Rules

Configure in GitHub repository settings:

```yaml
# Branch protection for 'main'
protection_rules:
  main:
    required_status_checks:
      strict: true
      contexts:
        - "TypeScript Quality Gates"
        - "Python Quality Gates"
        - "Rust Quality Gates"
        - "Integration Tests"
        - "Security Scanning"
        - "Quality Gate"
    enforce_admins: true
    required_pull_request_reviews:
      required_approving_review_count: 1
      dismiss_stale_reviews: true
      require_code_owner_reviews: true
    restrictions: null
    required_linear_history: true
    allow_force_pushes: false
    allow_deletions: false
```

---

## 6. Security Scanning

### 6.1 Secret Scanning

```bash
# Generate baseline (run once)
detect-secrets scan > .secrets.baseline

# Check for new secrets
detect-secrets scan --baseline .secrets.baseline
```

### 6.2 Dependency Scanning

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "javascript"
    
  - package-ecosystem: "pip"
    directory: "/memory_system"
    schedule:
      interval: "weekly"
    labels:
      - "dependencies"
      - "python"
    
  - package-ecosystem: "cargo"
    directory: "/src/native"
    schedule:
      interval: "weekly"
    labels:
      - "dependencies"
      - "rust"
```

### 6.3 SAST (Static Application Security Testing)

```yaml
# CodeQL configuration
# .github/codeql/codeql-config.yml
name: "Chrysalis Security Analysis"

queries:
  - uses: security-and-quality
  - uses: security-extended

paths-ignore:
  - node_modules
  - dist
  - coverage
  - "**/*.test.ts"
```

---

## 7. Quality Metrics Dashboard

### 7.1 Codecov Configuration

```yaml
# codecov.yml
codecov:
  require_ci_to_pass: yes

coverage:
  precision: 2
  round: down
  range: "70...100"
  
  status:
    project:
      default:
        target: 80%
        threshold: 2%
    patch:
      default:
        target: 90%
        threshold: 5%

flags:
  typescript:
    paths:
      - src/
    carryforward: true
  python:
    paths:
      - memory_system/
      - shared/
    carryforward: true
  rust:
    paths:
      - src/native/
    carryforward: true

comment:
  layout: "reach,diff,flags,files"
  behavior: default
  require_changes: true
```

### 7.2 SonarQube Configuration (Optional)

```properties
# sonar-project.properties
sonar.projectKey=chrysalis
sonar.projectName=Chrysalis
sonar.projectVersion=1.0

sonar.sources=src,memory_system,shared
sonar.tests=src/**/__tests__,memory_system/tests

sonar.typescript.lcov.reportPaths=coverage/lcov.info
sonar.python.coverage.reportPaths=coverage.xml

sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**

# Quality gates
sonar.qualitygate.wait=true
```

---

## 8. Implementation Checklist

### Immediate (Week 1)
- [ ] Update `.pre-commit-config.yaml` with new hooks
- [ ] Update `tsconfig.json` with strict settings
- [ ] Create `eslint.config.mjs` with type rules
- [ ] Update `pyproject.toml` with mypy strict settings
- [ ] Run initial audit: `npm audit`, `safety check`, `cargo audit`

### Short-term (Week 2-3)
- [ ] Create `.github/workflows/ci.yml`
- [ ] Configure branch protection rules
- [ ] Setup Codecov integration
- [ ] Configure Dependabot
- [ ] Create `.secrets.baseline`

### Medium-term (Week 4-6)
- [ ] Enable strict type checking incrementally
- [ ] Add missing test coverage
- [ ] Configure SonarQube (optional)
- [ ] Document quality gate requirements
- [ ] Train team on new tools

### Validation
- [ ] All pre-commit hooks pass locally
- [ ] CI pipeline completes successfully
- [ ] Coverage thresholds met
- [ ] No high/critical security vulnerabilities
- [ ] Dependabot PRs reviewed weekly

---

## Appendix: Quick Commands

```bash
# Run all local checks
npm run lint && npm run type-check && npm test
mypy memory_system shared --strict
cd src/native && cargo clippy && cargo test

# Pre-commit on all files
pre-commit run --all-files

# Security scan
npm audit --audit-level=high
safety check
bandit -r memory_system shared -ll
cargo audit

# Coverage report
npm test -- --coverage
pytest --cov=memory_system --cov-report=html
cargo tarpaulin --workspace
```

---

*This guide establishes automated quality enforcement to maintain code quality as the codebase evolves. Regular updates to thresholds and rules are expected as the team matures.*
