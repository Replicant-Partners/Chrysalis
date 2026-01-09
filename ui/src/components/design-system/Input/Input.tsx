/**
 * Input Component - Chrysalis Design System
 * 
 * A flexible input component with support for various states and types.
 */

import React from 'react';
import clsx from 'clsx';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Icon to display before input */
  iconBefore?: React.ReactNode;
  /** Icon to display after input */
  iconAfter?: React.ReactNode;
  /** Full width input */
  fullWidth?: boolean;
}

/**
 * Input component with design system integration
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      iconBefore,
      iconAfter,
      fullWidth = false,
      className,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${React.useId()}`;
    const hasError = Boolean(error);

    const containerClasses = clsx(
      styles.container,
      {
        [styles['container--full-width']]: fullWidth,
      },
      className
    );

    const wrapperClasses = clsx(styles.wrapper, {
      [styles['wrapper--error']]: hasError,
      [styles['wrapper--disabled']]: disabled,
      [styles['wrapper--with-icon-before']]: iconBefore,
      [styles['wrapper--with-icon-after']]: iconAfter,
    });

    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}

        <div className={wrapperClasses}>
          {iconBefore && <span className={styles['icon-before']}>{iconBefore}</span>}
          
          <input
            ref={ref}
            id={inputId}
            className={styles.input}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />
          
          {iconAfter && <span className={styles['icon-after']}>{iconAfter}</span>}
        </div>

        {error && (
          <p id={`${inputId}-error`} className={styles.error} role="alert">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={`${inputId}-helper`} className={styles.helper}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';