/**
 * CapabilityGatewayService - Unified API Standard
 *
 * Agent-facing API for learning capabilities (grounding, skillforge).
 * Routes to AgentBuilder and commits events to LedgerService.
 */

import http from 'http';
import path from 'path';
import { badRequest, methodNotAllowed, notFound, readJsonBody } from '../../demo/milestone1/http';
import {
  sendJson,
  sendError,
  createSuccessResponse,
  createErrorResponse,
  APIError,
  ErrorCode,
  ErrorCategory,
} from '../ledger/api-utils';
import { authenticateRequest } from '../../shared/api-core/src/auth';
import { LedgerClient } from '../../demo/milestone1/ledger-client';
import { AgentBuilderAdapter, RoleModel } from '../../integrations/agentbuilder/AgentBuilderAdapter';
import { ApiKeyStore } from '../auth/ApiKeyStore';
import { RateLimiter } from '../auth/RateLimiter';
import { CapabilityResponse, BuildRequest } from './types';
import { AgentEvent } from '../../sync/events/types';

export type CapabilityGatewayConfig = {
  port: number;
  ledgerBaseUrl: string;
  repoRoot: string;
  apiKeysPath: string;
  allowBootstrap: boolean;
  rateLimitPerMinute: number;
};

export class CapabilityGatewayService {
  private builder: AgentBuilderAdapter;
  private apiKeys: ApiKeyStore;
  private limiter: RateLimiter;

  constructor(private readonly cfg: CapabilityGatewayConfig) {
    this.builder = new AgentBuilderAdapter();
    this.apiKeys = new ApiKeyStore(cfg.apiKeysPath);
    this.limiter = new RateLimiter({ windowMs: 60_000, max: Math.max(1, cfg.rateLimitPerMinute) });
  }

  async start(): Promise<http.Server> {
    const server = http.createServer((req, res) => void this.route(req, res));
    await new Promise<void>((resolve) => server.listen(this.cfg.port, resolve));
    return server;
  }

  private async route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '/', `http://localhost:${this.cfg.port}`);

      // Health check (public endpoint)
      if (url.pathname === '/health' || url.pathname === '/api/v1/health') {
        const response = createSuccessResponse({ status: 'healthy', service: 'capability-gateway' });
        return sendJson(res, 200, response);
      }

      // Authentication endpoints
      if (url.pathname === '/api/v1/auth/bootstrap' || url.pathname === '/auth/bootstrap') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        return void this.handleBootstrap(req, res);
      }

      // Authenticate request for protected endpoints
      const authz = this.getBearerToken(req);
      if (!authz) {
        const error: APIError = {
          code: ErrorCode.MISSING_AUTH,
          message: 'Authentication required',
          category: ErrorCategory.AUTHENTICATION_ERROR,
          timestamp: new Date().toISOString(),
          documentation_url: 'https://docs.chrysalis.dev/auth',
        };
        const { response, statusCode } = createErrorResponse(error, 401);
        return sendError(res, statusCode, error);
      }

      const v = this.apiKeys.verify(authz);
      if (!v.ok) {
        const error: APIError = {
          code: ErrorCode.INVALID_TOKEN,
          message: `Invalid authorization: ${v.reason}`,
          category: ErrorCategory.AUTHENTICATION_ERROR,
          timestamp: new Date().toISOString(),
        };
        const { response, statusCode } = createErrorResponse(error, 401);
        return sendError(res, statusCode, error);
      }

      const allowed = this.limiter.allow(v.keyId);
      if (!allowed.ok) {
        const error: APIError = {
          code: ErrorCode.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          category: ErrorCategory.RATE_LIMIT_ERROR,
          retry_after: allowed.retryAfterMs ? Math.ceil(allowed.retryAfterMs / 1000) : undefined,
          timestamp: new Date().toISOString(),
        };
        const { response, statusCode } = createErrorResponse(error, 429);
        return sendError(res, statusCode, error);
      }

      // Unified API endpoints
      if (url.pathname === '/api/v1/capabilities') {
        if (req.method === 'GET') {
          return void this.handleListCapabilities(res, v.keyId);
        } else if (req.method === 'POST') {
          const body = (await readJsonBody(req)) as BuildRequest;
          return void (await this.handleBuild(res, body, v.keyId));
        }
        return methodNotAllowed(res);
      }

      if (url.pathname.startsWith('/api/v1/capabilities/') && url.pathname !== '/api/v1/capabilities') {
        if (req.method === 'GET') {
          const capabilityId = url.pathname.split('/').pop();
          return void this.handleGetCapability(res, capabilityId || '', v.keyId);
        }
        return methodNotAllowed(res);
      }

      // Legacy endpoints (backwards compatibility)
      if (url.pathname === '/capabilities/build') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const body = (await readJsonBody(req)) as BuildRequest;
        return void (await this.handleBuild(res, body, v.keyId));
      }

      return notFound(res);
    } catch (err: any) {
      const error: APIError = {
        code: ErrorCode.INTERNAL_ERROR,
        message: String(err?.message || err),
        category: ErrorCategory.SERVICE_ERROR,
        timestamp: new Date().toISOString(),
      };
      const { response, statusCode } = createErrorResponse(error, 500);
      return sendError(res, statusCode, error);
    }
  }

  private async handleBootstrap(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.cfg.allowBootstrap) {
      const error: APIError = {
        code: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'Bootstrap is disabled',
        category: ErrorCategory.AUTHORIZATION_ERROR,
        timestamp: new Date().toISOString(),
      };
      const { response, statusCode } = createErrorResponse(error, 403);
      return sendError(res, statusCode, error);
    }

    if (this.apiKeys.exists()) {
      const error: APIError = {
        code: ErrorCode.DUPLICATE_RESOURCE,
        message: 'API keys already initialized',
        category: ErrorCategory.CONFLICT_ERROR,
        timestamp: new Date().toISOString(),
      };
      const { response, statusCode } = createErrorResponse(error, 409);
      return sendError(res, statusCode, error);
    }

    const body = (await readJsonBody(req)) as { name?: string };
    const name = body?.name?.trim() || 'admin';
    const minted = this.apiKeys.mint(name, 'admin').key;

    const response = createSuccessResponse({
      token: `${minted.id}.${minted.secret}`,
      key: minted,
    });
    sendJson(res, 201, response);
  }

  private handleListCapabilities(res: http.ServerResponse, keyId: string): void {
    // List capabilities for the authenticated key
    // For now, return empty list (would query capability registry)
    const capabilities: any[] = [];

    const response = createSuccessResponse(capabilities);
    sendJson(res, 200, response);
  }

  private handleGetCapability(res: http.ServerResponse, capabilityId: string, keyId: string): void {
    // Get capability by ID
    // For now, return not found
    const error: APIError = {
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: `Capability '${capabilityId}' not found`,
      category: ErrorCategory.NOT_FOUND_ERROR,
      timestamp: new Date().toISOString(),
    };
    const { response, statusCode } = createErrorResponse(error, 404);
    return sendError(res, statusCode, error);
  }

  private getBearerToken(req: http.IncomingMessage): string | null {
    const h = req.headers['authorization'];
    if (!h || typeof h !== 'string') return null;
    const m = h.match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() : null;
  }

  private async handleBuild(res: http.ServerResponse, body: BuildRequest, callerKeyId: string): Promise<void> {
    try {
      // Validate request
      if (!body?.roleModel) {
        const error: APIError = {
          code: ErrorCode.REQUIRED_FIELD,
          message: 'roleModel is required',
          category: ErrorCategory.VALIDATION_ERROR,
          details: [{ field: 'roleModel', message: 'roleModel is required' }],
          timestamp: new Date().toISOString(),
        };
        const { response, statusCode } = createErrorResponse(error, 400);
        return sendError(res, statusCode, error);
      }

      const agentId = body.agentId || (await this.ensureAgent(body.agent, callerKeyId));
      if (!agentId) {
        const error: APIError = {
          code: ErrorCode.REQUIRED_FIELD,
          message: 'agentId (or agent profile) is required',
          category: ErrorCategory.VALIDATION_ERROR,
          details: [{ field: 'agentId', message: 'agentId or agent profile is required' }],
          timestamp: new Date().toISOString(),
        };
        const { response, statusCode } = createErrorResponse(error, 400);
        return sendError(res, statusCode, error);
      }

      // Check authorization
      try {
        await this.assertOwnerOrAdmin(callerKeyId, agentId);
      } catch (authErr: any) {
        const error: APIError = {
          code: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: authErr.message || 'Insufficient permissions',
          category: ErrorCategory.AUTHORIZATION_ERROR,
          timestamp: new Date().toISOString(),
        };
        const { response, statusCode } = createErrorResponse(error, 403);
        return sendError(res, statusCode, error);
      }

      // Build capabilities
      await this.builder.buildAgentCapabilities(agentId, body.roleModel);

      const response = createSuccessResponse({
        agent_id: agentId,
        committed: 1,
        tx_ids: [],
      });
      sendJson(res, 200, response);
    } catch (err: any) {
      const error: APIError = {
        code: ErrorCode.INTERNAL_ERROR,
        message: `Build failed: ${String(err?.message || err)}`,
        category: ErrorCategory.SERVICE_ERROR,
        timestamp: new Date().toISOString(),
      };
      const { response, statusCode } = createErrorResponse(error, 500);
      return sendError(res, statusCode, error);
    }
  }

  private async ensureAgent(
    agent?: { designation: string; bio?: string; occupation?: string; sourceRef?: string },
    ownerKeyId?: string
  ): Promise<string | null> {
    if (!agent?.designation) return null;
    const resp = await httpPostJson(`${this.cfg.ledgerBaseUrl}/agents/register`, { profile: agent, ownerKeyId });
    const agentId = resp?.agent?.agentId || null;
    if (!agentId) return null;

    // Persist profile into the ledger as an event so ProjectionService can publish it.
    const instanceId = 'capability-gateway:registry';
    const ledger = new LedgerClient({ agentId, instanceId, httpsBaseUrl: this.cfg.ledgerBaseUrl });
    const ev: AgentEvent = {
      agentId,
      eventId: `${instanceId}:${Date.now()}`,
      type: 'PersonaUpdated',
      primitive: 'persona',
      createdAt: new Date().toISOString(),
      payload: {
        designation: agent.designation,
        bio: agent.bio,
        occupation: agent.occupation,
        sourceRef: agent.sourceRef,
      },
    };
    await ledger.commitEvent(ev);

    return agentId;
  }

  private async assertOwnerOrAdmin(callerKeyId: string, agentId: string): Promise<void> {
    if (this.apiKeys.isAdmin(callerKeyId)) return;
    const resp = await httpGetJson(`${this.cfg.ledgerBaseUrl}/agents/get?agentId=${encodeURIComponent(agentId)}`);
    const owner = resp?.agent?.ownerKeyId;
    if (!owner) throw new Error('agent has no ownerKeyId');
    if (owner !== callerKeyId) throw new Error('forbidden: not agent owner');
  }
}

export function defaultRepoRoot(): string {
  return path.resolve(process.cwd());
}

async function httpPostJson(url: string, body: any): Promise<any> {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('ledgerBaseUrl must be https');
  const https = await import('https');
  const data = Buffer.from(JSON.stringify(body), 'utf8');
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': data.length },
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          resolve(raw ? JSON.parse(raw) : null);
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function httpGetJson(url: string): Promise<any> {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('ledgerBaseUrl must be https');
  const https = await import('https');
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', rejectUnauthorized: false },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          resolve(raw ? JSON.parse(raw) : null);
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}
