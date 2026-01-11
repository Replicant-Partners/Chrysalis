/**
 * Button Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('should render with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should apply primary variant by default', () => {
    const { container } = render(<Button>Primary</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('primary');
  });

  it('should apply different variants', () => {
    const { rerender, container } = render(<Button variant="secondary">Secondary</Button>);
    expect(container.querySelector('button')?.className).toContain('secondary');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(container.querySelector('button')?.className).toContain('ghost');

    rerender(<Button variant="danger">Danger</Button>);
    expect(container.querySelector('button')?.className).toContain('danger');
  });

  it('should apply different sizes', () => {
    const { rerender, container } = render(<Button size="sm">Small</Button>);
    expect(container.querySelector('button')?.className).toContain('sm');

    rerender(<Button size="md">Medium</Button>);
    expect(container.querySelector('button')?.className).toContain('md');

    rerender(<Button size="lg">Large</Button>);
    expect(container.querySelector('button')?.className).toContain('lg');
  });

  it('should handle click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button onClick={handleClick}>Click</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should show loading state', () => {
    render(<Button isLoading>Loading</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it('should render with icons', () => {
    const { rerender } = render(
      <Button iconBefore={<span data-testid="icon-before">→</span>}>
        With Icon Before
      </Button>
    );
    
    expect(screen.getByTestId('icon-before')).toBeInTheDocument();
    expect(screen.getByText(/with icon before/i)).toBeInTheDocument();

    rerender(
      <Button iconAfter={<span data-testid="icon-after">←</span>}>
        With Icon After
      </Button>
    );
    
    expect(screen.getByTestId('icon-after')).toBeInTheDocument();
  });

  it('should apply fullWidth className', () => {
    const { container } = render(<Button fullWidth>Full Width</Button>);
    expect(container.querySelector('button')?.className).toContain('full-width');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Button</Button>);
    expect(ref).toHaveBeenCalled();
  });

  it('should merge custom className', () => {
    const { container } = render(<Button className="custom-class">Custom</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('custom-class');
    expect(button?.className).toContain('button');
  });

  it('should pass through HTML button attributes', () => {
    render(<Button type="submit" name="submit-btn">Submit</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('name', 'submit-btn');
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button onClick={handleClick}>Keyboard</Button>);
    
    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();
    
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});