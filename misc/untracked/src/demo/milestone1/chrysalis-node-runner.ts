import { ChrysalisNode } from './chrysalis-node';

function parseArg(name: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  return process.argv[idx + 1] || def;
}

async function main(): Promise<void> {
  const httpsPort = parseInt(parseArg('httpsPort', '9443')!, 10);
  const crdtPort = parseInt(parseArg('crdtPort', '1234')!, 10);
  const tlsDir = parseArg('tlsDir', '.demo/milestone1/tls')!;

  const node = new ChrysalisNode({ httpsPort, crdtPort, tlsDir });
  await node.start();
  console.log(`[chrysalis-node] up https://localhost:${httpsPort} ws://localhost:${crdtPort}`);
  // Keep process alive.
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

