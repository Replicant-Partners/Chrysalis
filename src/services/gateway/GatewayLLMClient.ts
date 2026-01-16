export interface GatewayLLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GatewayLLMResponse {
  content: string;
  model: string;
  provider: string;
  requestId?: string;
  durationMs?: number;
}

export interface GatewayLLMClientConfig {
  baseUrl?: string;
  authToken?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  stream?: boolean;
}

/**
 * Minimal HTTP client for the Go LLM gateway (/v1/chat).
 */
export class GatewayLLMClient {
  private baseUrl: string;
  private authToken?: string;
  private model?: string;
  private fetchImpl: typeof fetch;
  private streamDefault?: boolean;

  constructor(config: GatewayLLMClientConfig = {}) {
    const envBase = typeof process !== 'undefined' ? (process.env.GATEWAY_BASE_URL || process.env.NEXT_PUBLIC_GATEWAY_BASE_URL || process.env.VITE_GATEWAY_BASE_URL) : undefined;
    const envToken = typeof process !== 'undefined' ? (process.env.GATEWAY_AUTH_TOKEN || process.env.NEXT_PUBLIC_GATEWAY_AUTH_TOKEN || process.env.VITE_GATEWAY_AUTH_TOKEN) : undefined;
    this.baseUrl = config.baseUrl ?? envBase ?? 'http://localhost:8080';
    this.authToken = config.authToken ?? envToken;
    this.model = config.model;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.streamDefault = config.stream;
  }

  /**
   * Send a chat completion request.
   * @param agentId - The agent making the request (for tracking)
   * @param messages - Conversation messages
   * @param temperature - Optional temperature override
   * @param model - Optional model override (routes to correct provider)
   */
  async chat(agentId: string, messages: GatewayLLMMessage[], temperature?: number, model?: string): Promise<GatewayLLMResponse> {
    const requestId = this.generateRequestId();
    const started = Date.now();
    const requestModel = model ?? this.model;
    
    if (!requestModel) {
      throw new Error('No model specified. Provide model in constructor config or per-call.');
    }
    
    const res = await this.fetchImpl(`${this.baseUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({
        agent_id: agentId,
        messages,
        model: requestModel,
        temperature,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(JSON.stringify({
        event: 'gateway_chat_error',
        requestId,
        status: res.status,
        body: text,
        baseUrl: this.baseUrl,
        agentId,
      }));
      throw new Error(`Gateway chat failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    const response: GatewayLLMResponse = {
      content: json.content,
      model: json.model,
      provider: json.provider,
      requestId: res.headers.get('X-Request-Id') || requestId,
      durationMs: Date.now() - started,
    };
    console.debug(JSON.stringify({
      event: 'gateway_chat',
      requestId: response.requestId,
      durationMs: response.durationMs,
      provider: response.provider,
      model: response.model,
      baseUrl: this.baseUrl,
      agentId,
    }));
    return response;
  }

  /**
   * Stream a chat completion response.
   * @param agentId - The agent making the request (for tracking)
   * @param messages - Conversation messages
   * @param temperature - Optional temperature override
   * @param model - Optional model override (routes to correct provider)
   */
  async *stream(agentId: string, messages: GatewayLLMMessage[], temperature?: number, model?: string): AsyncGenerator<GatewayLLMResponse> {
    const requestId = this.generateRequestId();
    const requestModel = model ?? this.model;
    
    if (!requestModel) {
      throw new Error('No model specified. Provide model in constructor config or per-call.');
    }
    
    const res = await this.fetchImpl(`${this.baseUrl}/v1/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({
        agent_id: agentId,
        messages,
        model: requestModel,
        temperature,
      }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(`Gateway stream failed: ${res.status} ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!chunk.startsWith('data:')) continue;
        const payload = chunk.replace(/^data:\s*/, '');
        const json = JSON.parse(payload);
        yield {
          content: json.content || '',
          model: json.model,
          provider: json.provider,
          requestId: res.headers.get('X-Request-Id') || requestId,
        };
        if (json.done) return;
      }
    }
  }

  private generateRequestId(): string {
    return `gw-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }
}
