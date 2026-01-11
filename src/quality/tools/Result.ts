/**
 * Result Type
 *
 * Design Pattern: Result/Either (Functional Error Handling)
 * - Provides explicit success/failure typing
 * - Avoids exception-driven control flow
 *
 * References:
 * - Rust std::result https://doc.rust-lang.org/std/result/
 * - Railway Oriented Programming (Scott Wlaschin)
 */

export type Result<T, E = Error> =
    | { success: true; value: T }
    | { success: false; error: E };

/**
 * Type guard for successful Result
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; value: T } {
    return result.success === true;
}

/**
 * Type guard for failed Result
 */
export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
    return result.success === false;
}

/**
 * Get error from Result (throws if success)
 */
export function getError<T, E>(result: Result<T, E>): E {
    if (isFailure(result)) {
        return result.error;
    }
    throw new Error('Cannot get error from successful result');
}

/**
 * Get value from Result (throws if failure)
 */
export function getValue<T, E>(result: Result<T, E>): T {
    if (isSuccess(result)) {
        return result.value;
    }
    throw new Error('Cannot get value from failed result');
}

/**
 * Utilities for working with Result.
 */
export class ResultUtils {
    static ok<T>(value: T): Result<T, never> {
        return { success: true, value };
    }

    static err<E>(error: E): Result<never, E> {
        return { success: false, error };
    }

    static async fromPromise<T>(
        promise: Promise<T>
    ): Promise<Result<T, Error>> {
        try {
            const value = await promise;
            return { success: true, value };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    static map<T, U, E>(
        result: Result<T, E>,
        fn: (value: T) => U
    ): Result<U, E> {
        if (isSuccess(result)) {
            return { success: true, value: fn(result.value) };
        }
        return { success: false, error: result.error };
    }

    static mapError<T, E, F>(
        result: Result<T, E>,
        fn: (error: E) => F
    ): Result<T, F> {
        if (isFailure(result)) {
            return { success: false, error: fn(result.error) };
        }
        return { success: true, value: result.value };
    }

    static chain<T, U, E>(
        result: Result<T, E>,
        fn: (value: T) => Result<U, E>
    ): Result<U, E> {
        if (isSuccess(result)) {
            return fn(result.value);
        }
        return { success: false, error: result.error };
    }
}
