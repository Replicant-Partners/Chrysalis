"use strict";
/**
 * HTTP utilities for Chrysalis services (TypeScript).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BODY_INVALID_JSON_FLAG = exports.BODY_TOO_LARGE_FLAG = void 0;
exports.readJsonBody = readJsonBody;
exports.sendJson = sendJson;
exports.sendError = sendError;
exports.sendText = sendText;
exports.notFound = notFound;
exports.methodNotAllowed = methodNotAllowed;
exports.badRequest = badRequest;
exports.payloadTooLarge = payloadTooLarge;
exports.serverError = serverError;
exports.createHttpsServer = createHttpsServer;
const models_1 = require("./models");
exports.BODY_TOO_LARGE_FLAG = '_bodyTooLarge';
exports.BODY_INVALID_JSON_FLAG = '_bodyInvalidJson';
async function readJsonBody(req, maxBytes = 1000000) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buf.length;
        if (size > maxBytes) {
            req[exports.BODY_TOO_LARGE_FLAG] = true;
            return null;
        }
        chunks.push(buf);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch (_a) {
        req[exports.BODY_INVALID_JSON_FLAG] = true;
        return null;
    }
}
function sendJson(res, status, obj) {
    let response;
    if (isAPIResponse(obj)) {
        response = obj;
    }
    else {
        // Auto-wrap non-APIResponse objects
        response = {
            success: true,
            data: obj,
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
function sendError(res, status, error) {
    const response = {
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
function sendText(res, status, text) {
    res.statusCode = status;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('content-length', Buffer.byteLength(text, 'utf8'));
    res.end(text);
}
function notFound(res) {
    const error = {
        code: models_1.ErrorCode.ENDPOINT_NOT_FOUND,
        message: 'Endpoint not found',
        category: models_1.ErrorCategory.NOT_FOUND_ERROR,
        timestamp: new Date().toISOString(),
    };
    sendError(res, 404, error);
}
function methodNotAllowed(res) {
    const error = {
        code: models_1.ErrorCode.INTERNAL_ERROR,
        message: 'Method not allowed',
        category: models_1.ErrorCategory.SERVICE_ERROR,
        timestamp: new Date().toISOString(),
    };
    sendError(res, 405, error);
}
function badRequest(res, message, code) {
    const error = {
        code: code || models_1.ErrorCode.INVALID_FORMAT,
        message,
        category: models_1.ErrorCategory.VALIDATION_ERROR,
        timestamp: new Date().toISOString(),
    };
    sendError(res, 400, error);
}
function payloadTooLarge(res, message = 'Request body too large') {
    const error = {
        code: models_1.ErrorCode.INVALID_RANGE,
        message,
        category: models_1.ErrorCategory.VALIDATION_ERROR,
        timestamp: new Date().toISOString(),
    };
    sendError(res, 413, error);
}
function serverError(res, message, requestId) {
    const error = {
        code: models_1.ErrorCode.INTERNAL_ERROR,
        message,
        category: models_1.ErrorCategory.SERVICE_ERROR,
        request_id: requestId,
        timestamp: new Date().toISOString(),
    };
    sendError(res, 500, error);
}
function createHttpsServer(opts, handler) {
    const https = require('https');
    return https.createServer(opts, handler);
}
function isAPIResponse(obj) {
    return obj && typeof obj === 'object' && 'success' in obj;
}
//# sourceMappingURL=http.js.map
