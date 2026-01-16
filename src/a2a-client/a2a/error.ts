/**
 * A2A Error Class
 * 
 * A2A-specific error class with cause chain support (ES2022).
 * 
 * @module a2a-client/a2a/error
 */

import { JsonRpcError, A2A_ERROR_CODES } from '../types';

/**
 * A2A-specific error class with cause chain support.
 * 
 * @example
 * ```typescript
 * try {
 *   await client.sendTask(params);
 * } catch (error) {
 *   if (error instanceof A2AError) {
 *     // Inspect error.cause as needed
 *   }
 * }
 * ```
 */
export class A2AError extends Error {
  readonly code: number;
  readonly data?: unknown;
  
  constructor(
    code: number,
    message: string,
    data?: unknown,
    options?: { cause?: Error }
  ) {
    super(message);
    this.name = 'A2AError';
    this.code = code;
    this.data = data;
    
    if (options?.cause) {
      (this as any).cause = options.cause;
    }
    
    Object.setPrototypeOf(this, A2AError.prototype);
  }
  
  toJsonRpcError(): JsonRpcError {
    return {
      code: this.code,
      message: this.message,
      data: this.data
    };
  }
  
  static from(error: unknown, code?: number): A2AError {
    if (error instanceof A2AError) {
      return error;
    }
    
    if (error instanceof Error) {
      return new A2AError(
        code ?? A2A_ERROR_CODES.INTERNAL_ERROR,
        error.message,
        undefined,
        { cause: error }
      );
    }
    
    return new A2AError(
      code ?? A2A_ERROR_CODES.INTERNAL_ERROR,
      String(error)
    );
  }
  
  static isA2AError(error: unknown): error is A2AError {
    return error instanceof A2AError;
  }
}
