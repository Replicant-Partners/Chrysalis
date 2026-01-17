/**
 * Framework Adapter - Abstract interface for framework-specific adapters
 * 
 * All framework adapters must implement this interface to enable
 * bidirectional conversion between the framework and Uniform Semantic Agent format.
 */

import type { UniformSemanticAgent, ValidationResult } from './UniformSemanticAgent';

/**
 * Encrypted shadow data structure
 */
export interface EncryptedShadow {
  encrypted: string;      // Base64 encoded ciphertext
  algorithm: string;      // e.g., "aes-256-gcm"
  iv: string;            // Initialization vector (base64)
  authTag: string;       // Authentication tag (base64)
  signature: string;     // Digital signature (base64)
  metadata: {
    framework: string;   // Source framework name
    version: string;     // Shadow schema version
    timestamp: number;   // Creation timestamp
    checksum: string;    // Data integrity checksum
  };
}

/**
 * Shadow data before encryption
 */
export interface ShadowData<
  TFrameworkAgent = unknown,
  TUniversal extends UniformSemanticAgent = UniformSemanticAgent
> {
  framework: string;
  version: string;
  timestamp: number;
  data: {
    // Framework-specific non-mappable fields
    [key: string]: unknown;

    // Always include complete original and universal
    _original: TFrameworkAgent;
    _universal: TUniversal;
  };
  checksum: string;
}

/**
 * Field mapping configuration
 */
export interface FieldMapping<TFrameworkAgent = unknown> {
  // Direct 1:1 mappings
  direct?: Record<string, string>;

  // Derived mappings (computed from multiple fields)
  derived?: Record<string, (agent: TFrameworkAgent) => unknown>;

  // Partial mappings (requires transformation)
  partial?: Record<string, (agent: TFrameworkAgent) => unknown>;

  // Non-mappable fields (go in shadow)
  nonMappable?: string[];
}

/**
 * Abstract Framework Adapter
 * 
 * All framework adapters must extend this class or implement this interface.
 */
export abstract class FrameworkAdapter<
  TFrameworkAgent = unknown,
  TUniversal extends UniformSemanticAgent = UniformSemanticAgent
> {
  // Adapter metadata
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly supports_shadow: boolean;

  // Optional field mapping
  protected fieldMapping?: FieldMapping<TFrameworkAgent>;

  /**
   * Convert framework-specific agent to Uniform Semantic Agent
   */
  abstract toUniversal(frameworkAgent: TFrameworkAgent): Promise<TUniversal>;

  /**
   * Convert Uniform Semantic Agent to framework-specific format
   */
  abstract fromUniversal(universalAgent: TUniversal): Promise<TFrameworkAgent>;

  /**
   * Embed encrypted shadow data in framework agent
   */
  abstract embedShadow(
    frameworkAgent: TFrameworkAgent,
    shadow: EncryptedShadow
  ): Promise<TFrameworkAgent>;

  /**
   * Extract encrypted shadow data from framework agent
   */
  abstract extractShadow(frameworkAgent: TFrameworkAgent): Promise<EncryptedShadow | null>;

  /**
   * Validate framework-specific agent
   */
  abstract validate(frameworkAgent: TFrameworkAgent): Promise<ValidationResult>;

  /**
   * Get list of fields that can be mapped to universal format
   */
  getMappableFields(): string[] {
    if (!this.fieldMapping) return [];

    return [
      ...Object.keys(this.fieldMapping.direct || {}),
      ...Object.keys(this.fieldMapping.derived || {}),
      ...Object.keys(this.fieldMapping.partial || {})
    ];
  }

  /**
   * Extract non-mappable fields from framework agent
   */
  getNonMappableFields(frameworkAgent: TFrameworkAgent): Record<string, unknown> {
    if (!this.fieldMapping?.nonMappable) return {};

    const nonMappable: Record<string, unknown> = {};

    for (const fieldPath of this.fieldMapping.nonMappable) {
      const value = this.getNestedValue(frameworkAgent, fieldPath);
      if (value !== undefined) {
        nonMappable[fieldPath] = value;
      }
    }

    return nonMappable;
  }

  /**
   * Helper: Get nested value from object using dot notation
   */
  protected getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Helper: Set nested value in object using dot notation
   */
  protected setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current)) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Apply field mappings
   */
  protected applyMappings(source: any, target: any, reverse: boolean = false): void {
    if (!this.fieldMapping) return;

    // Apply direct mappings
    if (this.fieldMapping.direct) {
      for (const [sourcePath, targetPath] of Object.entries(this.fieldMapping.direct)) {
        const [from, to] = reverse ? [targetPath, sourcePath] : [sourcePath, targetPath];
        const value = this.getNestedValue(source, from);
        if (value !== undefined) {
          this.setNestedValue(target, to, value);
        }
      }
    }

    // Apply derived mappings (only in forward direction)
    if (!reverse && this.fieldMapping.derived) {
      for (const [targetPath, deriveFn] of Object.entries(this.fieldMapping.derived)) {
        const value = deriveFn(source);
        if (value !== undefined) {
          this.setNestedValue(target, targetPath, value);
        }
      }
    }

    // Apply partial mappings
    if (this.fieldMapping.partial) {
      for (const [targetPath, transformFn] of Object.entries(this.fieldMapping.partial)) {
        const value = transformFn(source);
        if (value !== undefined) {
          this.setNestedValue(target, targetPath, value);
        }
      }
    }
  }
}

/**
 * Type guard to check if object is a FrameworkAdapter
 */
export function isFrameworkAdapter(obj: any): obj is FrameworkAdapter {
  return (
    typeof obj === 'object' &&
    'name' in obj &&
    'version' in obj &&
    'toUniversal' in obj &&
    'fromUniversal' in obj &&
    'embedShadow' in obj &&
    'extractShadow' in obj &&
    'validate' in obj
  );
}
