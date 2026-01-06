import { LedgerService } from './LedgerService';

function parseArg(name: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  return process.argv[idx + 1] || def;
}

async function main(): Promise<void> {
  const httpsPort = parseInt(parseArg('httpsPort', '9443')!, 10);
  const tlsDir = parseArg('tlsDir', '.chrysalis/ledger/tls')!;
  const svc = new LedgerService({ httpsPort, tlsDir });
  await svc.start();
  console.log(`[LedgerService] up https://localhost:${httpsPort}`);
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

