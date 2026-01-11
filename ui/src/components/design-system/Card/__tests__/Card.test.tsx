/**
 * Card Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from '../Card';

describe('Card', () => {
  it('should render children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText(/card content/i)).toBeInTheDocument();
  });

  it('should apply hover effect when hoverable', () => {
    const { container } = render(<Card hoverable>Hoverable card</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('hoverable');
  });

  it('should handle click events when clickable', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Card onClick={handleClick}>Clickable card</Card>);
    
    await user.click(screen.getByText(/clickable card/i));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should apply custom className', () => {
    const { container } = render(<Card className="custom-card">Custom</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('custom-card');
    expect(card.className).toContain('card');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<Card ref={ref}>Card</Card>);
    expect(ref).toHaveBeenCalled();
  });

  it('should pass through HTML attributes', () => {
    render(<Card data-testid="test-card" title="Test Card">Card</Card>);
    
    const card = screen.getByTestId('test-card');
    expect(card).toHaveAttribute('title', 'Test Card');
  });

  it('should be keyboard accessible when clickable', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Card onClick={handleClick} tabIndex={0}>Keyboard card</Card>);
    
    const card = screen.getByText(/keyboard card/i);
    card.focus();
    expect(card).toHaveFocus();
    
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalled();
  });
});