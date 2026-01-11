"use strict";
/**
 * HTTP utilities for Chrysalis services (TypeScript).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readJsonBody = readJsonBody;
exports.sendJson = sendJson;
exports.sendError = sendError;
exports.sendText = sendText;
exports.notFound = notFound;
exports.methodNotAllowed = methodNotAllowed;
exports.badRequest = badRequest;
exports.serverError = serverError;
exports.createHttpsServer = createHttpsServer;
const models_1 = require("./models");
async function readJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) {
        return null;
    }
    return JSON.parse(raw);
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