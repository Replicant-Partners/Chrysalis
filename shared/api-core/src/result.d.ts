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
import { APIError, ErrorCode } from './models';
/**
 * Discriminant tag for Success variant.
 * Using const assertion for literal type inference.
 */
declare const SUCCESS_TAG: "Success";
/**
 * Discriminant tag for Failure variant.
 */
declare const FAILURE_TAG: "Failure";
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
export declare function isSuccess<T, E>(result: Result<T, E>): result is Success<T>;
/**
 * Type guard to check if a Result is a Failure.
 *
 * @param result - The Result to check
 * @returns true if the result is a Failure, false otherwise
 */
export declare function isFailure<T, E>(result: Result<T, E>): result is Failure<E>;
/**
 * Creates a Success Result containing the given value.
 *
 * @param value - The success value to wrap
 * @returns A Success Result containing the value
 */
export declare function success<T>(value: T): Success<T>;
/**
 * Creates a Failure Result containing the given error.
 *
 * @param error - The error to wrap
 * @returns A Failure Result containing the error
 */
export declare function failure<E = APIError>(error: E): Failure<E>;
/**
 * Creates a validation error wrapped in a Failure Result.
 * Convenience function for common validation failure scenarios.
 *
 * @param message - The error message
 * @param field - Optional field name that failed validation
 * @param code - Error code (defaults to REQUIRED_FIELD)
 * @returns A Failure Result containing an APIError
 */
export declare function validationFailure(message: string, field?: string, code?: ErrorCode): Failure<APIError>;
/**
 * Creates a not-found error wrapped in a Failure Result.
 *
 * @param resourceType - The type of resource not found
 * @param identifier - The identifier used in the search
 * @returns A Failure Result containing an APIError
 */
export declare function notFoundFailure(resourceType: string, identifier: string): Failure<APIError>;
/**
 * Creates an internal service error wrapped in a Failure Result.
 *
 * @param message - The error message
 * @param originalError - Optional original error for debugging
 * @returns A Failure Result containing an APIError
 */
export declare function serviceFailure(message: string, originalError?: Error): Failure<APIError>;
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
export declare function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
/**
 * Transforms the error inside a Failure Result using the provided function.
 * If the Result is a Success, returns the Success unchanged.
 *
 * @param result - The Result to transform
 * @param fn - The error transformation function
 * @returns A new Result with the transformed error or the original value
 */
export declare function mapError<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>;
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
export declare function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E>;
/**
 * Alias for flatMap, using the 'chain' naming convention.
 */
export declare const chain: typeof flatMap;
/**
 * Alias for flatMap, using the 'andThen' naming convention.
 */
export declare const andThen: typeof flatMap;
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
export declare function fold<T, E, U>(result: Result<T, E>, onSuccess: (value: T) => U, onFailure: (error: E) => U): U;
/**
 * Alias for fold, using the 'match' naming convention.
 */
export declare const match: typeof fold;
/**
 * Extracts the value from a Success Result, or returns the default value.
 *
 * @param result - The Result to unwrap
 * @param defaultValue - The default value if Failure
 * @returns The success value or the default
 */
export declare function getOrElse<T, E>(result: Result<T, E>, defaultValue: T): T;
/**
 * Extracts the value from a Success Result, or computes a default using a function.
 * Lazy evaluation of the default value.
 *
 * @param result - The Result to unwrap
 * @param fn - Function to compute default value from error
 * @returns The success value or the computed default
 */
export declare function getOrElseL<T, E>(result: Result<T, E>, fn: (error: E) => T): T;
/**
 * Converts a Result to a nullable value.
 * Returns the success value or null if failure.
 *
 * @param result - The Result to convert
 * @returns The success value or null
 */
export declare function toNullable<T, E>(result: Result<T, E>): T | null;
/**
 * Converts a Result to an optional value (undefined for failure).
 *
 * @param result - The Result to convert
 * @returns The success value or undefined
 */
export declare function toUndefined<T, E>(result: Result<T, E>): T | undefined;
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
export declare function sequence<T, E>(results: Result<T, E>[]): Result<T[], E>;
/**
 * Maps over an array with a Result-returning function, then sequences.
 * Short-circuits on first failure for optimal performance.
 *
 * @param items - Array of items to transform
 * @param fn - Function that returns a Result for each item
 * @returns A Result containing array of transformed values or first error
 */
export declare function traverse<T, U, E>(items: T[], fn: (item: T) => Result<U, E>): Result<U[], E>;
/**
 * Combines two Results into a Result of tuple.
 *
 * @param r1 - First Result
 * @param r2 - Second Result
 * @returns Result containing tuple of both values or first error
 */
export declare function zip<T1, T2, E>(r1: Result<T1, E>, r2: Result<T2, E>): Result<[T1, T2], E>;
/**
 * Combines three Results into a Result of tuple.
 */
export declare function zip3<T1, T2, T3, E>(r1: Result<T1, E>, r2: Result<T2, E>, r3: Result<T3, E>): Result<[T1, T2, T3], E>;
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
export declare function mapAsync<T, U, E>(asyncResult: AsyncResult<T, E>, fn: (value: T) => U): AsyncResult<U, E>;
/**
 * Chains AsyncResult operations.
 *
 * @param asyncResult - Promise of Result
 * @param fn - Function returning Promise of Result
 * @returns Flattened Promise of Result
 */
export declare function flatMapAsync<T, U, E>(asyncResult: AsyncResult<T, E>, fn: (value: T) => AsyncResult<U, E>): AsyncResult<U, E>;
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
export declare function tryCatch<T, E = APIError>(fn: () => T, errorMapper?: (error: unknown) => E): Result<T, E>;
/**
 * Wraps an async function that may throw into one returning AsyncResult.
 *
 * @param fn - Async function that may throw
 * @param errorMapper - Optional function to convert caught error to E
 * @returns Promise of Result containing value or caught error
 */
export declare function tryCatchAsync<T, E = APIError>(fn: () => Promise<T>, errorMapper?: (error: unknown) => E): AsyncResult<T, E>;
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
export declare function unwrapOrThrow<T, E extends Error>(result: Result<T, E>): T;
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
export declare function fromPredicate<T, E = APIError>(value: T, predicate: (v: T) => boolean, error: E): Result<T, E>;
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
export declare function fromNullable<T, E = APIError>(value: T | null | undefined, error: E): Result<T, E>;
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
export declare function fromException<T>(fn: () => T): Result<T, Error>;
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
export declare class ResultDo<A extends Record<string, unknown>, E = APIError> {
    private readonly result;
    private constructor();
    /**
     * Creates a new ResultDo builder starting with a Success.
     */
    static of<A extends Record<string, unknown>, E = APIError>(initial: A): ResultDo<A, E>;
    /**
     * Binds a new property to the accumulator.
     * If the Result is a Failure, short-circuits.
     */
    bind<K extends string, T>(key: K, result: Result<T, E>): ResultDo<A & Record<K, T>, E>;
    /**
     * Maps over the accumulated value.
     */
    map<B>(fn: (a: A) => B): Result<B, E>;
    /**
     * Returns the accumulated Result.
     */
    return(): Result<A, E>;
}
export { SUCCESS_TAG, FAILURE_TAG, };
//# sourceMappingURL=result.d.ts.map