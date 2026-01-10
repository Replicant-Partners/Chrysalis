/**
 * Request validation utilities (TypeScript).
 */

import { ValidationError, ErrorCode } from './models';

export class RequestValidator {
  static requireField<T>(data: Record<string, any>, field: string, fieldName?: string): T {
    if (!(field in data) || data[field] === null || data[field] === undefined) {
      throw new ValidationError(
        `Field '${fieldName || field}' is required`,
        field,
        ErrorCode.REQUIRED_FIELD
      );
    }
    return data[field] as T;
  }

  static requireString(
    data: Record<string, any>,
    field: string,
    minLength?: number,
    maxLength?: number
  ): string {
    const value = this.requireField<string>(data, field);
    if (typeof value !== 'string') {
      throw new ValidationError(
        `Field '${field}' must be a string`,
        field,
        ErrorCode.INVALID_TYPE
      );
    }
    if (minLength !== undefined && value.length < minLength) {
      throw new ValidationError(
        `Field '${field}' must be at least ${minLength} characters`,
        field,
        ErrorCode.INVALID_RANGE
      );
    }
    if (maxLength !== undefined && value.length > maxLength) {
      throw new ValidationError(
        `Field '${field}' must be at most ${maxLength} characters`,
        field,
        ErrorCode.INVALID_RANGE
      );
    }
    return value;
  }

  static requireInteger(
    data: Record<string, any>,
    field: string,
    minValue?: number,
    maxValue?: number
  ): number {
    const value = this.requireField<number>(data, field);
    const intValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(intValue) || !Number.isInteger(intValue)) {
      throw new ValidationError(
        `Field '${field}' must be an integer`,
        field,
        ErrorCode.INVALID_TYPE
      );
    }
    if (minValue !== undefined && intValue < minValue) {
      throw new ValidationError(
        `Field '${field}' must be at least ${minValue}`,
        field,
        ErrorCode.INVALID_RANGE
      );
    }
    if (maxValue !== undefined && intValue > maxValue) {
      throw new ValidationError(
        `Field '${field}' must be at most ${maxValue}`,
        field,
        ErrorCode.INVALID_RANGE
      );
    }
    return intValue;
  }
}
