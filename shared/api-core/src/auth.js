"use strict";
/**
 * Unified authentication framework for Chrysalis services (TypeScript).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBearerToken = getBearerToken;
exports.verifyJWTToken = verifyJWTToken;
exports.verifyAPIKey = verifyAPIKey;
exports.authenticateRequest = authenticateRequest;
exports.createJWTToken = createJWTToken;
exports.registerAPIKey = registerAPIKey;
exports.hasRole = hasRole;
exports.hasPermission = hasPermission;
const jwt = __importStar(require("jsonwebtoken"));
const models_1 = require("./models");
const ENVIRONMENT = process.env.CHRYSALIS_ENV || process.env.NODE_ENV || 'development';
const CONFIGURED_SECRET = process.env.JWT_SECRET || process.env.CHRYSALIS_JWT_SECRET;
if (!CONFIGURED_SECRET && ENVIRONMENT === 'production') {
    throw new Error('JWT_SECRET is required in production');
}
const JWT_SECRET = CONFIGURED_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRATION_HOURS = parseInt(process.env.JWT_EXPIRATION_HOURS || '24', 10);
// API Key store (in-memory, replace with database in production)
const API_KEYS = new Map();
const ADMIN_KEY_IDS = new Set((process.env.ADMIN_KEY_IDS || '').split(',').filter(Boolean));
function getBearerToken(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
        return null;
    }
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7).trim();
}
function verifyJWTToken(token) {
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        return payload;
    }
    catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return null;
        }
        return null;
    }
}
function verifyAPIKey(key) {
    if (!key.includes('.')) {
        return null;
    }
    const [keyId, secret] = key.split('.', 2);
    // Check in-memory store
    const stored = API_KEYS.get(keyId);
    if (stored && stored.secret === secret) {
        return {
            key_id: keyId,
            roles: stored.roles,
            permissions: stored.permissions,
        };
    }
    // Check admin keys
    if (ADMIN_KEY_IDS.has(keyId)) {
        return {
            key_id: keyId,
            roles: ['admin'],
            permissions: ['*'],
        };
    }
    return null;
}
function authenticateRequest(req, optional = false) {
    const bearerToken = getBearerToken(req);
    if (!bearerToken) {
        if (optional) {
            return null;
        }
        throw createAuthError(models_1.ErrorCode.MISSING_AUTH, 'Authentication required');
    }
    // Try JWT first
    const jwtPayload = verifyJWTToken(bearerToken);
    if (jwtPayload) {
        return {
            user_id: jwtPayload.sub || jwtPayload.user_id || undefined,
            token_type: 'bearer',
            roles: jwtPayload.roles || [],
            permissions: jwtPayload.permissions || [],
        };
    }
    // Try API key
    const apiKeyData = verifyAPIKey(bearerToken);
    if (apiKeyData) {
        return {
            user_id: apiKeyData.key_id,
            token_type: 'api_key',
            roles: apiKeyData.roles,
            permissions: apiKeyData.permissions,
        };
    }
    if (optional) {
        return null;
    }
    throw createAuthError(models_1.ErrorCode.INVALID_TOKEN, 'Invalid authentication token');
}
function createJWTToken(userId, roles = [], permissions = [], expiresInHours = JWT_EXPIRATION_HOURS) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: userId,
        user_id: userId,
        roles,
        permissions,
        iat: now,
        exp: now + expiresInHours * 3600,
    };
    return jwt.sign(payload, JWT_SECRET);
}
function registerAPIKey(keyId, secret, roles = ['service'], permissions = []) {
    API_KEYS.set(keyId, { secret, roles, permissions });
}
function hasRole(context, role) {
    if (!context) {
        return false;
    }
    return context.roles.includes(role);
}
function hasPermission(context, permission) {
    if (!context) {
        return false;
    }
    if (context.roles.includes('admin') || context.permissions.includes('*')) {
        return true;
    }
    return context.permissions.includes(permission);
}
function createAuthError(code, message) {
    return {
        code,
        message,
        category: models_1.ErrorCategory.AUTHENTICATION_ERROR,
        timestamp: new Date().toISOString(),
        documentation_url: 'https://docs.chrysalis.dev/auth',
    };
}
//# sourceMappingURL=auth.js.map
