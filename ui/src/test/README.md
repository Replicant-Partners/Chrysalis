# Testing Guide

This directory contains testing utilities and configuration for the Chrysalis Terminal UI.

## Test Structure

```
ui/
├── vitest.config.ts          # Vitest configuration
├── src/
│   ├── test/
│   │   ├── setup.ts          # Global test setup
│   │   ├── test-utils.tsx    # Custom render functions
│   │   └── README.md         # This file
│   ├── components/
│   │   └── **/__tests__/     # Component tests
│   └── utils/
│       └── __tests__/         # Utility tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck
```

## Writing Tests

### Component Tests

Use the custom render functions from `test-utils.tsx`:

```typescript
import { renderWithProviders } from '../../test/test-utils';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Testing with Context

```typescript
// With all providers
renderWithProviders(<Component />);

// With VoyeurProvider only
renderWithVoyeur(<Component />);

// With WalletProvider only
renderWithWallet(<Component />);
```

### Testing User Interactions

```typescript
import userEvent from '@testing-library/user-event';

it('should handle click', async () => {
  const user = userEvent.setup();
  renderWithProviders(<Button onClick={handleClick}>Click</Button>);
  
  await user.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalled();
});
```

### Testing Async Operations

```typescript
import { waitFor } from '@testing-library/react';

it('should load data', async () => {
  renderWithProviders(<AsyncComponent />);
  
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

## Test Utilities

### MockEventSource

For testing SSE connections:

```typescript
import { MockEventSource } from '../../test/test-utils';

const mockEventSource = new MockEventSource('http://localhost:8787/stream');
mockEventSource.simulateOpen();
mockEventSource.simulateMessage({ kind: 'test', timestamp: '...' });
mockEventSource.simulateError();
```

### createMockCrypto

For testing encryption utilities:

```typescript
import { createMockCrypto } from '../../test/test-utils';

beforeEach(() => {
  vi.stubGlobal('crypto', createMockCrypto());
});
```

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what users see and interact with
   - Avoid testing internal state or implementation details

2. **Use Semantic Queries**
   - Prefer `getByRole`, `getByLabelText`, `getByText`
   - Avoid `getByTestId` unless necessary

3. **Test Accessibility**
   - Ensure components have proper ARIA labels
   - Test keyboard navigation
   - Verify screen reader compatibility

4. **Keep Tests Simple**
   - One assertion per test when possible
   - Clear test descriptions
   - Minimal setup and teardown

5. **Mock External Dependencies**
   - Mock API calls
   - Mock browser APIs (EventSource, crypto, localStorage)
   - Use test utilities for complex setups

## Coverage Goals

- **Statements:** 70%
- **Branches:** 70%
- **Functions:** 70%
- **Lines:** 70%

Priority areas for coverage:
- Core utilities (WalletCrypto, VoyeurBusClient)
- Design system components
- Context providers
- Critical user flows

## Debugging Tests

```bash
# Run specific test file
npm test -- VoyeurPane.test.tsx

# Run tests matching pattern
npm test -- --grep "Button"

# Run in debug mode
node --inspect-brk ./node_modules/vitest/vitest.mjs
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-commit hooks (optional)

Required checks:
- ✅ All tests pass
- ✅ Coverage meets thresholds
- ✅ Type checking passes
- ✅ Linting passes

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Accessibility Testing](https://www.a11yproject.com/)