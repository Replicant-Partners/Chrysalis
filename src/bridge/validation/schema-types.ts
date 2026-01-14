/**
 * Schema Definition Types
 * 
 * Core type definitions for the validation schema system.
 * 
 * @module bridge/validation/schema-types
 */

/**
 * Schema types supported
 */
export type SchemaType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'array' 
  | 'object' 
  | 'null'
  | 'any'
  | 'union';

/**
 * Base schema definition
 */
export interface SchemaDefinition {
  type: SchemaType;
  required?: boolean;
  nullable?: boolean;
  description?: string;
}

/**
 * String schema
 */
export interface StringSchema extends SchemaDefinition {
  type: 'string';
  minLength?: number;
  maxLength?: number;
  pattern?: string | RegExp;
  enum?: string[];
  format?: 'uri' | 'email' | 'date' | 'datetime' | 'uuid';
}

/**
 * Number schema
 */
export interface NumberSchema extends SchemaDefinition {
  type: 'number';
  minimum?: number;
  maximum?: number;
  integer?: boolean;
  enum?: number[];
}

/**
 * Boolean schema
 */
export interface BooleanSchema extends SchemaDefinition {
  type: 'boolean';
}

/**
 * Array schema
 */
export interface ArraySchema extends SchemaDefinition {
  type: 'array';
  items: Schema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

/**
 * Object schema
 */
export interface ObjectSchema extends Omit<SchemaDefinition, 'required'> {
  type: 'object';
  /** Whether this object is required (inherited semantic) */
  required?: boolean;
  properties?: Record<string, Schema>;
  /** List of property names that are required within this object */
  requiredProperties?: string[];
  additionalProperties?: boolean | Schema;
  minProperties?: number;
  maxProperties?: number;
}

/**
 * Null schema
 */
export interface NullSchema extends SchemaDefinition {
  type: 'null';
}

/**
 * Any schema (allows any value)
 */
export interface AnySchema extends SchemaDefinition {
  type: 'any';
}

/**
 * Union schema (one of multiple types)
 */
export interface UnionSchema extends SchemaDefinition {
  type: 'union';
  oneOf: Schema[];
}

/**
 * Combined schema type
 */
export type Schema =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | ArraySchema
  | ObjectSchema
  | NullSchema
  | AnySchema
  | UnionSchema;
