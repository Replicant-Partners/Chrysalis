/**
 * Pattern Match Context Module
 *
 * Provides the context structure used during pattern matching operations
 * in the evolutionary patterns system. This context captures version changes,
 * API modifications, deprecations, security advisories, and other metadata
 * relevant to pattern recognition and dependency evolution analysis.
 *
 * @module ai-maintenance/patterns/context
 */

/**
 * Context for pattern matching.
 */
export interface PatternMatchContext {
  /** Version change if applicable */
  versionChange?: {
    from: string;
    to: string;
  };
  /** Changelog content */
  changelog?: string;
  /** API changes */
  apiChanges?: Array<{
    type: string;
    element: string;
    breaking: boolean;
  }>;
  /** Deprecation notices */
  deprecations?: Array<{
    element: string;
    replacement?: string;
  }>;
  /** Security advisories */
  securityAdvisories?: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }>;
  /** Metrics */
  metrics?: Record<string, number>;
  /** Schema changes */
  schemaChanges?: Array<{
    type: 'field-added' | 'field-removed' | 'field-modified' | 'type-changed';
    fieldPath?: string;
    requiredChange?: boolean;
  }>;
  /** Raw content for pattern matching */
  rawContent?: string;
  /** Additional context */
  additional?: Record<string, unknown>;
}
