"use strict";
/**
 * Standard request/response models for Chrysalis API (TypeScript).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.ErrorCode = exports.ErrorCategory = void 0;
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
exports.createPaginationMeta = createPaginationMeta;
exports.parsePaginationParams = parsePaginationParams;
exports.parseFilterParams = parseFilterParams;
exports.parseSortParams = parseSortParams;
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCategory["AUTHENTICATION_ERROR"] = "AUTHENTICATION_ERROR";
    ErrorCategory["AUTHORIZATION_ERROR"] = "AUTHORIZATION_ERROR";
    ErrorCategory["NOT_FOUND_ERROR"] = "NOT_FOUND_ERROR";
    ErrorCategory["CONFLICT_ERROR"] = "CONFLICT_ERROR";
    ErrorCategory["RATE_LIMIT_ERROR"] = "RATE_LIMIT_ERROR";
    ErrorCategory["SERVICE_ERROR"] = "SERVICE_ERROR";
    ErrorCategory["UPSTREAM_ERROR"] = "UPSTREAM_ERROR";
})(ErrorCategory || (exports.ErrorCategory = ErrorCategory = {}));
var ErrorCode;
(function (ErrorCode) {
    // Validation
    ErrorCode["REQUIRED_FIELD"] = "VALIDATION_ERROR.REQUIRED_FIELD";
    ErrorCode["INVALID_FORMAT"] = "VALIDATION_ERROR.INVALID_FORMAT";
    ErrorCode["INVALID_TYPE"] = "VALIDATION_ERROR.INVALID_TYPE";
    ErrorCode["INVALID_RANGE"] = "VALIDATION_ERROR.INVALID_RANGE";
    // Authentication
    ErrorCode["INVALID_TOKEN"] = "AUTHENTICATION_ERROR.INVALID_TOKEN";
    ErrorCode["EXPIRED_TOKEN"] = "AUTHENTICATION_ERROR.EXPIRED_TOKEN";
    ErrorCode["MISSING_AUTH"] = "AUTHENTICATION_ERROR.MISSING_AUTHORIZATION";
    // Authorization
    ErrorCode["INSUFFICIENT_PERMISSIONS"] = "AUTHORIZATION_ERROR.INSUFFICIENT_PERMISSIONS";
    ErrorCode["FORBIDDEN_RESOURCE"] = "AUTHORIZATION_ERROR.FORBIDDEN_RESOURCE";
    // Not Found
    ErrorCode["RESOURCE_NOT_FOUND"] = "NOT_FOUND_ERROR.RESOURCE_NOT_FOUND";
    ErrorCode["ENDPOINT_NOT_FOUND"] = "NOT_FOUND_ERROR.ENDPOINT_NOT_FOUND";
    // Conflict
    ErrorCode["DUPLICATE_RESOURCE"] = "CONFLICT_ERROR.DUPLICATE_RESOURCE";
    ErrorCode["RESOURCE_CONFLICT"] = "CONFLICT_ERROR.RESOURCE_CONFLICT";
    // Rate Limit
    ErrorCode["TOO_MANY_REQUESTS"] = "RATE_LIMIT_ERROR.TOO_MANY_REQUESTS";
    // Service
    ErrorCode["INTERNAL_ERROR"] = "SERVICE_ERROR.INTERNAL_ERROR";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_ERROR.SERVICE_UNAVAILABLE";
    // Upstream
    ErrorCode["UPSTREAM_ERROR"] = "UPSTREAM_ERROR.SERVICE_UNAVAILABLE";
    ErrorCode["UPSTREAM_TIMEOUT"] = "UPSTREAM_ERROR.SERVICE_TIMEOUT";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
class ValidationError extends Error {
    constructor(message, field, code) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.code = code || ErrorCode.REQUIRED_FIELD;
    }
}
exports.ValidationError = ValidationError;
function createSuccessResponse(data, requestId, pagination, version = 'v1') {
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
function createErrorResponse(error, statusCode = 400) {
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
function createPaginationMeta(pagination, total) {
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
function parsePaginationParams(url) {
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(url.searchParams.get('per_page') || '20', 10) || 20));
    return { page, per_page: perPage };
}
function parseFilterParams(url) {
    const filters = {};
    for (const [key, value] of url.searchParams.entries()) {
        if (key.startsWith('filter[')) {
            const fieldMatch = key.slice(7, -1).split('][');
            if (fieldMatch.length === 1) {
                filters[fieldMatch[0]] = value;
            }
            else if (fieldMatch.length === 2) {
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
function parseSortParams(url) {
    const sortStr = url.searchParams.get('sort') || '';
    if (!sortStr) {
        return { sort_fields: [], order: 'asc' };
    }
    const fields = sortStr.split(',').map(f => f.trim());
    return { sort_fields: fields, order: 'asc' };
}
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
//# sourceMappingURL=models.js.map