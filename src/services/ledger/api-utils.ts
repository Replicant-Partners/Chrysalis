/**
 * Unified API utilities for LedgerService (TypeScript).
 *
 * Provides standardized response formatting and error handling.
 */

import http from 'http';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: {
    request_id?: string;
    timestamp: string;
    version: string;
    pagination?: PaginationMeta;
  };
}

export interface APIError {
  code: string;
  message: string;
  category: string;
  details?: ErrorDetail[];
  request_id?: string;
  timestamp: string;
  documentation_url?: string;
  retry_after?: number;
  suggestions?: string[];
}

export interface ErrorDetail {
  field?: string;
  code?: string;
  message: string;
  path?: string[];
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export enum ErrorCode {
  REQUIRED_FIELD = 'VALIDATION_ERROR.REQUIRED_FIELD',
  INVALID_FORMAT = 'VALIDATION_ERROR.INVALID_FORMAT',
  INVALID_TOKEN = 'AUTHENTICATION_ERROR.INVALID_TOKEN',
  MISSING_AUTH = 'AUTHENTICATION_ERROR.MISSING_AUTHORIZATION',
  INSUFFICIENT_PERMISSIONS = 'AUTHORIZATION_ERROR.INSUFFICIENT_PERMISSIONS',
  RESOURCE_NOT_FOUND = 'NOT_FOUND_ERROR.RESOURCE_NOT_FOUND',
  ENDPOINT_NOT_FOUND = 'NOT_FOUND_ERROR.ENDPOINT_NOT_FOUND',
  DUPLICATE_RESOURCE = 'CONFLICT_ERROR.DUPLICATE_RESOURCE',
  TOO_MANY_REQUESTS = 'RATE_LIMIT_ERROR.TOO_MANY_REQUESTS',
  INTERNAL_ERROR = 'SERVICE_ERROR.INTERNAL_ERROR',
}

export enum ErrorCategory {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
}

export function createSuccessResponse<T>(
  data: T,
  requestId?: string,
  pagination?: PaginationMeta,
  version: string = 'v1'
): APIResponse<T> {
  return {
    success: true,
    data,
    meta: {
      request_id: requestId || generateRequestId(),
      timestamp: new Date().toISOString(),
      version,
      pagination,
    },
  };
}

export function createErrorResponse(
  error: APIError,
  statusCode: number = 400
): { response: APIResponse; statusCode: number } {
  return {
    response: {
      success: false,
      error: {
        ...error,
        request_id: error.request_id || generateRequestId(),
        timestamp: error.timestamp || new Date().toISOString(),
      },
      meta: {
        request_id: error.request_id || generateRequestId(),
        timestamp: error.timestamp || new Date().toISOString(),
        version: 'v1',
      },
    },
    statusCode,
  };
}

export function sendError(
  res: http.ServerResponse,
  status: number,
  error: APIError
): void {
  const response: APIResponse = {
    success: false,
    error,
    meta: {
      request_id: error.request_id,
      timestamp: error.timestamp || new Date().toISOString(),
      version: 'v1',
    },
  };
  sendJson(res, status, response);
}

export function sendJson<T>(
  res: http.ServerResponse,
  status: number,
  obj: APIResponse<T> | T
): void {
  let response: APIResponse<T>;
  if (isAPIResponse(obj)) {
    response = obj;
  } else {
    // Auto-wrap non-APIResponse objects
    response = {
      success: true,
      data: obj as T,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    };
  }

  const body = JSON.stringify(response, null, 2);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(body, 'utf8'));
  res.end(body);
}

export function parsePaginationParams(url: URL): { page: number; per_page: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const perPage = Math.max(1, Math.min(100, parseInt(url.searchParams.get('per_page') || '20', 10) || 20));
  return { page, per_page: perPage };
}

export function createPaginationMeta(
  pagination: { page: number; per_page: number },
  total: number
): PaginationMeta {
  const totalPages = total > 0 ? Math.ceil(total / pagination.per_page) : 0;
  return {
    page: pagination.page,
    per_page: pagination.per_page,
    total,
    total_pages: totalPages,
    has_next: pagination.page < totalPages,
    has_prev: pagination.page > 1,
  };
}

function isAPIResponse<T>(obj: any): obj is APIResponse<T> {
  return obj && typeof obj === 'object' && 'success' in obj;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
