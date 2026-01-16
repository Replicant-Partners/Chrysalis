import { LedgerService } from './LedgerService';
import { createLogger } from '../../shared/logger';

const log = createLogger('ledger-service');

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
  log.info('ledger service started', { httpsPort, tlsDir });
  await new Promise(() => {});
}

main().catch((err) => {
  log.error('ledger service failed to start', { error: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});
