/**
 * LLM Hydration Service
 * 
 * Central service for providing LLM access to agents.
 * Manages multiple providers, load balancing, rate limiting,
 * cost control, and circuit breaker patterns for resilience.
 * 
 * @module LLMHydrationService
 */

import {
  LLMProvider,
  ProviderId,
  ProviderConfig,
  ProviderStatus,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  LLMServiceConfig,
  DEFAULT_LLM_CONFIG
} from './types';
import {
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider
} from './providers';
import { CostController, calculateCost } from '../../utils/CostControl';
import { RateLimiter } from '../auth/RateLimiter';
import { CircuitBreaker } from '../../utils/CircuitBreaker';

/**
 * Provider registration with metadata
 */
interface ProviderRegistration {
  provider: LLMProvider;
  circuitBreaker: CircuitBreaker<CompletionResponse>;
  status: ProviderStatus;
}

/**
 * Service usage statistics
 */
export interface ServiceStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  requestsByProvider: Record<ProviderId, number>;
  tokensByProvider: Record<ProviderId, number>;
  errorsByProvider: Record<ProviderId, number>;
}

/**
 * LLM Hydration Service
 * 
 * Provides centralized LLM access for agents with:
 * - Multi-provider support (OpenAI, Anthropic, Ollama)
 * - Automatic failover between providers
 * - Rate limiting per provider
 * - Cost tracking and budget enforcement
 * - Circuit breaker for fault tolerance
 */
export class LLMHydrationService {
  private providers: Map<ProviderId, ProviderRegistration> = new Map();
  private config: LLMServiceConfig;
  private costController: CostController;
  private rateLimiter: RateLimiter;

  private stats: ServiceStats = {
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    requestsByProvider: {} as Record<ProviderId, number>,
    tokensByProvider: {} as Record<ProviderId, number>,
    errorsByProvider: {} as Record<ProviderId, number>
  };

  constructor(config?: Partial<LLMServiceConfig>) {
    this.config = { ...DEFAULT_LLM_CONFIG, ...config };

    // Initialize cost controller (map to BudgetConfig fields)
    this.costController = new CostController({
      perOperationLimit: this.config.costTracking?.maxCostPerRequest ?? 1.0,
      dailyLimit: this.config.costTracking?.dailyBudget ?? 10.0,
      monthlyLimit: this.config.costTracking?.monthlyBudget ?? 100.0,
      warningThreshold: 0.8,
      onLimitExceeded: 'warn'
    });

    // Initialize rate limiter (requests per minute)
    this.rateLimiter = new RateLimiter({
      windowMs: 60000,
      max: this.config.rateLimiting?.requestsPerMinute ?? 60
    });

    // Register default providers
    this.registerDefaultProviders();
  }

  /**
   * Register default providers based on configuration
   */
  private registerDefaultProviders(): void {
    // Register providers from config array
    for (const providerConfig of this.config.providers) {
      if (!providerConfig.enabled) continue;

      switch (providerConfig.id) {
        case 'openai':
          this.registerProvider(new OpenAIProvider(providerConfig));
          break;
        case 'anthropic':
          this.registerProvider(new AnthropicProvider(providerConfig));
          break;
        case 'ollama':
          this.registerProvider(new OllamaProvider(providerConfig));
          break;
      }
    }
  }

  /**
   * Register a provider with the service
   */
  registerProvider(provider: LLMProvider): void {
    const circuitBreaker = new CircuitBreaker<CompletionResponse>({
      failureThreshold: 3,
      timeout: 30000, // 30 seconds
      resetTime: 60000, // 1 minute
      name: `provider-${provider.id}`
    });

    this.providers.set(provider.id, {
      provider,
      circuitBreaker,
      status: {
        id: provider.id,
        available: false,
        lastCheck: new Date()
      }
    });

    // Initialize stats
    this.stats.requestsByProvider[provider.id] = 0;
    this.stats.tokensByProvider[provider.id] = 0;
    this.stats.errorsByProvider[provider.id] = 0;

    // Check availability
    this.checkProviderAvailability(provider.id);
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(providerId: ProviderId): void {
    this.providers.delete(providerId);
  }

  /**
   * Check provider availability
   */
  private async checkProviderAvailability(providerId: ProviderId): Promise<boolean> {
    const registration = this.providers.get(providerId);
    if (!registration) return false;

    try {
      const available = await registration.provider.isAvailable();
      registration.status = {
        id: providerId,
        available,
        lastCheck: new Date()
      };
      return available;
    } catch {
      registration.status = {
        id: providerId,
        available: false,
        lastCheck: new Date(),
        error: 'Availability check failed'
      };
      return false;
    }
  }

  /**
   * Get available providers sorted by priority
   */
  async getAvailableProviders(): Promise<LLMProvider[]> {
    const available: Array<{ provider: LLMProvider; priority: number }> = [];

    for (const [, registration] of this.providers) {
      // Check circuit breaker
      if (registration.circuitBreaker.getState() === 'open') {
        continue;
      }

      // Check availability (use cached status if recent)
      const statusAge = Date.now() - registration.status.lastCheck.getTime();
      let isAvailable = registration.status.available;

      if (statusAge > 60000) { // Re-check every minute
        isAvailable = await this.checkProviderAvailability(registration.provider.id);
      }

      if (isAvailable) {
        // Get priority from provider config
        const providerConfig = this.config.providers.find(p => p.id === registration.provider.id);
        available.push({
          provider: registration.provider,
          priority: providerConfig?.priority ?? 99
        });
      }
    }

    // Sort by priority (lower is better)
    return available
      .sort((a, b) => a.priority - b.priority)
      .map(p => p.provider);
  }

  /**
   * Get a specific provider
   */
  getProvider(providerId: ProviderId): LLMProvider | undefined {
    return this.providers.get(providerId)?.provider;
  }

  /**
   * Complete a request with automatic provider selection and failover
   */
  async complete(
    request: CompletionRequest,
    preferredProvider?: ProviderId
  ): Promise<CompletionResponse> {
    // Check rate limit
    const rateLimitResult = this.rateLimiter.allow('global');
    if (!rateLimitResult.ok) {
      throw new Error(`Rate limit exceeded. Retry after ${rateLimitResult.retryAfterMs}ms.`);
    }

    // Estimate cost before making request
    const estimatedInputTokens = this.estimateInputTokens(request);
    const model = request.model ?? 'gpt-4o-mini';
    const estimatedCost = calculateCost(estimatedInputTokens, 500, model);

    // Get providers to try
    let providers: LLMProvider[] = [];

    if (preferredProvider) {
      const preferred = this.getProvider(preferredProvider);
      if (preferred) {
        providers = [preferred];
      }
    }

    if (providers.length === 0) {
      const available = await this.getAvailableProviders();
      providers = preferredProvider
        ? [providers[0], ...available.filter(p => p.id !== preferredProvider)]
        : available;
    }

    if (providers.length === 0) {
      throw new Error('No LLM providers available');
    }

    // Try each provider in order
    let lastError: Error | null = null;

    for (const provider of providers) {
      const registration = this.providers.get(provider.id);
      if (!registration) continue;

      try {
        const response = await registration.circuitBreaker.execute(
          async () => provider.complete(request),
          async () => {
            throw new Error(`Circuit open for provider ${provider.id}`);
          }
        );

        // Update stats
        this.updateStats(provider.id, response);

        this.costController.trackUsage(
          request.agentId,
          'completion',
          response.model,
          response.usage.promptTokens,
          response.usage.completionTokens
        );

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Update error stats
        this.stats.errorsByProvider[provider.id] =
          (this.stats.errorsByProvider[provider.id] ?? 0) + 1;

        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    throw lastError ?? new Error('All providers failed');
  }

  /**
   * Stream a completion with automatic provider selection
   */
  async *stream(
    request: CompletionRequest,
    preferredProvider?: ProviderId
  ): AsyncIterable<CompletionChunk> {
    // Check rate limit
    const rateLimitResult = this.rateLimiter.allow('global');
    if (!rateLimitResult.ok) {
      throw new Error(`Rate limit exceeded. Retry after ${rateLimitResult.retryAfterMs}ms.`);
    }

    // Get providers to try
    let providers: LLMProvider[] = [];

    if (preferredProvider) {
      const preferred = this.getProvider(preferredProvider);
      if (preferred) {
        providers = [preferred];
      }
    }

    if (providers.length === 0) {
      providers = await this.getAvailableProviders();
    }

    if (providers.length === 0) {
      throw new Error('No LLM providers available');
    }

    // For streaming, we only try the first provider
    // Failover during streaming is complex and risky
    const provider = providers[0];
    const registration = this.providers.get(provider.id);

    if (!registration) {
      throw new Error(`Provider ${provider.id} not registered`);
    }

    let totalContent = '';
    let finalUsage: CompletionResponse['usage'] | undefined;

    try {
      for await (const chunk of provider.stream(request)) {
        totalContent += chunk.content;

        if (chunk.usage) {
          finalUsage = chunk.usage;
        }

        yield chunk;
      }

      // Update stats after stream completes
      if (finalUsage) {
        this.stats.totalRequests++;
        this.stats.totalTokens += finalUsage.totalTokens;
        this.stats.requestsByProvider[provider.id] =
          (this.stats.requestsByProvider[provider.id] ?? 0) + 1;
        this.stats.tokensByProvider[provider.id] =
          (this.stats.tokensByProvider[provider.id] ?? 0) + finalUsage.totalTokens;

        const cost = calculateCost(
          finalUsage.promptTokens,
          finalUsage.completionTokens,
          request.model ?? 'gpt-4o-mini'
        );
        this.stats.totalCost += cost;
        this.costController.trackUsage(
          request.agentId,
          'completion',
          request.model ?? 'unknown',
          finalUsage.promptTokens,
          finalUsage.completionTokens
        );
      }

      // Success - status already updated
    } catch (error) {
      this.stats.errorsByProvider[provider.id] =
        (this.stats.errorsByProvider[provider.id] ?? 0) + 1;
      throw error;
    }
  }

  /**
   * Estimate input tokens for a request
   */
  private estimateInputTokens(request: CompletionRequest): number {
    let text = '';
    for (const msg of request.messages) {
      text += msg.content + ' ';
    }
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Update statistics after a successful request
   */
  private updateStats(providerId: ProviderId, response: CompletionResponse): void {
    this.stats.totalRequests++;
    this.stats.totalTokens += response.usage.totalTokens;
    this.stats.totalCost += response.estimatedCost ?? 0;

    this.stats.requestsByProvider[providerId] =
      (this.stats.requestsByProvider[providerId] ?? 0) + 1;
    this.stats.tokensByProvider[providerId] =
      (this.stats.tokensByProvider[providerId] ?? 0) + response.usage.totalTokens;
  }

  /**
   * Get service statistics
   */
  getStats(): ServiceStats {
    return { ...this.stats };
  }

  /**
   * Get cost summary
   */
  getCostSummary(): {
    total: number;
    daily: number;
    remaining: number;
    budgetUsedPercent: number;
  } {
    const status = this.costController.getBudgetStatus();
    return {
      total: this.stats.totalCost,
      daily: status.dailySpend,
      remaining: Math.max(0, status.dailyLimit - status.dailySpend),
      budgetUsedPercent: status.dailyLimit > 0 ? (status.dailySpend / status.dailyLimit) * 100 : 0
    };
  }

  /**
   * Get provider statuses
   */
  getProviderStatuses(): Record<ProviderId, ProviderStatus> {
    const statuses: Record<string, ProviderStatus> = {};
    for (const [id, registration] of this.providers) {
      statuses[id] = {
        ...registration.status,
        circuitState: registration.circuitBreaker.getState()
      };
    }
    return statuses as Record<ProviderId, ProviderStatus>;
  }

  /**
   * Reset a provider's circuit breaker
   */
  resetProviderCircuit(providerId: ProviderId): void {
    const registration = this.providers.get(providerId);
    if (registration) {
      registration.circuitBreaker.reset();
    }
  }

  /**
   * Check health of all providers
   */
  async healthCheck(): Promise<Record<ProviderId, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [id] of this.providers) {
      results[id] = await this.checkProviderAvailability(id);
    }

    return results as Record<ProviderId, boolean>;
  }
}

/**
 * Default service instance (singleton pattern)
 */
let defaultService: LLMHydrationService | null = null;

/**
 * Get or create the default service instance
 */
export function getDefaultService(config?: Partial<LLMServiceConfig>): LLMHydrationService {
  if (!defaultService) {
    defaultService = new LLMHydrationService(config);
  }
  return defaultService;
}

/**
 * Reset the default service instance
 */
export function resetDefaultService(): void {
  defaultService = null;
}
