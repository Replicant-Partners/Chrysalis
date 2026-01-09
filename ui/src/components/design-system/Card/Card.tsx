/**
 * Card Component - Chrysalis Design System
 * 
 * A versatile card container component.
 */

import React from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card variant */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Enable hover effect */
  hoverable?: boolean;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Children content */
  children?: React.ReactNode;
}

/**
 * Card component with design system integration
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      hoverable = false,
      padding = 'md',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const cardClasses = clsx(
      styles.card,
      styles[`card--${variant}`],
      styles[`card--padding-${padding}`],
      {
        [styles['card--hoverable']]: hoverable,
      },
      className
    );

    return (
      <div ref={ref} className={cardClasses} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';