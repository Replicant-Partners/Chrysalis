# Chrysalis Design System

The Chrysalis Design System provides a cohesive visual language for the AI workbench interface. It's built on design tokens, ensuring consistency, maintainability, and easy customization.

## Architecture

```
Foundation Tokens (tokens.css)
    ↓
Component Tokens (components.css)
    ↓
Components (React + CSS Modules)
```

## Files Overview

### `tokens.css`
**Foundation design tokens** - The single source of truth for all design values:
- Colors (primary palette, neutrals, semantics)
- Typography (font families, sizes, weights, line heights)
- Spacing (8px base unit system)
- Border radii
- Shadows
- Motion (durations, easing functions)
- Z-index scale

### `components.css`
**Component-specific token mappings** - Semantic layer between foundation tokens and components:
- Button variants (primary, secondary, ghost, danger)
- Input states (default, hover, focus, error)
- Cards and containers
- Node cards (canvas elements)
- Chat messages
- Mercury frame (signature aesthetic)
- Badges, modals, tooltips

### `animations.css`
**Reusable animation definitions**:
- Mercury shimmer (signature animation)
- Fade, slide, scale transitions
- Pulse, spin, bounce effects
- Skeleton loading states
- Typing indicators
- Reduced motion support

### `utilities.css`
**Common utility classes**:
- Layout (flex, grid, positioning)
- Sizing and spacing
- Text utilities
- Cursor and pointer events
- Accessibility (sr-only, focus-ring, skip-link)
- Glass morphism effects

## Usage Examples

### Using Design Tokens in CSS Modules

```css
/* MyComponent.module.css */
.button {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--button-radius);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  transition: all var(--duration-fast) var(--ease-smooth);
}

.button:hover {
  background: var(--button-primary-bg-hover);
  box-shadow: var(--button-shadow-hover);
}
```

### Using Utility Classes

```tsx
// Component.tsx
<div className="flex items-center gap-4 smooth-transition">
  <span className="font-semibold text-ellipsis">Title</span>
  <button className="cursor-pointer focus-ring">Click</button>
</div>
```

### Using Animation Classes

```tsx
// Animated component
<div className="fade-in slide-in-up">
  <p>I animate in smoothly!</p>
</div>

// Loading state
<div className="skeleton" style={{ width: '100%', height: '2rem' }} />
```

## Color System

### Primary Brand Colors
- **Chrysalis Cyan** (`--color-chrysalis-cyan`): Primary brand, agent elements
- **Metamorphosis Blue** (`--color-metamorphosis-blue`): Secondary, interactive states  
- **Evolution Purple** (`--color-evolution-purple`): Tertiary, special features

### Using Colors

```css
/* Prefer semantic tokens */
color: var(--color-text-primary);        /* ✅ Good */
background: var(--color-bg-secondary);   /* ✅ Good */

/* Avoid hardcoded values */
color: #F1F5F9;                          /* ❌ Avoid */
background: rgba(15, 23, 42, 0.9);       /* ❌ Avoid */
```

## Typography System

### Type Scale (Modular Scale 1.25)
- **xs**: 12px - Captions, metadata
- **sm**: 14px - Body small, labels
- **base**: 16px - Body text (default)
- **lg**: 20px - Section headers
- **xl**: 24px - Panel titles
- **2xl**: 32px - Page headers

### Font Families
- **Primary**: Inter (UI text, headings)
- **Monospace**: JetBrains Mono (code, technical content)

### Usage

```css
.heading {
  font-family: var(--font-family-primary);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
}

.code {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
}
```

## Spacing System

Based on 8px base unit for visual rhythm:

```
4px   (--space-1)  - Tight spacing
8px   (--space-2)  - Default gap
16px  (--space-4)  - Section padding
24px  (--space-6)  - Panel padding
32px  (--space-8)  - Page margins
```

### Usage

```css
.card {
  padding: var(--space-4);
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}
```

## Motion Language

### Animation Durations
- **Fast** (150ms): Micro-interactions, hover states
- **Base** (300ms): Standard transitions, slides
- **Slow** (500ms): Complex animations, page transitions

### Easing Functions
- `--ease-smooth`: Default for most transitions
- `--ease-out`: Enter animations
- `--ease-in`: Exit animations
- `--ease-in-out`: Bidirectional animations

### Usage

```css
.button {
  transition: all var(--duration-fast) var(--ease-smooth);
}

.modal {
  animation: scaleIn var(--duration-base) var(--ease-out);
}
```

## Mercury Frame Aesthetic

The signature visual element of Chrysalis - a liquid metal shimmer effect:

```tsx
<div className="mercury-frame">
  <div className="mercury-frame-inner">
    {/* Content */}
  </div>
</div>
```

**Tokens**:
- `--mercury-frame-gradient`: 10-stop silver gradient
- `--mercury-frame-shadow`: Inset + outer glow
- `--mercury-frame-animation-duration`: 8s shimmer cycle

## Accessibility

### Focus Management
All interactive elements have visible focus indicators:
- Focus ring: 2px solid cyan
- Offset: 2px from element
- Use `.focus-ring` class for custom focus states

### Screen Readers
- Use `.sr-only` for screen reader only content
- Provide text alternatives for icons
- Use semantic HTML (button, nav, main, etc.)

### Keyboard Navigation
- Tab order follows logical flow
- Escape key closes modals
- Arrow keys for navigation where appropriate

### Reduced Motion
Respects `prefers-reduced-motion` user preference:
- Disables animations
- Reduces transition durations
- Maintains instant feedback

## Dark Theme (Default)

Chrysalis uses a dark theme by default for reduced eye strain during extended sessions:

```css
:root {
  --color-bg-primary: var(--color-slate-950);
  --color-text-primary: var(--color-slate-100);
  /* ... more semantic mappings */
}
```

Light theme is available for future use via `[data-theme="light"]` attribute.

## Best Practices

### ✅ Do
- Use design tokens for all values
- Prefer semantic tokens over foundation tokens
- Use utility classes for common patterns
- Follow 8px spacing grid
- Respect reduced motion preferences
- Provide focus indicators

### ❌ Don't
- Hardcode color values
- Use arbitrary spacing values
- Create inline styles (use CSS Modules)
- Skip accessibility features
- Ignore responsive design principles

## Component Development Workflow

1. **Design in Figma** (if applicable)
2. **Identify tokens** needed for the component
3. **Create component tokens** in `components.css` if needed
4. **Build component** using CSS Modules + tokens
5. **Add animations** from `animations.css`
6. **Test accessibility** (keyboard nav, screen readers)
7. **Document** in Storybook (Phase 2)

## Extending the System

### Adding New Colors

```css
/* tokens.css */
:root {
  /* Add to appropriate section */
  --color-orange-500: #F97316;
}

/* components.css */
:root {
  /* Create semantic mapping */
  --button-warning-bg: var(--color-orange-500);
}
```

### Adding New Components

```css
/* components.css */
:root {
  --my-component-bg: var(--color-bg-secondary);
  --my-component-border: var(--color-border-subtle);
  --my-component-radius: var(--radius-lg);
  /* ... more tokens */
}
```

### Adding New Animations

```css
/* animations.css */
@keyframes myAnimation {
  from { /* ... */ }
  to { /* ... */ }
}

.my-animation {
  animation: myAnimation var(--duration-base) var(--ease-smooth);
}
```

## File Import Order

Always import in this order to maintain proper cascade:

```css
@import './styles/tokens.css';        /* 1. Foundation */
@import './styles/components.css';    /* 2. Component mappings */
@import './styles/animations.css';    /* 3. Animations */
@import './styles/utilities.css';     /* 4. Utilities */
```

## Resources

- [Design System Documentation](../docs/design-system.md) (Coming soon)
- [Component Library](../components/design-system/) (Coming soon)
- [Storybook](http://localhost:6006) (Coming soon)
- [Figma Design Files](#) (Coming soon)

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Maintainer**: Chrysalis Team