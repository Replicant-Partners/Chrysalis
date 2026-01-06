import WebSocket from 'ws';
import * as Y from 'yjs';

function parseArg(name: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  return process.argv[idx + 1] || def;
}

async function main(): Promise<void> {
  const wsBase = parseArg('wsBase');
  const agentId = parseArg('agentId');
  const waitMs = parseInt(parseArg('waitMs', '800')!, 10);
  if (!wsBase || !agentId) throw new Error('missing args: --wsBase and --agentId');

  const wsUrl = `${wsBase.replace(/\/$/, '')}/agent:${agentId}`;
  const doc = new Y.Doc();
  const ws = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';

  ws.on('message', (data: any) => {
    const bytes = data instanceof Buffer ? new Uint8Array(data) : new Uint8Array(Buffer.from(data));
    Y.applyUpdate(doc, bytes);
  });

  await waitFor(() => ws.readyState === WebSocket.OPEN, 2000);
  await new Promise((r) => setTimeout(r, waitMs));

  const publicClaims = doc.getMap<any>('publicClaims').toJSON();
  const semanticCandidates = doc.getMap<any>('semanticCandidates').toJSON();
  const suppressionSet = doc.getMap<any>('suppressionSet').toJSON();
  const skills = doc.getMap<any>('skills').toJSON();
  const agentProfile = doc.getMap<any>('agentProfile').toJSON();

  process.stdout.write(
    JSON.stringify({ ok: true, agentId, agentProfile, publicClaims, semanticCandidates, suppressionSet, skills }, null, 2) + '\n'
  );
  ws.close();
}

async function waitFor(pred: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('timeout');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
