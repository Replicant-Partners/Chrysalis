/**
 * Bridge REST API Controller
 *
 * REST API endpoints for the Universal Agent Bridge service.
 * Follows Chrysalis API patterns from shared/api-core.
 *
 * @module api/bridge/controller
 */

import http from 'http';
import {
  APIResponse,
  APIError,
  ErrorCode,
  ErrorCategory,
  PaginationParams,
  PaginationMeta,
  createSuccessResponse,
  createPaginationMeta,
  parsePaginationParams,
} from '../../../shared/api-core/src/models';
import { HEALTH_CHECK_INTERVAL_MS, MAX_EVENT_HISTORY } from '../../shared/constants/timing';
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
  IntegratedBridgeService,
  createIntegratedBridgeService,
  BridgeServiceStats,
  StoredAgent,
  TranslationRecord,
  BridgeEvent,
} from '../../bridge/service-integration';
import {
  BridgeOrchestrator,
  TranslationResult,
} from '../../bridge/orchestrator';
import { AgentFramework } from '../../adapters/protocol-types';

// Temporary type definitions to replace legacy base-adapter types
export interface NativeAgent {
  framework: AgentFramework;
  data: Record<string, unknown>;
}

export interface CanonicalAgent {
  uri: string;
  quads: Array<any>;
  extensions: Array<any>;
  metadata: Record<string, any>;
}
import { createLogger } from '../../shared/logger';

const log = createLogger('bridge-api');

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Translation request body
 */
export interface TranslateRequest {
  agent: NativeAgent;
  targetFramework: AgentFramework;
  options?: {
    correlationId?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Ingest request body
 */
export interface IngestRequest {
  agent: NativeAgent;
  options?: {
    correlationId?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Batch translation request body
 */
export interface BatchTranslateRequest {
  agents: NativeAgent[];
  targetFramework: AgentFramework;
  options?: {
    correlationId?: string;
    stopOnError?: boolean;
  };
}

/**
 * Query agents request body
 */
export interface QueryAgentsRequest {
  framework?: AgentFramework;
  name?: string;
  minFidelity?: number;
}

/**
 * Translation response data
 */
export interface TranslationResponseData {
  success: boolean;
  sourceFramework: AgentFramework;
  targetFramework: AgentFramework;
  fidelityScore: number;
  result?: unknown;
  canonical?: {
    uri: string;
    quadsCount: number;
    extensionsCount: number;
  };
  warnings?: string[];
  durationMs: number;
  stored?: StoredAgent;
}

/**
 * Batch translation response data
 */
export interface BatchTranslationResponseData {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    index: number;
    success: boolean;
    fidelityScore?: number;
    error?: string;
  }>;
  averageFidelity: number;
  totalDurationMs: number;
}

// ============================================================================
// Bridge API Controller
// ============================================================================

/**
 * Bridge API Controller
 *
 * Handles REST API requests for the Universal Agent Bridge.
 */
export class BridgeAPIController {
  private readonly service: IntegratedBridgeService;
  private readonly version: string = 'v1';
  private readonly allowedOrigins: Set<string>;

  /**
   * Create a new BridgeAPIController.
   *
   * @param service - Optional IntegratedBridgeService instance
   * @param allowedOrigins - CORS allowed origins (defaults to localhost for security)
   */
  constructor(service?: IntegratedBridgeService, allowedOrigins?: string[]) {
    this.service = service ?? createIntegratedBridgeService({
      healthCheckInterval: HEALTH_CHECK_INTERVAL_MS,
      maxEventHistory: MAX_EVENT_HISTORY,
      enableEventLogging: true,
    });
    this.service.start();

    // CORS: Default to localhost for development security
    // Production deployments should explicitly configure allowed origins
    this.allowedOrigins = new Set(allowedOrigins ?? [
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
    ]);
  }

  /**
   * Handle incoming HTTP request
   */
  async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    const method = req.method?.toUpperCase() || 'GET';

    // CORS headers - validate origin against allowlist
    const origin = req.headers.origin || '';
    if (origin && this.allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      // Route request
      if (path === '/api/v1/bridge/health' || path === '/health') {
        await this.handleHealth(req, res);
      } else if (path === '/api/v1/bridge/stats') {
        await this.handleStats(req, res);
      } else if (path === '/api/v1/bridge/translate') {
        await this.handleTranslate(req, res, method);
      } else if (path === '/api/v1/bridge/translate/batch') {
        await this.handleBatchTranslate(req, res, method);
      } else if (path === '/api/v1/bridge/ingest') {
        await this.handleIngest(req, res, method);
      } else if (path === '/api/v1/bridge/adapters') {
        await this.handleAdapters(req, res, method);
      } else if (path.startsWith('/api/v1/bridge/adapters/')) {
        const framework = path.split('/')[5];
        await this.handleAdapterDetail(req, res, method, framework as AgentFramework);
      } else if (path === '/api/v1/bridge/agents') {
        await this.handleAgents(req, res, method, url);
      } else if (path.startsWith('/api/v1/bridge/agents/')) {
        const agentUri = decodeURIComponent(path.split('/').slice(5).join('/'));
        await this.handleAgentDetail(req, res, method, agentUri);
      } else if (path === '/api/v1/bridge/translations') {
        await this.handleTranslations(req, res, method, url);
      } else if (path === '/api/v1/bridge/events') {
        await this.handleEvents(req, res, method, url);
      } else if (path === '/api/v1/bridge/compatibility') {
        await this.handleCompatibility(req, res, method);
      } else {
        notFound(res);
      }
    } catch (error) {
      log.error('Bridge API error', { error });
      serverError(res, error instanceof Error ? error.message : 'Internal server error');
    }
  }

  /**
   * GET /health - Health check endpoint
   */
  private async handleHealth(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const health = this.service.healthCheck();

    const statusCode = health.status === 'healthy' ? 200 :
                       health.status === 'degraded' ? 207 : 503;

    sendJson(res, statusCode, createSuccessResponse({
      status: health.status,
      components: health.details,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * GET /stats - Service statistics
   */
  private async handleStats(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const stats = this.service.getStats();
    sendJson(res, 200, createSuccessResponse(stats));
  }

  /**
   * POST /translate - Translate an agent between frameworks
   */
  private async handleTranslate(
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

    // Validate request
    const validation = this.validateTranslateRequest(body);
    if (!validation.valid) {
      badRequest(res, validation.error || 'Invalid request', ErrorCode.INVALID_FORMAT);
      return;
    }

    const request = body as TranslateRequest;

    try {
      const { result, event } = await this.service.translateAgent(
        request.agent,
        request.targetFramework,
        request.options
      );

      const responseData: TranslationResponseData = {
        success: result.success,
        sourceFramework: result.sourceFramework,
        targetFramework: result.targetFramework,
        fidelityScore: result.fidelityScore,
        result: result.result?.data,
        canonical: result.canonical ? {
          uri: result.canonical.uri,
          quadsCount: result.canonical.quads.length,
          extensionsCount: result.canonical.extensions.length,
        } : undefined,
        warnings: result.warnings,
        durationMs: result.durationMs,
        stored: undefined,
      };

      sendJson(res, 200, createSuccessResponse(responseData));
    } catch (error) {
      const apiError: APIError = {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Translation failed',
        category: ErrorCategory.SERVICE_ERROR,
        timestamp: new Date().toISOString(),
      };
      sendError(res, 500, apiError);
    }
  }

  /**
   * POST /translate/batch - Batch translate multiple agents
   */
  private async handleBatchTranslate(
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

    const request = body as BatchTranslateRequest;

    if (!Array.isArray(request.agents) || request.agents.length === 0) {
      badRequest(res, 'agents array is required and must not be empty');
      return;
    }

    if (!request.targetFramework) {
      badRequest(res, 'targetFramework is required');
      return;
    }

    const startTime = Date.now();
    const results: BatchTranslationResponseData['results'] = [];
    let totalFidelity = 0;
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < request.agents.length; i++) {
      try {
        const { result } = await this.service.translateAgent(
          request.agents[i],
          request.targetFramework,
          { correlationId: request.options?.correlationId }
        );

        if (result.success) {
          succeeded++;
          totalFidelity += result.fidelityScore;
          results.push({
            index: i,
            success: true,
            fidelityScore: result.fidelityScore,
          });
        } else {
          failed++;
          results.push({
            index: i,
            success: false,
            error: result.errors?.join(', ') || 'Translation failed',
          });

          if (request.options?.stopOnError) {
            break;
          }
        }
      } catch (error) {
        failed++;
        results.push({
          index: i,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        if (request.options?.stopOnError) {
          break;
        }
      }
    }

    const responseData: BatchTranslationResponseData = {
      total: request.agents.length,
      succeeded,
      failed,
      results,
      averageFidelity: succeeded > 0 ? totalFidelity / succeeded : 0,
      totalDurationMs: Date.now() - startTime,
    };

    sendJson(res, 200, createSuccessResponse(responseData));
  }

  /**
   * POST /ingest - Ingest an agent into canonical form
   */
  private async handleIngest(
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

    const request = body as IngestRequest;

    if (!request.agent || !request.agent.framework || !request.agent.data) {
      badRequest(res, 'agent with framework and data is required');
      return;
    }

    try {
      const { canonical, event } = await this.service.ingestAgent(
        request.agent,
        request.options
      );

      sendJson(res, 201, createSuccessResponse({
        canonical: {
          uri: canonical.uri,
          quadsCount: canonical.quads.length,
          extensionsCount: canonical.extensions.length,
          fidelityScore: canonical.metadata.fidelityScore,
        },
        stored: undefined,
        eventId: event.eventId,
      }));
    } catch (error) {
      const apiError: APIError = {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Ingestion failed',
        category: ErrorCategory.SERVICE_ERROR,
        timestamp: new Date().toISOString(),
      };
      sendError(res, 500, apiError);
    }
  }

  /**
   * GET /adapters - List all registered adapters
   */
  private async handleAdapters(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string
  ): Promise<void> {
    if (method !== 'GET') {
      methodNotAllowed(res);
      return;
    }

    const adapters = this.service.discovery.listAdapters();
    sendJson(res, 200, createSuccessResponse({
      adapters,
      count: adapters.length,
    }));
  }

  /**
   * GET /adapters/:framework - Get adapter details
   */
  private async handleAdapterDetail(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string,
    framework: AgentFramework
  ): Promise<void> {
    if (method !== 'GET') {
      methodNotAllowed(res);
      return;
    }

    const adapter = this.service.discovery.getAdapter(framework);

    if (!adapter) {
      const error: APIError = {
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: `Adapter '${framework}' not found`,
        category: ErrorCategory.NOT_FOUND_ERROR,
        timestamp: new Date().toISOString(),
      };
      sendError(res, 404, error);
      return;
    }

    sendJson(res, 200, createSuccessResponse(adapter));
  }

  /**
   * GET /agents - List stored agents with pagination
   */
  private async handleAgents(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string,
    url: URL
  ): Promise<void> {
    if (method !== 'GET') {
      methodNotAllowed(res);
      return;
    }

    const pagination = parsePaginationParams(url);
    const framework = url.searchParams.get('framework') as AgentFramework | null;
    const name = url.searchParams.get('name') || undefined;
    const minFidelity = url.searchParams.get('minFidelity')
      ? parseFloat(url.searchParams.get('minFidelity')!)
      : undefined;

    // Persistence is not yet implemented in IntegratedBridgeService
    // Return empty list for now - should be implemented via TemporalStore
    const allAgents: StoredAgent[] = [];

    const total = allAgents.length;
    const start = (pagination.page - 1) * pagination.per_page;
    const agents = allAgents.slice(start, start + pagination.per_page);
    const paginationMeta = createPaginationMeta(pagination, total);

    sendJson(res, 200, createSuccessResponse(agents, undefined, paginationMeta));
  }

  /**
   * GET /agents/:uri - Get agent by URI
   * DELETE /agents/:uri - Delete agent by URI
   */
  private async handleAgentDetail(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string,
    agentUri: string
  ): Promise<void> {
    if (method === 'GET') {
      // Persistence is not yet implemented - return not found
      const agent: StoredAgent | undefined = undefined;

      if (!agent) {
        const error: APIError = {
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: `Agent '${agentUri}' not found`,
          category: ErrorCategory.NOT_FOUND_ERROR,
          timestamp: new Date().toISOString(),
        };
        sendError(res, 404, error);
        return;
      }

      const versions: StoredAgent[] = [];

      sendJson(res, 200, createSuccessResponse({
        agent,
        versionCount: versions.length,
        versions: versions.slice(0, 10), // Return last 10 versions
      }));
    } else if (method === 'DELETE') {
      // Persistence not implemented - always report not found
      const deleted = false;

      if (!deleted) {
        const error: APIError = {
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: `Agent '${agentUri}' not found`,
          category: ErrorCategory.NOT_FOUND_ERROR,
          timestamp: new Date().toISOString(),
        };
        sendError(res, 404, error);
        return;
      }

      sendJson(res, 200, createSuccessResponse({ deleted: true, uri: agentUri }));
    } else {
      methodNotAllowed(res);
    }
  }

  /**
   * GET /translations - List translation history
   */
  private async handleTranslations(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string,
    url: URL
  ): Promise<void> {
    if (method !== 'GET') {
      methodNotAllowed(res);
      return;
    }

    const sourceFramework = url.searchParams.get('sourceFramework') as AgentFramework | null;
    const targetFramework = url.searchParams.get('targetFramework') as AgentFramework | null;
    const minFidelity = url.searchParams.get('minFidelity')
      ? parseFloat(url.searchParams.get('minFidelity')!)
      : undefined;
    const limit = url.searchParams.get('limit')
      ? parseInt(url.searchParams.get('limit')!, 10)
      : 50;

    // Persistence not yet implemented - return empty list
    const translations: TranslationRecord[] = [];

    sendJson(res, 200, createSuccessResponse({
      translations,
      count: translations.length,
    }));
  }

  /**
   * GET /events - List bridge events
   */
  private async handleEvents(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string,
    url: URL
  ): Promise<void> {
    if (method !== 'GET') {
      methodNotAllowed(res);
      return;
    }

    const type = url.searchParams.get('type') || undefined;
    const primitive = url.searchParams.get('primitive') || undefined;
    const since = url.searchParams.get('since') || undefined;
    const limit = url.searchParams.get('limit')
      ? parseInt(url.searchParams.get('limit')!, 10)
      : 100;

    const events = this.service.events.getHistory({
      type,
      primitive,
      since,
      limit,
    });

    sendJson(res, 200, createSuccessResponse({
      events,
      count: events.length,
    }));
  }

  /**
   * GET /compatibility - Get framework compatibility matrix
   */
  private async handleCompatibility(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string
  ): Promise<void> {
    if (method !== 'GET') {
      methodNotAllowed(res);
      return;
    }

    const compatibility = this.service.orchestrator.getCompatibilityMatrix();
    const frameworks = this.service.orchestrator.getRegisteredFrameworks();

    sendJson(res, 200, createSuccessResponse({
      frameworks,
      compatibility,
    }));
  }

  /**
   * Validate translate request
   */
  private validateTranslateRequest(body: any): { valid: boolean; error?: string } {
    if (!body.agent) {
      return { valid: false, error: 'agent is required' };
    }
    if (!body.agent.framework) {
      return { valid: false, error: 'agent.framework is required' };
    }
    if (!body.agent.data) {
      return { valid: false, error: 'agent.data is required' };
    }
    if (!body.targetFramework) {
      return { valid: false, error: 'targetFramework is required' };
    }
    return { valid: true };
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    this.service.stop();
  }
}

// ============================================================================
// Server Factory
// ============================================================================

/**
 * Create HTTP server with bridge API
 */
export function createBridgeAPIServer(
  options: {
    port?: number;
    host?: string;
    service?: IntegratedBridgeService;
  } = {}
): { server: http.Server; controller: BridgeAPIController } {
  const controller = new BridgeAPIController(options.service);

  const server = http.createServer((req, res) => {
    controller.handleRequest(req, res);
  });

  return { server, controller };
}

/**
 * Start bridge API server
 */
export function startBridgeAPIServer(
  options: {
    port?: number;
    host?: string;
    service?: IntegratedBridgeService;
  } = {}
): Promise<{ server: http.Server; controller: BridgeAPIController; port: number }> {
  return new Promise((resolve, reject) => {
    const { server, controller } = createBridgeAPIServer(options);
    const port = options.port ?? 3100;
    const host = options.host ?? '0.0.0.0';

    server.on('error', reject);
    server.listen(port, host, () => {
      log.info('Bridge API server listening', { host, port });
      resolve({ server, controller, port });
    });
  });
}

// ============================================================================
// Exports
// ============================================================================

export {
  IntegratedBridgeService,
  createIntegratedBridgeService,
  BridgeOrchestrator,
  TranslationResult,
  NativeAgent,
  CanonicalAgent,
  AgentFramework,
};