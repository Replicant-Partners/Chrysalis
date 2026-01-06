import http from 'http';
import path from 'path';
import { badRequest, methodNotAllowed, notFound, readJsonBody, sendJson } from '../../demo/milestone1/http';
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
      if (url.pathname === '/health') return sendJson(res, 200, { ok: true });

      if (url.pathname === '/auth/bootstrap') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        if (!this.cfg.allowBootstrap) return sendJson(res, 403, { error: 'bootstrap_disabled' });
        if (this.apiKeys.exists()) return sendJson(res, 409, { error: 'already_initialized' });
        const body = (await readJsonBody(req)) as { name?: string };
        const name = body?.name?.trim() || 'admin';
        const minted = this.apiKeys.mint(name, 'admin').key;
        return sendJson(res, 200, { ok: true, token: `${minted.id}.${minted.secret}`, key: minted });
      }

      const authz = this.getBearerToken(req);
      if (!authz) return sendJson(res, 401, { error: 'missing_authorization' });
      const v = this.apiKeys.verify(authz);
      if (!v.ok) return sendJson(res, 401, { error: 'invalid_authorization', reason: v.reason });
      const allowed = this.limiter.allow(v.keyId);
      if (!allowed.ok) return sendJson(res, 429, { error: 'rate_limited', retryAfterMs: allowed.retryAfterMs });

      if (url.pathname === '/capabilities/build') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const body = (await readJsonBody(req)) as BuildRequest;
        return void (await this.handleBuild(res, body, v.keyId));
      }

      return notFound(res);
    } catch (err: any) {
      return sendJson(res, 500, { error: 'server_error', message: String(err?.message || err) });
    }
  }

  private getBearerToken(req: http.IncomingMessage): string | null {
    const h = req.headers['authorization'];
    if (!h || typeof h !== 'string') return null;
    const m = h.match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() : null;
  }

  private async handleBuild(res: http.ServerResponse, body: BuildRequest, callerKeyId: string): Promise<void> {
    const agentId = body.agentId || (await this.ensureAgent(body.agent, callerKeyId));
    if (!agentId || !body?.roleModel) return badRequest(res, 'agentId (or agent profile) and roleModel required');
    await this.assertOwnerOrAdmin(callerKeyId, agentId);

    await this.builder.buildAgentCapabilities(agentId, body.roleModel);

    const out: CapabilityResponse = { ok: true, agentId, committed: 1, txIds: [] };
    sendJson(res, 200, out);
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
