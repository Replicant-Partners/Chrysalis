/**
 * GatewayLLMClient
 *
 * TypeScript client for the Go LLM Gateway.
 * This is a thin UI adapter that connects the React frontend to the
 * Go-based gateway service.
 *
 * NOTE: Core logic is in Go (go-gateway/)
 * This file is ONLY for UI integration.
 *
 * @module services/gateway/GatewayLLMClient
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface GatewayChatRequest {
  agentId: string;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GatewayUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GatewayChatResponse {
  content: string;
  model: string;
  provider: string;
  usage: GatewayUsage;
  requestId?: string;
}

export interface GatewayHealth {
  status: string;
  provider: string;
  agentCount?: number;
  multiTenant?: boolean;
}

export interface GatewayAgentInfo {
  id: string;
  name: string;
  modelTier?: string;
  defaultModel?: string;
}

export interface GatewayLLMClientConfig {
  baseUrl?: string;
  authToken?: string;
  defaultModel?: string;
  timeout?: number;
}

/**
 * Client for communicating with the Go LLM Gateway
 */
export class GatewayLLMClient {
  private baseUrl: string;
  private authToken: string | null;
  private defaultModel: string;
  private timeout: number;

  constructor(config: GatewayLLMClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:8080';
    this.authToken = config.authToken || null;
    this.defaultModel = config.defaultModel || 'thudm/glm-4-9b-chat';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Create headers for API requests
   */
  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Make a chat request
   */
  async chat(request: GatewayChatRequest): Promise<GatewayChatResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          agent_id: request.agentId,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2000,
          model: request.model || this.defaultModel,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gateway error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as any;
      const requestId = response.headers.get('X-Request-Id') ?? undefined;

      return {
        content: data.content ?? '',
        model: data.model ?? request.model ?? this.defaultModel,
        provider: data.provider ?? 'unknown',
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        requestId,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Simple completion helper
   */
  async complete(agentId: string, prompt: string, options?: Omit<Partial<GatewayChatRequest>, 'agentId' | 'messages'>): Promise<string> {
    const response = await this.chat({
      agentId,
      model: options?.model || this.defaultModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    return response.content || '';
  }

  /**
   * Check gateway health
   */
  async health(): Promise<GatewayHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/healthz`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return {
          status: 'unhealthy',
          provider: 'unknown',
        };
      }

      const data = (await response.json()) as any;
      return {
        status: data.status || 'ok',
        provider: data.provider || 'unknown',
        agentCount: data.agent_count,
        multiTenant: data.multi_tenant,
      };
    } catch {
      return {
        status: 'unreachable',
        provider: 'unknown',
      };
    }
  }

  /**
   * Get available agents
   */
  async listAgents(): Promise<GatewayAgentInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/agents`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as any;
      const agents = (data.agents ?? []) as Array<Record<string, unknown>>;
      return agents.map((a) => ({
        id: String(a.id ?? ''),
        name: String(a.name ?? ''),
        modelTier: typeof a.model_tier === 'string' ? a.model_tier : undefined,
        defaultModel: typeof a.default_model === 'string' ? a.default_model : undefined,
      })).filter((a) => a.id);
    } catch {
      return [];
    }
  }

  /**
   * Set the default model
   */
  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  /**
   * Get current default model
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }
}

/**
 * Create a gateway client with environment configuration
 */
export function createGatewayClient(): GatewayLLMClient {
  const env = (globalThis as any)?.process?.env;
  return new GatewayLLMClient({
    baseUrl: env?.GATEWAY_BASE_URL || 'http://localhost:8080',
    authToken: env?.GATEWAY_AUTH_TOKEN,
    defaultModel: env?.LLM_DEFAULT_MODEL || 'thudm/glm-4-9b-chat',
  });
}

export default GatewayLLMClient;
