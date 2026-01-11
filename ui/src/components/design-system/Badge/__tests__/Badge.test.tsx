/**
 * Badge Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('should render with children', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText(/test badge/i)).toBeInTheDocument();
  });

  it('should apply default variant', () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('default');
  });

  it('should apply different variants', () => {
    const { rerender, container } = render(<Badge variant="success">Success</Badge>);
    expect(container.querySelector('span')?.className).toContain('success');

    rerender(<Badge variant="warning">Warning</Badge>);
    expect(container.querySelector('span')?.className).toContain('warning');

    rerender(<Badge variant="error">Error</Badge>);
    expect(container.querySelector('span')?.className).toContain('error');

    rerender(<Badge variant="info">Info</Badge>);
    expect(container.querySelector('span')?.className).toContain('info');
  });

  it('should show pulsing dot when withDot is true', () => {
    const { container } = render(<Badge withDot>Live</Badge>);
    const dot = container.querySelector('.dot');
    expect(dot).toBeInTheDocument();
  });

  it('should not show dot by default', () => {
    const { container } = render(<Badge>No Dot</Badge>);
    const dot = container.querySelector('.dot');
    expect(dot).not.toBeInTheDocument();
  });

  it('should merge custom className', () => {
    const { container } = render(<Badge className="custom-badge">Custom</Badge>);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('custom-badge');
    expect(badge?.className).toContain('badge');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<Badge ref={ref}>Badge</Badge>);
    expect(ref).toHaveBeenCalled();
  });

  it('should pass through HTML span attributes', () => {
    render(<Badge data-testid="test-badge" title="Test Badge">Badge</Badge>);
    
    const badge = screen.getByTestId('test-badge');
    expect(badge).toHaveAttribute('title', 'Test Badge');
  });

  it('should render live variant with dot', () => {
    const { container } = render(<Badge variant="live" withDot>Live</Badge>);
    
    expect(container.querySelector('span')?.className).toContain('live');
    expect(container.querySelector('.dot')).toBeInTheDocument();
  });
});