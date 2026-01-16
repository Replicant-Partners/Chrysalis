/**
 * Feedback API Server Runner
 * 
 * Simple HTTP server for feedback API endpoints.
 * 
 * Usage:
 *   npm run build && node dist/api/feedback/run-feedback-server.js
 */

import * as http from 'http';
import { createFeedbackApiHandler } from './feedback-handler';
import { logger } from '../../observability';

const PORT = parseInt(process.env.FEEDBACK_API_PORT || '3002');

async function main() {
  const feedbackApi = createFeedbackApiHandler({
    emailNotifications: {
      enabled: false, // Enable in production with SMTP config
      recipients: [] as string[]
    },
    webhookUrl: process.env.FEEDBACK_WEBHOOK_URL
  });

  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Parse request body for POST/PATCH
    let body = '';
    if (req.method === 'POST' || req.method === 'PATCH') {
      req.on('data', chunk => {
        body += chunk.toString();
      });
    }

    await new Promise(resolve => {
      req.on('end', () => {
        if (body) {
          try {
            (req as any).body = JSON.parse(body);
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
            return;
          }
        }
        resolve(undefined);
      });
    });

    // Route requests
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const path = url.pathname;

    res.setHeader('Content-Type', 'application/json');

    try {
      if (path === '/api/feedback' && req.method === 'POST') {
        await feedbackApi.submitFeedback(req, res);
      } else if (path === '/api/feedback' && req.method === 'GET') {
        (req as any).query = Object.fromEntries(url.searchParams);
        await feedbackApi.listFeedback(req, res);
      } else if (path.match(/^\/api\/feedback\/[^/]+$/) && req.method === 'GET') {
        (req as any).params = { id: path.split('/')[3] };
        await feedbackApi.getFeedback(req, res);
      } else if (path.match(/^\/api\/feedback\/[^/]+$/) && req.method === 'PATCH') {
        (req as any).params = { id: path.split('/')[3] };
        await feedbackApi.updateFeedbackStatus(req, res);
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      logger.error('Request handling error', error as Error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  server.listen(PORT, () => {
    logger.info('Feedback API Server started', {
      port: PORT,
      endpoint_1: `http://localhost:${PORT}/api/feedback (POST, GET)`,
      endpoint_2: `http://localhost:${PORT}/api/feedback/:id (GET, PATCH)`
    });
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down Feedback API Server...');
    server.close(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down Feedback API Server...');
    server.close(() => process.exit(0));
  });
}

main();