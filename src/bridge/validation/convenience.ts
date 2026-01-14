/**
 * Convenience Functions
 * 
 * Helper functions for common validation tasks.
 * 
 * @module bridge/validation/convenience
 */

import type { AgentFramework } from '../types';
import { ValidationError } from '../errors';
import type { Schema } from './schema-types';
import { Validator, type ValidationOptions, type ValidationResult } from './validator';
import { USAAgentSchema, LMOSAgentSchema, MCPAgentSchema } from './agent-schemas';
import { schemaRegistry } from './schema-registry';

/**
 * Validate USA agent data
 */
export function validateUSAAgent(data: unknown, options?: ValidationOptions): ValidationResult {
  return new Validator(USAAgentSchema, options).validate(data);
}

/**
 * Validate LMOS agent data
 */
export function validateLMOSAgent(data: unknown, options?: ValidationOptions): ValidationResult {
  return new Validator(LMOSAgentSchema, options).validate(data);
}

/**
 * Validate MCP agent data
 */
export function validateMCPAgent(data: unknown, options?: ValidationOptions): ValidationResult {
  return new Validator(MCPAgentSchema, options).validate(data);
}

/**
 * Validate agent data by framework
 */
export function validateAgentByFramework(
  framework: AgentFramework,
  data: unknown,
  options?: ValidationOptions
): ValidationResult {
  return schemaRegistry.validateAgent(framework, data, options);
}

/**
 * Create a type-safe validator for a schema
 */
export function createValidator<T>(schema: Schema, options?: ValidationOptions): {
  validate: (value: unknown) => ValidationResult;
  parse: (value: unknown) => T;
  safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: ValidationError };
} {
  const validator = new Validator(schema, options);
  return {
    validate: (value) => validator.validate(value),
    parse: (value) => validator.parse<T>(value),
    safeParse: (value) => validator.safeParse<T>(value),
  };
}
