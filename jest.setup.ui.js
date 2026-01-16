/**
 * Jest setup file for UI (React) tests
 * Extends Jest matchers with @testing-library/jest-dom for DOM assertions
 * 
 * This adds custom matchers like:
 * - toBeInTheDocument()
 * - toHaveAttribute()
 * - toHaveClass()
 * - toBeVisible()
 * - toBeEnabled() / toBeDisabled()
 * - toHaveTextContent()
 * - toHaveStyle()
 * etc.
 */
require('@testing-library/jest-dom');
