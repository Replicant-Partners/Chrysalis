/**
 * Chrysalis Universal Agent Bridge - Schema Validation Layer
 * 
 * Provides structural validation for external agent data using a
 * lightweight, type-safe schema validation approach. Supports both
 * compile-time type inference and runtime validation.
 * 
 * @module bridge/validation
 * @version 1.0.0
 */

// Schema types
export type {
  SchemaType,
  SchemaDefinition,
  StringSchema,
  NumberSchema,
  BooleanSchema,
  ArraySchema,
  ObjectSchema,
  NullSchema,
  AnySchema,
  UnionSchema,
  Schema,
} from './schema-types';

// Schema builder
export { SchemaBuilder, S } from './schema-builder';

// Validator
export { Validator, type ValidationOptions, type ValidationResult } from './validator';

// Agent schemas
export { USAAgentSchema, LMOSAgentSchema, MCPAgentSchema } from './agent-schemas';

// Schema registry
export { SchemaRegistry, schemaRegistry } from './schema-registry';

// Convenience functions
export {
  validateUSAAgent,
  validateLMOSAgent,
  validateMCPAgent,
  validateAgentByFramework,
  createValidator,
} from './convenience';
