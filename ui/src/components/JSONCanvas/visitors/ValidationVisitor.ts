/**
 * ValidationVisitor - Visitor Pattern Implementation for Canvas Node Validation
 * 
 * Implements the Visitor pattern to validate different canvas node types
 * without coupling validation logic to node types.
 * 
 * Supports multiple validation levels:
 * - Schema validation (required fields, types)
 * - Business rule validation (constraints, relationships)
 * - Security validation (XSS, injection prevention)
 * 
 * @see Design Patterns: Elements of Reusable Object-Oriented Software
 *      Gamma, Helm, Johnson, Vlissides (1994), Chapter: Visitor Pattern
 * @see docs/DESIGN_PATTERN_ANALYSIS.md - Section 1.3: Visitor Pattern
 * 
 * @module ui/components/JSONCanvas/visitors/ValidationVisitor
 */

import type {
  TextNode,
  FileNode,
  LinkNode,
  GroupNode,
  WidgetNode,
  CanvasNode
} from '@terminal/protocols/types';
import type { CanvasNodeVisitor } from './CanvasNodeVisitor';

/**
 * Validation severity levels.
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Single validation issue.
 */
export interface ValidationIssue {
  /** Unique code for the issue type */
  code: string;
  /** Human-readable message */
  message: string;
  /** Severity level */
  severity: ValidationSeverity;
  /** Path to the problematic field */
  path?: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Validation result for a single node.
 */
export interface ValidationResult {
  /** Whether the node is valid (no errors) */
  valid: boolean;
  /** Node ID being validated */
  nodeId: string;
  /** Node type */
  nodeType: string;
  /** List of validation issues */
  issues: ValidationIssue[];
  /** Timestamp of validation */
  timestamp: number;
}

/**
 * Validation options for customizing validation behavior.
 */
export interface ValidationOptions {
  /** Check for required fields */
  checkRequired?: boolean;
  /** Check field types */
  checkTypes?: boolean;
  /** Check business rules */
  checkBusinessRules?: boolean;
  /** Check security concerns */
  checkSecurity?: boolean;
  /** Maximum text length for text nodes */
  maxTextLength?: number;
  /** Maximum URL length for link nodes */
  maxUrlLength?: number;
  /** Allowed URL protocols */
  allowedProtocols?: string[];
  /** Allowed widget types */
  allowedWidgetTypes?: string[];
  /** Custom validators */
  customValidators?: CustomValidator[];
}

/**
 * Custom validator function type.
 */
export type CustomValidator = (node: CanvasNode) => ValidationIssue[];

const DEFAULT_OPTIONS: ValidationOptions = {
  checkRequired: true,
  checkTypes: true,
  checkBusinessRules: true,
  checkSecurity: true,
  maxTextLength: 100000,
  maxUrlLength: 2048,
  allowedProtocols: ['http', 'https', 'mailto', 'tel'],
  allowedWidgetTypes: [],  // Empty = all allowed
  customValidators: []
};

/**
 * Visitor that validates canvas nodes.
 * 
 * Each visit method receives a correctly typed node and returns
 * a validation result with any issues found.
 * 
 * @example
 * ```typescript
 * const visitor = new ValidationVisitor();
 * const result = wrappedNode.accept(visitor);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.issues);
 * }
 * ```
 */
export class ValidationVisitor implements CanvasNodeVisitor<ValidationResult> {
  private readonly options: ValidationOptions;
  
  constructor(options: Partial<ValidationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Create a validation result.
   */
  private createResult(node: CanvasNode, issues: ValidationIssue[]): ValidationResult {
    return {
      valid: !issues.some(i => i.severity === 'error'),
      nodeId: node.id,
      nodeType: node.type,
      issues,
      timestamp: Date.now()
    };
  }
  
  /**
   * Validate base node properties common to all node types.
   */
  private validateBase(node: CanvasNode): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    if (this.options.checkRequired) {
      if (!node.id || typeof node.id !== 'string') {
        issues.push({
          code: 'MISSING_ID',
          message: 'Node must have a valid string ID',
          severity: 'error',
          path: 'id'
        });
      }
      
      if (!node.type || typeof node.type !== 'string') {
        issues.push({
          code: 'MISSING_TYPE',
          message: 'Node must have a valid type',
          severity: 'error',
          path: 'type'
        });
      }
    }
    
    if (this.options.checkTypes) {
      if (typeof node.x !== 'number' || isNaN(node.x)) {
        issues.push({
          code: 'INVALID_X',
          message: 'Node x position must be a valid number',
          severity: 'error',
          path: 'x'
        });
      }
      
      if (typeof node.y !== 'number' || isNaN(node.y)) {
        issues.push({
          code: 'INVALID_Y',
          message: 'Node y position must be a valid number',
          severity: 'error',
          path: 'y'
        });
      }
      
      if (typeof node.width !== 'number' || node.width <= 0) {
        issues.push({
          code: 'INVALID_WIDTH',
          message: 'Node width must be a positive number',
          severity: 'error',
          path: 'width'
        });
      }
      
      if (typeof node.height !== 'number' || node.height <= 0) {
        issues.push({
          code: 'INVALID_HEIGHT',
          message: 'Node height must be a positive number',
          severity: 'error',
          path: 'height'
        });
      }
    }
    
    // Run custom validators
    if (this.options.customValidators) {
      for (const validator of this.options.customValidators) {
        issues.push(...validator(node));
      }
    }
    
    return issues;
  }
  
  /**
   * Check for potential XSS in text content.
   */
  private checkXSS(text: string, path: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    if (!this.options.checkSecurity) {
      return issues;
    }
    
    // Check for script tags
    if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(text)) {
      issues.push({
        code: 'XSS_SCRIPT_TAG',
        message: 'Text contains potentially dangerous script tags',
        severity: 'error',
        path,
        suggestion: 'Remove or escape script tags'
      });
    }
    
    // Check for event handlers
    if (/\bon\w+\s*=/gi.test(text)) {
      issues.push({
        code: 'XSS_EVENT_HANDLER',
        message: 'Text contains potentially dangerous event handlers',
        severity: 'warning',
        path,
        suggestion: 'Remove inline event handlers'
      });
    }
    
    // Check for javascript: URLs
    if (/javascript:/gi.test(text)) {
      issues.push({
        code: 'XSS_JAVASCRIPT_URL',
        message: 'Text contains potentially dangerous javascript: URL',
        severity: 'error',
        path,
        suggestion: 'Remove javascript: URLs'
      });
    }
    
    return issues;
  }
  
  /**
   * Validate a text node.
   */
  visitTextNode(node: TextNode): ValidationResult {
    const issues = this.validateBase(node);
    
    if (this.options.checkRequired) {
      if (typeof node.text !== 'string') {
        issues.push({
          code: 'MISSING_TEXT',
          message: 'Text node must have text content',
          severity: 'error',
          path: 'text'
        });
      }
    }
    
    if (this.options.checkBusinessRules && typeof node.text === 'string') {
      if (node.text.length > this.options.maxTextLength!) {
        issues.push({
          code: 'TEXT_TOO_LONG',
          message: `Text exceeds maximum length of ${this.options.maxTextLength} characters`,
          severity: 'warning',
          path: 'text',
          suggestion: 'Consider splitting into multiple text nodes'
        });
      }
      
      if (node.text.trim().length === 0) {
        issues.push({
          code: 'EMPTY_TEXT',
          message: 'Text node has empty content',
          severity: 'info',
          path: 'text'
        });
      }
    }
    
    if (typeof node.text === 'string') {
      issues.push(...this.checkXSS(node.text, 'text'));
    }
    
    return this.createResult(node, issues);
  }
  
  /**
   * Validate a file node.
   */
  visitFileNode(node: FileNode): ValidationResult {
    const issues = this.validateBase(node);
    
    if (this.options.checkRequired) {
      if (!node.file || typeof node.file !== 'string') {
        issues.push({
          code: 'MISSING_FILE',
          message: 'File node must have a file path',
          severity: 'error',
          path: 'file'
        });
      }
    }
    
    if (this.options.checkSecurity && typeof node.file === 'string') {
      // Check for path traversal
      if (node.file.includes('..')) {
        issues.push({
          code: 'PATH_TRAVERSAL',
          message: 'File path contains potentially dangerous path traversal',
          severity: 'error',
          path: 'file',
          suggestion: 'Use absolute paths or remove .. sequences'
        });
      }
      
      // Check for absolute paths (may be intentional)
      if (node.file.startsWith('/') || /^[A-Za-z]:/.test(node.file)) {
        issues.push({
          code: 'ABSOLUTE_PATH',
          message: 'File path is absolute, which may not be portable',
          severity: 'info',
          path: 'file'
        });
      }
    }
    
    return this.createResult(node, issues);
  }
  
  /**
   * Validate a link node.
   */
  visitLinkNode(node: LinkNode): ValidationResult {
    const issues = this.validateBase(node);
    
    if (this.options.checkRequired) {
      if (!node.url || typeof node.url !== 'string') {
        issues.push({
          code: 'MISSING_URL',
          message: 'Link node must have a URL',
          severity: 'error',
          path: 'url'
        });
      }
    }
    
    if (typeof node.url === 'string') {
      // Validate URL format
      try {
        const url = new URL(node.url);
        
        if (this.options.checkSecurity) {
          const protocol = url.protocol.replace(':', '');
          if (!this.options.allowedProtocols!.includes(protocol)) {
            issues.push({
              code: 'DISALLOWED_PROTOCOL',
              message: `URL protocol '${protocol}' is not allowed`,
              severity: 'error',
              path: 'url',
              suggestion: `Use one of: ${this.options.allowedProtocols!.join(', ')}`
            });
          }
        }
      } catch {
        issues.push({
          code: 'INVALID_URL',
          message: 'URL is not valid',
          severity: 'error',
          path: 'url'
        });
      }
      
      if (this.options.checkBusinessRules) {
        if (node.url.length > this.options.maxUrlLength!) {
          issues.push({
            code: 'URL_TOO_LONG',
            message: `URL exceeds maximum length of ${this.options.maxUrlLength} characters`,
            severity: 'warning',
            path: 'url'
          });
        }
      }
    }
    
    return this.createResult(node, issues);
  }
  
  /**
   * Validate a group node.
   */
  visitGroupNode(node: GroupNode): ValidationResult {
    const issues = this.validateBase(node);
    
    if (this.options.checkBusinessRules) {
      if (node.label && typeof node.label === 'string') {
        if (node.label.length > 100) {
          issues.push({
            code: 'LABEL_TOO_LONG',
            message: 'Group label exceeds 100 characters',
            severity: 'warning',
            path: 'label'
          });
        }
        
        issues.push(...this.checkXSS(node.label, 'label'));
      }
      
      if (node.backgroundStyle && 
          !['cover', 'ratio', 'repeat'].includes(node.backgroundStyle)) {
        issues.push({
          code: 'INVALID_BACKGROUND_STYLE',
          message: 'Invalid background style',
          severity: 'error',
          path: 'backgroundStyle',
          suggestion: 'Use one of: cover, ratio, repeat'
        });
      }
    }
    
    return this.createResult(node, issues);
  }
  
  /**
   * Validate a widget node.
   */
  visitWidgetNode(node: WidgetNode): ValidationResult {
    const issues = this.validateBase(node);
    
    if (this.options.checkRequired) {
      if (!node.widgetType || typeof node.widgetType !== 'string') {
        issues.push({
          code: 'MISSING_WIDGET_TYPE',
          message: 'Widget node must have a widget type',
          severity: 'error',
          path: 'widgetType'
        });
      }
      
      if (!node.widgetVersion || typeof node.widgetVersion !== 'string') {
        issues.push({
          code: 'MISSING_WIDGET_VERSION',
          message: 'Widget node must have a widget version',
          severity: 'error',
          path: 'widgetVersion'
        });
      }
      
      if (!node.createdBy || typeof node.createdBy !== 'string') {
        issues.push({
          code: 'MISSING_CREATED_BY',
          message: 'Widget node must have a creator ID',
          severity: 'error',
          path: 'createdBy'
        });
      }
    }
    
    if (this.options.checkBusinessRules) {
      // Check allowed widget types
      if (this.options.allowedWidgetTypes!.length > 0 &&
          !this.options.allowedWidgetTypes!.includes(node.widgetType)) {
        issues.push({
          code: 'DISALLOWED_WIDGET_TYPE',
          message: `Widget type '${node.widgetType}' is not allowed`,
          severity: 'error',
          path: 'widgetType',
          suggestion: `Use one of: ${this.options.allowedWidgetTypes!.join(', ')}`
        });
      }
      
      // Validate props is an object
      if (node.props && typeof node.props !== 'object') {
        issues.push({
          code: 'INVALID_PROPS',
          message: 'Widget props must be an object',
          severity: 'error',
          path: 'props'
        });
      }
      
      // Validate state is an object
      if (node.state && typeof node.state !== 'object') {
        issues.push({
          code: 'INVALID_STATE',
          message: 'Widget state must be an object',
          severity: 'error',
          path: 'state'
        });
      }
    }
    
    // Check for XSS in string props
    if (this.options.checkSecurity && node.props) {
      for (const [key, value] of Object.entries(node.props)) {
        if (typeof value === 'string') {
          const xssIssues = this.checkXSS(value, `props.${key}`);
          issues.push(...xssIssues);
        }
      }
    }
    
    return this.createResult(node, issues);
  }
}

/**
 * Validate multiple nodes and aggregate results.
 * 
 * @param nodes - Array of canvas nodes to validate
 * @param options - Validation options
 * @returns Aggregated validation results
 */
export function validateCanvas(
  nodes: CanvasNode[],
  options: Partial<ValidationOptions> = {}
): {
  valid: boolean;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  results: ValidationResult[];
} {
  const visitor = new ValidationVisitor(options);
  const { wrapNode } = require('../../utils/CanvasNodeWrapper');
  
  const results = nodes.map(node => {
    const wrapped = wrapNode(node);
    return wrapped.accept(visitor);
  });
  
  const allIssues = results.flatMap(r => r.issues);
  const errorCount = allIssues.filter(i => i.severity === 'error').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  
  return {
    valid: errorCount === 0,
    totalIssues: allIssues.length,
    errorCount,
    warningCount,
    results
  };
}

/**
 * Quick validation check - returns true if all nodes are valid.
 */
export function isCanvasValid(
  nodes: CanvasNode[],
  options: Partial<ValidationOptions> = {}
): boolean {
  return validateCanvas(nodes, options).valid;
}
