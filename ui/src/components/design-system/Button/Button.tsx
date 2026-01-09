/**
 * Button Component - Chrysalis Design System
 * 
 * A flexible button component with multiple variants and sizes.
 * All styling uses design tokens for consistency.
 */

import React from 'react';
import clsx from 'clsx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Full width button */
  fullWidth?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Icon to display before text */
  iconBefore?: React.ReactNode;
  /** Icon to display after text */
  iconAfter?: React.ReactNode;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * Button component with design system integration
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      iconBefore,
      iconAfter,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const buttonClasses = clsx(
      styles.button,
      styles[`button--${variant}`],
      styles[`button--${size}`],
      {
        [styles['button--full-width']]: fullWidth,
        [styles['button--loading']]: isLoading,
        [styles['button--icon-only']]: !children && (iconBefore || iconAfter),
      },
      className
    );

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className={styles.spinner} aria-label="Loading" />
        ) : (
          <>
            {iconBefore && <span className={styles.icon}>{iconBefore}</span>}
            {children && <span className={styles.text}>{children}</span>}
            {iconAfter && <span className={styles.icon}>{iconAfter}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';