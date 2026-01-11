# Testing Quick Start Guide

Get up and running with testing in 5 minutes.

## 1. Install Dependencies

```bash
cd ui
npm install
```

## 2. Verify Setup

```bash
# Check that vitest is installed
npm list vitest

# Run verification script
./verify-setup.sh
```

## 3. Run Tests

```bash
# Run all tests
npm test

# Watch mode (recommended for development)
npm run test:watch

# Interactive UI
npm run test:ui

# With coverage
npm run test:coverage
```

## 4. Write Your First Test

Create `src/components/MyComponent/__tests__/MyComponent.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## 5. Test with Context

```typescript
import { renderWithProviders } from '../../../test/test-utils';

describe('MyComponent', () => {
  it('should work with context', () => {
    renderWithProviders(<MyComponent />);
    // Your assertions...
  });
});
```

## 6. Test User Interactions

```typescript
import userEvent from '@testing-library/user-event';

it('should handle click', async () => {
  const user = userEvent.setup();
  render(<Button onClick={handleClick}>Click</Button>);
  
  await user.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalled();
});
```

## 7. Test Accessibility

```typescript
import { expectAccessible } from '../../../test/a11y-utils';

it('should be accessible', () => {
  const result = render(<MyComponent />);
  expectAccessible(result);
});
```

## Common Issues

### vitest: command not found

**Solution:** Run `npm install` in the ui directory

### Type errors in tests

**Solution:** Make sure `vitest/globals` is in tsconfig.json types

### Mocks not working

**Solution:** Check src/test/setup.ts is configured in vitest.config.ts

## Resources

- [Full Testing Guide](./src/test/README.md)
- [Accessibility Guide](../docs/accessibility-testing-guide.md)
- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/react)

## Help

If you encounter issues:
1. Check the [Testing Guide](./src/test/README.md)
2. Review test examples in `src/**/__tests__/`
3. See [PHASE_3_COMPLETION_REPORT](../docs/PHASE_3_COMPLETION_REPORT.md)

Happy Testing! 🧪