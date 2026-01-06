import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { spawnSync } from 'child_process';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import {
  LedgerCommitRequest,
  LedgerCommitResponse,
  LedgerKeyRotateRequest,
  LedgerKeyRotateResponse,
  PollStartRequest,
  PollStartResponse,
  PollStatusResponse,
  PollVoteRequest,
  RegistryRegisterRequest,
  RegistryRegisterResponse,
  ResolutionEventPayload,
  SemanticClaimPayload,
} from './types';
import { badRequest, createHttpsServer, methodNotAllowed, notFound, readJsonBody, sendJson, sendText } from './http';
import { base64ToBytes, sha384Hex, verifyHashHex } from './crypto';

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

type Poll = {
  pollId: string;
  agentId: string;
  key: string;
  candidates: string[];
  quorumRequired: number;
  votes: Record<string, string>; // instanceId -> claimHash
  decidedAt?: string;
  winnerClaimHash?: string;
};

export type ChrysalisNodeConfig = {
  httpsPort: number;
  crdtPort: number;
  tlsDir: string;
};

export class ChrysalisNode {
  private readonly commitsByHash = new Map<string, TxRecord>();
  private readonly commitsByTxId = new Map<string, TxRecord>();
  private txCounter = 0;

  private readonly instancesByAgent = new Map<string, Map<string, RegisteredInstance>>();

  private readonly claimsByAgentAndKey = new Map<string, Map<string, Set<string>>>();
  private readonly claimPayloadByHash = new Map<string, SemanticClaimPayload>();

  private readonly pollsById = new Map<string, Poll>();

  private readonly crdtDocsByRoom = new Map<string, Y.Doc>();
  private readonly crdtPeersByRoom = new Map<string, Set<any>>();

  constructor(private readonly config: ChrysalisNodeConfig) {}

  async start(): Promise<{ httpsServer: https.Server; crdtServer: http.Server }> {
    const tls = ensureDevTls(this.config.tlsDir);

    const httpsServer = createHttpsServer(
      { key: tls.key, cert: tls.cert },
      (req, res) => void this.route(req, res)
    );

    await new Promise<void>((resolve) => httpsServer.listen(this.config.httpsPort, resolve));

    const crdtServer = http.createServer((_, res) => sendText(res, 200, 'chrysalis-crdt'));
    const wss = new WebSocketServer({ server: crdtServer });
    wss.on('connection', (conn: any, req: any) => this.handleCrdtConnection(conn, req));
    await new Promise<void>((resolve) => crdtServer.listen(this.config.crdtPort, resolve));

    return { httpsServer, crdtServer };
  }

  private handleCrdtConnection(conn: any, req: any): void {
    const room = this.roomFromReq(req);
    const doc = this.crdtDocsByRoom.get(room) || new Y.Doc();
    this.crdtDocsByRoom.set(room, doc);
    const peers = this.crdtPeersByRoom.get(room) || new Set<any>();
    peers.add(conn);
    this.crdtPeersByRoom.set(room, peers);

    const initial = Y.encodeStateAsUpdate(doc);
    conn.send(initial);

    conn.on('message', (data: any) => {
      const update = data instanceof Buffer ? new Uint8Array(data) : new Uint8Array(Buffer.from(data));
      Y.applyUpdate(doc, update);
      for (const peer of peers) {
        if (peer === conn) continue;
        try {
          peer.send(update);
        } catch {
          // ignore
        }
      }
    });
    conn.on('close', () => {
      peers.delete(conn);
    });
  }

  private roomFromReq(req: any): string {
    try {
      const url = new URL(req?.url || '/', `http://localhost:${this.config.crdtPort}`);
      const p = url.pathname.replace(/^\//, '');
      return p || 'default';
    } catch {
      return 'default';
    }
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

      if (url.pathname === '/semantic/poll/start') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const body = (await readJsonBody(req)) as PollStartRequest;
        return void this.handlePollStart(res, body);
      }

      if (url.pathname === '/semantic/poll/vote') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const body = (await readJsonBody(req)) as PollVoteRequest;
        return void this.handlePollVote(res, body);
      }

      if (url.pathname === '/semantic/poll/status') {
        if (req.method !== 'GET') return methodNotAllowed(res);
        const pollId = url.searchParams.get('pollId');
        if (!pollId) return badRequest(res, 'pollId required');
        return void this.handlePollStatus(res, pollId);
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

    await this.indexIfSemanticClaim(record);
    await this.projectCommitToPublicCrdt(record);
    await this.maybeResolveConflicts(body.agentId);

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

    const out: LedgerKeyRotateResponse = { txId, acceptedAt: record.acceptedAt, publicKeyBase64: body.newPublicKeyBase64 };
    sendJson(res, 200, out);
  }

  private handleQuery(res: http.ServerResponse, query: { txId?: string; hash?: string }): void {
    const record =
      (query.txId ? this.commitsByTxId.get(query.txId) : undefined) || (query.hash ? this.commitsByHash.get(query.hash) : undefined);
    if (!record) return sendJson(res, 404, { error: 'not_found' });
    sendJson(res, 200, { status: 'included', ...record });
  }

  private handlePollStart(res: http.ServerResponse, body: PollStartRequest): void {
    if (!body?.agentId || !body?.key || !Array.isArray(body?.candidates) || body.candidates.length < 2) {
      return badRequest(res, 'agentId, key, and >=2 candidates required');
    }
    const registeredCount = this.instancesByAgent.get(body.agentId)?.size || 0;
    const quorumRequired = Math.ceil(registeredCount * 0.5);
    const pollId = `poll_${sha384Hex(Buffer.from(`${body.agentId}:${body.key}:${Date.now()}`)).slice(0, 12)}`;
    const poll: Poll = {
      pollId,
      agentId: body.agentId,
      key: body.key,
      candidates: body.candidates,
      quorumRequired,
      votes: {},
    };
    this.pollsById.set(pollId, poll);
    const out: PollStartResponse = { pollId, quorumRequired };
    sendJson(res, 200, out);
  }

  private async handlePollVote(res: http.ServerResponse, body: PollVoteRequest): Promise<void> {
    const poll = body?.pollId ? this.pollsById.get(body.pollId) : undefined;
    if (!poll) return sendJson(res, 404, { error: 'poll_not_found' });
    if (poll.agentId !== body.agentId) return badRequest(res, 'agentId mismatch');
    if (!poll.candidates.includes(body.claimHash)) return badRequest(res, 'invalid candidate');

    const known = this.instancesByAgent.get(body.agentId)?.get(body.instanceId);
    if (!known) return sendJson(res, 403, { error: 'instance_not_registered' });
    if (known.publicKeyBase64 !== body.publicKeyBase64) return sendJson(res, 403, { error: 'public_key_mismatch' });

    const message = `${body.pollId}:${body.claimHash}`;
    const msgHash = sha384Hex(Buffer.from(message, 'utf8'));
    const ok = await verifyHashHex(
      base64ToBytes(body.publicKeyBase64),
      msgHash,
      base64ToBytes(body.signatureBase64)
    );
    if (!ok) return sendJson(res, 401, { error: 'invalid_signature' });

    poll.votes[body.instanceId] = body.claimHash;
    await this.maybeFinalizePoll(poll);
    sendJson(res, 200, { ok: true });
  }

  private handlePollStatus(res: http.ServerResponse, pollId: string): void {
    const poll = this.pollsById.get(pollId);
    if (!poll) return sendJson(res, 404, { error: 'poll_not_found' });
    const out: PollStatusResponse = {
      pollId: poll.pollId,
      agentId: poll.agentId,
      key: poll.key,
      quorumRequired: poll.quorumRequired,
      votes: poll.votes,
      winnerClaimHash: poll.winnerClaimHash,
      decidedAt: poll.decidedAt,
    };
    sendJson(res, 200, out);
  }

  private async projectCommitToPublicCrdt(record: TxRecord): Promise<void> {
    const type = record?.event?.type as string | undefined;
    if (!type) return;

    if (type === 'SemanticClaimUpserted') {
      const payload = record.event.payload as SemanticClaimPayload;
      if (!payload?.key) return;
      await this.updatePublicSemanticCandidates(record.agentId, payload.key, record.eventHash);
      // If only one candidate for the key, treat it as the current public claim.
      const byKey = this.claimsByAgentAndKey.get(record.agentId);
      const hashes = byKey?.get(payload.key);
      if (hashes && hashes.size === 1) {
        await this.updatePublicSemanticCurrent(record.agentId, payload.key, record.eventHash);
      }
      return;
    }

    if (type === 'SkillAdded' || type === 'SkillDeprecated') {
      await this.updatePublicSkills(record.agentId, record.event);
      return;
    }
  }

  private async updatePublicSemanticCandidates(agentId: string, key: string, claimHash: string): Promise<void> {
    const room = `agent:${agentId}`;
    const doc = this.crdtDocsByRoom.get(room) || new Y.Doc();
    this.crdtDocsByRoom.set(room, doc);

    const candidates = doc.getMap<any>('semanticCandidates');
    const existing = (candidates.get(key) as string[]) || [];
    const next = Array.from(new Set([...existing, claimHash]));
    candidates.set(key, next);

    this.broadcastRoom(room, doc);
  }

  private async updatePublicSemanticCurrent(agentId: string, key: string, claimHash: string): Promise<void> {
    const room = `agent:${agentId}`;
    const doc = this.crdtDocsByRoom.get(room) || new Y.Doc();
    this.crdtDocsByRoom.set(room, doc);
    const claims = doc.getMap<any>('publicClaims');
    claims.set(key, { claimHash, resolvedAt: new Date().toISOString() });
    this.broadcastRoom(room, doc);
  }

  private async updatePublicSkills(agentId: string, event: any): Promise<void> {
    const room = `agent:${agentId}`;
    const doc = this.crdtDocsByRoom.get(room) || new Y.Doc();
    this.crdtDocsByRoom.set(room, doc);

    const skills = doc.getMap<any>('skills');
    const payload = event?.payload || {};
    const name = String(payload?.name || payload?.skill || '');
    if (!name) return;
    const current = skills.get(name) || {};
    const next = {
      ...current,
      name,
      description: payload?.description || current.description || '',
      confidence: payload?.confidence ?? current.confidence ?? undefined,
      status: event.type === 'SkillDeprecated' ? 'deprecated' : 'active',
      updatedAt: new Date().toISOString(),
      source: payload?.provenance?.source || payload?.source || undefined,
    };
    skills.set(name, next);
    this.broadcastRoom(room, doc);
  }

  private broadcastRoom(room: string, doc: Y.Doc): void {
    const peers = this.crdtPeersByRoom.get(room);
    if (!peers?.size) return;
    const update = Y.encodeStateAsUpdate(doc);
    for (const peer of peers) {
      try {
        peer.send(update);
      } catch {
        // ignore
      }
    }
  }

  private async indexIfSemanticClaim(record: TxRecord): Promise<void> {
    if (record?.event?.type !== 'SemanticClaimUpserted') return;
    const payload = record.event.payload as SemanticClaimPayload;
    if (!payload?.key || typeof payload.value !== 'string') return;

    this.claimPayloadByHash.set(record.eventHash, payload);

    const byKey = this.claimsByAgentAndKey.get(record.agentId) || new Map<string, Set<string>>();
    const set = byKey.get(payload.key) || new Set<string>();
    set.add(record.eventHash);
    byKey.set(payload.key, set);
    this.claimsByAgentAndKey.set(record.agentId, byKey);
  }

  private async maybeResolveConflicts(agentId: string): Promise<void> {
    const byKey = this.claimsByAgentAndKey.get(agentId);
    if (!byKey) return;

    for (const [key, hashes] of byKey.entries()) {
      const values = new Map<string, string[]>(); // value -> hashes
      for (const h of hashes) {
        const p = this.claimPayloadByHash.get(h);
        if (!p) continue;
        const arr = values.get(p.value) || [];
        arr.push(h);
        values.set(p.value, arr);
      }
      if (values.size <= 1) continue;

      const candidates = Array.from(hashes);
      const winner = await this.tryEmpiricalResolution(agentId, key, candidates);
      if (winner) {
        await this.emitResolutionEvent(agentId, key, winner, candidates.filter((h) => h !== winner), 'ground_truth_service');
        continue;
      }

      const pollId = await this.ensurePoll(agentId, key, candidates);
      console.log(`[chrysalis-node] semantic conflict on "${key}", poll started: ${pollId}`);
    }
  }

  private async tryEmpiricalResolution(_agentId: string, _key: string, _candidates: string[]): Promise<string | null> {
    return null;
  }

  private async ensurePoll(agentId: string, key: string, candidates: string[]): Promise<string> {
    const existing = Array.from(this.pollsById.values()).find(
      (p) => p.agentId === agentId && p.key === key && !p.decidedAt
    );
    if (existing) return existing.pollId;

    const registeredCount = this.instancesByAgent.get(agentId)?.size || 0;
    const quorumRequired = Math.ceil(registeredCount * 0.5);
    const pollId = `poll_${sha384Hex(Buffer.from(`${agentId}:${key}:${Date.now()}`)).slice(0, 12)}`;
    const poll: Poll = {
      pollId,
      agentId,
      key,
      candidates,
      quorumRequired,
      votes: {},
    };
    this.pollsById.set(pollId, poll);
    return pollId;
  }

  private async maybeFinalizePoll(poll: Poll): Promise<void> {
    if (poll.decidedAt) return;
    const votes = Object.values(poll.votes);
    const uniqueVoters = Object.keys(poll.votes).length;
    if (uniqueVoters < poll.quorumRequired) return;

    const counts = new Map<string, number>();
    for (const v of votes) counts.set(v, (counts.get(v) || 0) + 1);
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const winner = sorted[0]?.[0];
    if (!winner) return;

    poll.winnerClaimHash = winner;
    poll.decidedAt = new Date().toISOString();

    const suppressed = poll.candidates.filter((h) => h !== winner);
    await this.emitResolutionEvent(poll.agentId, poll.key, winner, suppressed, 'poll', poll);
  }

  private async emitResolutionEvent(
    agentId: string,
    key: string,
    winnerClaimHash: string,
    suppressedClaimHashes: string[],
    decidedBy: 'ground_truth_service' | 'poll',
    poll?: Poll
  ): Promise<void> {
    const payload: ResolutionEventPayload = {
      key,
      winnerClaimHash,
      suppressedClaimHashes,
      decidedBy,
      poll: poll
        ? {
            quorumRequired: poll.quorumRequired,
            quorumReached: Object.keys(poll.votes).length,
            votes: poll.votes,
          }
        : undefined,
    };

    const event = {
      agentId,
      eventId: `resolution_${sha384Hex(Buffer.from(`${agentId}:${key}:${Date.now()}`)).slice(0, 12)}`,
      type: 'ResolutionEvent',
      primitive: 'semantic_memory',
      createdAt: new Date().toISOString(),
      payload,
    };

    const eventHash = sha384Hex(Buffer.from(JSON.stringify(event), 'utf8'));
    const txId = `tx_${++this.txCounter}`;
    const record: TxRecord = {
      txId,
      acceptedAt: new Date().toISOString(),
      agentId,
      instanceId: 'chrysalis-ground-truth',
      eventHash,
      event,
    };
    this.commitsByHash.set(eventHash, record);
    this.commitsByTxId.set(txId, record);

    await this.updatePublicCrdt(agentId, payload);

    console.log(
      `[chrysalis-node] resolved semantic conflict key="${key}" winner=${winnerClaimHash} suppressed=${suppressedClaimHashes.length}`
    );
  }

  private async updatePublicCrdt(agentId: string, payload: ResolutionEventPayload): Promise<void> {
    const room = `agent:${agentId}`;
    const doc = this.crdtDocsByRoom.get(room) || new Y.Doc();
    this.crdtDocsByRoom.set(room, doc);

    const claims = doc.getMap<any>('publicClaims');
    const candidates = doc.getMap<any>('semanticCandidates');
    const suppression = doc.getMap<boolean>('suppressionSet');

    claims.set(payload.key, { claimHash: payload.winnerClaimHash, resolvedAt: new Date().toISOString() });
    candidates.set(payload.key, [payload.winnerClaimHash, ...payload.suppressedClaimHashes]);
    for (const h of payload.suppressedClaimHashes) suppression.set(h, true);

    this.broadcastRoom(room, doc);
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
