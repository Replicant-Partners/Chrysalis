import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface TUIOptions {
  agent?: string;
  session?: string;
  noSidebar?: boolean;
  debug?: boolean;
  apiBaseUrl?: string;
}

function resolveRepoRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

function resolveTsxPath(): string {
  try {
    return require.resolve('tsx/dist/cli.js');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`tsx is required to run the TUI. Install deps and retry. (${message})`);
  }
}

export async function startTUI(options: TUIOptions = {}): Promise<void> {
  const repoRoot = resolveRepoRoot();
  const appPath = path.join(repoRoot, 'src', 'tui', 'app.tsx');

  if (!fs.existsSync(appPath)) {
    throw new Error(`TUI app not found at ${appPath}`);
  }

  const tsxPath = resolveTsxPath();
  // Note: src/tui/package.json sets "type": "module" which enables ESM mode
  // for tsx/esbuild, allowing yoga-layout (Ink dependency) to load correctly.
  const args: string[] = [tsxPath, appPath];

  if (options.agent) {
    args.push('--agent', options.agent);
  }
  if (options.session) {
    args.push('--session', options.session);
  }
  if (options.noSidebar) {
    args.push('--no-sidebar');
  }
  if (options.debug) {
    args.push('--debug');
  }
  if (options.apiBaseUrl) {
    args.push('--base-url', options.apiBaseUrl);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code && code !== 0) {
        reject(new Error(`TUI exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}
