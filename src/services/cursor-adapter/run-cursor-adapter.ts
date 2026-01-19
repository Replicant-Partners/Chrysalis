#!/usr/bin/env npx ts-node
/**
 * Cursor Adapter Service Runner
 *
 * Starts the Cursor Adapter HTTP server that bridges system agents
 * to the Cursor IDE agent.
 *
 * Usage:
 *   npx ts-node src/services/cursor-adapter/run-cursor-adapter.ts
 *
 *   # Or after build:
 *   node dist/services/cursor-adapter/run-cursor-adapter.js
 *
 * Environment Variables:
 *   CURSOR_ADAPTER_PORT - HTTP port (default: 3210)
 *   CURSOR_ADAPTER_HOST - Bind address (default: 127.0.0.1)
 */

import CursorAdapterServer from './CursorAdapter';

const PORT = parseInt(process.env.CURSOR_ADAPTER_PORT || '3210', 10);
const HOST = process.env.CURSOR_ADAPTER_HOST || '127.0.0.1';

async function main() {
  console.log('='.repeat(60));
  console.log('Cursor Adapter Service');
  console.log('='.repeat(60));
  console.log('');
  console.log('This service bridges system agents (Ada, Lea, Phil, David, Milton)');
  console.log('to the Cursor IDE agent for complex reasoning tasks.');
  console.log('');
  console.log(`Starting server on http://${HOST}:${PORT}`);
  console.log('');

  const server = new CursorAdapterServer({
    port: PORT,
    host: HOST,
  });

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n[CursorAdapter] Shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[CursorAdapter] Shutting down...');
    await server.stop();
    process.exit(0);
  });

  // Start server
  try {
    await server.start();
    console.log('');
    console.log('Endpoints:');
    console.log(`  POST /v1/complete  - Submit request (waits for response)`);
    console.log(`  GET  /v1/pending   - List pending requests`);
    console.log(`  POST /v1/respond   - Submit response (from Cursor)`);
    console.log(`  GET  /health       - Health check`);
    console.log('');
    console.log('Waiting for requests...');
  } catch (error) {
    console.error('[CursorAdapter] Failed to start:', error);
    process.exit(1);
  }
}

main();
