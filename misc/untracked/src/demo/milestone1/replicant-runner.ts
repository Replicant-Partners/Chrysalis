import readline from 'readline';
import { Replicant } from './replicant';

function parseArg(name: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  return process.argv[idx + 1] || def;
}

type InMsg =
  | { cmd: 'claim'; key: string; value: string; source: string }
  | { cmd: 'vote'; pollId: string; claimHash: string }
  | { cmd: 'exit' };

async function main(): Promise<void> {
  const agentId = parseArg('agentId');
  const instanceId = parseArg('instanceId');
  const httpsBase = parseArg('httpsBase');
  const crdtWs = parseArg('crdtWs');
  const storageDir = parseArg('storageDir');

  if (!agentId || !instanceId || !httpsBase || !crdtWs || !storageDir) {
    throw new Error('missing args: --agentId --instanceId --httpsBase --crdtWs --storageDir');
  }

  const replicant = new Replicant({
    agentId,
    instanceId,
    chrysalisHttpsBaseUrl: httpsBase,
    chrysalisCrdtWsUrl: crdtWs,
    storageDir,
  });
  await replicant.start();
  console.log(`[${instanceId}] ready`);

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg: InMsg;
    try {
      msg = JSON.parse(line);
    } catch {
      return void write({ ok: false, error: 'invalid_json' });
    }
    try {
      if (msg.cmd === 'claim') {
        const claimHash = await replicant.appendSemanticClaim(msg.key, msg.value, msg.source);
        return void write({ ok: true, claimHash });
      }
      if (msg.cmd === 'vote') {
        await replicant.vote(msg.pollId, msg.claimHash);
        return void write({ ok: true });
      }
      if (msg.cmd === 'exit') {
        write({ ok: true });
        process.exit(0);
      }
      return void write({ ok: false, error: 'unknown_cmd' });
    } catch (err: any) {
      return void write({ ok: false, error: String(err?.message || err) });
    }
  });
}

function write(obj: any): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

