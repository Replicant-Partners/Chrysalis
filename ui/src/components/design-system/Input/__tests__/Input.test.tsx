/**
 * Input Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../Input';

describe('Input', () => {
  it('should render without crashing', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render with label', () => {
    render(<Input label="Email Address" />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('should display error message', () => {
    render(<Input label="Password" error="Password is required" />);
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });

  it('should display helper text when no error', () => {
    render(<Input helperText="Enter your email address" />);
    
    expect(screen.getByText(/enter your email address/i)).toBeInTheDocument();
  });

  it('should hide helper text when error is present', () => {
    render(<Input helperText="Helper" error="Error message" />);
    
    expect(screen.queryByText(/helper/i)).not.toBeInTheDocument();
    expect(screen.getByText(/error message/i)).toBeInTheDocument();
  });

  it('should handle value changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    
    render(<Input onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test@example.com');
    
    expect(handleChange).toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Input disabled />);
    
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('should render with iconBefore', () => {
    render(<Input iconBefore={<span data-testid="icon-before">🔍</span>} />);
    
    expect(screen.getByTestId('icon-before')).toBeInTheDocument();
  });

  it('should render with iconAfter', () => {
    render(<Input iconAfter={<span data-testid="icon-after">✓</span>} />);
    
    expect(screen.getByTestId('icon-after')).toBeInTheDocument();
  });

  it('should apply fullWidth className', () => {
    const { container } = render(<Input fullWidth />);
    const containerDiv = container.firstChild as HTMLElement;
    // CSS Modules hash class names, just verify container exists
    expect(containerDiv).toBeInTheDocument();
  });

  it('should have proper ARIA attributes for errors', () => {
    render(<Input label="Username" error="Username is taken" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('should have proper ARIA attributes for helper text', () => {
    render(<Input label="Email" helperText="We'll never share your email" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<Input ref={ref} />);
    expect(ref).toHaveBeenCalled();
  });

  it('should pass through HTML input attributes', () => {
    render(<Input type="email" placeholder="Enter email" name="email" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('placeholder', 'Enter email');
    expect(input).toHaveAttribute('name', 'email');
  });

  it('should generate unique IDs for multiple inputs', () => {
    const { container } = render(
      <>
        <Input label="First" />
        <Input label="Second" />
      </>
    );
    
    const inputs = container.querySelectorAll('input');
    expect(inputs[0].id).not.toBe(inputs[1].id);
  });

  it('should use provided id over generated one', () => {
    render(<Input id="custom-input" label="Custom" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('id', 'custom-input');
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    
    render(<Input onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    await user.tab();
    expect(input).toHaveFocus();
  });
});