# Code Quality Standards

**Version**: 1.0.0
**Last Updated**: 2025-01-XX
**Status**: Current

## Overview

This document outlines code quality standards and tools for the Chrysalis project. Following the complex learner pattern, code quality tools serve as learning interfaces that help the system understand code patterns, identify issues, and improve over time.

## Code Quality Philosophy

### Complex Learner Pattern Applied to Code Quality

Code quality follows the complex learner pattern principles:

1. **Discovery**: Tools discover code patterns and issues
2. **Investigation**: Tools investigate code quality, style, and correctness
3. **Synthesis**: Tools synthesize insights about code quality
4. **Reporting**: Tools report findings that help the system improve

### Quality Principles

- **Pattern-Based**: Quality standards based on universal patterns
- **Learning-First**: Quality tools serve as learning interfaces
- **Progressive Refinement**: Quality standards evolve with the system
- **Quality over Speed**: Comprehensive quality checks, no shortcuts

## Python Code Quality

### Linting: flake8

**Tool**: `flake8`

**Configuration**: `.flake8` (if present) or `setup.cfg`

**Usage**:

```bash
# Run flake8
flake8 shared/api_core/

# Run with specific rules
flake8 --select=E9,F63,F7,F82 shared/api_core/

# Run with max complexity
flake8 --max-complexity=10 shared/api_core/
```

**Standards**:
- Maximum line length: 127 characters (configurable)
- Maximum complexity: 10 (configurable)
- Follow PEP 8 style guide
- Use flake8 plugins for additional checks

### Formatting: black

**Tool**: `black`

**Configuration**: `pyproject.toml` or command-line options

**Usage**:

```bash
# Format code
black shared/api_core/

# Check formatting (no changes)
black --check shared/api_core/

# Format with line length
black --line-length 127 shared/api_core/
```

**Standards**:
- Line length: 127 characters (default: 88)
- String quotes: Double quotes (default)
- Trailing commas: Yes (default)

### Type Checking: mypy

**Tool**: `mypy`

**Configuration**: `mypy.ini` or `pyproject.toml`

**Usage**:

```bash
# Type check
mypy shared/api_core/

# Type check with strict mode
mypy --strict shared/api_core/

# Type check with ignore missing imports
mypy --ignore-missing-imports shared/api_core/
```

**Standards**:
- Type annotations for all public APIs
- Type hints for function parameters and return types
- Use `typing` module for complex types
- Use `Optional` for nullable types
- Use `Union` for multiple types

### Additional Python Tools

- **isort**: Import sorting
- **pydocstyle**: Docstring style checking
- **bandit**: Security linting
- **safety**: Dependency vulnerability checking

## TypeScript Code Quality

### Linting: ESLint

**Tool**: `eslint`

**Configuration**: `.eslintrc.js` or `eslint.config.js`

**Usage**:

```bash
# Run ESLint
npm run lint

# Fix automatically
npm run lint:fix

# Run with specific rules
eslint --ext .ts,.tsx src/
```

**Standards**:
- Use TypeScript ESLint rules
- Follow recommended configurations
- Custom rules for project-specific patterns
- Enable strict mode

### Formatting: Prettier

**Tool**: `prettier`

**Configuration**: `.prettierrc` or `prettier.config.js`

**Usage**:

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

**Standards**:
- Line length: 100 characters
- Use semicolons
- Single quotes for strings
- Trailing commas: Yes

### Type Checking: TypeScript Compiler

**Tool**: `tsc`

**Configuration**: `tsconfig.json`

**Usage**:

```bash
# Type check
npm run type-check

# Type check with build
npm run build
```

**Standards**:
- Strict mode enabled
- No implicit any
- Strict null checks
- Strict function types
- No unused locals/parameters

## Code Quality Tools Configuration

### Python: pyproject.toml

```toml
[tool.black]
line-length = 127
target-version = ['py310', 'py311', 'py312']

[tool.isort]
profile = "black"
line_length = 127

[tool.mypy]
python_version = "3.10"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = false
ignore_missing_imports = true

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
markers = [
    "unit: marks tests as unit tests",
    "integration: marks tests as integration tests",
    "e2e: marks tests as end-to-end tests",
]
```

### TypeScript: tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Pre-commit Hooks

### Setup with pre-commit

**Tool**: `pre-commit`

**Configuration**: `.pre-commit-config.yaml`

**Usage**:

```bash
# Install pre-commit hooks
pre-commit install

# Run hooks manually
pre-commit run --all-files
```

**Hooks**:
- `black`: Format Python code
- `flake8`: Lint Python code
- `mypy`: Type check Python code
- `eslint`: Lint TypeScript code
- `prettier`: Format TypeScript code
- `trailing-whitespace`: Remove trailing whitespace
- `end-of-file-fixer`: Ensure files end with newline

## CI/CD Integration

Code quality checks run automatically in CI/CD:

- **On Pull Request**: All quality checks run
- **On Push to Main**: All quality checks + coverage
- **On Commit**: Pre-commit hooks run (if configured)

See `.github/workflows/ci.yml` for CI configuration.

## Quality Gates

### Minimum Quality Standards

- **Linting**: No errors, warnings acceptable with justification
- **Formatting**: All code formatted with black/prettier
- **Type Checking**: No type errors (warnings acceptable)
- **Coverage**: 80%+ code coverage
- **Security**: No high/critical vulnerabilities

### Quality Gate Checklist

Before merge:

- [ ] All linting checks pass
- [ ] All formatting checks pass
- [ ] All type checks pass
- [ ] Code coverage >80%
- [ ] No security vulnerabilities
- [ ] All tests pass
- [ ] Documentation updated

## Code Review Quality Standards

### Review Checklist

- **Code Style**: Follows project style guide
- **Type Safety**: Proper type annotations/hints
- **Error Handling**: Comprehensive error handling
- **Testing**: Adequate test coverage
- **Documentation**: Updated documentation
- **Performance**: No performance regressions
- **Security**: No security issues
- **Accessibility**: Accessibility considered (if applicable)

## Best Practices

1. **Run Quality Checks Locally**: Run checks before committing
2. **Fix Issues Immediately**: Don't accumulate technical debt
3. **Use IDE Integration**: Configure IDE for real-time feedback
4. **Review Quality Reports**: Understand quality issues and fixes
5. **Continuous Improvement**: Update quality standards as needed

## Quality Tools Setup

### Python Setup

```bash
# Install quality tools
pip install black flake8 mypy isort pydocstyle bandit safety

# Install pre-commit
pip install pre-commit
pre-commit install
```

### TypeScript Setup

```bash
# Install quality tools (via npm)
npm install --save-dev eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser

# Install pre-commit hooks
npm install --save-dev husky lint-staged
```

## IDE Integration

### VS Code

- **Python**: Python extension with Pylance, black formatter
- **TypeScript**: ESLint extension, Prettier extension
- **Settings**: Configure format on save, lint on save

### PyCharm

- **Python**: Built-in type checking, code inspection
- **Formatting**: Configure black as external tool
- **Linting**: Configure flake8 as external tool

## Future Enhancements

- **SonarQube Integration**: Advanced code quality analysis
- **Code Climate**: Automated code review
- **DeepCode**: AI-powered code review
- **Mutation Testing**: Test quality assurance
- **Static Analysis**: Advanced static analysis tools

## References

- [PEP 8 Style Guide](https://pep8.org/)
- [black Documentation](https://black.readthedocs.io/)
- [mypy Documentation](https://mypy.readthedocs.io/)
- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)
- [Complex Learner Pattern](AGENT.md)
