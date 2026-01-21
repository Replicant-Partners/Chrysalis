/**
 * Chrysalis Universal Agent Bridge - Guard Utilities
 * 
 * Provides defensive programming utilities including:
 * - Type guards with narrowing
 * - Null/undefined assertions
 * - Deep property access with defaults
 * - Invariant checking
 * 
 * @module bridge/guards
 * @version 1.0.0
 */

import { ValidationError, type ErrorContext } from './errors';

// ============================================================================
// Null/Undefined Guards
// ============================================================================

/**
 * Check if value is null or undefined
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if value is non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Check if value is non-empty array
 */
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Check if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Check if value is a function
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * Check if value is a Promise
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return (
    value instanceof Promise ||
    (typeof value === 'object' &&
      value !== null &&
      'then' in value &&
      typeof (value as Record<string, unknown>).then === 'function')
  );
}

// ============================================================================
// Assertion Guards
// ============================================================================

/**
 * Assert that a value is defined
 * @throws ValidationError if value is null or undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  name: string,
  context?: ErrorContext
): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(
      `${name} is required but was ${value}`,
      [{ path: name, code: 'required', message: `${name} is required` }],
      { ...context, metadata: { ...context?.metadata, field: name } }
    );
  }
}

/**
 * Assert that a value is a non-empty string
 */
export function assertNonEmptyString(
  value: unknown,
  name: string,
  context?: ErrorContext
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(
      `${name} must be a non-empty string`,
      [{ path: name, code: 'type', message: `${name} must be a non-empty string`, expected: 'string', actual: typeof value }],
      { ...context, metadata: { ...context?.metadata, field: name, actualType: typeof value, actualValue: value } }
    );
  }
}

/**
 * Assert that a value is a number
 */
export function assertNumber(
  value: unknown,
  name: string,
  context?: ErrorContext
): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError(
      `${name} must be a valid number`,
      [{ path: name, code: 'type', message: `${name} must be a valid number`, expected: 'number', actual: typeof value }],
      { ...context, metadata: { ...context?.metadata, field: name, actualType: typeof value } }
    );
  }
}

/**
 * Assert that a value is within a range
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  name: string,
  context?: ErrorContext
): asserts value is number {
  assertNumber(value, name, context);
  if (value < min || value > max) {
    throw new ValidationError(
      `${name} must be between ${min} and ${max}`,
      [{ path: name, code: 'range', message: `${name} must be between ${min} and ${max}` }],
      { ...context, metadata: { ...context?.metadata, field: name, actualValue: value, min, max } }
    );
  }
}

/**
 * Assert that a value is a boolean
 */
export function assertBoolean(
  value: unknown,
  name: string,
  context?: ErrorContext
): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(
      `${name} must be a boolean`,
      [{ path: name, code: 'type', message: `${name} must be a boolean`, expected: 'boolean', actual: typeof value }],
      { ...context, metadata: { ...context?.metadata, field: name, actualType: typeof value } }
    );
  }
}

/**
 * Assert that a value is an array
 */
export function assertArray<T>(
  value: unknown,
  name: string,
  context?: ErrorContext
): asserts value is T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(
      `${name} must be an array`,
      [{ path: name, code: 'type', message: `${name} must be an array`, expected: 'array', actual: typeof value }],
      { ...context, metadata: { ...context?.metadata, field: name, actualType: typeof value } }
    );
  }
}

/**
 * Assert that a value is a non-empty array
 */
export function assertNonEmptyArray<T>(
  value: unknown,
  name: string,
  context?: ErrorContext
): asserts value is T[] {
  assertArray(value, name, context);
  if (value.length === 0) {
    throw new ValidationError(
      `${name} must be a non-empty array`,
      [{ path: name, code: 'empty', message: `${name} must be a non-empty array` }],
      { ...context, metadata: { ...context?.metadata, field: name } }
    );
  }
}

/**
 * Assert that a value is an object
 */
export function assertObject(
  value: unknown,
  name: string,
  context?: ErrorContext
): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    throw new ValidationError(
      `${name} must be an object`,
      [{ path: name, code: 'type', message: `${name} must be an object`, expected: 'object', actual: actualType }],
      { ...context, metadata: { ...context?.metadata, field: name, actualType } }
    );
  }
}

/**
 * Assert that a value matches a type guard
 */
export function assertType<T>(
  value: unknown,
  guard: (v: unknown) => v is T,
  name: string,
  expectedType: string,
  context?: ErrorContext
): asserts value is T {
  if (!guard(value)) {
    throw new ValidationError(
      `${name} must be of type ${expectedType}`,
      [{ path: name, code: 'type', message: `${name} must be of type ${expectedType}`, expected: expectedType, actual: typeof value }],
      { ...context, metadata: { ...context?.metadata, field: name, expectedType, actualType: typeof value } }
    );
  }
}

// ============================================================================
// Safe Property Access
// ============================================================================

/**
 * Safely get a nested property with a default value
 */
export function get<T, D>(
  obj: unknown,
  path: string | string[],
  defaultValue: D
): T | D {
  const keys = Array.isArray(path) ? path : path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return (current === undefined ? defaultValue : current) as T | D;
}

/**
 * Safely get a nested property, throwing if not found
 */
export function getOrThrow<T>(
  obj: unknown,
  path: string | string[],
  name?: string
): T {
  const keys = Array.isArray(path) ? path : path.split('.');
  const pathStr = Array.isArray(path) ? path.join('.') : path;
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      throw new ValidationError(
        `Property ${name ?? pathStr} not found at '${key}'`,
        [{ path: pathStr, code: 'not_found', message: `Property not found at '${key}'` }],
        { metadata: { field: pathStr } }
      );
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  if (current === undefined) {
    throw new ValidationError(
      `Property ${name ?? pathStr} is undefined`,
      [{ path: pathStr, code: 'undefined', message: `Property ${name ?? pathStr} is undefined` }],
      { metadata: { field: pathStr } }
    );
  }
  
  return current as T;
}

/**
 * Check if object has a property
 */
export function has(obj: unknown, key: string): boolean {
  return obj !== null && obj !== undefined && key in (obj as object);
}

/**
 * Check if object has a property with a specific type
 */
export function hasTyped<T>(
  obj: unknown,
  key: string,
  guard: (v: unknown) => v is T
): boolean {
  return has(obj, key) && guard((obj as Record<string, unknown>)[key]);
}

// ============================================================================
// Default Value Helpers
// ============================================================================

/**
 * Return first defined value
 */
export function coalesce<T>(...values: (T | null | undefined)[]): T | undefined {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return undefined;
}

/**
 * Return first defined value or throw
 */
export function coalesceOrThrow<T>(
  name: string,
  ...values: (T | null | undefined)[]
): T {
  const result = coalesce(...values);
  if (result === undefined) {
    throw new ValidationError(`No defined value found for ${name}`);
  }
  return result;
}

/**
 * Provide a default value for null/undefined
 */
export function withDefault<T>(value: T | null | undefined, defaultValue: T): T {
  return value ?? defaultValue;
}

/**
 * Provide a lazy default value for null/undefined
 */
export function withLazyDefault<T>(
  value: T | null | undefined,
  getDefault: () => T
): T {
  return value ?? getDefault();
}

// ============================================================================
// Invariant Checking
// ============================================================================

/**
 * Assert an invariant condition
 * @throws Error if condition is false
 */
export function invariant(
  condition: unknown,
  message: string | (() => string)
): asserts condition {
  if (!condition) {
    const errorMessage = typeof message === 'function' ? message() : message;
    throw new Error(`Invariant violation: ${errorMessage}`);
  }
}

// ============================================================================
// Object Utilities
// ============================================================================

/**
 * Pick defined properties from an object
 */
export function pickDefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  
  return result;
}

/**
 * Omit null and undefined values from an object
 */
export function omitNullish<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  
  return result;
}

/**
 * Deep freeze an object
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  
  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  }
  
  return obj;
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Ensure value is an array
 */
export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Filter out nullish values from an array
 */
export function filterNullish<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((item): item is T => item !== null && item !== undefined);
}

/**
 * Find first item matching predicate or throw
 */
export function findOrThrow<T>(
  arr: T[],
  predicate: (item: T, index: number) => boolean,
  message?: string
): T {
  const item = arr.find(predicate);
  if (item === undefined) {
    throw new ValidationError(message ?? 'Item not found in array');
  }
  return item;
}

/**
 * Get first item or throw
 */
export function firstOrThrow<T>(arr: T[], message?: string): T {
  if (arr.length === 0) {
    throw new ValidationError(message ?? 'Array is empty');
  }
  return arr[0];
}

/**
 * Get last item or throw
 */
export function lastOrThrow<T>(arr: T[], message?: string): T {
  if (arr.length === 0) {
    throw new ValidationError(message ?? 'Array is empty');
  }
  return arr[arr.length - 1];
}

// ============================================================================
// Type Narrowing Helpers
// ============================================================================

/**
 * Create a type guard from a set of allowed values
 */
export function isOneOf<T extends string | number | boolean>(
  allowedValues: readonly T[]
): (value: unknown) => value is T {
  const set = new Set<unknown>(allowedValues);
  return (value): value is T => set.has(value);
}

/**
 * Create a type guard for objects with required keys
 */
export function hasKeys<K extends string>(
  ...keys: K[]
): (value: unknown) => value is Record<K, unknown> {
  return (value): value is Record<K, unknown> => {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    return keys.every((key) => key in value);
  };
}

/**
 * Create a negated type guard
 */
export function not<T>(
  guard: (value: unknown) => value is T
): (value: unknown) => value is Exclude<unknown, T> {
  return (value): value is Exclude<unknown, T> => !guard(value);
}

// ============================================================================
// Error Boundary Helpers
// ============================================================================

/**
 * Execute a function and return undefined on error
 */
export function tryOrUndefined<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/**
 * Execute a function and return default on error
 */
export function tryOrDefault<T>(fn: () => T, defaultValue: T): T {
  try {
    return fn();
  } catch {
    return defaultValue;
  }
}

/**
 * Execute an async function and return undefined on error
 */
export async function tryAsyncOrUndefined<T>(
  fn: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

/**
 * Execute an async function and return default on error
 */
export async function tryAsyncOrDefault<T>(
  fn: () => Promise<T>,
  defaultValue: T
): Promise<T> {
  try {
    return await fn();
  } catch {
    return defaultValue;
  }
}
