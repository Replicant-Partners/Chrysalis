/**
 * Terminal WebSocket Server Runner
 * 
 * Standalone script to run the Terminal WebSocket server.
 * 
 * Usage:
 *   npm run build && node dist/api/terminal/run-terminal-server.js
 */

import { startTerminalServer } from './websocket-server';
import { logger } from '../../observability';

const PORT = parseInt(process.env.TERMINAL_WS_PORT || '3001');
const SHELL = process.env.TERMINAL_SHELL || process.env.SHELL || '/bin/bash';

async function main() {
  try {
    logger.info('Starting Terminal WebSocket Server...', {
      port: PORT,
      shell: SHELL
    });

    const server = await startTerminalServer({
      port: PORT,
      shell: SHELL,
      maxSessions: 100,
      sessionTimeout: 30 * 60 * 1000 // 30 minutes
    });

    server.on('session:created', ({ terminalId, cols, rows }) => {
      logger.info('Terminal session created', { terminalId, cols, rows });
    });

    server.on('session:closed', ({ terminalId }) => {
      logger.info('Terminal session closed', { terminalId });
    });

    logger.info('Terminal WebSocket Server started successfully', {
      port: PORT,
      url: `ws://localhost:${PORT}`
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down Terminal WebSocket Server...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down Terminal WebSocket Server...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start Terminal WebSocket Server', error as Error);
    process.exit(1);
  }
}

main();