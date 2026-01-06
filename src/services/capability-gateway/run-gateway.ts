import { CapabilityGatewayService, defaultRepoRoot } from './CapabilityGatewayService';

function parseArg(name: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  return process.argv[idx + 1] || def;
}

async function main(): Promise<void> {
  const port = parseInt(parseArg('port', '8089')!, 10);
  const ledgerBaseUrl = parseArg('ledgerBaseUrl', 'https://localhost:9443')!;
  const repoRoot = parseArg('repoRoot', defaultRepoRoot())!;
  const apiKeysPath = parseArg('apiKeysPath', '.chrysalis/auth/api-keys.json')!;
  const allowBootstrap = (parseArg('allowBootstrap', 'true') || 'true').toLowerCase() === 'true';
  const rateLimitPerMinute = parseInt(parseArg('rateLimitPerMinute', '60')!, 10);

  const svc = new CapabilityGatewayService({ port, ledgerBaseUrl, repoRoot, apiKeysPath, allowBootstrap, rateLimitPerMinute });
  await svc.start();
  console.log(`[CapabilityGateway] up http://localhost:${port} (ledger=${ledgerBaseUrl}) auth=${apiKeysPath}`);
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
