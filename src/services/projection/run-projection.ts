import { ProjectionService } from './ProjectionService';

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
  console.log(`[ProjectionService] up ws://localhost:${crdtPort} (polling ${ledgerBaseUrl})`);
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

