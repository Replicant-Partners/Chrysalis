import http from 'http';
import https from 'https';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { badRequest, createHttpsServer, methodNotAllowed, notFound, readJsonBody, sendJson, sendText } from '../../demo/milestone1/http';
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
      if (url.pathname === '/health') return sendJson(res, 200, { ok: true });

      if (url.pathname === '/registry/register') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const body = (await readJsonBody(req)) as RegistryRegisterRequest;
        return void this.handleRegister(res, body);
      }

      if (url.pathname === '/ledger/commit') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const body = (await readJsonBody(req)) as LedgerCommitRequest;
        return void this.handleCommit(res, body);
      }

      if (url.pathname === '/ledger/keyrotate') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const body = (await readJsonBody(req)) as LedgerKeyRotateRequest;
        return void this.handleKeyRotate(res, body);
      }

      if (url.pathname === '/ledger/query') {
        if (req.method !== 'GET') return methodNotAllowed(res);
        const txId = url.searchParams.get('txId') || undefined;
        const hash = url.searchParams.get('hash') || undefined;
        return void this.handleQuery(res, { txId, hash });
      }

      if (url.pathname === '/ledger/tail') {
        if (req.method !== 'GET') return methodNotAllowed(res);
        const afterTxId = url.searchParams.get('afterTxId') || undefined;
        const limitRaw = url.searchParams.get('limit') || '100';
        const limit = Math.max(1, Math.min(1000, parseInt(limitRaw, 10) || 100));
        return void this.handleTail(res, { afterTxId, limit });
      }

      if (url.pathname === '/agents/register') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const body = (await readJsonBody(req)) as { profile?: AgentProfile; ownerKeyId?: string };
        return void this.handleAgentRegister(res, body?.profile, body?.ownerKeyId);
      }

      if (url.pathname === '/agents/get') {
        if (req.method !== 'GET') return methodNotAllowed(res);
        const agentId = url.searchParams.get('agentId') || '';
        return void this.handleAgentGet(res, agentId);
      }

      return notFound(res);
    } catch (err: any) {
      return sendJson(res, 500, { error: 'server_error', message: String(err?.message || err) });
    }
  }

  private handleRegister(res: http.ServerResponse, body: RegistryRegisterRequest): void {
    if (!body?.agentId || !body?.instanceId || !body?.publicKeyBase64 || !body?.signatureBase64 || !body?.ts) {
      return badRequest(res, 'missing fields');
    }
    const pub = body.publicKeyBase64;
    const agentInstances = this.instancesByAgent.get(body.agentId) || new Map<string, RegisteredInstance>();
    agentInstances.set(body.instanceId, { publicKeyBase64: pub, lastSeenAt: Date.now() });
    this.instancesByAgent.set(body.agentId, agentInstances);
    const out: RegistryRegisterResponse = { ok: true, registeredAt: new Date().toISOString() };
    sendJson(res, 200, out);
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
      return badRequest(res, 'missing fields');
    }

    const agentInstances = this.instancesByAgent.get(body.agentId);
    const known = agentInstances?.get(body.instanceId);
    if (!known) return sendJson(res, 403, { error: 'instance_not_registered' });

    const message = `${body.agentId}:${body.instanceId}:keyrotate:${body.newPublicKeyBase64}`;
    const msgHash = sha384Hex(Buffer.from(message, 'utf8'));
    const ok = await verifyHashHex(
      base64ToBytes(known.publicKeyBase64),
      msgHash,
      base64ToBytes(body.signatureBase64)
    );
    if (!ok) return sendJson(res, 401, { error: 'invalid_signature' });

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

    const out: LedgerKeyRotateResponse = { txId, acceptedAt: record.acceptedAt, publicKeyBase64: body.newPublicKeyBase64 };
    sendJson(res, 200, out);
  }

  private handleQuery(res: http.ServerResponse, query: { txId?: string; hash?: string }): void {
    const record =
      (query.txId ? this.commitsByTxId.get(query.txId) : undefined) ||
      (query.hash ? this.commitsByHash.get(query.hash) : undefined);
    if (!record) return sendJson(res, 404, { error: 'not_found' });
    sendJson(res, 200, { status: 'included', ...record });
  }

  private handleTail(res: http.ServerResponse, query: { afterTxId?: string; limit: number }): void {
    let startIdx = 0;
    if (query.afterTxId) {
      const idx = this.commitsInOrder.findIndex((r) => r.txId === query.afterTxId);
      startIdx = idx >= 0 ? idx + 1 : 0;
    }
    const items = this.commitsInOrder.slice(startIdx, startIdx + query.limit);
    sendJson(res, 200, { items });
  }

  private handleAgentRegister(res: http.ServerResponse, profile?: AgentProfile, ownerKeyId?: string): void {
    if (!profile?.designation) return badRequest(res, 'profile.designation required');
    const createdAt = new Date().toISOString();
    const agentId = makeAgentId(profile, createdAt);
    const rec: RegisteredAgent = { agentId, createdAt, ownerKeyId, profile };
    this.agentsById.set(agentId, rec);
    sendJson(res, 200, { ok: true, agent: rec });
  }

  private handleAgentGet(res: http.ServerResponse, agentId: string): void {
    if (!agentId) return badRequest(res, 'agentId required');
    const rec = this.agentsById.get(agentId);
    if (!rec) return sendJson(res, 404, { error: 'agent_not_found' });
    sendJson(res, 200, { ok: true, agent: rec });
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
