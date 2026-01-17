/**
 * TypeScript client for Go Rate Limiter Service
 *
 * Provides type-safe access to the rate limiting HTTP API.
 */

// ============================================================================
// Types
// ============================================================================

export interface RateLimiterStats {
  circuit_state: 'closed' | 'open' | 'half-open';
  available_tokens: number;
  window_count: number;
  window_limit: number;
}

export interface CheckRequest {
  resource: string;
  client_id?: string;
}

export interface CheckResponse {
  allowed: boolean;
  error?: string;
  stats?: RateLimiterStats;
}

export interface RecordRequest {
  resource: string;
  success: boolean;
}

export interface ConfigRequest {
  resource: string;
  requests_per_second?: number;
  burst_size?: number;
  window_limit?: number;
  failure_threshold?: number;
}

export interface RateLimiterConfig {
  RequestsPerSecond: number;
  BurstSize: number;
  WindowLimit: number;
  WindowSize: number;
  CircuitBreaker: {
    FailureThreshold: number;
    SuccessThreshold: number;
    Timeout: number;
    MaxHalfOpen: number;
  };
  EnableClientLimits: boolean;
  ClientLimitDefault: number;
}

// ============================================================================
// Client
// ============================================================================

export class RateLimiterClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = 'http://localhost:8090', timeout: number = 5000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if the service is healthy.
   */
  async health(): Promise<{ status: string }> {
    return this.fetch('/health');
  }

  /**
   * Check if a request is allowed for a resource/client.
   */
  async check(request: CheckRequest): Promise<CheckResponse> {
    return this.fetch('/api/v1/check', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Convenience method to check and throw if rate limited.
   */
  async checkOrThrow(resource: string, clientId?: string): Promise<RateLimiterStats> {
    const response = await this.check({ resource, client_id: clientId });

    if (!response.allowed) {
      const error = new Error(response.error || 'Rate limit exceeded');
      (error as any).rateLimitStats = response.stats;
      throw error;
    }

    return response.stats!;
  }

  /**
   * Record a success or failure for circuit breaker.
   */
  async record(request: RecordRequest): Promise<{ recorded: boolean; stats: RateLimiterStats }> {
    return this.fetch('/api/v1/record', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Record a successful request.
   */
  async recordSuccess(resource: string): Promise<RateLimiterStats> {
    const result = await this.record({ resource, success: true });
    return result.stats;
  }

  /**
   * Record a failed request.
   */
  async recordFailure(resource: string): Promise<RateLimiterStats> {
    const result = await this.record({ resource, success: false });
    return result.stats;
  }

  /**
   * Get current stats for a resource.
   */
  async stats(resource: string = 'default'): Promise<RateLimiterStats> {
    return this.fetch(`/api/v1/stats?resource=${encodeURIComponent(resource)}`);
  }

  /**
   * Get configuration for a resource.
   */
  async getConfig(resource: string = 'default'): Promise<RateLimiterConfig> {
    return this.fetch(`/api/v1/config?resource=${encodeURIComponent(resource)}`);
  }

  /**
   * Update configuration for a resource.
   */
  async setConfig(config: ConfigRequest): Promise<{ configured: boolean; resource: string }> {
    return this.fetch('/api/v1/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
}

// ============================================================================
// Decorator for rate limiting
// ============================================================================

/**
 * Decorator factory for rate-limited methods.
 */
export function rateLimited(
  client: RateLimiterClient,
  resource: string,
  clientId?: string
) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      await client.checkOrThrow(resource, clientId);

      try {
        const result = await originalMethod.apply(this, args);
        await client.recordSuccess(resource);
        return result;
      } catch (error) {
        await client.recordFailure(resource);
        throw error;
      }
    } as T;

    return descriptor;
  };
}

// ============================================================================
// Middleware helper
// ============================================================================

/**
 * Creates an Express-style middleware for rate limiting.
 */
export function createRateLimitMiddleware(
  client: RateLimiterClient,
  options: {
    resource?: string;
    getClientId?: (req: any) => string;
    onRateLimited?: (req: any, res: any, stats: RateLimiterStats) => void;
  } = {}
) {
  const {
    resource = 'default',
    getClientId = () => '',
    onRateLimited = (_req, res, _stats) => {
      res.status(429).json({ error: 'Rate limit exceeded' });
    },
  } = options;

  return async (req: any, res: any, next: (err?: any) => void) => {
    try {
      const clientId = getClientId(req);
      const response = await client.check({ resource, client_id: clientId });

      if (!response.allowed) {
        return onRateLimited(req, res, response.stats!);
      }

      // Attach stats to request for downstream use
      req.rateLimitStats = response.stats;
      next();
    } catch (error) {
      // If rate limiter is unavailable, allow the request through
      console.warn('Rate limiter unavailable:', error);
      next();
    }
  };
}

export default RateLimiterClient;
