import https from 'https';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { AgentEvent, LedgerCommitRequest, PollVoteRequest, RegistryRegisterRequest, SemanticClaimPayload } from './types';
import { bytesToBase64, newKeypair, sha384Hex, signHashHex } from './crypto';

export type ReplicantConfig = {
  agentId: string;
  instanceId: string;
  chrysalisHttpsBaseUrl: string; // e.g. https://localhost:9443
  chrysalisCrdtWsUrl: string; // e.g. ws://localhost:1234
  storageDir: string;
};

export class Replicant {
  private readonly keypair = newKeypair();
  private lastEventHash: string | undefined;

  constructor(private readonly cfg: ReplicantConfig) {}

  async start(): Promise<void> {
    fs.mkdirSync(this.cfg.storageDir, { recursive: true });
    await this.register();
    await this.connectPublicCrdt();
  }

  async appendSemanticClaim(key: string, value: string, source: string): Promise<string> {
    const payload: SemanticClaimPayload = {
      key,
      value,
      confidence: 0.6,
      provenance: { source, collectedAt: new Date().toISOString() },
    };
    const event: AgentEvent<SemanticClaimPayload> = {
      agentId: this.cfg.agentId,
      eventId: `${this.cfg.instanceId}_${Date.now()}`,
      type: 'SemanticClaimUpserted',
      primitive: 'semantic_memory',
      createdAt: new Date().toISOString(),
      payload,
      prev: this.lastEventHash,
    };
    const eventHash = sha384Hex(Buffer.from(JSON.stringify(event), 'utf8'));
    const signature = await signHashHex(this.keypair.privateKey, eventHash);

    const req: LedgerCommitRequest = {
      agentId: this.cfg.agentId,
      instanceId: this.cfg.instanceId,
      publicKeyBase64: bytesToBase64(this.keypair.publicKey),
      event,
      eventHash,
      signatureBase64: bytesToBase64(signature),
    };

    await httpsJson(`${this.cfg.chrysalisHttpsBaseUrl}/ledger/commit`, req);
    this.lastEventHash = eventHash;
    this.persistEvent(eventHash, event);
    return eventHash;
  }

  async vote(pollId: string, claimHash: string): Promise<void> {
    const message = `${pollId}:${claimHash}`;
    const msgHash = sha384Hex(Buffer.from(message, 'utf8'));
    const sig = await signHashHex(this.keypair.privateKey, msgHash);
    const req: PollVoteRequest = {
      agentId: this.cfg.agentId,
      pollId,
      instanceId: this.cfg.instanceId,
      publicKeyBase64: bytesToBase64(this.keypair.publicKey),
      claimHash,
      signatureBase64: bytesToBase64(sig),
    };
    await httpsJson(`${this.cfg.chrysalisHttpsBaseUrl}/semantic/poll/vote`, req);
  }

  private async register(): Promise<void> {
    const ts = new Date().toISOString();
    const message = `${this.cfg.agentId}:${this.cfg.instanceId}:${ts}`;
    const msgHash = sha384Hex(Buffer.from(message, 'utf8'));
    const sig = await signHashHex(this.keypair.privateKey, msgHash);
    const req: RegistryRegisterRequest = {
      agentId: this.cfg.agentId,
      instanceId: this.cfg.instanceId,
      publicKeyBase64: bytesToBase64(this.keypair.publicKey),
      signatureBase64: bytesToBase64(sig),
      ts,
    };
    await httpsJson(`${this.cfg.chrysalisHttpsBaseUrl}/registry/register`, req);
  }

  private async connectPublicCrdt(): Promise<void> {
    const doc = new Y.Doc();
    const wsUrl = `${this.cfg.chrysalisCrdtWsUrl.replace(/\/$/, '')}/agent:${this.cfg.agentId}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.on('message', (data: any) => {
      const bytes = data instanceof Buffer ? new Uint8Array(data) : new Uint8Array(Buffer.from(data));
      Y.applyUpdate(doc, bytes);
    });

    doc.on('update', (update: Uint8Array) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(update);
    });

    const publicClaims = doc.getMap<any>('publicClaims');
    const suppression = doc.getMap<boolean>('suppressionSet');
    publicClaims.observe(() => {
      const v = publicClaims.toJSON();
      console.log(`[${this.cfg.instanceId}] publicClaims`, JSON.stringify(v));
    });
    suppression.observe(() => {
      const v = suppression.toJSON();
      console.log(`[${this.cfg.instanceId}] suppressionSet`, JSON.stringify(v));
    });

    await waitFor(() => ws.readyState === WebSocket.OPEN, 2000);
  }

  private persistEvent(eventHash: string, event: AgentEvent): void {
    const eventsDir = path.join(this.cfg.storageDir, 'events');
    fs.mkdirSync(eventsDir, { recursive: true });
    fs.writeFileSync(path.join(eventsDir, `${eventHash}.json`), JSON.stringify(event, null, 2));
  }
}

async function httpsJson(url: string, body: any): Promise<any> {
  const u = new URL(url);
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
          try {
            resolve(raw ? JSON.parse(raw) : null);
          } catch (e) {
            resolve(raw);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function waitFor(pred: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('timeout waiting for condition');
}
