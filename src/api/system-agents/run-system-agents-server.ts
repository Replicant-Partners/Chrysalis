#!/usr/bin/env node
/**
 * System Agent API Server Runner
 *
 * Starts the HTTP server for system agent chat interactions.
 *
 * Usage:
 *   npm run service:system-agents
 *   node dist/api/system-agents/run-system-agents-server.js
 *
 * Environment variables:
 *   PORT - Server port (default: 3200)
 *   HOST - Server host (default: 0.0.0.0)
 *   GATEWAY_BASE_URL - LLM gateway URL
 *   OPENAI_API_KEY - OpenAI API key for direct calls
 *   ANTHROPIC_API_KEY - Anthropic API key for direct calls
 *
 * @module api/system-agents/run-system-agents-server
 */

import { startSystemAgentAPIServer } from './controller';
import { getDefaultService as createLLMHydrationService } from '../../services/llm/LLMHydrationService';
import { OpenAIProvider } from '../../services/llm/providers/OpenAIProvider';
import { AnthropicProvider } from '../../services/llm/providers/AnthropicProvider';
import { OllamaProvider } from '../../services/llm/providers/OllamaProvider';
import { GatewayLLMClient } from '../../services/gateway/GatewayLLMClient';

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3200', 10);
  const host = process.env.HOST || '0.0.0.0';

  console.log('===========================================');
  console.log('  System Agent API Server');
  console.log('===========================================');
  console.log(`Starting on ${host}:${port}...`);
  console.log('');

  // Create LLM service with available providers
  const llmService = createLLMHydrationService();

  // Register providers based on available API keys
  if (process.env.OPENAI_API_KEY) {
    llmService.registerProvider(new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    }));
    console.log('[LLM] Registered OpenAI provider');
  }

  if (process.env.ANTHROPIC_API_KEY) {
    llmService.registerProvider(new AnthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
    }));
    console.log('[LLM] Registered Anthropic provider');
  }

  // Always try Ollama (local, no key needed)
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  try {
    llmService.registerProvider(new OllamaProvider({
      baseUrl: ollamaUrl,
      defaultModel: process.env.OLLAMA_MODEL || 'llama3.2',
    }));
    console.log(`[LLM] Registered Ollama provider (${ollamaUrl})`);
  } catch (e) {
    console.log(`[LLM] Ollama not available at ${ollamaUrl}`);
  }

  // Create gateway client
  const gatewayUrl = process.env.GATEWAY_BASE_URL || 'http://localhost:8080';
  const gatewayClient = new GatewayLLMClient({
    baseUrl: gatewayUrl,
    authToken: process.env.GATEWAY_AUTH_TOKEN,
  });
  console.log(`[Gateway] Configured gateway at ${gatewayUrl}`);

  console.log('');

  try {
    const { server, controller, port: actualPort } = await startSystemAgentAPIServer({
      port,
      host,
      llmService,
      gatewayClient,
      allowedOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('\nShutting down...');
      controller.shutdown();
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    console.log('');
    console.log('Server ready. Press Ctrl+C to stop.');
    console.log('');
    console.log('Example requests:');
    console.log(`  curl -X POST http://localhost:${actualPort}/api/v1/system-agents/chat \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"message": "@ada analyze this code pattern"}'`);
    console.log('');
    console.log(`  curl http://localhost:${actualPort}/api/v1/system-agents/agents`);
    console.log('');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
