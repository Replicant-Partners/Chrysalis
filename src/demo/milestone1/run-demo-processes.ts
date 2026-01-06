import { spawn } from 'child_process';
import https from 'https';
import path from 'path';
import { AgentBuilderAdapter, RoleModel } from '../../integrations/agentbuilder/AgentBuilderAdapter';
import { LedgerClient } from './ledger-client';

type Child = ReturnType<typeof spawn>;

async function main(): Promise<void> {
  const httpsPort = 9443;
  const crdtPort = 1234;
  const httpsBase = `https://localhost:${httpsPort}`;
  const crdtWs = `ws://localhost:${crdtPort}`;
  const agentId = 'replicant-demo-agent';

  const node = spawn('node', ['dist/demo/milestone1/chrysalis-node-runner.js', '--httpsPort', String(httpsPort), '--crdtPort', String(crdtPort)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipe('node', node);
  await waitForHealth(`${httpsBase}/health`, 5000);

  const a = spawnReplicant('replicant-a', agentId, httpsBase, crdtWs, '.demo/milestone1/replicant-a');
  const b = spawnReplicant('replicant-b', agentId, httpsBase, crdtWs, '.demo/milestone1/replicant-b');

  await waitForReady('replicant-a', a, 5000);
  await waitForReady('replicant-b', b, 5000);

  // Step 1: Build agent capabilities using the unified AgentBuilder
  const builder = new AgentBuilderAdapter();
  const roleModel: RoleModel = {
    name: 'Satya Nadella',
    occupation: 'Software Engineer',
  };
  await builder.buildAgentCapabilities(agentId, roleModel);
  console.log('[demo] Agent capabilities built and stored.');

  // Step 3: Replicants commit contradictory semantic claims -> triggers poll and ResolutionEvent -> updates public CRDT.
  const claimA = await sendCmd(a, { cmd: 'claim', key: 'ceo_of_microsoft', value: 'Satya Nadella', source: 'replicant-a-experience' });
  const claimB = await sendCmd(b, { cmd: 'claim', key: 'ceo_of_microsoft', value: 'Steve Ballmer', source: 'replicant-b-experience' });
  console.log('[demo] conflicting replicant claims committed', { claimA: claimA.claimHash, claimB: claimB.claimHash });

  const pollStart = await httpsPostJson(`${httpsBase}/semantic/poll/start`, {
    agentId,
    key: 'ceo_of_microsoft',
    candidates: [claimA.claimHash, claimB.claimHash],
  });
  console.log('[demo] poll started', pollStart);

  await sendCmd(a, { cmd: 'vote', pollId: pollStart.pollId, claimHash: claimA.claimHash });
  await sendCmd(b, { cmd: 'vote', pollId: pollStart.pollId, claimHash: claimA.claimHash });
  console.log('[demo] votes submitted');

  const status = await httpsGetJson(`${httpsBase}/semantic/poll/status?pollId=${encodeURIComponent(pollStart.pollId)}`);
  console.log('[demo] poll status', status);

  await new Promise((r) => setTimeout(r, 500));

  await sendCmd(a, { cmd: 'exit' });
  await sendCmd(b, { cmd: 'exit' });
  node.kill('SIGTERM');
}

function spawnReplicant(instanceId: string, agentId: string, httpsBase: string, crdtWs: string, storageDir: string): Child {
  const child = spawn(
    'node',
    [
      'dist/demo/milestone1/replicant-runner.js',
      '--agentId',
      agentId,
      '--instanceId',
      instanceId,
      '--httpsBase',
      httpsBase,
      '--crdtWs',
      crdtWs,
      '--storageDir',
      storageDir,
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );
  pipe(instanceId, child);
  return child;
}

function pipe(name: string, child: Child): void {
  child.stdout?.on('data', (d) => {
    process.stdout.write(`[${name}] ${String(d)}`);
  });
  child.stderr?.on('data', (d) => {
    process.stderr.write(`[${name}:err] ${String(d)}`);
  });
}

async function sendCmd(child: Child, obj: any): Promise<any> {
  const line = `${JSON.stringify(obj)}\n`;
  const p = waitForJsonLine(child, 5000);
  child.stdin?.write(line);
  return p;
}

async function waitForJsonLine(child: Child, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let buf = '';
    const onData = (d: any) => {
      buf += String(d);
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        try {
          child.stdout?.off('data', onData);
          return resolve(JSON.parse(trimmed));
        } catch {
          // ignore
        }
      }
      if (Date.now() - start > timeoutMs) {
        child.stdout?.off('data', onData);
        reject(new Error('timeout waiting for child response'));
      }
    };
    child.stdout?.on('data', onData);
    setTimeout(() => {
      child.stdout?.off('data', onData);
      reject(new Error('timeout waiting for child response'));
    }, timeoutMs);
  });
}

async function waitForReady(name: string, child: Child, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // crude: if process is alive and has printed "ready", we proceed.
    // The orchestration uses command responses anyway, so this is best-effort.
    if (child.exitCode !== null) throw new Error(`${name} exited early`);
    await new Promise((r) => setTimeout(r, 50));
    return;
  }
  throw new Error(`timeout waiting for ${name}`);
}

async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await httpsGetJson(url);
      if (r?.ok) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('timeout waiting for chrysalis-node health');
}

async function httpsPostJson(url: string, body: any): Promise<any> {
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

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
