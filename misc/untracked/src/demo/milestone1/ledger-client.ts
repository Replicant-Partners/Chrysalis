import https from 'https';
import { AgentEvent } from '../../sync/events/types';
import { bytesToBase64, newKeypair, sha384Hex, signHashHex } from './crypto';

export type LedgerClientConfig = {
  agentId: string;
  instanceId: string;
  httpsBaseUrl: string; // e.g. https://localhost:9443
};

export class LedgerClient {
  private readonly keypair = newKeypair();
  private registered = false;

  constructor(private readonly cfg: LedgerClientConfig) {}

  async ensureRegistered(): Promise<void> {
    if (this.registered) return;
    const ts = new Date().toISOString();
    const message = `${this.cfg.agentId}:${this.cfg.instanceId}:${ts}`;
    const msgHash = sha384Hex(Buffer.from(message, 'utf8'));
    const sig = await signHashHex(this.keypair.privateKey, msgHash);
    await httpsJson(`${this.cfg.httpsBaseUrl}/registry/register`, {
      agentId: this.cfg.agentId,
      instanceId: this.cfg.instanceId,
      publicKeyBase64: bytesToBase64(this.keypair.publicKey),
      signatureBase64: bytesToBase64(sig),
      ts,
    });
    this.registered = true;
  }

  async commitEvent(event: AgentEvent): Promise<{ txId: string; acceptedAt: string; eventHash: string }> {
    await this.ensureRegistered();
    const eventHash = sha384Hex(Buffer.from(JSON.stringify(event), 'utf8'));
    const signature = await signHashHex(this.keypair.privateKey, eventHash);
    const resp = await httpsJson(`${this.cfg.httpsBaseUrl}/ledger/commit`, {
      agentId: this.cfg.agentId,
      instanceId: this.cfg.instanceId,
      publicKeyBase64: bytesToBase64(this.keypair.publicKey),
      event,
      eventHash,
      signatureBase64: bytesToBase64(signature),
    });
    return { txId: resp.txId, acceptedAt: resp.acceptedAt, eventHash };
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
          resolve(raw ? JSON.parse(raw) : null);
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

