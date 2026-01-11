# Testing Strategy

**Version**: 1.0.0
**Last Updated**: 2025-01-XX
**Status**: Current

## Overview

This document outlines the comprehensive testing strategy for the Chrysalis project. Following the complex learner pattern, testing serves as a learning interface that helps the system understand its own behavior, identify patterns, and improve over time.

## Testing Philosophy

### Complex Learner Pattern Applied to Testing

Testing follows the complex learner pattern principles:

1. **Discovery**: Tests discover system behavior through exploration
2. **Investigation**: Tests investigate patterns, relationships, and edge cases
3. **Synthesis**: Tests synthesize insights about system correctness
4. **Reporting**: Tests report findings that help the system improve

### Testing Principles

- **Pattern-Based**: Tests verify universal patterns and their interactions
- **Learning-First**: Tests serve as documentation and learning tools
- **Progressive Refinement**: Tests evolve with the system, becoming more sophisticated
- **Quality over Speed**: Comprehensive testing, no shortcuts

## Testing Pyramid

```
                    ┌─────────────┐
                    │   E2E Tests │  Few, high-level
                    │   (10-20%)  │
                    └─────────────┘
                  ┌─────────────────┐
                  │ Integration     │  Moderate
                  │ Tests (30-40%)  │
                  └─────────────────┘
              ┌───────────────────────┐
              │   Unit Tests          │  Many, fast
              │   (40-60%)            │
              └───────────────────────┘
```

### Distribution

- **Unit Tests**: 40-60% of tests
  - Fast, isolated, test individual functions/classes
  - High coverage, fast execution
  - Mock external dependencies

- **Integration Tests**: 30-40% of tests
  - Test component interactions
  - Use real dependencies where possible
  - Test API endpoints, database interactions

- **End-to-End Tests**: 10-20% of tests
  - Test complete workflows
  - Use real services and databases
  - Verify system behavior from user perspective

## Test Types

### 1. Unit Tests

**Purpose**: Test individual functions, classes, and methods in isolation.

**Scope**:
- Business logic functions
- Utility functions
- Model classes
- Helper functions

**Tools**:
- **Python**: `pytest` with `pytest-cov`
- **TypeScript**: `jest` with `ts-jest`

**Example**:

```python
# tests/test_models.py
import pytest
from shared.api_core.models import APIResponse, APIError

def test_api_response_success():
    response = APIResponse.success_response({"data": "value"})
    assert response.success is True
    assert response.data == {"data": "value"}
    assert response.error is None

def test_api_error_creation():
    error = APIError(
        code="RESOURCE_NOT_FOUND",
        message="Resource not found",
        category="NOT_FOUND_ERROR"
    )
    assert error.code == "RESOURCE_NOT_FOUND"
    assert error.message == "Resource not found"
```

### 2. Integration Tests

**Purpose**: Test component interactions and API endpoints.

**Scope**:
- API endpoint testing
- Service integration
- Database interactions
- Middleware behavior

**Tools**:
- **Python**: `pytest` with Flask test client
- **TypeScript**: `jest` with supertest or fetch-mock

**Example**:

```python
# tests/test_api_integration.py
import pytest
from shared.api_core.test_utils import create_test_app_with_auth_bypass

@pytest.fixture
def client():
    app = create_test_app_with_auth_bypass()
    return app.test_client()

def test_health_endpoint(client):
    response = client.get('/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert 'status' in data['data']

def test_authenticated_endpoint(client):
    response = client.get(
        '/api/v1/protected',
        headers={'Authorization': 'Bearer test-token'}
    )
    assert response.status_code == 200
```

### 3. End-to-End Tests

**Purpose**: Test complete workflows from user perspective.

**Scope**:
- Complete user workflows
- Multi-service interactions
- Real database and services
- Error scenarios

**Tools**:
- **Python**: `pytest` with real services
- **TypeScript**: `jest` with real services
- **E2E Tools**: Playwright, Cypress (for UI)

**Example**:

```python
# tests/test_e2e_workflow.py
import pytest
import requests

@pytest.fixture(scope="module")
def services():
    # Start services
    agent_builder = start_service("AgentBuilder")
    knowledge_builder = start_service("KnowledgeBuilder")
    skill_builder = start_service("SkillBuilder")
    yield {
        "agent_builder": agent_builder,
        "knowledge_builder": knowledge_builder,
        "skill_builder": skill_builder,
    }
    # Cleanup
    stop_services()

def test_create_agent_workflow(services):
    # Create agent
    response = requests.post(
        f"{services['agent_builder']}/api/v1/agents",
        json={
            "agent_id": "test-agent",
            "role_model": {"name": "Test", "occupation": "Engineer"}
        },
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 201

    # Verify agent created
    response = requests.get(
        f"{services['agent_builder']}/api/v1/agents/test-agent",
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 200
```

### 4. Property-Based Tests

**Purpose**: Test properties and invariants that should hold for all inputs.

**Tools**:
- **Python**: `hypothesis`
- **TypeScript**: `fast-check`

**Example**:

```python
# tests/test_property.py
from hypothesis import given, strategies as st
from shared.api_core.models import APIResponse

@given(st.dictionaries(st.text(), st.text()))
def test_api_response_always_has_success(data):
    response = APIResponse.success_response(data)
    assert response.success is True
    assert isinstance(response.success, bool)
```

### 5. Performance Tests

**Purpose**: Test system performance and identify bottlenecks.

**Scope**:
- Response time requirements
- Throughput requirements
- Resource usage
- Load testing

**Tools**:
- **Python**: `pytest-benchmark`, `locust`
- **TypeScript**: `autocannon`, `artillery`

**Example**:

```python
# tests/test_performance.py
import pytest

def test_endpoint_performance(benchmark, client):
    result = benchmark(client.get, '/api/v1/endpoint')
    assert result.status_code == 200
    # Assert response time < threshold
    assert benchmark.stats.mean < 0.1  # 100ms
```

## Test Organization

### Directory Structure

```
tests/
├── unit/                    # Unit tests
│   ├── test_models.py
│   ├── test_utils.py
│   └── test_validators.py
├── integration/             # Integration tests
│   ├── test_api.py
│   ├── test_middleware.py
│   └── test_services.py
├── e2e/                     # End-to-end tests
│   ├── test_workflows.py
│   └── test_scenarios.py
├── fixtures/                # Test fixtures
│   ├── conftest.py
│   └── factories.py
└── utils/                   # Test utilities
    └── helpers.py

shared/api_core/tests/       # Shared API core tests
├── test_models.py
├── test_middleware.py
├── test_monitoring.py
└── test_utils.py
```

### Naming Conventions

- **Test Files**: `test_*.py` or `*_test.py`
- **Test Classes**: `Test*`
- **Test Functions**: `test_*`
- **Fixtures**: `*_fixture` or in `conftest.py`

## Test Utilities and Fixtures

### Shared Test Utilities

Located in `shared/api_core/test_utils.py`:

- `MockRequest`: Mock Flask request
- `MockResponse`: Mock Flask response
- `create_mock_auth_context`: Create mock auth context
- `mock_authenticate_request`: Mock authentication
- `AuthenticationFixture`: Authentication test fixture
- `pytest_auth_fixture`: Pytest authentication fixture
- `create_test_app_with_auth_bypass`: Create test Flask app

### Common Fixtures

```python
# tests/fixtures/conftest.py
import pytest
from flask import Flask
from shared.api_core import create_all_middleware

@pytest.fixture
def app():
    app = Flask(__name__)
    app.config['TESTING'] = True
    create_all_middleware(app, api_version="v1")
    return app

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def auth_token():
    return "test-auth-token"

@pytest.fixture
def authenticated_client(client, auth_token):
    client.environ_base['HTTP_AUTHORIZATION'] = f'Bearer {auth_token}'
    return client
```

## Coverage Goals

### Target Coverage

- **Overall**: 80%+ code coverage
- **Critical Paths**: 95%+ coverage
- **Shared Libraries**: 90%+ coverage
- **Services**: 80%+ coverage

### Coverage Exclusions

- Migration scripts
- CLI entry points
- Example code
- Test code
- Generated code

### Coverage Tools

- **Python**: `pytest-cov` with coverage.py
- **TypeScript**: `jest` with `--coverage`

## Running Tests

### Python Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=shared/api_core --cov-report=html

# Run specific test file
pytest tests/test_models.py

# Run with verbose output
pytest -v

# Run with specific markers
pytest -m unit
pytest -m integration
```

### TypeScript Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- test_file.test.ts
```

## Continuous Integration

Tests run automatically in CI/CD:

- **On Pull Request**: All tests run
- **On Push to Main**: All tests + coverage
- **Nightly**: Full test suite + performance tests

See `.github/workflows/ci.yml` for CI configuration.

## Test Maintenance

### When to Add Tests

- **New Features**: Always add tests
- **Bug Fixes**: Add regression tests
- **Refactoring**: Update existing tests
- **Code Review**: Review test coverage

### When to Update Tests

- **API Changes**: Update tests to match
- **Behavior Changes**: Update tests to reflect
- **Test Failures**: Fix tests or code
- **Coverage Gaps**: Add missing tests

## Best Practices

1. **Test Naming**: Use descriptive names that explain what is tested
2. **Test Isolation**: Tests should not depend on each other
3. **Fast Tests**: Unit tests should be fast (<100ms each)
4. **Deterministic**: Tests should produce consistent results
5. **Clean Setup/Teardown**: Use fixtures for setup and teardown
6. **Mock External Dependencies**: Don't rely on external services
7. **Test Edge Cases**: Test boundary conditions and error cases
8. **Test Documentation**: Use docstrings to explain test purpose

## Testing Anti-Patterns

1. **God Tests**: Tests that test too much
2. **Brittle Tests**: Tests that break on unrelated changes
3. **Slow Tests**: Tests that take too long to run
4. **Flaky Tests**: Tests that sometimes pass, sometimes fail
5. **No Tests**: Code without tests
6. **Duplicate Tests**: Tests that test the same thing

## Future Enhancements

- **Property-Based Testing**: Expand use of hypothesis/fast-check
- **Mutation Testing**: Add mutation testing for quality assurance
- **Contract Testing**: Add contract testing for API compatibility
- **Visual Regression Testing**: Add visual regression tests for UI
- **Chaos Engineering**: Add chaos engineering tests for resilience

## References

- [pytest Documentation](https://docs.pytest.org/)
- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Complex Learner Pattern](AGENT.md)
