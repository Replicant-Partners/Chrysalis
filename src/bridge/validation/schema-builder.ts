/**
 * Schema Builder (Fluent API)
 * 
 * Provides a fluent API for constructing schema definitions.
 * 
 * @module bridge/validation/schema-builder
 */

import type {
  Schema,
  StringSchema,
  NumberSchema,
  BooleanSchema,
  ArraySchema,
  ObjectSchema,
  NullSchema,
  AnySchema,
  UnionSchema,
} from './schema-types';

/**
 * Schema builder for fluent schema construction
 */
export class SchemaBuilder {
  /**
   * Create a string schema
   */
  static string(options: Partial<Omit<StringSchema, 'type'>> = {}): StringSchema {
    return { type: 'string', ...options };
  }

  /**
   * Create a number schema
   */
  static number(options: Partial<Omit<NumberSchema, 'type'>> = {}): NumberSchema {
    return { type: 'number', ...options };
  }

  /**
   * Create an integer schema
   */
  static integer(options: Partial<Omit<NumberSchema, 'type' | 'integer'>> = {}): NumberSchema {
    return { type: 'number', integer: true, ...options };
  }

  /**
   * Create a boolean schema
   */
  static boolean(options: Partial<Omit<BooleanSchema, 'type'>> = {}): BooleanSchema {
    return { type: 'boolean', ...options };
  }

  /**
   * Create an array schema
   */
  static array(items: Schema, options: Partial<Omit<ArraySchema, 'type' | 'items'>> = {}): ArraySchema {
    return { type: 'array', items, ...options };
  }

  /**
   * Create an object schema
   */
  static object(
    properties: Record<string, Schema>,
    options: Partial<Omit<ObjectSchema, 'type' | 'properties'>> = {}
  ): ObjectSchema {
    return { type: 'object', properties, ...options };
  }

  /**
   * Create a null schema
   */
  static null(): NullSchema {
    return { type: 'null' };
  }

  /**
   * Create an any schema
   */
  static any(): AnySchema {
    return { type: 'any' };
  }

  /**
   * Create a union schema
   */
  static union(oneOf: Schema[]): UnionSchema {
    return { type: 'union', oneOf };
  }

  /**
   * Create an optional schema
   */
  static optional<S extends Schema>(schema: S): S {
    return { ...schema, required: false };
  }

  /**
   * Create a nullable schema
   */
  static nullable<S extends Schema>(schema: S): S {
    return { ...schema, nullable: true };
  }

  /**
   * Create an enum schema
   */
  static enum<T extends string | number>(values: readonly T[]): T extends string ? StringSchema : NumberSchema {
    if (typeof values[0] === 'string') {
      return { type: 'string', enum: values as unknown as string[] } as T extends string ? StringSchema : NumberSchema;
    }
    return { type: 'number', enum: values as unknown as number[] } as T extends string ? StringSchema : NumberSchema;
  }

  /**
   * Create a record schema (object with dynamic keys)
   */
  static record(valueSchema: Schema): ObjectSchema {
    return {
      type: 'object',
      additionalProperties: valueSchema,
    };
  }
}

/**
 * Shorthand alias for SchemaBuilder
 */
export const S = SchemaBuilder;
