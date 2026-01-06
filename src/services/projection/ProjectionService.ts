import http from 'http';
import https from 'https';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { sendJson, sendText } from '../../demo/milestone1/http';
import { ResolutionEventPayload, SemanticClaimPayload } from '../../demo/milestone1/types';

type TxRecord = {
  txId: string;
  acceptedAt: string;
  agentId: string;
  instanceId: string;
  eventHash: string;
  event: any;
};

export type ProjectionServiceConfig = {
  crdtPort: number;
  ledgerBaseUrl: string; // https://localhost:9443
  pollIntervalMs: number;
  tailBatchSize: number;
};

export class ProjectionService {
  private readonly crdtDocsByRoom = new Map<string, Y.Doc>();
  private readonly crdtPeersByRoom = new Map<string, Set<any>>();
  private lastSeenTxId: string | undefined;

  constructor(private readonly config: ProjectionServiceConfig) {}

  async start(): Promise<{ httpServer: http.Server; wss: any }> {
    const server = http.createServer((req, res) => {
      if ((req.url || '/') === '/health') return sendJson(res, 200, { ok: true });
      return sendText(res, 200, 'projection-service');
    });
    const wss = new WebSocketServer({ server });
    wss.on('connection', (conn: any, req: any) => this.handleCrdtConnection(conn, req));
    await new Promise<void>((resolve) => server.listen(this.config.crdtPort, resolve));

    this.pollLoop().catch((err) => {
      console.error('[ProjectionService] pollLoop error', err);
    });

    return { httpServer: server, wss };
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

  private async pollLoop(): Promise<void> {
    for (;;) {
      try {
        const batch = await this.ledgerTail(this.lastSeenTxId, this.config.tailBatchSize);
        if (batch.items.length) {
          for (const rec of batch.items) {
            await this.projectCommit(rec);
            this.lastSeenTxId = rec.txId;
          }
        }
      } catch (err) {
        // swallow transient failures
      }
      await new Promise((r) => setTimeout(r, this.config.pollIntervalMs));
    }
  }

  private async projectCommit(record: TxRecord): Promise<void> {
    const type = record?.event?.type as string | undefined;
    if (!type) return;
    const agentId = record.agentId;
    const room = `agent:${agentId}`;

    if (type === 'SemanticClaimUpserted') {
      const payload = record.event.payload as SemanticClaimPayload;
      if (!payload?.key) return;
      await this.updateSemanticCandidates(room, payload.key, record.eventHash);
      return;
    }

    if (type === 'ResolutionEvent') {
      const payload = record.event.payload as ResolutionEventPayload;
      if (!payload?.key) return;
      await this.applyResolution(room, payload);
      return;
    }

    if (type === 'SkillAdded' || type === 'SkillDeprecated') {
      await this.updateSkills(room, record.event);
      return;
    }

    if (type === 'PersonaUpdated') {
      await this.updateAgentProfile(room, record.event?.payload || {});
      return;
    }
  }

  projectAgentProfile(agentId: string, profile: any): void {
    const room = `agent:${agentId}`;
    this.updateDoc(room, (doc) => {
      const meta = doc.getMap<any>('agentProfile');
      meta.set('designation', profile?.designation || '');
      if (profile?.occupation) meta.set('occupation', profile.occupation);
      if (profile?.bio) meta.set('bio', profile.bio);
      if (profile?.sourceRef) meta.set('sourceRef', profile.sourceRef);
      meta.set('updatedAt', new Date().toISOString());
    });
  }

  private updateDoc(room: string, mut: (doc: Y.Doc) => void): void {
    const doc = this.crdtDocsByRoom.get(room) || new Y.Doc();
    this.crdtDocsByRoom.set(room, doc);
    mut(doc);
    this.broadcastRoom(room, doc);
  }

  private async updateSemanticCandidates(room: string, key: string, claimHash: string): Promise<void> {
    this.updateDoc(room, (doc) => {
      const candidates = doc.getMap<any>('semanticCandidates');
      const existing = (candidates.get(key) as string[]) || [];
      const next = Array.from(new Set([...existing, claimHash]));
      candidates.set(key, next);
    });
  }

  private async applyResolution(room: string, payload: ResolutionEventPayload): Promise<void> {
    this.updateDoc(room, (doc) => {
      const claims = doc.getMap<any>('publicClaims');
      const candidates = doc.getMap<any>('semanticCandidates');
      const suppression = doc.getMap<boolean>('suppressionSet');
      claims.set(payload.key, { claimHash: payload.winnerClaimHash, resolvedAt: new Date().toISOString() });
      candidates.set(payload.key, [payload.winnerClaimHash, ...payload.suppressedClaimHashes]);
      for (const h of payload.suppressedClaimHashes) suppression.set(h, true);
    });
  }

  private async updateSkills(room: string, event: any): Promise<void> {
    this.updateDoc(room, (doc) => {
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
    });
  }

  private async updateAgentProfile(room: string, payload: any): Promise<void> {
    this.updateDoc(room, (doc) => {
      const meta = doc.getMap<any>('agentProfile');
      if (payload?.designation) meta.set('designation', String(payload.designation));
      if (payload?.occupation) meta.set('occupation', String(payload.occupation));
      if (payload?.bio) meta.set('bio', String(payload.bio));
      if (payload?.sourceRef) meta.set('sourceRef', String(payload.sourceRef));
      meta.set('updatedAt', new Date().toISOString());
    });
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

  private async ledgerTail(afterTxId: string | undefined, limit: number): Promise<{ items: TxRecord[] }> {
    const qs = new URLSearchParams();
    if (afterTxId) qs.set('afterTxId', afterTxId);
    qs.set('limit', String(limit));
    const url = `${this.config.ledgerBaseUrl}/ledger/tail?${qs.toString()}`;
    return httpsGetJson(url);
  }
}

async function httpsGetJson(url: string): Promise<any> {
  const u = new URL(url);
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
