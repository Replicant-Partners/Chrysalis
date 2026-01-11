import http from 'http';
import https from 'https';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { badRequest, createHttpsServer, methodNotAllowed, notFound, readJsonBody } from '../../demo/milestone1/http';
import {
  sendJson,
  sendError,
  createSuccessResponse,
  parsePaginationParams,
  createPaginationMeta,
  APIError,
  ErrorCode,
  ErrorCategory,
} from './api-utils';
import { base64ToBytes, sha384Hex, verifyHashHex } from '../../demo/milestone1/crypto';
import {
  LedgerCommitRequest,
  LedgerCommitResponse,
  LedgerKeyRotateRequest,
  LedgerKeyRotateResponse,
  RegistryRegisterRequest,
  RegistryRegisterResponse,
} from '../../demo/milestone1/types';
import { AgentProfile, RegisteredAgent, makeAgentId } from './agent-registry';

type TxRecord = {
  txId: string;
  acceptedAt: string;
  agentId: string;
  instanceId: string;
  eventHash: string;
  event: any;
};

type RegisteredInstance = {
  publicKeyBase64: string;
  lastSeenAt: number;
};

export type LedgerServiceConfig = {
  httpsPort: number;
  tlsDir: string;
};

export class LedgerService {
  private readonly commitsByHash = new Map<string, TxRecord>();
  private readonly commitsByTxId = new Map<string, TxRecord>();
  private readonly commitsInOrder: TxRecord[] = [];
  private txCounter = 0;
  private readonly instancesByAgent = new Map<string, Map<string, RegisteredInstance>>();
  private readonly agentsById = new Map<string, RegisteredAgent>();

  constructor(private readonly config: LedgerServiceConfig) {}

  async start(): Promise<https.Server> {
    const tls = ensureDevTls(this.config.tlsDir);
    const server = createHttpsServer(
      { key: tls.key, cert: tls.cert },
      (req, res) => void this.route(req, res)
    );
    await new Promise<void>((resolve) => server.listen(this.config.httpsPort, resolve));
    return server;
  }

  private async route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '/', `https://localhost:${this.config.httpsPort}`);

      // Health check (public endpoint)
      if (url.pathname === '/health' || url.pathname === '/api/v1/health') {
        const response = createSuccessResponse({ status: 'healthy', service: 'ledger' });
        return sendJson(res, 200, response);
      }

      // Authentication is optional for LedgerService (uses Ed25519 signatures instead)
      // Can be added later if needed

      // Unified API endpoints
      if (url.pathname === '/api/v1/transactions' || url.pathname === '/ledger/transactions') {
        if (req.method === 'GET') {
          return void this.handleListTransactions(res, url);
        }
        return methodNotAllowed(res);
      }

      if (url.pathname === '/api/v1/transactions/commit' || url.pathname === '/ledger/commit') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const body = (await readJsonBody(req)) as LedgerCommitRequest;
        return void this.handleCommit(res, body);
      }

      if (url.pathname.startsWith('/api/v1/transactions/') && !url.pathname.endsWith('/commit') && !url.pathname.endsWith('/tail') && !url.pathname.endsWith('/stats')) {
        if (req.method !== 'GET') return methodNotAllowed(res);
        const txId = url.pathname.split('/').pop();
        const hash = url.searchParams.get('hash') || undefined;
        return void this.handleQuery(res, { txId, hash });
      }

      // Legacy query endpoint
      if (url.pathname === '/ledger/query') {
        if (req.method !== 'GET') return methodNotAllowed(res);
        const txId = url.searchParams.get('txId') || undefined;
        const hash = url.searchParams.get('hash') || undefined;
        return void this.handleQuery(res, { txId, hash });
      }

      if (url.pathname === '/api/v1/transactions/tail' || url.pathname === '/ledger/tail') {
        if (req.method !== 'GET') return methodNotAllowed(res);
        return void this.handleTail(res, url);
      }

      if (url.pathname === '/api/v1/transactions/stats' || url.pathname === '/ledger/stats') {
        if (req.method !== 'GET') return methodNotAllowed(res);
        return void this.handleStats(res);
      }

      if (url.pathname === '/api/v1/agents' || url.pathname === '/agents/register') {
        if (req.method === 'POST') {
          const body = (await readJsonBody(req)) as { profile?: AgentProfile; ownerKeyId?: string };
          return void this.handleAgentRegister(res, body?.profile, body?.ownerKeyId);
        } else if (req.method === 'GET') {
          return void this.handleListAgents(res, url);
        }
        return methodNotAllowed(res);
      }

      if (url.pathname.startsWith('/api/v1/agents/') || url.pathname === '/agents/get') {
        if (req.method !== 'GET') return methodNotAllowed(res);
        const agentId = url.pathname.split('/').pop() || url.searchParams.get('agentId') || '';
        return void this.handleAgentGet(res, agentId);
      }

      // Legacy endpoints (maintain for backwards compatibility)
      if (url.pathname === '/registry/register') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const body = (await readJsonBody(req)) as RegistryRegisterRequest;
        return void this.handleRegister(res, body);
      }

      if (url.pathname === '/ledger/keyrotate') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const body = (await readJsonBody(req)) as LedgerKeyRotateRequest;
        return void this.handleKeyRotate(res, body);
      }

      return notFound(res);
    } catch (err: any) {
      const error: APIError = {
        code: ErrorCode.INTERNAL_ERROR,
        message: String(err?.message || err),
        category: ErrorCategory.SERVICE_ERROR,
        timestamp: new Date().toISOString(),
      };
      return sendError(res, 500, error);
    }
  }

  private handleRegister(res: http.ServerResponse, body: RegistryRegisterRequest): void {
    if (!body?.agentId || !body?.instanceId || !body?.publicKeyBase64 || !body?.signatureBase64 || !body?.ts) {
      const error: APIError = {
        code: ErrorCode.REQUIRED_FIELD,
        message: 'Missing required fields',
        category: ErrorCategory.VALIDATION_ERROR,
        details: [
          { field: 'agentId', message: 'agentId is required' },
          { field: 'instanceId', message: 'instanceId is required' },
          { field: 'publicKeyBase64', message: 'publicKeyBase64 is required' },
          { field: 'signatureBase64', message: 'signatureBase64 is required' },
          { field: 'ts', message: 'ts is required' },
        ],
        timestamp: new Date().toISOString(),
      };
      return sendError(res, 400, error);
    }
    const pub = body.publicKeyBase64;
    const agentInstances = this.instancesByAgent.get(body.agentId) || new Map<string, RegisteredInstance>();
    agentInstances.set(body.instanceId, { publicKeyBase64: pub, lastSeenAt: Date.now() });
    this.instancesByAgent.set(body.agentId, agentInstances);
    const response = createSuccessResponse({ registered: true, registeredAt: new Date().toISOString() });
    sendJson(res, 200, response);
  }

  private async handleCommit(res: http.ServerResponse, body: LedgerCommitRequest): Promise<void> {
    if (!body?.agentId || !body?.instanceId || !body?.publicKeyBase64 || !body?.eventHash || !body?.signatureBase64) {
      return badRequest(res, 'missing fields');
    }
    const verified = await verifyHashHex(
      base64ToBytes(body.publicKeyBase64),
      body.eventHash,
      base64ToBytes(body.signatureBase64)
    );
    if (!verified) return sendJson(res, 401, { error: 'invalid_signature' });

    const txId = `tx_${++this.txCounter}`;
    const record: TxRecord = {
      txId,
      acceptedAt: new Date().toISOString(),
      agentId: body.agentId,
      instanceId: body.instanceId,
      eventHash: body.eventHash,
      event: body.event,
    };
    this.commitsByHash.set(body.eventHash, record);
    this.commitsByTxId.set(txId, record);
    this.commitsInOrder.push(record);

    const out: LedgerCommitResponse = { txId, acceptedAt: record.acceptedAt };
    sendJson(res, 200, out);
  }

  private async handleKeyRotate(res: http.ServerResponse, body: LedgerKeyRotateRequest): Promise<void> {
    if (!body?.agentId || !body?.instanceId || !body?.newPublicKeyBase64 || !body?.signatureBase64) {
      const error: APIError = {
        code: ErrorCode.REQUIRED_FIELD,
        message: 'Missing required fields',
        category: ErrorCategory.VALIDATION_ERROR,
        details: [
          { field: 'agentId', message: 'agentId is required' },
          { field: 'instanceId', message: 'instanceId is required' },
          { field: 'newPublicKeyBase64', message: 'newPublicKeyBase64 is required' },
          { field: 'signatureBase64', message: 'signatureBase64 is required' },
        ],
        timestamp: new Date().toISOString(),
      };
      return sendError(res, 400, error);
    }

    const agentInstances = this.instancesByAgent.get(body.agentId);
    const known = agentInstances?.get(body.instanceId);
    if (!known) {
      const error: APIError = {
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Instance not registered',
        category: ErrorCategory.NOT_FOUND_ERROR,
        timestamp: new Date().toISOString(),
      };
      return sendError(res, 403, error);
    }

    const message = `${body.agentId}:${body.instanceId}:keyrotate:${body.newPublicKeyBase64}`;
    const msgHash = sha384Hex(Buffer.from(message, 'utf8'));
    const ok = await verifyHashHex(
      base64ToBytes(known.publicKeyBase64),
      msgHash,
      base64ToBytes(body.signatureBase64)
    );
    if (!ok) {
      const error: APIError = {
        code: ErrorCode.INVALID_TOKEN,
        message: 'Invalid signature',
        category: ErrorCategory.AUTHENTICATION_ERROR,
        timestamp: new Date().toISOString(),
      };
      return sendError(res, 401, error);
    }

    known.publicKeyBase64 = body.newPublicKeyBase64;
    known.lastSeenAt = Date.now();

    const event = {
      agentId: body.agentId,
      eventId: `keyrotate_${sha384Hex(Buffer.from(message, 'utf8')).slice(0, 12)}`,
      type: 'KeyRotated',
      primitive: 'rights',
      createdAt: new Date().toISOString(),
      payload: { instanceId: body.instanceId, newPublicKeyBase64: body.newPublicKeyBase64 },
    };
    const eventHash = sha384Hex(Buffer.from(JSON.stringify(event), 'utf8'));

    const txId = `tx_${++this.txCounter}`;
    const record: TxRecord = {
      txId,
      acceptedAt: new Date().toISOString(),
      agentId: body.agentId,
      instanceId: body.instanceId,
      eventHash,
      event,
    };
    this.commitsByHash.set(eventHash, record);
    this.commitsByTxId.set(txId, record);
    this.commitsInOrder.push(record);

    const response = createSuccessResponse({ txId, acceptedAt: record.acceptedAt, publicKeyBase64: body.newPublicKeyBase64 });
    sendJson(res, 200, response);
  }

  private handleQuery(res: http.ServerResponse, query: { txId?: string; hash?: string }): void {
    const record =
      (query.txId ? this.commitsByTxId.get(query.txId) : undefined) ||
      (query.hash ? this.commitsByHash.get(query.hash) : undefined);
    if (!record) {
      const error: APIError = {
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Transaction not found',
        category: ErrorCategory.NOT_FOUND_ERROR,
        timestamp: new Date().toISOString(),
      };
      return sendError(res, 404, error);
    }
    const response = createSuccessResponse(record);
    sendJson(res, 200, response);
  }

  private handleTail(res: http.ServerResponse, url: URL): void {
    const afterTxId = url.searchParams.get('afterTxId') || undefined;
    const limitRaw = url.searchParams.get('limit') || url.searchParams.get('per_page') || '100';
    const limit = Math.max(1, Math.min(1000, parseInt(limitRaw, 10) || 100));

    let startIdx = 0;
    if (afterTxId) {
      const idx = this.commitsInOrder.findIndex((r) => r.txId === afterTxId);
      startIdx = idx >= 0 ? idx + 1 : 0;
    }

    const items = this.commitsInOrder.slice(startIdx, startIdx + limit);

    // For tail endpoint, return items directly with metadata
    const response = createSuccessResponse({
      items,
      after_tx_id: afterTxId,
      limit,
      returned: items.length,
      has_more: startIdx + items.length < this.commitsInOrder.length,
    });
    sendJson(res, 200, response);
  }

  private handleListTransactions(res: http.ServerResponse, url: URL): void {
    const pagination = parsePaginationParams(url);

    const startIdx = (pagination.page - 1) * pagination.per_page;
    const items = this.commitsInOrder.slice(startIdx, startIdx + pagination.per_page);
    const paginationMeta = createPaginationMeta(pagination, this.commitsInOrder.length);

    const response = createSuccessResponse(items, undefined, paginationMeta);
    sendJson(res, 200, response);
  }

  private handleStats(res: http.ServerResponse): void {
    const stats = {
      total_transactions: this.commitsInOrder.length,
      unique_agents: new Set(this.commitsInOrder.map(t => t.agentId)).size,
      unique_instances: new Set(this.commitsInOrder.map(t => t.instanceId)).size,
      latest_transaction: this.commitsInOrder[this.commitsInOrder.length - 1]?.txId || null,
    };
    const response = createSuccessResponse(stats);
    sendJson(res, 200, response);
  }

  private handleListAgents(res: http.ServerResponse, url: URL): void {
    const pagination = parsePaginationParams(url);

    const agents = Array.from(this.agentsById.values());
    const startIdx = (pagination.page - 1) * pagination.per_page;
    const items = agents.slice(startIdx, startIdx + pagination.per_page);
    const paginationMeta = createPaginationMeta(pagination, agents.length);

    const response = createSuccessResponse(items, undefined, paginationMeta);
    sendJson(res, 200, response);
  }

  private handleAgentRegister(res: http.ServerResponse, profile?: AgentProfile, ownerKeyId?: string): void {
    if (!profile?.designation) {
      const error: APIError = {
        code: ErrorCode.REQUIRED_FIELD,
        message: 'profile.designation is required',
        category: ErrorCategory.VALIDATION_ERROR,
        details: [{ field: 'profile.designation', message: 'designation is required' }],
        timestamp: new Date().toISOString(),
      };
      return sendError(res, 400, error);
    }
    const createdAt = new Date().toISOString();
    const agentId = makeAgentId(profile, createdAt);
    const rec: RegisteredAgent = { agentId, createdAt, ownerKeyId, profile };
    this.agentsById.set(agentId, rec);
    const response = createSuccessResponse(rec);
    sendJson(res, 201, response);
  }

  private handleAgentGet(res: http.ServerResponse, agentId: string): void {
    if (!agentId) {
      const error: APIError = {
        code: ErrorCode.REQUIRED_FIELD,
        message: 'agentId is required',
        category: ErrorCategory.VALIDATION_ERROR,
        details: [{ field: 'agentId', message: 'agentId is required' }],
        timestamp: new Date().toISOString(),
      };
      return sendError(res, 400, error);
    }
    const rec = this.agentsById.get(agentId);
    if (!rec) {
      const error: APIError = {
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: `Agent '${agentId}' not found`,
        category: ErrorCategory.NOT_FOUND_ERROR,
        timestamp: new Date().toISOString(),
      };
      return sendError(res, 404, error);
    }
    const response = createSuccessResponse(rec);
    sendJson(res, 200, response);
  }
}

function ensureDevTls(tlsDir: string): { key: Buffer; cert: Buffer } {
  fs.mkdirSync(tlsDir, { recursive: true });
  const keyPath = path.join(tlsDir, 'key.pem');
  const certPath = path.join(tlsDir, 'cert.pem');
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    const subj = '/CN=localhost';
    const args = [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '365',
      '-nodes',
      '-subj',
      subj,
    ];
    const r = spawnSync('openssl', args, { stdio: 'ignore' });
    if (r.status !== 0) throw new Error('failed to generate dev TLS certs (requires openssl)');
  }
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}
