/**
 * Badge Component - Chrysalis Design System
 * 
 * A small badge/pill component for status indicators and labels.
 */

import React from 'react';
import clsx from 'clsx';
import styles from './Badge.module.css';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'live' | 'secondary';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Badge variant */
  variant?: BadgeVariant;
  /** Show pulsing dot indicator */
  withDot?: boolean;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * Badge component with design system integration
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', withDot = false, className, children, ...props }, ref) => {
    const badgeClasses = clsx(
      styles.badge,
      styles[`badge--${variant}`],
      {
        [styles['badge--with-dot']]: withDot,
      },
      className
    );

    return (
      <span ref={ref} className={badgeClasses} {...props}>
        {withDot && <span className={styles.dot} />}
        <span className={styles.text}>{children}</span>
      </span>
    );
  }
);

Badge.displayName = 'Badge';