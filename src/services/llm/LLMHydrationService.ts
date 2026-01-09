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
  OllamaProvider,
  MockProvider
} from './providers';
import { CostController, calculateCost } from '../../utils/CostControl';
import { RateLimiter } from '../auth/RateLimiter';
import { CircuitBreaker } from '../../utils/CircuitBreaker';

/**
 * Provider registration with metadata
 */
interface ProviderRegistration {
  provider: LLMProvider;
  circuitBreaker: CircuitBreaker;
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
    
    // Initialize cost controller
    this.costController = new CostController({
      maxCostPerRequest: this.config.costTracking.maxCostPerRequest,
      dailyBudget: this.config.costTracking.dailyBudget,
      monthlyBudget: this.config.costTracking.monthlyBudget,
      warningThreshold: 0.8
    });
    
    // Initialize rate limiter (requests per minute)
    this.rateLimiter = new RateLimiter(
      this.config.rateLimiting.requestsPerMinute,
      60000 // 1 minute window
    );
    
    // Register default providers
    this.registerDefaultProviders();
  }
  
  /**
   * Register default providers based on configuration
   */
  private registerDefaultProviders(): void {
    // OpenAI
    if (this.config.providers.openai?.enabled !== false) {
      this.registerProvider(new OpenAIProvider(this.config.providers.openai));
    }
    
    // Anthropic
    if (this.config.providers.anthropic?.enabled !== false) {
      this.registerProvider(new AnthropicProvider(this.config.providers.anthropic));
    }
    
    // Ollama (local)
    if (this.config.providers.ollama?.enabled !== false) {
      this.registerProvider(new OllamaProvider(this.config.providers.ollama));
    }
  }
  
  /**
   * Register a provider with the service
   */
  registerProvider(provider: LLMProvider): void {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000 // 30 seconds
    });
    
    this.providers.set(provider.id, {
      provider,
      circuitBreaker,
      status: {
        available: false,
        lastCheck: new Date(),
        consecutiveErrors: 0
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
        available,
        lastCheck: new Date(),
        consecutiveErrors: available ? 0 : registration.status.consecutiveErrors
      };
      return available;
    } catch {
      registration.status = {
        available: false,
        lastCheck: new Date(),
        consecutiveErrors: registration.status.consecutiveErrors + 1
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
        available.push({
          provider: registration.provider,
          priority: registration.provider.getStatus().priority ?? 99
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
    if (!this.rateLimiter.allow('global')) {
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }
    
    // Estimate cost before making request
    const estimatedInputTokens = this.estimateInputTokens(request);
    const model = request.model ?? 'gpt-4o-mini';
    const estimatedCost = calculateCost(estimatedInputTokens, 500, model);
    
    // Check cost budget
    if (!this.costController.canSpend(estimatedCost)) {
      throw new Error('Budget limit exceeded. Cannot make request.');
    }
    
    // Get providers to try
    let providers: LLMProvider[] = [];
    
    if (preferredProvider) {
      const preferred = this.getProvider(preferredProvider);
      if (preferred) {
        providers = [preferred];
      }
    }
    
    if (providers.length === 0 || this.config.fallbackEnabled) {
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
          async () => provider.complete(request)
        );
        
        // Update stats
        this.updateStats(provider.id, response);
        
        // Track cost
        this.costController.track({
          inputTokens: response.usage.promptTokens,
          outputTokens: response.usage.completionTokens,
          model: response.model,
          estimatedCost: response.estimatedCost
        });
        
        // Reset error count on success
        registration.status.consecutiveErrors = 0;
        
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Update error stats
        this.stats.errorsByProvider[provider.id] = 
          (this.stats.errorsByProvider[provider.id] ?? 0) + 1;
        registration.status.consecutiveErrors++;
        
        // Continue to next provider if fallback enabled
        if (!this.config.fallbackEnabled) {
          throw lastError;
        }
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
    if (!this.rateLimiter.allow('global')) {
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
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
        
        // Track cost
        const cost = calculateCost(
          finalUsage.promptTokens,
          finalUsage.completionTokens,
          request.model ?? 'gpt-4o-mini'
        );
        this.stats.totalCost += cost;
        this.costController.track({
          inputTokens: finalUsage.promptTokens,
          outputTokens: finalUsage.completionTokens,
          model: request.model ?? 'unknown',
          estimatedCost: cost
        });
      }
      
      registration.status.consecutiveErrors = 0;
    } catch (error) {
      this.stats.errorsByProvider[provider.id] = 
        (this.stats.errorsByProvider[provider.id] ?? 0) + 1;
      registration.status.consecutiveErrors++;
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
    const summary = this.costController.getSummary();
    return {
      total: summary.totalCost,
      daily: summary.dailyCost,
      remaining: summary.remainingBudget,
      budgetUsedPercent: summary.budgetUsedPercent
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
      registration.status.consecutiveErrors = 0;
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
  
  /**
   * Create a mock service for testing
   */
  static createMock(defaultResponse?: string): LLMHydrationService {
    const service = new LLMHydrationService({
      providers: {
        openai: { enabled: false },
        anthropic: { enabled: false },
        ollama: { enabled: false }
      }
    });
    
    const mockProvider = new MockProvider();
    if (defaultResponse) {
      mockProvider.setDefaultResponse({ content: defaultResponse });
    }
    
    service.registerProvider(mockProvider);
    return service;
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