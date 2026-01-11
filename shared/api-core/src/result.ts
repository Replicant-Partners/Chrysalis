/**
 * Result Type Pattern Implementation for Chrysalis API
 * 
 * Provides monadic error handling as an alternative to exception-based patterns.
 * Implements Success/Failure discriminated union with functional combinators.
 * 
 * Design Rationale:
 * - Aligns with Decision 4 (ValidationStrategy) - enables runtime selection between
 *   imperative validation (throwing) and functional validation (Result-returning)
 * - Aligns with Decision 7 (Hexagonal Architecture) - Result types are framework-agnostic
 *   and belong in the domain layer
 * - Complements existing APIError taxonomy for consistent error representation
 * 
 * @module result
 */

import { APIError, ErrorCode, ErrorCategory, ErrorDetail } from './models';

// ============================================================================
// Core Result Type Definitions
// ============================================================================

/**
 * Discriminant tag for Success variant.
 * Using const assertion for literal type inference.
 */
const SUCCESS_TAG = 'Success' as const;

/**
 * Discriminant tag for Failure variant.
 */
const FAILURE_TAG = 'Failure' as const;

/**
 * Success variant of Result type.
 * Contains a value of type T representing successful computation.
 */
export interface Success<T> {
  readonly _tag: typeof SUCCESS_TAG;
  readonly value: T;
}

/**
 * Failure variant of Result type.
 * Contains an error of type E representing failed computation.
 * Default error type is APIError for consistency with existing error taxonomy.
 */
export interface Failure<E = APIError> {
  readonly _tag: typeof FAILURE_TAG;
  readonly error: E;
}

/**
 * Result type representing either Success<T> or Failure<E>.
 * This is a discriminated union that enables exhaustive pattern matching.
 * 
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error (defaults to APIError)
 * 
 * @example
 * ```typescript
 * function parseInteger(input: string): Result<number> {
 *   const parsed = parseInt(input, 10);
 *   if (isNaN(parsed)) {
 *     return failure(createValidationError('Input must be a valid integer'));
 *   }
 *   return success(parsed);
 * }
 * 
 * const result = parseInteger('42');
 * const display = fold(
 *   result,
 *   (value) => `Parsed: ${value}`,
 *   (error) => `Error: ${error.message}`
 * );
 * ```
 */
export type Result<T, E = APIError> = Success<T> | Failure<E>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a Result is a Success.
 * Enables TypeScript to narrow the type within conditional blocks.
 * 
 * @param result - The Result to check
 * @returns true if the result is a Success, false otherwise
 * 
 * @example
 * ```typescript
 * const result = fetchUser(id);
 * if (isSuccess(result)) {
 *   // TypeScript knows result.value is available here
 *   console.log(result.value.name);
 * }
 * ```
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result._tag === SUCCESS_TAG;
}

/**
 * Type guard to check if a Result is a Failure.
 * 
 * @param result - The Result to check
 * @returns true if the result is a Failure, false otherwise
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result._tag === FAILURE_TAG;
}

// ============================================================================
// Constructors
// ============================================================================

/**
 * Creates a Success Result containing the given value.
 * 
 * @param value - The success value to wrap
 * @returns A Success Result containing the value
 */
export function success<T>(value: T): Success<T> {
  return { _tag: SUCCESS_TAG, value };
}

/**
 * Creates a Failure Result containing the given error.
 * 
 * @param error - The error to wrap
 * @returns A Failure Result containing the error
 */
export function failure<E = APIError>(error: E): Failure<E> {
  return { _tag: FAILURE_TAG, error };
}

// ============================================================================
// APIError Factory Functions
// ============================================================================

/**
 * Creates a validation error wrapped in a Failure Result.
 * Convenience function for common validation failure scenarios.
 * 
 * @param message - The error message
 * @param field - Optional field name that failed validation
 * @param code - Error code (defaults to REQUIRED_FIELD)
 * @returns A Failure Result containing an APIError
 */
export function validationFailure(
  message: string,
  field?: string,
  code: ErrorCode = ErrorCode.REQUIRED_FIELD
): Failure<APIError> {
  const details: ErrorDetail[] = field
    ? [{ field, message, code: code.toString() }]
    : [{ message }];
  
  return failure({
    code,
    message,
    category: ErrorCategory.VALIDATION_ERROR,
    details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Creates a not-found error wrapped in a Failure Result.
 * 
 * @param resourceType - The type of resource not found
 * @param identifier - The identifier used in the search
 * @returns A Failure Result containing an APIError
 */
export function notFoundFailure(
  resourceType: string,
  identifier: string
): Failure<APIError> {
  return failure({
    code: ErrorCode.RESOURCE_NOT_FOUND,
    message: `${resourceType} with identifier '${identifier}' not found`,
    category: ErrorCategory.NOT_FOUND_ERROR,
    details: [{ message: `Resource type: ${resourceType}, Identifier: ${identifier}` }],
    timestamp: new Date().toISOString(),
  });
}

/**
 * Creates an internal service error wrapped in a Failure Result.
 * 
 * @param message - The error message
 * @param originalError - Optional original error for debugging
 * @returns A Failure Result containing an APIError
 */
export function serviceFailure(
  message: string,
  originalError?: Error
): Failure<APIError> {
  return failure({
    code: ErrorCode.INTERNAL_ERROR,
    message,
    category: ErrorCategory.SERVICE_ERROR,
    details: originalError
      ? [{ message: originalError.message }]
      : [],
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// Functor Operations (map)
// ============================================================================

/**
 * Transforms the value inside a Success Result using the provided function.
 * If the Result is a Failure, returns the Failure unchanged.
 * 
 * This is the Functor 'map' operation.
 * 
 * @param result - The Result to transform
 * @param fn - The transformation function
 * @returns A new Result with the transformed value or the original error
 * 
 * @example
 * ```typescript
 * const result: Result<number> = success(5);
 * const doubled = map(result, x => x * 2); // Success(10)
 * ```
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isSuccess(result)) {
    return success(fn(result.value));
  }
  return result;
}

/**
 * Transforms the error inside a Failure Result using the provided function.
 * If the Result is a Success, returns the Success unchanged.
 * 
 * @param result - The Result to transform
 * @param fn - The error transformation function
 * @returns A new Result with the transformed error or the original value
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isFailure(result)) {
    return failure(fn(result.error));
  }
  // Success case: repackage with new error type parameter
  return success(result.value);
}

// ============================================================================
// Monad Operations (flatMap/chain)
// ============================================================================

/**
 * Chains Result-returning operations together.
 * If the Result is a Success, applies the function to the value.
 * If the Result is a Failure, returns the Failure unchanged.
 * 
 * This is the Monad 'bind' / 'flatMap' / 'chain' operation.
 * 
 * @param result - The Result to chain
 * @param fn - A function that returns a new Result
 * @returns The Result from fn if success, or the original failure
 * 
 * @example
 * ```typescript
 * const parseAndDouble = (input: string): Result<number> =>
 *   flatMap(parseInteger(input), x => success(x * 2));
 * ```
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isSuccess(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Alias for flatMap, using the 'chain' naming convention.
 */
export const chain = flatMap;

/**
 * Alias for flatMap, using the 'andThen' naming convention.
 */
export const andThen = flatMap;

// ============================================================================
// Catamorphism (fold/match)
// ============================================================================

/**
 * Pattern matches on the Result and applies the appropriate function.
 * This is a catamorphism that collapses the Result into a single value.
 * 
 * @param result - The Result to fold
 * @param onSuccess - Function to apply if Success
 * @param onFailure - Function to apply if Failure
 * @returns The result of applying the appropriate function
 * 
 * @example
 * ```typescript
 * const message = fold(
 *   result,
 *   (user) => `Hello, ${user.name}!`,
 *   (error) => `Error: ${error.message}`
 * );
 * ```
 */
export function fold<T, E, U>(
  result: Result<T, E>,
  onSuccess: (value: T) => U,
  onFailure: (error: E) => U
): U {
  if (isSuccess(result)) {
    return onSuccess(result.value);
  }
  return onFailure(result.error);
}

/**
 * Alias for fold, using the 'match' naming convention.
 */
export const match = fold;

// ============================================================================
// Utility Operations
// ============================================================================

/**
 * Extracts the value from a Success Result, or returns the default value.
 * 
 * @param result - The Result to unwrap
 * @param defaultValue - The default value if Failure
 * @returns The success value or the default
 */
export function getOrElse<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isSuccess(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Extracts the value from a Success Result, or computes a default using a function.
 * Lazy evaluation of the default value.
 * 
 * @param result - The Result to unwrap
 * @param fn - Function to compute default value from error
 * @returns The success value or the computed default
 */
export function getOrElseL<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  if (isSuccess(result)) {
    return result.value;
  }
  return fn(result.error);
}

/**
 * Converts a Result to a nullable value.
 * Returns the success value or null if failure.
 * 
 * @param result - The Result to convert
 * @returns The success value or null
 */
export function toNullable<T, E>(result: Result<T, E>): T | null {
  if (isSuccess(result)) {
    return result.value;
  }
  return null;
}

/**
 * Converts a Result to an optional value (undefined for failure).
 * 
 * @param result - The Result to convert
 * @returns The success value or undefined
 */
export function toUndefined<T, E>(result: Result<T, E>): T | undefined {
  if (isSuccess(result)) {
    return result.value;
  }
  return undefined;
}

// ============================================================================
// Combining Results
// ============================================================================

/**
 * Combines an array of Results into a Result of an array.
 * If all Results are Success, returns Success with array of values.
 * If any Result is Failure, returns the first Failure encountered.
 * 
 * @param results - Array of Results to combine
 * @returns A single Result containing array of values or first error
 * 
 * @example
 * ```typescript
 * const results = [success(1), success(2), success(3)];
 * const combined = sequence(results); // Success([1, 2, 3])
 * ```
 */
export function sequence<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (isFailure(result)) {
      return result;
    }
    values.push(result.value);
  }
  return success(values);
}

/**
 * Maps over an array with a Result-returning function, then sequences.
 * Short-circuits on first failure for optimal performance.
 *
 * @param items - Array of items to transform
 * @param fn - Function that returns a Result for each item
 * @returns A Result containing array of transformed values or first error
 */
export function traverse<T, U, E>(
  items: T[],
  fn: (item: T) => Result<U, E>
): Result<U[], E> {
  const values: U[] = [];
  for (const item of items) {
    const result = fn(item);
    if (isFailure(result)) {
      return result; // Short-circuit on first failure
    }
    values.push(result.value);
  }
  return success(values);
}

/**
 * Combines two Results into a Result of tuple.
 * 
 * @param r1 - First Result
 * @param r2 - Second Result
 * @returns Result containing tuple of both values or first error
 */
export function zip<T1, T2, E>(
  r1: Result<T1, E>,
  r2: Result<T2, E>
): Result<[T1, T2], E> {
  if (isFailure(r1)) return r1;
  if (isFailure(r2)) return r2;
  return success([r1.value, r2.value] as [T1, T2]);
}

/**
 * Combines three Results into a Result of tuple.
 */
export function zip3<T1, T2, T3, E>(
  r1: Result<T1, E>,
  r2: Result<T2, E>,
  r3: Result<T3, E>
): Result<[T1, T2, T3], E> {
  if (isFailure(r1)) return r1;
  if (isFailure(r2)) return r2;
  if (isFailure(r3)) return r3;
  return success([r1.value, r2.value, r3.value] as [T1, T2, T3]);
}

// ============================================================================
// Async Result Operations
// ============================================================================

/**
 * Type alias for Promise of Result.
 * Represents async operations that may fail.
 */
export type AsyncResult<T, E = APIError> = Promise<Result<T, E>>;

/**
 * Maps over an AsyncResult.
 * 
 * @param asyncResult - Promise of Result
 * @param fn - Transformation function
 * @returns Promise of transformed Result
 */
export async function mapAsync<T, U, E>(
  asyncResult: AsyncResult<T, E>,
  fn: (value: T) => U
): AsyncResult<U, E> {
  const result = await asyncResult;
  return map(result, fn);
}

/**
 * Chains AsyncResult operations.
 * 
 * @param asyncResult - Promise of Result
 * @param fn - Function returning Promise of Result
 * @returns Flattened Promise of Result
 */
export async function flatMapAsync<T, U, E>(
  asyncResult: AsyncResult<T, E>,
  fn: (value: T) => AsyncResult<U, E>
): AsyncResult<U, E> {
  const result = await asyncResult;
  if (isSuccess(result)) {
    return fn(result.value);
  }
  return result;
}

// ============================================================================
// Exception Bridge Functions
// ============================================================================

/**
 * Wraps a potentially throwing function into a Result-returning function.
 * Catches exceptions and converts them to Failure.
 * 
 * @param fn - Function that may throw
 * @param errorMapper - Optional function to convert caught error to E
 * @returns A Result containing the return value or caught error
 * 
 * @example
 * ```typescript
 * const parseJSON = (input: string): Result<unknown> =>
 *   tryCatch(() => JSON.parse(input));
 * ```
 */
export function tryCatch<T, E = APIError>(
  fn: () => T,
  errorMapper?: (error: unknown) => E
): Result<T, E> {
  try {
    return success(fn());
  } catch (error) {
    if (errorMapper) {
      return failure(errorMapper(error));
    }
    // Default error mapping to APIError
    const apiError: APIError = {
      code: ErrorCode.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : String(error),
      category: ErrorCategory.SERVICE_ERROR,
      details: [],
      timestamp: new Date().toISOString(),
    };
    return failure(apiError as E);
  }
}

/**
 * Wraps an async function that may throw into one returning AsyncResult.
 * 
 * @param fn - Async function that may throw
 * @param errorMapper - Optional function to convert caught error to E
 * @returns Promise of Result containing value or caught error
 */
export async function tryCatchAsync<T, E = APIError>(
  fn: () => Promise<T>,
  errorMapper?: (error: unknown) => E
): AsyncResult<T, E> {
  try {
    const value = await fn();
    return success(value);
  } catch (error) {
    if (errorMapper) {
      return failure(errorMapper(error));
    }
    const apiError: APIError = {
      code: ErrorCode.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : String(error),
      category: ErrorCategory.SERVICE_ERROR,
      details: [],
      timestamp: new Date().toISOString(),
    };
    return failure(apiError as E);
  }
}

/**
 * Converts a Result back to exception-based control flow.
 * Throws the error if Failure, returns value if Success.
 *
 * Use sparingly - prefer staying in Result context.
 *
 * @param result - The Result to unwrap
 * @returns The success value
 * @throws The failure error
 */
export function unwrapOrThrow<T, E extends Error>(result: Result<T, E>): T {
  if (isSuccess(result)) {
    return result.value;
  }
  throw result.error;
}

// ============================================================================
// Predicate-based Constructors
// ============================================================================

/**
 * Creates a Result based on a predicate.
 *
 * @param value - The value to test
 * @param predicate - Predicate function that returns true for valid values
 * @param error - Error to use if predicate returns false
 * @returns Success(value) if predicate passes, Failure(error) otherwise
 *
 * @example
 * ```typescript
 * const result = fromPredicate(
 *   age,
 *   (a) => a >= 18,
 *   validationFailure('Must be 18 or older', 'age').error
 * );
 * ```
 */
export function fromPredicate<T, E = APIError>(
  value: T,
  predicate: (v: T) => boolean,
  error: E
): Result<T, E> {
  if (predicate(value)) {
    return success(value);
  }
  return failure(error);
}

/**
 * Creates a Result from a nullable value.
 *
 * @param value - The nullable value
 * @param error - Error to use if value is null or undefined
 * @returns Success(value) if not null/undefined, Failure(error) otherwise
 *
 * @example
 * ```typescript
 * const user = getUser(id); // User | null
 * const result = fromNullable(
 *   user,
 *   notFoundFailure('User', id).error
 * );
 * ```
 */
export function fromNullable<T, E = APIError>(
  value: T | null | undefined,
  error: E
): Result<T, E> {
  if (value !== null && value !== undefined) {
    return success(value);
  }
  return failure(error);
}

/**
 * Converts a potentially throwing function to Result, catching specific error type.
 * More type-safe variant of tryCatch for known exception types.
 *
 * @param fn - Function that may throw
 * @returns Success with value or Failure with caught exception
 *
 * @example
 * ```typescript
 * const result = fromException(() => JSON.parse(input));
 * // Result<unknown, Error>
 * ```
 */
export function fromException<T>(fn: () => T): Result<T, Error> {
  try {
    return success(fn());
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

// ============================================================================
// Do Notation Helper (Builder Pattern)
// ============================================================================

/**
 * Builder class for composing multiple Result operations.
 * Provides a cleaner syntax for sequential Result operations.
 * 
 * @example
 * ```typescript
 * const result = ResultDo.of<{ name: string; age: number }>({})
 *   .bind('name', validateName(input.name))
 *   .bind('age', validateAge(input.age))
 *   .return();
 * ```
 */
export class ResultDo<A extends Record<string, unknown>, E = APIError> {
  private constructor(private readonly result: Result<A, E>) {}

  /**
   * Creates a new ResultDo builder starting with a Success.
   */
  static of<A extends Record<string, unknown>, E = APIError>(
    initial: A
  ): ResultDo<A, E> {
    return new ResultDo(success(initial));
  }

  /**
   * Binds a new property to the accumulator.
   * If the Result is a Failure, short-circuits.
   */
  bind<K extends string, T>(
    key: K,
    result: Result<T, E>
  ): ResultDo<A & Record<K, T>, E> {
    if (isFailure(this.result)) {
      return new ResultDo(this.result as Result<A & Record<K, T>, E>);
    }
    if (isFailure(result)) {
      return new ResultDo(result as Result<A & Record<K, T>, E>);
    }
    const newValue = {
      ...this.result.value,
      [key]: result.value,
    } as A & Record<K, T>;
    return new ResultDo(success(newValue));
  }

  /**
   * Maps over the accumulated value.
   */
  map<B>(fn: (a: A) => B): Result<B, E> {
    return map(this.result, fn);
  }

  /**
   * Returns the accumulated Result.
   */
  return(): Result<A, E> {
    return this.result;
  }
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export {
  SUCCESS_TAG,
  FAILURE_TAG,
};
