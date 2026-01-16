import { ProjectionService } from './ProjectionService';
import { createLogger } from '../../shared/logger';

const log = createLogger('projection-service');

function parseArg(name: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  return process.argv[idx + 1] || def;
}

async function main(): Promise<void> {
  const crdtPort = parseInt(parseArg('crdtPort', '1234')!, 10);
  const ledgerBaseUrl = parseArg('ledgerBaseUrl', 'https://localhost:9443')!;
  const pollIntervalMs = parseInt(parseArg('pollIntervalMs', '250')!, 10);
  const tailBatchSize = parseInt(parseArg('tailBatchSize', '100')!, 10);

  const svc = new ProjectionService({ crdtPort, ledgerBaseUrl, pollIntervalMs, tailBatchSize });
  await svc.start();
  log.info('projection service started', { crdtPort, ledgerBaseUrl, pollIntervalMs, tailBatchSize });
  await new Promise(() => {});
}

main().catch((err) => {
  log.error('projection service failed to start', { error: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});
