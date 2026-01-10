/**
 * Unified authentication framework for Chrysalis services (TypeScript).
 */

import * as jwt from 'jsonwebtoken';
import http from 'http';
import { APIError, ErrorCode, ErrorCategory, AuthContext } from './models';

const JWT_SECRET = process.env.JWT_SECRET || process.env.CHRYSALIS_JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRATION_HOURS = parseInt(process.env.JWT_EXPIRATION_HOURS || '24', 10);

// API Key store (in-memory, replace with database in production)
const API_KEYS: Map<string, { secret: string; roles: string[]; permissions: string[] }> = new Map();
const ADMIN_KEY_IDS = new Set(
  (process.env.ADMIN_KEY_IDS || '').split(',').filter(Boolean)
);

export function getBearerToken(req: http.IncomingMessage): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export function verifyJWTToken(token: string): jwt.JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    return payload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return null;
    }
    return null;
  }
}

export function verifyAPIKey(key: string): { key_id: string; roles: string[]; permissions: string[] } | null {
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

export function authenticateRequest(
  req: http.IncomingMessage,
  optional: boolean = false
): AuthContext | null {
  const bearerToken = getBearerToken(req);
  if (!bearerToken) {
    if (optional) {
      return null;
    }
    throw createAuthError(ErrorCode.MISSING_AUTH, 'Authentication required');
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

  throw createAuthError(ErrorCode.INVALID_TOKEN, 'Invalid authentication token');
}

export function createJWTToken(
  userId: string,
  roles: string[] = [],
  permissions: string[] = [],
  expiresInHours: number = JWT_EXPIRATION_HOURS
): string {
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

export function registerAPIKey(
  keyId: string,
  secret: string,
  roles: string[] = ['service'],
  permissions: string[] = []
): void {
  API_KEYS.set(keyId, { secret, roles, permissions });
}

export function hasRole(context: AuthContext | null, role: string): boolean {
  if (!context) {
    return false;
  }
  return context.roles.includes(role);
}

export function hasPermission(context: AuthContext | null, permission: string): boolean {
  if (!context) {
    return false;
  }
  if (context.roles.includes('admin') || context.permissions.includes('*')) {
    return true;
  }
  return context.permissions.includes(permission);
}

function createAuthError(code: ErrorCode, message: string): APIError {
  return {
    code,
    message,
    category: ErrorCategory.AUTHENTICATION_ERROR,
    timestamp: new Date().toISOString(),
    documentation_url: 'https://docs.chrysalis.dev/auth',
  };
}
