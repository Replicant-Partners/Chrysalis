# Development Guide

**Version:** 1.0.0  
**Last Updated:** January 10, 2026  
**For:** Chrysalis Terminal UI Developers

This guide describes the development workflow, best practices, and conventions for working on the Chrysalis Terminal UI.

---

## Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0
- **Git**
- **VS Code** (recommended)

---

## Setup

### 1. Clone Repository

```bash
git clone https://github.com/Replicant-Partners/Chrysalis.git
cd Chrysalis/ui
```

### 2. Install Dependencies

```bash
npm install
```

**Verify:** Should install ~311 packages without errors

### 3. Start Development Server

```bash
npm run dev
```

**Expected:** Server starts on http://localhost:3000 and opens in browser

### 4. Verify Build

```bash
npm run build
```

**Expected:** Build succeeds with 0 errors, outputs to `dist/`

---

## Available Scripts

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run dev` | Start dev server | Development work |
| `npm run build` | Type-check + build | Before committing |
| `npm run preview` | Preview production build | Test production behavior |
| `npm run lint` | Run ESLint | Before committing |

---

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

**Branch Naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring

### 2. Make Changes

**Follow:**
- [Component Architecture](../architecture/COMPONENT_ARCHITECTURE.md)
- [Design System](../../src/styles/README.md)
- TypeScript best practices
- Accessibility guidelines

### 3. Test Locally

```bash
# Start dev server
npm run dev

# Test in browser
# - Check functionality
# - Test keyboard navigation
# - Test with different screen sizes
# - Check console for errors
```

### 4. Type Check

```bash
npm run build
```

**Fix all TypeScript errors before committing**

### 5. Lint Code

```bash
npm run lint
```

**Fix all linting errors**

### 6. Commit Changes

```bash
git add .
git commit -m "feat: add new component"
```

**Commit Message Format:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style (formatting)
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

**Source:** [Conventional Commits](https://www.conventionalcommits.org/)

### 7. Push & Create PR

```bash
git push origin feature/my-feature
```

Then create Pull Request on GitHub

---

## Project Structure

```
ui/
├── src/
│   ├── components/          # React components
│   │   ├── design-system/   # Reusable UI components
│   │   ├── ChatPane/        # Feature: Chat
│   │   ├── ReactFlowCanvas/  # Feature: Canvas (React Flow)
│   │   └── ...
│   │
│   ├── contexts/            # React contexts
│   │   └── WalletContext.tsx
│   │
│   ├── hooks/               # Custom hooks
│   │   └── useTerminal.ts
│   │
│   ├── styles/              # Design system
│   │   ├── tokens.css       # 340+ design tokens
│   │   ├── components.css   # Component tokens
│   │   ├── animations.css   # Animations
│   │   └── utilities.css    # Utilities
│   │
│   ├── App.tsx              # Main app
│   ├── main.tsx             # Entry point
│   └── vite-env.d.ts        # Type declarations
│
├── docs/                    # Documentation
├── index.html               # HTML template
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite config
└── README.md                # Quick start
```

---

## Component Development

### 1. Plan Component

**Ask:**
- Is this a design system component (reusable) or feature component (specific)?
- What props does it need?
- What design tokens will it use?
- What accessibility features are required?

### 2. Create Component Files

```bash
# Design system component
mkdir -p src/components/design-system/MyComponent
touch src/components/design-system/MyComponent/MyComponent.tsx
touch src/components/design-system/MyComponent/MyComponent.module.css

# Feature component
mkdir -p src/components/MyFeature
touch src/components/MyFeature/MyFeature.tsx
touch src/components/MyFeature/MyFeature.module.css
```

### 3. Implement Component

**MyComponent.tsx:**
```tsx
import { ReactNode } from 'react';
import styles from './MyComponent.module.css';

export interface MyComponentProps {
  variant?: 'default' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  onClick?: () => void;
}

export function MyComponent({
  variant = 'default',
  size = 'md',
  children,
  onClick
}: MyComponentProps) {
  return (
    <div
      className={`${styles.container} ${styles[variant]} ${styles[size]}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
```

**MyComponent.module.css:**
```css
.container {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-smooth);
}

.container:hover {
  background: var(--color-bg-tertiary);
}

.container:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Variants */
.default {
  border: 1px solid var(--color-border-subtle);
}

.primary {
  background: var(--color-primary);
  color: white;
}

/* Sizes */
.sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
}

.md {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
}

.lg {
  padding: var(--space-4) var(--space-6);
  font-size: var(--font-size-lg);
}
```

### 4. Export Component

**index.ts (if design system):**
```tsx
export { MyComponent } from './MyComponent/MyComponent';
export type { MyComponentProps } from './MyComponent/MyComponent';
```

### 5. Use Component

```tsx
import { MyComponent } from '@/components/design-system';

function App() {
  return (
    <MyComponent variant="primary" size="lg">
      Click me
    </MyComponent>
  );
}
```

---

## Styling Guidelines

### Use Design Tokens

```css
/* ✅ Good */
.button {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  padding: var(--space-3);
}

/* ❌ Bad */
.button {
  background: #3B82F6;
  color: white;
  padding: 12px;
}
```

### Follow 8px Grid

```css
/* ✅ Good: Use spacing tokens */
.container {
  padding: var(--space-4);    /* 16px */
  gap: var(--space-3);         /* 12px */
  margin-bottom: var(--space-6); /* 24px */
}

/* ❌ Bad: Arbitrary values */
.container {
  padding: 15px;
  gap: 10px;
  margin-bottom: 25px;
}
```

### Use CSS Modules

```tsx
// ✅ Good: Scoped styles
import styles from './Component.module.css';
<div className={styles.container}>

// ❌ Bad: Global styles
<div className="container">
```

**See:** [Design System README](../../src/styles/README.md)

---

## TypeScript Guidelines

### Strong Typing

```tsx
// ✅ Good: Explicit types
interface Props {
  name: string;
  age: number;
  onSubmit: (data: FormData) => void;
}

// ❌ Bad: Any or implicit types
interface Props {
  name: any;
  age;
  onSubmit: Function;
}
```

### Avoid `any`

```tsx
// ✅ Good: Use unknown or specific type
function process(data: unknown) {
  if (typeof data === 'string') {
    return data.toUpperCase();
  }
}

// ❌ Bad: Using any
function process(data: any) {
  return data.toUpperCase();
}
```

### Use Type Guards

```tsx
function isMessage(obj: unknown): obj is ChatMessage {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'content' in obj
  );
}

if (isMessage(data)) {
  // TypeScript knows data is ChatMessage
  console.log(data.content);
}
```

---

## State Management

### Local State (useState)

```tsx
// Component-specific state
const [isOpen, setIsOpen] = useState(false);
const [inputValue, setInputValue] = useState('');
```

### Context (Zustand/Context API)

```tsx
// Global state
const wallet = useWallet();
const isUnlocked = wallet.isUnlocked;
```

### YJS (Distributed State)

```tsx
// Real-time collaborative state
const terminal = useTerminal({ terminalId: 'my-session' });
const messages = terminal.leftPane.messages;
```

**See:** [State Management](../architecture/STATE_MANAGEMENT.md)

---

## Accessibility

### Semantic HTML

```tsx
// ✅ Good: Semantic elements
<button onClick={handleClick}>Click</button>
<nav><a href="/home">Home</a></nav>

// ❌ Bad: Generic divs with onClick
<div onClick={handleClick}>Click</div>
```

### ARIA Attributes

```tsx
<button
  aria-label="Close modal"
  aria-expanded={isOpen}
  aria-controls="modal-content"
>
  ×
</button>
```

### Keyboard Navigation

```tsx
function Modal({ onClose }: Props) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  
  return <div role="dialog" tabIndex={-1}>...</div>;
}
```

### Focus Management

```tsx
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (isOpen) {
    inputRef.current?.focus();
  }
}, [isOpen]);

return <input ref={inputRef} />;
```

**Source:** [WAI-ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)

---

## Performance

### Memoization

```tsx
import { useMemo, useCallback } from 'react';

// Memoize expensive computations
const sortedMessages = useMemo(() => {
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}, [messages]);

// Memoize callbacks
const handleSend = useCallback((content: string) => {
  terminal.actions.sendMessage(content);
}, [terminal.actions]);
```

### React.memo

```tsx
import { memo } from 'react';

// Prevent re-renders when props don't change
export const ChatMessage = memo(function ChatMessage({ message }: Props) {
  return <div>{message.content}</div>;
});
```

### Code Splitting

```tsx
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const Chart = lazy(() => import('./Chart'));

function App() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Chart data={data} />
    </Suspense>
  );
}
```

---

## Debugging

### React DevTools

1. Install [React Developer Tools](https://react.dev/learn/react-developer-tools)
2. Open browser DevTools → Components tab
3. Inspect component tree, props, state

### Console Logging

```tsx
// Development logging
useEffect(() => {
  console.log('Component mounted', { props });
  return () => console.log('Component unmounted');
}, []);

// Conditional logging
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data);
}
```

### Source Maps

Enabled by default in Vite config:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    sourcemap: true  // ✅ Enabled
  }
});
```

---

## Common Issues

### TypeScript Errors

**Error:** `Cannot find module '@/components'`  
**Fix:** Check tsconfig.json paths configuration

**Error:** `Property 'x' does not exist on type 'Y'`  
**Fix:** Add property to interface or use type guard

### Build Errors

**Error:** `The inferred type cannot be named`  
**Fix:** Export types explicitly

**Error:** `Circular dependency detected`  
**Fix:** Refactor to remove circular imports

### Runtime Errors

**Error:** `Cannot read property of undefined`  
**Fix:** Add optional chaining `obj?.property`

**Error:** `Maximum update depth exceeded`  
**Fix:** Check useEffect dependencies, avoid state updates in render

---

## VS Code Setup (Recommended)

### Extensions

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript Error Translator** - Better TS errors
- **CSS Modules** - IntelliSense for CSS Modules

### Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Resources

### Documentation
- [React Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [YJS Docs](https://docs.yjs.dev/)
- [Zustand](https://github.com/pmndrs/zustand)

### Internal Docs
- [Component Architecture](../architecture/COMPONENT_ARCHITECTURE.md)
- [State Management](../architecture/STATE_MANAGEMENT.md)
- [Design System](../../src/styles/README.md)
- [Implementation Status](../status/IMPLEMENTATION_STATUS.md)

---

**Version:** 1.0.0  
**Last Updated:** January 10, 2026  
**Maintainer:** Chrysalis UI Team