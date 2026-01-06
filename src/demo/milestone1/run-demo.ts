import { ChrysalisNode } from './chrysalis-node';
import { Replicant } from './replicant';
import https from 'https';

async function main(): Promise<void> {
  const httpsPort = 9443;
  const crdtPort = 1234;

  const node = new ChrysalisNode({
    httpsPort,
    crdtPort,
    tlsDir: '.demo/milestone1/tls',
  });
  await node.start();
  console.log(`[demo] chrysalis-node up: https://localhost:${httpsPort} ws://localhost:${crdtPort}`);

  const agentId = 'replicant-demo-agent';

  const replicantA = new Replicant({
    agentId,
    instanceId: 'replicant-a',
    chrysalisHttpsBaseUrl: `https://localhost:${httpsPort}`,
    chrysalisCrdtWsUrl: `ws://localhost:${crdtPort}`,
    storageDir: '.demo/milestone1/replicant-a',
  });
  const replicantB = new Replicant({
    agentId,
    instanceId: 'replicant-b',
    chrysalisHttpsBaseUrl: `https://localhost:${httpsPort}`,
    chrysalisCrdtWsUrl: `ws://localhost:${crdtPort}`,
    storageDir: '.demo/milestone1/replicant-b',
  });

  await replicantA.start();
  await replicantB.start();
  console.log('[demo] replicants registered and connected to public CRDT');

  const claimA = await replicantA.appendSemanticClaim('ceo_of_microsoft', 'Satya Nadella', 'replicant-a-experience');
  const claimB = await replicantB.appendSemanticClaim('ceo_of_microsoft', 'Steve Ballmer', 'replicant-b-experience');
  console.log('[demo] conflicting claims committed', { claimA, claimB });

  // Poll should have started; fetch poll id by scanning status endpoint list is not implemented,
  // so we deterministically recreate the expected conflict and start poll via API.
  const pollStart = await httpsJson(`https://localhost:${httpsPort}/semantic/poll/start`, {
    agentId,
    key: 'ceo_of_microsoft',
    candidates: [claimA, claimB],
  });
  const pollId = pollStart.pollId as string;
  console.log('[demo] poll started', pollStart);

  await replicantA.vote(pollId, claimA);
  await replicantB.vote(pollId, claimA); // majority wins: claimA
  console.log('[demo] votes submitted');

  const status = await httpsGetJson(`https://localhost:${httpsPort}/semantic/poll/status?pollId=${encodeURIComponent(pollId)}`);
  console.log('[demo] poll status', status);

  // Give CRDT time to propagate.
  await new Promise((r) => setTimeout(r, 500));
  console.log('[demo] done (watch replicant logs for CRDT convergence)');
  process.exit(0);
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

async function httpsGetJson(url: string): Promise<any> {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'GET',
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
    req.end();
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
