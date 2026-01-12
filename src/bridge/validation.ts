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

import {
  ValidationError,
  SchemaValidationError,
  RequiredFieldError,
  TypeMismatchError,
  type ValidationErrorDetail,
  type ErrorContext,
} from './errors';

import {
  type AgentFramework,
  type AgentData,
  type USAAgentData,
  type LMOSAgentData,
  type MCPAgentData,
  type JsonValue,
  type JsonObject,
  isJsonObject,
  isJsonValue,
  isAgentFramework,
} from './types';

// ============================================================================
// Schema Definition Types
// ============================================================================

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

// ============================================================================
// Schema Builder (Fluent API)
// ============================================================================

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

// Shorthand aliases
export const S = SchemaBuilder;

// ============================================================================
// Validation Context
// ============================================================================

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

// ============================================================================
// Validator Implementation
// ============================================================================

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

  // ==========================================================================
  // Internal Validation Methods
  // ==========================================================================

  private validateValue(value: unknown, schema: Schema, ctx: ValidationContext): void {
    // Handle null
    if (value === null) {
      if (schema.nullable) {
        return;
      }
      this.addError(ctx, 'type', `Expected ${schema.type}, got null`);
      return;
    }

    // Handle undefined (missing required)
    if (value === undefined) {
      if (schema.required !== false) {
        this.addError(ctx, 'required', 'Value is required');
      }
      return;
    }

    // Dispatch to type-specific validation
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
        // Any value is valid
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

    // Validate each item
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

    // Check required fields
    for (const key of requiredFields) {
      if (!(key in value) || value[key] === undefined) {
        ctx.path.push(key);
        this.addError(ctx, 'required', `Required field "${key}" is missing`);
        ctx.path.pop();
      }
    }

    // Validate known properties
    for (const [key, propSchema] of Object.entries(properties)) {
      ctx.path.push(key);
      
      const propValue = value[key];
      if (propValue !== undefined) {
        this.validateValue(propValue, propSchema, ctx);
      } else if (requiredFields.has(key)) {
        // Already handled above
      } else if (propSchema.required !== false) {
        // Property defined in schema but missing - check if required
        this.addError(ctx, 'required', `Field "${key}" is required`);
      }
      
      ctx.path.pop();

      if (this.options.abortEarly && ctx.errors.length > 0) {
        break;
      }
    }

    // Check additional properties
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
      // Validate additional properties against schema
      const knownKeys = new Set(Object.keys(properties));
      for (const [key, val] of Object.entries(value)) {
        if (!knownKeys.has(key)) {
          ctx.path.push(key);
          this.validateValue(val, schema.additionalProperties, ctx);
          ctx.path.pop();
        }
      }
    }

    // Check property count
    const propCount = Object.keys(value).length;
    if (schema.minProperties !== undefined && propCount < schema.minProperties) {
      this.addError(ctx, 'minProperties', `Object must have at least ${schema.minProperties} properties`);
    }
    if (schema.maxProperties !== undefined && propCount > schema.maxProperties) {
      this.addError(ctx, 'maxProperties', `Object must have at most ${schema.maxProperties} properties`);
    }
  }

  private validateUnion(value: unknown, schema: UnionSchema, ctx: ValidationContext): void {
    // Try each schema in the union
    for (const subSchema of schema.oneOf) {
      const subCtx: ValidationContext = {
        path: [...ctx.path],
        errors: [],
        warnings: [],
        options: ctx.options,
      };

      this.validateValue(value, subSchema, subCtx);

      if (subCtx.errors.length === 0) {
        // Found a matching schema
        ctx.warnings.push(...subCtx.warnings);
        return;
      }
    }

    // None matched
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

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorDetail[];
  warnings: Array<{ path: string; message: string }>;
  value: unknown;
}

// ============================================================================
// Pre-defined Agent Schemas
// ============================================================================

/**
 * USA Agent metadata schema
 */
const USAMetadataSchema = S.object({
  name: S.string({ minLength: 1 }),
  version: S.optional(S.string()),
  description: S.optional(S.string()),
  author: S.optional(S.string()),
  tags: S.optional(S.array(S.string())),
}, { requiredProperties: ['name'] });

/**
 * USA Agent identity schema
 */
const USAIdentitySchema = S.object({
  role: S.string({ minLength: 1 }),
  goal: S.string({ minLength: 1 }),
  backstory: S.optional(S.string()),
  personality_traits: S.optional(S.record(S.union([S.string(), S.number(), S.boolean()]))),
  constraints: S.optional(S.array(S.string())),
}, { requiredProperties: ['role', 'goal'] });

/**
 * USA Agent tool schema
 */
const USAToolSchema = S.object({
  name: S.string({ minLength: 1 }),
  protocol: S.optional(S.string()),
  config: S.optional(S.record(S.any())),
  description: S.optional(S.string()),
}, { requiredProperties: ['name'] });

/**
 * USA Agent LLM schema
 */
const USALLMSchema = S.object({
  provider: S.string({ minLength: 1 }),
  model: S.string({ minLength: 1 }),
  temperature: S.optional(S.number({ minimum: 0, maximum: 2 })),
  max_tokens: S.optional(S.integer({ minimum: 1 })),
}, { requiredProperties: ['provider', 'model'] });

/**
 * Complete USA Agent schema
 */
export const USAAgentSchema = S.object({
  apiVersion: S.string({ pattern: /^usa\/v\d+/ }),
  kind: S.enum(['Agent'] as const),
  metadata: USAMetadataSchema,
  identity: USAIdentitySchema,
  capabilities: S.object({
    tools: S.optional(S.array(USAToolSchema)),
    reasoning: S.optional(S.object({
      strategy: S.string(),
      max_iterations: S.optional(S.integer({ minimum: 1 })),
      allow_backtracking: S.optional(S.boolean()),
    })),
    memory: S.optional(S.object({
      architecture: S.string(),
      working: S.optional(S.object({
        enabled: S.boolean(),
        max_tokens: S.optional(S.integer({ minimum: 1 })),
      })),
      episodic: S.optional(S.object({
        enabled: S.boolean(),
        storage: S.optional(S.string()),
      })),
      semantic: S.optional(S.object({
        enabled: S.boolean(),
        storage: S.optional(S.string()),
      })),
      procedural: S.optional(S.object({
        enabled: S.boolean(),
      })),
      core: S.optional(S.object({
        enabled: S.boolean(),
        blocks: S.optional(S.array(S.object({
          name: S.string(),
          content: S.string(),
        }))),
      })),
    })),
  }),
  execution: S.object({
    llm: USALLMSchema,
    runtime: S.optional(S.object({
      timeout: S.optional(S.integer({ minimum: 1 })),
      max_iterations: S.optional(S.integer({ minimum: 1 })),
    })),
  }, { requiredProperties: ['llm'] }),
  protocols: S.optional(S.object({
    mcp: S.optional(S.object({
      enabled: S.boolean(),
      role: S.optional(S.string()),
    })),
    a2a: S.optional(S.object({
      enabled: S.boolean(),
    })),
    agent_protocol: S.optional(S.object({
      enabled: S.boolean(),
      endpoint: S.optional(S.string({ format: 'uri' })),
    })),
  })),
}, { requiredProperties: ['apiVersion', 'kind', 'metadata', 'identity', 'execution'] });

/**
 * LMOS Agent schema (W3C WoT Thing Description based)
 */
export const LMOSAgentSchema = S.object({
  '@context': S.union([
    S.string(),
    S.array(S.union([S.string(), S.record(S.any())])),
    S.record(S.any()),
  ]),
  '@type': S.optional(S.union([S.string(), S.array(S.string())])),
  id: S.string({ minLength: 1 }),
  title: S.string({ minLength: 1 }),
  description: S.optional(S.string()),
  version: S.optional(S.object({
    instance: S.optional(S.string()),
    model: S.optional(S.string()),
  })),
  securityDefinitions: S.optional(S.record(S.object({
    scheme: S.string(),
    description: S.optional(S.string()),
    pubKeyPem: S.optional(S.string()),
  }))),
  security: S.optional(S.union([S.string(), S.array(S.string())])),
  properties: S.optional(S.record(S.object({
    type: S.optional(S.string()),
    title: S.optional(S.string()),
    description: S.optional(S.string()),
    observable: S.optional(S.boolean()),
  }))),
  actions: S.optional(S.record(S.object({
    title: S.optional(S.string()),
    description: S.optional(S.string()),
    input: S.optional(S.record(S.any())),
    output: S.optional(S.record(S.any())),
    forms: S.optional(S.array(S.object({
      href: S.string(),
      contentType: S.optional(S.string()),
    }))),
  }))),
  events: S.optional(S.record(S.object({
    title: S.optional(S.string()),
    description: S.optional(S.string()),
    data: S.optional(S.record(S.any())),
  }))),
  forms: S.optional(S.array(S.object({
    href: S.string(),
    contentType: S.optional(S.string()),
    subprotocol: S.optional(S.string()),
    op: S.optional(S.union([S.string(), S.array(S.string())])),
  }))),
  'lmos:agentClass': S.optional(S.string()),
  'lmos:capabilities': S.optional(S.array(S.string())),
  'lmos:llmConfig': S.optional(S.object({
    provider: S.string(),
    model: S.string(),
    temperature: S.optional(S.number()),
    maxTokens: S.optional(S.integer()),
    systemPrompt: S.optional(S.string()),
  })),
  'lmos:memory': S.optional(S.object({
    type: S.string(),
    vectorStore: S.optional(S.object({
      provider: S.string(),
      config: S.optional(S.record(S.any())),
    })),
    contextWindow: S.optional(S.integer()),
  })),
  'lmos:protocols': S.optional(S.object({
    mcp: S.optional(S.boolean()),
    a2a: S.optional(S.boolean()),
    http: S.optional(S.boolean()),
    websocket: S.optional(S.boolean()),
  })),
}, { requiredProperties: ['@context', 'id', 'title'] });

/**
 * MCP Agent schema
 */
export const MCPAgentSchema = S.object({
  name: S.string({ minLength: 1 }),
  version: S.string(),
  description: S.optional(S.string()),
  tools: S.optional(S.array(S.object({
    name: S.string({ minLength: 1 }),
    description: S.string(),
    inputSchema: S.record(S.any()),
  }))),
  resources: S.optional(S.array(S.object({
    uri: S.string(),
    name: S.string(),
    description: S.optional(S.string()),
    mimeType: S.optional(S.string()),
  }))),
  prompts: S.optional(S.array(S.object({
    name: S.string(),
    description: S.optional(S.string()),
    arguments: S.optional(S.array(S.object({
      name: S.string(),
      description: S.optional(S.string()),
      required: S.optional(S.boolean()),
    }))),
  }))),
}, { requiredProperties: ['name', 'version'] });

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Schema registry for framework-specific schemas
 */
export class SchemaRegistry {
  private static instance: SchemaRegistry;
  private schemas = new Map<AgentFramework, Schema>();

  private constructor() {
    // Register default schemas
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

// ============================================================================
// Convenience Functions
// ============================================================================

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
