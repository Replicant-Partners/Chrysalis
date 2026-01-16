/**
 * System Agent Chat API Controller
 *
 * REST API endpoints for System Agent interactions.
 * Routes messages through the SCM pipeline to Ada, Lea, Phil, and David.
 *
 * @module api/system-agents/controller
 */

import http from 'http';
import {
  APIResponse,
  APIError,
  ErrorCode,
  ErrorCategory,
  createSuccessResponse,
} from '../../../shared/api-core/src/models';
import {
  readJsonBody,
  sendJson,
  sendError,
  notFound,
  methodNotAllowed,
  badRequest,
  serverError,
} from '../../../shared/api-core/src/http';

import {
  SystemAgentChatService,
  SystemAgentChatServiceConfig,
  ChatMessage,
  ChatRoutingResult,
  AgentResponse,
} from '../../agents/system/SystemAgentChatService';
import { GatewayLLMClient } from '../../services/gateway/GatewayLLMClient';
import type { SystemAgentPersonaId } from '../../agents/system/types';

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Chat request body
 */
export interface ChatRequest {
  message: string;
  threadId?: string;
  targetAgent?: SystemAgentPersonaId;
  metadata?: Record<string, unknown>;
}

/**
 * Inter-agent chat request
 */
export interface InterAgentRequest {
  fromAgent: SystemAgentPersonaId;
  toAgent: SystemAgentPersonaId;
  message: string;
  threadId?: string;
}

/**
 * Proactive check request
 */
export interface ProactiveCheckRequest {
  userId?: string;
  context?: Record<string, unknown>;
}

/**
 * Chat response data
 */
export interface ChatResponseData {
  threadId: string;
  responses: Array<{
    agentId: SystemAgentPersonaId;
    content: string;
    intentType?: string;
    confidence: number;
    latencyMs: number;
  }>;
  totalLatencyMs: number;
  respondingAgents: SystemAgentPersonaId[];
}

// ============================================================================
// Controller Configuration
// ============================================================================

export interface SystemAgentAPIConfig {
  /** Port to listen on */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Gateway client for Go LLM service (required) */
  gatewayClient?: GatewayLLMClient;
  /** CORS allowed origins */
  allowedOrigins?: string[];
}

// ============================================================================
// System Agent API Controller
// ============================================================================

/**
 * System Agent Chat API Controller
 *
 * Handles REST API requests for system agent chat interactions.
 */
export class SystemAgentAPIController {
  private readonly service: SystemAgentChatService;
  private readonly version: string = 'v1';
  private readonly allowedOrigins: Set<string>;
  private initialized: boolean = false;

  constructor(config: SystemAgentAPIConfig = {}) {
    // Gateway client is required - Go LLM Gateway is the single source of truth
    const gatewayClient = config.gatewayClient ?? new GatewayLLMClient();

    this.service = new SystemAgentChatService({
      gatewayClient,
      mockMode: false,
    });

    // CORS configuration
    this.allowedOrigins = new Set(config.allowedOrigins ?? [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
    ]);
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.service.initialize();
    this.initialized = true;
    console.log('[SystemAgentAPI] Service initialized with agents: ada, lea, phil, david');
  }

  /**
   * Handle incoming HTTP request
   */
  async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    const method = req.method?.toUpperCase() || 'GET';

    // CORS headers
    const origin = req.headers.origin || '';
    if (origin && this.allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Thread-ID');

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      // Route request
      if (path === '/api/v1/system-agents/health') {
        await this.handleHealth(req, res);
      } else if (path === '/api/v1/system-agents/chat') {
        await this.handleChat(req, res, method);
      } else if (path === '/api/v1/system-agents/agents') {
        await this.handleListAgents(req, res, method);
      } else if (path.match(/^\/api\/v1\/system-agents\/agents\/(ada|lea|phil|david)$/)) {
        const agentId = path.split('/').pop() as SystemAgentPersonaId;
        await this.handleAgentDetail(req, res, method, agentId);
      } else if (path === '/api/v1/system-agents/inter-agent') {
        await this.handleInterAgent(req, res, method);
      } else if (path === '/api/v1/system-agents/proactive') {
        await this.handleProactiveCheck(req, res, method);
      } else if (path === '/api/v1/system-agents/history') {
        await this.handleHistory(req, res, method, url);
      } else if (path === '/api/v1/system-agents/metrics') {
        await this.handleMetrics(req, res, method);
      } else {
        notFound(res);
      }
    } catch (error) {
      console.error('[SystemAgentAPI] Error:', error);
      serverError(res, error instanceof Error ? error.message : 'Internal server error');
    }
  }

  // ==========================================================================
  // Endpoint Handlers
  // ==========================================================================

  /**
   * GET /health - Health check endpoint
   */
  private async handleHealth(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const metrics = this.service.getMetrics();

    sendJson(res, 200, createSuccessResponse({
      status: 'healthy',
      initialized: this.initialized,
      agents: ['ada', 'lea', 'phil', 'david'],
      metrics: {
        totalRoutes: metrics.totalArbitrations,
        averageLatencyMs: metrics.lastArbitrationMs,
      },
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * POST /chat - Send a message to system agents
   */
  private async handleChat(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string
  ): Promise<void> {
    if (method !== 'POST') {
      methodNotAllowed(res);
      return;
    }

    const body = await readJsonBody(req);
    if (!body) {
      badRequest(res, 'Request body is required');
      return;
    }

    const chatRequest = body as ChatRequest;

    if (!chatRequest.message || typeof chatRequest.message !== 'string') {
      badRequest(res, 'message field is required and must be a string');
      return;
    }

    // Build chat message
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content: chatRequest.message,
      role: 'user',
      timestamp: Date.now(),
      targetAgentId: chatRequest.targetAgent,
      threadId: chatRequest.threadId,
      metadata: chatRequest.metadata,
    };

    // Route through SCM pipeline
    const result = await this.service.routeMessage(message, {
      threadId: chatRequest.threadId,
    });

    const responseData: ChatResponseData = {
      threadId: chatRequest.threadId || 'default',
      responses: result.responses.map(r => ({
        agentId: r.agentId,
        content: r.content,
        intentType: r.intentType,
        confidence: r.confidence,
        latencyMs: r.latencyMs,
      })),
      totalLatencyMs: result.totalLatencyMs,
      respondingAgents: result.respondingAgents,
    };

    sendJson(res, 200, createSuccessResponse(responseData));
  }

  /**
   * GET /agents - List all system agents
   */
  private async handleListAgents(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string
  ): Promise<void> {
    if (method !== 'GET') {
      methodNotAllowed(res);
      return;
    }

    const agents = this.service.getAgentConfigs();

    sendJson(res, 200, createSuccessResponse({
      agents: agents.map(a => ({
        id: a.personaId,
        name: a.config.name,
        role: a.config.role,
        description: a.config.description,
        isActive: true,
      })),
      count: agents.length,
    }));
  }

  /**
   * GET /agents/:id - Get agent details
   */
  private async handleAgentDetail(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string,
    agentId: SystemAgentPersonaId
  ): Promise<void> {
    if (method !== 'GET') {
      methodNotAllowed(res);
      return;
    }

    const agents = this.service.getAgentConfigs();
    const agent = agents.find(a => a.personaId === agentId);

    if (!agent) {
      const error: APIError = {
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: `Agent '${agentId}' not found`,
        category: ErrorCategory.NOT_FOUND_ERROR,
        timestamp: new Date().toISOString(),
      };
      sendError(res, 404, error);
      return;
    }

    sendJson(res, 200, createSuccessResponse({
      id: agent.personaId,
      name: agent.config.name,
      role: agent.config.role,
      description: agent.config.description,
      evaluationDimensions: agent.config.evaluationDimensions,
      modelConfig: agent.config.modelConfig,
      scmPolicy: agent.config.scm_policy,
      behavior: agent.config.behavior,
    }));
  }

  /**
   * POST /inter-agent - Agent-to-agent communication
   */
  private async handleInterAgent(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string
  ): Promise<void> {
    if (method !== 'POST') {
      methodNotAllowed(res);
      return;
    }

    const body = await readJsonBody(req);
    if (!body) {
      badRequest(res, 'Request body is required');
      return;
    }

    const interRequest = body as InterAgentRequest;

    if (!interRequest.fromAgent || !interRequest.toAgent || !interRequest.message) {
      badRequest(res, 'fromAgent, toAgent, and message are required');
      return;
    }

    const result = await this.service.agentToAgent(
      interRequest.fromAgent,
      interRequest.toAgent,
      interRequest.message,
      interRequest.threadId
    );

    sendJson(res, 200, createSuccessResponse({
      fromAgent: interRequest.fromAgent,
      toAgent: interRequest.toAgent,
      response: result,
    }));
  }

  /**
   * POST /proactive - Check for proactive triggers
   */
  private async handleProactiveCheck(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string
  ): Promise<void> {
    if (method !== 'POST') {
      methodNotAllowed(res);
      return;
    }

    const body = await readJsonBody(req);
    const proactiveRequest = (body || {}) as ProactiveCheckRequest;

    const triggers = await this.service.checkProactiveTriggers(
      'default',
      proactiveRequest.context as Record<string, unknown>
    );

    sendJson(res, 200, createSuccessResponse({
      hasTriggeredAgents: triggers.length > 0,
      triggeredAgents: triggers,
    }));
  }

  /**
   * GET /history - Get conversation history
   */
  private async handleHistory(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string,
    url: URL
  ): Promise<void> {
    if (method !== 'GET') {
      methodNotAllowed(res);
      return;
    }

    const threadId = url.searchParams.get('threadId') || 'default';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const history = this.service.getConversationHistory(threadId);
    const limitedHistory = history.slice(-limit);

    sendJson(res, 200, createSuccessResponse({
      threadId,
      messages: limitedHistory,
      count: limitedHistory.length,
      totalInThread: history.length,
    }));
  }

  /**
   * GET /metrics - Get service metrics
   */
  private async handleMetrics(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string
  ): Promise<void> {
    if (method !== 'GET') {
      methodNotAllowed(res);
      return;
    }

    const metrics = this.service.getMetrics();

    sendJson(res, 200, createSuccessResponse({
      scm: {
        totalArbitrations: metrics.totalArbitrations,
        agentsSelected: metrics.agentsSelected,
        pileOnPrevented: metrics.pileOnPrevented,
        diversityBonusApplied: metrics.diversityBonusApplied,
        lastArbitrationMs: metrics.lastArbitrationMs,
      },
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    console.log('[SystemAgentAPI] Shutting down...');
  }
}

// ============================================================================
// Server Factory
// ============================================================================

/**
 * Create HTTP server with system agent API
 */
export function createSystemAgentAPIServer(
  config: SystemAgentAPIConfig = {}
): { server: http.Server; controller: SystemAgentAPIController } {
  const controller = new SystemAgentAPIController(config);

  const server = http.createServer((req, res) => {
    controller.handleRequest(req, res).catch(err => {
      console.error('[SystemAgentAPI] Unhandled error:', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal server error' }));
    });
  });

  return { server, controller };
}

/**
 * Start system agent API server
 */
export async function startSystemAgentAPIServer(
  config: SystemAgentAPIConfig = {}
): Promise<{ server: http.Server; controller: SystemAgentAPIController; port: number }> {
  const { server, controller } = createSystemAgentAPIServer(config);
  const port = config.port ?? 3200;
  const host = config.host ?? '0.0.0.0';

  // Initialize before starting
  await controller.initialize();

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      console.log(`[SystemAgentAPI] Server listening on ${host}:${port}`);
      console.log(`[SystemAgentAPI] Endpoints:`);
      console.log(`  POST /api/v1/system-agents/chat - Send message to agents`);
      console.log(`  GET  /api/v1/system-agents/agents - List agents`);
      console.log(`  GET  /api/v1/system-agents/agents/:id - Agent details`);
      console.log(`  POST /api/v1/system-agents/inter-agent - Agent-to-agent`);
      console.log(`  POST /api/v1/system-agents/proactive - Check triggers`);
      console.log(`  GET  /api/v1/system-agents/history - Conversation history`);
      console.log(`  GET  /api/v1/system-agents/metrics - Service metrics`);
      resolve({ server, controller, port });
    });
  });
}
