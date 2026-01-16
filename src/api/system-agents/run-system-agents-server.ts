#!/usr/bin/env node
/**
 * System Agent API Server Runner
 *
 * Starts the HTTP server for system agent chat interactions.
 * Uses the Go LLM Gateway as the single source of truth for LLM access.
 *
 * Usage:
 *   npm run service:system-agents
 *   node dist/api/system-agents/run-system-agents-server.js
 *
 * Environment variables:
 *   PORT - Server port (default: 3200)
 *   HOST - Server host (default: 0.0.0.0)
 *   GATEWAY_BASE_URL - Go LLM gateway URL (default: http://localhost:8080)
 *   GATEWAY_AUTH_TOKEN - Optional auth token for gateway
 *
 * @module api/system-agents/run-system-agents-server
 */

import { startSystemAgentAPIServer } from './controller';
import { GatewayLLMClient } from '../../services/gateway/GatewayLLMClient';

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3200', 10);
  const host = process.env.HOST || '0.0.0.0';

  console.log('===========================================');
  console.log('  System Agent API Server');
  console.log('===========================================');
  console.log(`Starting on ${host}:${port}...`);
  console.log('');

  // Create gateway client (Go LLM Gateway is the single source of truth)
  const gatewayUrl = process.env.GATEWAY_BASE_URL || 'http://localhost:8080';
  const gatewayClient = new GatewayLLMClient({
    baseUrl: gatewayUrl,
    authToken: process.env.GATEWAY_AUTH_TOKEN,
  });
  console.log(`[Gateway] Using Go LLM Gateway at ${gatewayUrl}`);
  console.log('[Note] Ensure the Go gateway is running: cd go-services && go run ./cmd/gateway');
  console.log('');

  try {
    await startSystemAgentAPIServer({
      port,
      host,
      gatewayClient,
    });
  } catch (error) {
    console.error('Failed to start System Agent API server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down System Agent API server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  process.exit(0);
});

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
