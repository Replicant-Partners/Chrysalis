/**
 * Schema Registry
 * 
 * Registry for framework-specific schemas with validation support.
 * 
 * @module bridge/validation/schema-registry
 */

import type { AgentFramework } from '../types';
import type { Schema } from './schema-types';
import { Validator, type ValidationOptions, type ValidationResult } from './validator';
import { USAAgentSchema, LMOSAgentSchema, MCPAgentSchema } from './agent-schemas';

/**
 * Schema registry for framework-specific schemas
 */
export class SchemaRegistry {
  private static instance: SchemaRegistry;
  private schemas = new Map<AgentFramework, Schema>();

  private constructor() {
    this.schemas.set('usa', USAAgentSchema);
    this.schemas.set('lmos', LMOSAgentSchema);
    this.schemas.set('mcp', MCPAgentSchema);
  }

  static getInstance(): SchemaRegistry {
    if (!SchemaRegistry.instance) {
      SchemaRegistry.instance = new SchemaRegistry();
    }
    return SchemaRegistry.instance;
  }

  /**
   * Get schema for framework
   */
  getSchema(framework: AgentFramework): Schema | undefined {
    return this.schemas.get(framework);
  }

  /**
   * Register a schema for a framework
   */
  registerSchema(framework: AgentFramework, schema: Schema): void {
    this.schemas.set(framework, schema);
  }

  /**
   * Check if schema exists for framework
   */
  hasSchema(framework: AgentFramework): boolean {
    return this.schemas.has(framework);
  }

  /**
   * Create validator for framework
   */
  createValidator(framework: AgentFramework, options?: ValidationOptions): Validator | null {
    const schema = this.schemas.get(framework);
    if (!schema) return null;
    return new Validator(schema, options);
  }

  /**
   * Validate agent data against framework schema
   */
  validateAgent(
    framework: AgentFramework,
    data: unknown,
    options?: ValidationOptions
  ): ValidationResult {
    const schema = this.schemas.get(framework);
    if (!schema) {
      return {
        valid: false,
        errors: [{
          path: '$',
          code: 'schema_not_found',
          message: `No schema registered for framework: ${framework}`,
        }],
        warnings: [],
        value: data,
      };
    }

    const validator = new Validator(schema, options);
    return validator.validate(data);
  }
}

/**
 * Get the global schema registry
 */
export const schemaRegistry = SchemaRegistry.getInstance();
