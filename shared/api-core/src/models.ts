/**
 * Standard request/response models for Chrysalis API (TypeScript).
 */

export enum ErrorCategory {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
}

export enum ErrorCode {
  // Validation
  REQUIRED_FIELD = 'VALIDATION_ERROR.REQUIRED_FIELD',
  INVALID_FORMAT = 'VALIDATION_ERROR.INVALID_FORMAT',
  INVALID_TYPE = 'VALIDATION_ERROR.INVALID_TYPE',
  INVALID_RANGE = 'VALIDATION_ERROR.INVALID_RANGE',

  // Authentication
  INVALID_TOKEN = 'AUTHENTICATION_ERROR.INVALID_TOKEN',
  EXPIRED_TOKEN = 'AUTHENTICATION_ERROR.EXPIRED_TOKEN',
  MISSING_AUTH = 'AUTHENTICATION_ERROR.MISSING_AUTHORIZATION',

  // Authorization
  INSUFFICIENT_PERMISSIONS = 'AUTHORIZATION_ERROR.INSUFFICIENT_PERMISSIONS',
  FORBIDDEN_RESOURCE = 'AUTHORIZATION_ERROR.FORBIDDEN_RESOURCE',

  // Not Found
  RESOURCE_NOT_FOUND = 'NOT_FOUND_ERROR.RESOURCE_NOT_FOUND',
  ENDPOINT_NOT_FOUND = 'NOT_FOUND_ERROR.ENDPOINT_NOT_FOUND',

  // Conflict
  DUPLICATE_RESOURCE = 'CONFLICT_ERROR.DUPLICATE_RESOURCE',
  RESOURCE_CONFLICT = 'CONFLICT_ERROR.RESOURCE_CONFLICT',

  // Rate Limit
  TOO_MANY_REQUESTS = 'RATE_LIMIT_ERROR.TOO_MANY_REQUESTS',

  // Service
  INTERNAL_ERROR = 'SERVICE_ERROR.INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_ERROR.SERVICE_UNAVAILABLE',

  // Upstream
  UPSTREAM_ERROR = 'UPSTREAM_ERROR.SERVICE_UNAVAILABLE',
  UPSTREAM_TIMEOUT = 'UPSTREAM_ERROR.SERVICE_TIMEOUT',
}

export interface ErrorDetail {
  field?: string;
  code?: string;
  message: string;
  path?: string[];
}

export interface APIError {
  code: ErrorCode;
  message: string;
  category: ErrorCategory;
  details?: ErrorDetail[];
  request_id?: string;
  timestamp: string;
  documentation_url?: string;
  retry_after?: number;
  suggestions?: string[];
}

export interface PaginationParams {
  page: number;
  per_page: number;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface FilterParams {
  filters: Record<string, any>;
}

export interface SortParams {
  sort_fields: string[];
  order: 'asc' | 'desc';
}

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

export interface AuthContext {
  user_id?: string;
  token_type: 'bearer' | 'api_key' | 'agent';
  roles: string[];
  permissions: string[];
}

export class ValidationError extends Error {
  field?: string;
  code?: ErrorCode;

  constructor(message: string, field?: string, code?: ErrorCode) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code || ErrorCode.REQUIRED_FIELD;
  }
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

export function createPaginationMeta(
  pagination: PaginationParams,
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

export function parsePaginationParams(url: URL): PaginationParams {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const perPage = Math.max(1, Math.min(100, parseInt(url.searchParams.get('per_page') || '20', 10) || 20));
  return { page, per_page: perPage };
}

export function parseFilterParams(url: URL): FilterParams {
  const filters: Record<string, any> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith('filter[')) {
      const fieldMatch = key.slice(7, -1).split('][');
      if (fieldMatch.length === 1) {
        filters[fieldMatch[0]] = value;
      } else if (fieldMatch.length === 2) {
        const [field, op] = fieldMatch;
        if (!filters[field]) {
          filters[field] = {};
        }
        filters[field][op] = value;
      }
    }
  }
  return { filters };
}

export function parseSortParams(url: URL): SortParams {
  const sortStr = url.searchParams.get('sort') || '';
  if (!sortStr) {
    return { sort_fields: [], order: 'asc' };
  }
  const fields = sortStr.split(',').map(f => f.trim());
  return { sort_fields: fields, order: 'asc' };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
