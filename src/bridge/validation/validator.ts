/**
 * Validator Implementation
 * 
 * Core validation engine for schema validation.
 * 
 * @module bridge/validation/validator
 */

import {
  ValidationError,
  type ValidationErrorDetail,
  type ErrorContext,
} from '../errors';

import { isJsonObject } from '../types';

import type {
  Schema,
  StringSchema,
  NumberSchema,
  BooleanSchema,
  ArraySchema,
  ObjectSchema,
  UnionSchema,
} from './schema-types';

/**
 * Validation context tracking path and errors
 */
interface ValidationContext {
  path: string[];
  errors: ValidationErrorDetail[];
  warnings: Array<{ path: string; message: string }>;
  options: ValidationOptions;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Stop on first error */
  abortEarly?: boolean;
  /** Allow additional properties not in schema */
  allowAdditional?: boolean;
  /** Strip additional properties */
  stripAdditional?: boolean;
  /** Coerce types when possible */
  coerceTypes?: boolean;
  /** Custom error context */
  errorContext?: ErrorContext;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorDetail[];
  warnings: Array<{ path: string; message: string }>;
  value: unknown;
}

/**
 * Schema validator class
 */
export class Validator {
  private readonly schema: Schema;
  private readonly options: ValidationOptions;

  constructor(schema: Schema, options: ValidationOptions = {}) {
    this.schema = schema;
    this.options = {
      abortEarly: false,
      allowAdditional: true,
      stripAdditional: false,
      coerceTypes: false,
      ...options,
    };
  }

  /**
   * Validate a value against the schema
   */
  validate(value: unknown): ValidationResult {
    const context: ValidationContext = {
      path: [],
      errors: [],
      warnings: [],
      options: this.options,
    };

    this.validateValue(value, this.schema, context);

    return {
      valid: context.errors.length === 0,
      errors: context.errors,
      warnings: context.warnings,
      value: value,
    };
  }

  /**
   * Validate and throw on error
   */
  validateOrThrow(value: unknown): void {
    const result = this.validate(value);
    if (!result.valid) {
      throw ValidationError.fromErrors(result.errors, this.options.errorContext);
    }
  }

  /**
   * Parse and validate (returns typed value or throws)
   */
  parse<T>(value: unknown): T {
    this.validateOrThrow(value);
    return value as T;
  }

  /**
   * Safe parse (returns result without throwing)
   */
  safeParse<T>(value: unknown): { success: true; data: T } | { success: false; error: ValidationError } {
    const result = this.validate(value);
    if (result.valid) {
      return { success: true, data: value as T };
    }
    return {
      success: false,
      error: ValidationError.fromErrors(result.errors, this.options.errorContext),
    };
  }

  private validateValue(value: unknown, schema: Schema, ctx: ValidationContext): void {
    if (value === null) {
      if (schema.nullable) {
        return;
      }
      this.addError(ctx, 'type', `Expected ${schema.type}, got null`);
      return;
    }

    if (value === undefined) {
      if (schema.required !== false) {
        this.addError(ctx, 'required', 'Value is required');
      }
      return;
    }

    switch (schema.type) {
      case 'string':
        this.validateString(value, schema, ctx);
        break;
      case 'number':
        this.validateNumber(value, schema, ctx);
        break;
      case 'boolean':
        this.validateBoolean(value, schema, ctx);
        break;
      case 'array':
        this.validateArray(value, schema, ctx);
        break;
      case 'object':
        this.validateObject(value, schema, ctx);
        break;
      case 'null':
        if (value !== null) {
          this.addError(ctx, 'type', 'Expected null');
        }
        break;
      case 'any':
        break;
      case 'union':
        this.validateUnion(value, schema, ctx);
        break;
    }
  }

  private validateString(value: unknown, schema: StringSchema, ctx: ValidationContext): void {
    if (typeof value !== 'string') {
      this.addError(ctx, 'type', `Expected string, got ${typeof value}`, 'string', typeof value);
      return;
    }

    if (schema.minLength !== undefined && value.length < schema.minLength) {
      this.addError(ctx, 'minLength', `String must be at least ${schema.minLength} characters`);
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      this.addError(ctx, 'maxLength', `String must be at most ${schema.maxLength} characters`);
    }

    if (schema.pattern) {
      const regex = typeof schema.pattern === 'string' ? new RegExp(schema.pattern) : schema.pattern;
      if (!regex.test(value)) {
        this.addError(ctx, 'pattern', `String must match pattern: ${schema.pattern}`);
      }
    }

    if (schema.enum && !schema.enum.includes(value)) {
      this.addError(ctx, 'enum', `Value must be one of: ${schema.enum.join(', ')}`);
    }

    if (schema.format) {
      this.validateStringFormat(value, schema.format, ctx);
    }
  }

  private validateStringFormat(value: string, format: NonNullable<StringSchema['format']>, ctx: ValidationContext): void {
    const formats: Record<string, RegExp> = {
      uri: /^https?:\/\/.+/,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      date: /^\d{4}-\d{2}-\d{2}$/,
      datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    };

    const regex = formats[format];
    if (regex && !regex.test(value)) {
      this.addError(ctx, 'format', `String must be a valid ${format}`);
    }
  }

  private validateNumber(value: unknown, schema: NumberSchema, ctx: ValidationContext): void {
    if (typeof value !== 'number' || isNaN(value)) {
      this.addError(ctx, 'type', `Expected number, got ${typeof value}`, 'number', typeof value);
      return;
    }

    if (schema.integer && !Number.isInteger(value)) {
      this.addError(ctx, 'integer', 'Number must be an integer');
    }

    if (schema.minimum !== undefined && value < schema.minimum) {
      this.addError(ctx, 'minimum', `Number must be >= ${schema.minimum}`);
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      this.addError(ctx, 'maximum', `Number must be <= ${schema.maximum}`);
    }

    if (schema.enum && !schema.enum.includes(value)) {
      this.addError(ctx, 'enum', `Value must be one of: ${schema.enum.join(', ')}`);
    }
  }

  private validateBoolean(value: unknown, schema: BooleanSchema, ctx: ValidationContext): void {
    if (typeof value !== 'boolean') {
      this.addError(ctx, 'type', `Expected boolean, got ${typeof value}`, 'boolean', typeof value);
    }
  }

  private validateArray(value: unknown, schema: ArraySchema, ctx: ValidationContext): void {
    if (!Array.isArray(value)) {
      this.addError(ctx, 'type', `Expected array, got ${typeof value}`, 'array', typeof value);
      return;
    }

    if (schema.minItems !== undefined && value.length < schema.minItems) {
      this.addError(ctx, 'minItems', `Array must have at least ${schema.minItems} items`);
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      this.addError(ctx, 'maxItems', `Array must have at most ${schema.maxItems} items`);
    }

    if (schema.uniqueItems) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) {
          this.addError(ctx, 'uniqueItems', 'Array items must be unique');
          break;
        }
        seen.add(key);
      }
    }

    for (let i = 0; i < value.length; i++) {
      ctx.path.push(`[${i}]`);
      this.validateValue(value[i], schema.items, ctx);
      ctx.path.pop();

      if (this.options.abortEarly && ctx.errors.length > 0) {
        break;
      }
    }
  }

  private validateObject(value: unknown, schema: ObjectSchema, ctx: ValidationContext): void {
    if (!isJsonObject(value)) {
      this.addError(ctx, 'type', `Expected object, got ${value === null ? 'null' : typeof value}`, 'object', typeof value);
      return;
    }

    const properties = schema.properties ?? {};
    const requiredFields = new Set(schema.requiredProperties ?? []);

    for (const key of requiredFields) {
      if (!(key in value) || value[key] === undefined) {
        ctx.path.push(key);
        this.addError(ctx, 'required', `Required field "${key}" is missing`);
        ctx.path.pop();
      }
    }

    for (const [key, propSchema] of Object.entries(properties)) {
      ctx.path.push(key);
      
      const propValue = value[key];
      if (propValue !== undefined) {
        this.validateValue(propValue, propSchema, ctx);
      } else if (requiredFields.has(key)) {
        // Already handled above
      } else if (propSchema.required !== false) {
        this.addError(ctx, 'required', `Field "${key}" is required`);
      }
      
      ctx.path.pop();

      if (this.options.abortEarly && ctx.errors.length > 0) {
        break;
      }
    }

    if (!this.options.allowAdditional && schema.additionalProperties === false) {
      const knownKeys = new Set(Object.keys(properties));
      for (const key of Object.keys(value)) {
        if (!knownKeys.has(key)) {
          ctx.path.push(key);
          this.addError(ctx, 'additionalProperties', `Additional property "${key}" is not allowed`);
          ctx.path.pop();
        }
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      const knownKeys = new Set(Object.keys(properties));
      for (const [key, val] of Object.entries(value)) {
        if (!knownKeys.has(key)) {
          ctx.path.push(key);
          this.validateValue(val, schema.additionalProperties, ctx);
          ctx.path.pop();
        }
      }
    }

    const propCount = Object.keys(value).length;
    if (schema.minProperties !== undefined && propCount < schema.minProperties) {
      this.addError(ctx, 'minProperties', `Object must have at least ${schema.minProperties} properties`);
    }
    if (schema.maxProperties !== undefined && propCount > schema.maxProperties) {
      this.addError(ctx, 'maxProperties', `Object must have at most ${schema.maxProperties} properties`);
    }
  }

  private validateUnion(value: unknown, schema: UnionSchema, ctx: ValidationContext): void {
    for (const subSchema of schema.oneOf) {
      const subCtx: ValidationContext = {
        path: [...ctx.path],
        errors: [],
        warnings: [],
        options: ctx.options,
      };

      this.validateValue(value, subSchema, subCtx);

      if (subCtx.errors.length === 0) {
        ctx.warnings.push(...subCtx.warnings);
        return;
      }
    }

    const types = schema.oneOf.map(s => s.type).join(' | ');
    this.addError(ctx, 'union', `Value must match one of: ${types}`);
  }

  private addError(
    ctx: ValidationContext,
    code: string,
    message: string,
    expected?: string,
    actual?: string
  ): void {
    ctx.errors.push({
      path: ctx.path.join('.') || '$',
      code,
      message,
      expected,
      actual,
    });
  }
}
