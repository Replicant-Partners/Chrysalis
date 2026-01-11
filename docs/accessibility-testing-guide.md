# Accessibility Testing Guide

**Date:** 2026-01-11  
**Purpose:** Guidelines for ensuring accessibility compliance in Chrysalis Terminal UI

---

## Overview

This guide covers accessibility testing practices for the Chrysalis Terminal UI to ensure WCAG 2.1 Level AA compliance.

## Testing Tools

### Automated Tools

1. **Built-in Utilities** (`src/test/a11y-utils.ts`)
   - Accessibility audit functions
   - Keyboard navigation tests
   - ARIA validation
   - Form label checking

2. **Browser Extensions**
   - axe DevTools (Chrome/Firefox)
   - WAVE (Web Accessibility Evaluation Tool)
   - Lighthouse (Chrome DevTools)

3. **Testing Libraries**
   - @testing-library/react (semantic queries)
   - jest-axe (automated a11y testing)

### Manual Testing

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Test keyboard shortcuts
   - Verify focus indicators
   - Check tab order

2. **Screen Readers**
   - NVDA (Windows)
   - JAWS (Windows)
   - VoiceOver (macOS/iOS)
   - TalkBack (Android)

---

## Accessibility Checklist

### ✅ Semantic HTML

- [ ] Use proper heading hierarchy (h1 → h2 → h3)
- [ ] Use semantic elements (nav, main, article, section)
- [ ] Use button elements for actions
- [ ] Use anchor tags for navigation
- [ ] Use form elements with proper types

### ✅ Keyboard Accessibility

- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible
- [ ] Tab order is logical
- [ ] Escape key closes modals/dialogs
- [ ] Arrow keys work in lists/menus

### ✅ ARIA Attributes

- [ ] Interactive elements have accessible names
- [ ] Dynamic content uses aria-live regions
- [ ] Form errors are announced
- [ ] Loading states are announced
- [ ] Modal dialogs have proper role and labels

### ✅ Color and Contrast

- [ ] Text has 4.5:1 contrast ratio (WCAG AA)
- [ ] Large text has 3:1 contrast ratio
- [ ] Focus indicators have 3:1 contrast
- [ ] Information not conveyed by color alone

### ✅ Images and Icons

- [ ] All images have alt text
- [ ] Decorative images have empty alt=""
- [ ] Icons have aria-label or sr-only text
- [ ] SVGs have title and desc elements

### ✅ Forms

- [ ] All inputs have associated labels
- [ ] Error messages are descriptive
- [ ] Required fields are indicated
- [ ] Form validation is accessible
- [ ] Autocomplete attributes are used

---

## Testing Examples

### Using A11y Utilities

```typescript
import { runA11yAudit, expectAccessible } from '../test/a11y-utils';

describe('MyComponent', () => {
  it('should be accessible', () => {
    const result = render(<MyComponent />);
    expectAccessible(result);
  });

  it('should have proper ARIA labels', () => {
    const { container } = render(<MyComponent />);
    const audit = runA11yAudit(container);
    
    expect(audit.passed).toBe(true);
    expect(audit.issues).toHaveLength(0);
  });
});
```

### Testing Keyboard Navigation

```typescript
it('should be keyboard navigable', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);
  
  // Tab to first element
  await user.tab();
  expect(screen.getByRole('button', { name: /first/i })).toHaveFocus();
  
  // Tab to second element
  await user.tab();
  expect(screen.getByRole('button', { name: /second/i })).toHaveFocus();
  
  // Activate with Enter
  await user.keyboard('{Enter}');
  expect(handleClick).toHaveBeenCalled();
});
```

### Testing Screen Reader Announcements

```typescript
it('should announce status changes', async () => {
  const { container } = render(<StatusComponent />);
  
  const liveRegions = getLiveRegions(container);
  expect(liveRegions.length).toBeGreaterThan(0);
  
  // Trigger status change
  await user.click(screen.getByRole('button'));
  
  expect(screen.getByRole('status')).toHaveTextContent('Success');
});
```

---

## Component-Specific Guidelines

### VoyeurPane

**Requirements:**
- Event list is keyboard navigable
- Event expansion via Enter/Space
- Connection status announced
- Loading states announced
- Search input properly labeled

**Tests:**
```typescript
it('should be keyboard navigable', async () => {
  const user = userEvent.setup();
  renderWithVoyeur(<VoyeurPane />);
  
  await user.tab(); // Focus connect button
  await user.keyboard('{Enter}'); // Connect
  
  // Navigate to search
  await user.tab();
  expect(screen.getByLabelText(/search/i)).toHaveFocus();
});
```

### WalletModal

**Requirements:**
- Form inputs labeled
- Password strength announced
- Error messages in live regions
- Modal traps focus
- Escape closes modal

**Tests:**
```typescript
it('should announce password strength', async () => {
  const user = userEvent.setup();
  renderWithWallet(<WalletModal />);
  
  const passwordInput = screen.getByLabelText(/password/i);
  await user.type(passwordInput, 'weak');
  
  expect(screen.getByRole('status')).toHaveTextContent(/weak/i);
});
```

### Design System Components

**Button:**
- Has accessible name
- Focus visible
- Keyboard activatable
- Loading state announced

**Input:**
- Label associated
- Error in aria-describedby
- Required indicated
- Autocomplete appropriate

**Badge:**
- Text content meaningful
- Color not sole indicator

---

## WCAG 2.1 Level AA Requirements

### Perceivable

1. **Text Alternatives** (1.1.1)
   - All non-text content has text alternative

2. **Captions** (1.2.2)
   - Captions for audio/video (if applicable)

3. **Adaptable** (1.3.1, 1.3.2, 1.3.3)
   - Info/structure/relationships can be programmatically determined
   - Meaningful sequence
   - Sensory characteristics not sole instruction

4. **Distinguishable** (1.4.1, 1.4.3)
   - Color not sole means of conveying info
   - Contrast ratio 4.5:1 for text

### Operable

1. **Keyboard Accessible** (2.1.1, 2.1.2)
   - All functionality available from keyboard
   - No keyboard trap

2. **Enough Time** (2.2.1)
   - Timing adjustable (if applicable)

3. **Seizures** (2.3.1)
   - No flashing content more than 3 times/second

4. **Navigable** (2.4.1-2.4.7)
   - Bypass blocks
   - Page titled
   - Focus order
   - Link purpose
   - Multiple ways to find pages
   - Headings and labels
   - Focus visible

### Understandable

1. **Readable** (3.1.1)
   - Language of page specified

2. **Predictable** (3.2.1, 3.2.2)
   - On focus doesn't cause context change
   - On input doesn't cause context change

3. **Input Assistance** (3.3.1, 3.3.2)
   - Error identification
   - Labels or instructions

### Robust

1. **Compatible** (4.1.1, 4.1.2)
   - Valid HTML
   - Name, role, value available

---

## Common Accessibility Issues

### Issue: Missing Alt Text
**Problem:** Images without alt attributes
**Fix:**
```tsx
// ❌ Bad
<img src="icon.png" />

// ✅ Good
<img src="icon.png" alt="User profile icon" />

// ✅ Decorative
<img src="decoration.png" alt="" aria-hidden="true" />
```

### Issue: Missing Form Labels
**Problem:** Inputs without associated labels
**Fix:**
```tsx
// ❌ Bad
<input type="text" placeholder="Email" />

// ✅ Good
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// ✅ Also good
<input type="email" aria-label="Email address" />
```

### Issue: Non-keyboard Accessible
**Problem:** onClick on div
**Fix:**
```tsx
// ❌ Bad
<div onClick={handleClick}>Click me</div>

// ✅ Good
<button onClick={handleClick}>Click me</button>
```

### Issue: Poor Focus Indicators
**Problem:** Focus outline removed without replacement
**Fix:**
```css
/* ❌ Bad */
button:focus {
  outline: none;
}

/* ✅ Good */
button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

---

## Resources

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project](https://www.a11yproject.com/)

### Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE](https://wave.webaim.org/)
- [Pa11y](https://pa11y.org/)

### Testing
- [Testing Library Accessibility](https://testing-library.com/docs/queries/about/#priority)
- [jest-axe](https://github.com/nickcolley/jest-axe)

---

## Continuous Testing

### In Development
- Use semantic HTML
- Test with keyboard
- Run automated tests
- Check with browser tools

### In CI/CD
- Run automated a11y tests
- Check WCAG compliance
- Monitor coverage

### In Production
- User feedback
- Analytics on keyboard users
- Periodic manual audits

---

**Last Updated:** 2026-01-11  
**Compliance Target:** WCAG 2.1 Level AA