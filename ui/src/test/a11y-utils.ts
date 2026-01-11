/**
 * Accessibility Testing Utilities
 * 
 * Helper functions for testing accessibility compliance
 */

import { RenderResult } from '@testing-library/react';

/**
 * Check if element has proper ARIA label
 */
export function hasAccessibleName(element: HTMLElement): boolean {
  const ariaLabel = element.getAttribute('aria-label');
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  const title = element.getAttribute('title');
  const textContent = element.textContent?.trim();
  
  return Boolean(ariaLabel || ariaLabelledBy || title || textContent);
}

/**
 * Check keyboard navigation
 */
export async function testKeyboardNavigation(
  container: HTMLElement,
  expectedFocusableElements: number
): Promise<boolean> {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  
  const focusableElements = container.querySelectorAll(focusableSelectors);
  return focusableElements.length === expectedFocusableElements;
}

/**
 * Check color contrast (simplified check)
 */
export interface ContrastRatio {
  foreground: string;
  background: string;
  ratio: number;
  passes: boolean;
}

export function checkColorContrast(
  foreground: string,
  background: string
): ContrastRatio {
  // Simplified contrast check
  // In production, use a proper library like 'color-contrast-checker'
  const minRatio = 4.5; // WCAG AA for normal text
  
  // This is a placeholder - in real tests, calculate actual contrast
  const ratio = 5.0; // Placeholder value
  
  return {
    foreground,
    background,
    ratio,
    passes: ratio >= minRatio
  };
}

/**
 * Check for missing alt text on images
 */
export function checkImageAltText(container: HTMLElement): string[] {
  const images = container.querySelectorAll('img');
  const missingAlt: string[] = [];
  
  images.forEach((img, index) => {
    const alt = img.getAttribute('alt');
    if (alt === null || alt === '') {
      missingAlt.push(`Image ${index}: ${img.src || 'no src'}`);
    }
  });
  
  return missingAlt;
}

/**
 * Check for proper heading hierarchy
 */
export function checkHeadingHierarchy(container: HTMLElement): {
  valid: boolean;
  issues: string[];
} {
  const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const issues: string[] = [];
  let lastLevel = 0;
  
  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName[1]);
    
    if (index === 0 && level !== 1) {
      issues.push('First heading should be h1');
    }
    
    if (level > lastLevel + 1) {
      issues.push(`Skipped heading level: ${heading.tagName} after h${lastLevel}`);
    }
    
    lastLevel = level;
  });
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Check for form labels
 */
export function checkFormLabels(container: HTMLElement): string[] {
  const inputs = container.querySelectorAll('input:not([type="hidden"]), select, textarea');
  const unlabeled: string[] = [];
  
  inputs.forEach((input) => {
    const id = input.getAttribute('id');
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    
    // Check if there's a label element
    const hasLabel = id && container.querySelector(`label[for="${id}"]`);
    
    if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
      unlabeled.push(`${input.tagName} with name="${input.getAttribute('name')}"`);
    }
  });
  
  return unlabeled;
}

/**
 * Comprehensive accessibility audit
 */
export interface A11yAuditResult {
  passed: boolean;
  issues: {
    category: string;
    severity: 'error' | 'warning';
    message: string;
  }[];
}

export function runA11yAudit(container: HTMLElement): A11yAuditResult {
  const issues: A11yAuditResult['issues'] = [];
  
  // Check images
  const missingAlt = checkImageAltText(container);
  missingAlt.forEach(msg => {
    issues.push({
      category: 'images',
      severity: 'error',
      message: `Missing alt text: ${msg}`
    });
  });
  
  // Check headings
  const headingCheck = checkHeadingHierarchy(container);
  headingCheck.issues.forEach(msg => {
    issues.push({
      category: 'headings',
      severity: 'warning',
      message: msg
    });
  });
  
  // Check form labels
  const unlabeled = checkFormLabels(container);
  unlabeled.forEach(msg => {
    issues.push({
      category: 'forms',
      severity: 'error',
      message: `Unlabeled form element: ${msg}`
    });
  });
  
  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues
  };
}

/**
 * Test for screen reader announcements
 */
export function getLiveRegions(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll('[aria-live], [role="status"], [role="alert"]')
  );
}

/**
 * Check ARIA attributes validity
 */
export function validateAriaAttributes(element: HTMLElement): string[] {
  const issues: string[] = [];
  const ariaAttributes = Array.from(element.attributes).filter(
    attr => attr.name.startsWith('aria-')
  );
  
  ariaAttributes.forEach(attr => {
    // Check for invalid ARIA attributes (basic check)
    if (attr.name === 'aria-labelledby' || attr.name === 'aria-describedby') {
      const ids = attr.value.split(' ');
      ids.forEach(id => {
        if (!element.ownerDocument.getElementById(id)) {
          issues.push(`${attr.name} references non-existent ID: ${id}`);
        }
      });
    }
  });
  
  return issues;
}

/**
 * Test helper: expect element to be accessible
 */
export function expectAccessible(result: RenderResult) {
  const { container } = result;
  const audit = runA11yAudit(container);
  
  if (!audit.passed) {
    const errorMessages = audit.issues
      .filter(i => i.severity === 'error')
      .map(i => `[${i.category}] ${i.message}`)
      .join('\n');
    
    throw new Error(`Accessibility violations found:\n${errorMessages}`);
  }
}