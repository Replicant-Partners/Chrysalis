/**
 * Standard request/response models for Chrysalis API (TypeScript).
 */
export declare enum ErrorCategory {
    VALIDATION_ERROR = "VALIDATION_ERROR",
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
    AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
    NOT_FOUND_ERROR = "NOT_FOUND_ERROR",
    CONFLICT_ERROR = "CONFLICT_ERROR",
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
    SERVICE_ERROR = "SERVICE_ERROR",
    UPSTREAM_ERROR = "UPSTREAM_ERROR"
}
export declare enum ErrorCode {
    REQUIRED_FIELD = "VALIDATION_ERROR.REQUIRED_FIELD",
    INVALID_FORMAT = "VALIDATION_ERROR.INVALID_FORMAT",
    INVALID_TYPE = "VALIDATION_ERROR.INVALID_TYPE",
    INVALID_RANGE = "VALIDATION_ERROR.INVALID_RANGE",
    INVALID_TOKEN = "AUTHENTICATION_ERROR.INVALID_TOKEN",
    EXPIRED_TOKEN = "AUTHENTICATION_ERROR.EXPIRED_TOKEN",
    MISSING_AUTH = "AUTHENTICATION_ERROR.MISSING_AUTHORIZATION",
    INSUFFICIENT_PERMISSIONS = "AUTHORIZATION_ERROR.INSUFFICIENT_PERMISSIONS",
    FORBIDDEN_RESOURCE = "AUTHORIZATION_ERROR.FORBIDDEN_RESOURCE",
    RESOURCE_NOT_FOUND = "NOT_FOUND_ERROR.RESOURCE_NOT_FOUND",
    ENDPOINT_NOT_FOUND = "NOT_FOUND_ERROR.ENDPOINT_NOT_FOUND",
    DUPLICATE_RESOURCE = "CONFLICT_ERROR.DUPLICATE_RESOURCE",
    RESOURCE_CONFLICT = "CONFLICT_ERROR.RESOURCE_CONFLICT",
    TOO_MANY_REQUESTS = "RATE_LIMIT_ERROR.TOO_MANY_REQUESTS",
    INTERNAL_ERROR = "SERVICE_ERROR.INTERNAL_ERROR",
    SERVICE_UNAVAILABLE = "SERVICE_ERROR.SERVICE_UNAVAILABLE",
    UPSTREAM_ERROR = "UPSTREAM_ERROR.SERVICE_UNAVAILABLE",
    UPSTREAM_TIMEOUT = "UPSTREAM_ERROR.SERVICE_TIMEOUT"
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
export declare class ValidationError extends Error {
    field?: string;
    code?: ErrorCode;
    constructor(message: string, field?: string, code?: ErrorCode);
}
export declare function createSuccessResponse<T>(data: T, requestId?: string, pagination?: PaginationMeta, version?: string): APIResponse<T>;
export declare function createErrorResponse(error: APIError, statusCode?: number): {
    response: APIResponse;
    statusCode: number;
};
export declare function createPaginationMeta(pagination: PaginationParams, total: number): PaginationMeta;
export declare function parsePaginationParams(url: URL): PaginationParams;
export declare function parseFilterParams(url: URL): FilterParams;
export declare function parseSortParams(url: URL): SortParams;
//# sourceMappingURL=models.d.ts.map