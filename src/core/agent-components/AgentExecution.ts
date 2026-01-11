/**
 * Agent Execution Component
 * 
 * Manages LLM and runtime configuration.
 * 
 * Single Responsibility: Execution configuration
 */

/**
 * LLM configuration
 */
export interface LLMConfig {
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  parameters?: Record<string, unknown>;
}

/**
 * Runtime configuration
 */
export interface RuntimeConfig {
  timeout: number;
  max_iterations: number;
  retry_policy?: {
    max_attempts: number;
    backoff: string;
    initial_delay: number;
  };
  error_handling: string;
}

/**
 * Execution data structure
 */
export interface AgentExecutionData {
  llm: LLMConfig;
  runtime: RuntimeConfig;
}

/**
 * Agent Execution Manager
 */
export class AgentExecution {
  private data: AgentExecutionData;

  constructor(data?: Partial<AgentExecutionData>) {
    this.data = {
      llm: data?.llm || {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        max_tokens: 4096,
      },
      runtime: data?.runtime || {
        timeout: 300,
        max_iterations: 20,
        error_handling: 'graceful_degradation',
      },
    };
  }

  /**
   * Set LLM provider and model
   */
  setLLM(provider: string, model: string): void {
    this.data.llm.provider = provider;
    this.data.llm.model = model;
  }

  /**
   * Set temperature
   */
  setTemperature(temperature: number): void {
    this.data.llm.temperature = Math.max(0, Math.min(2, temperature));
  }

  /**
   * Set max tokens
   */
  setMaxTokens(maxTokens: number): void {
    this.data.llm.max_tokens = Math.max(1, maxTokens);
  }

  /**
   * Set LLM parameter
   */
  setLLMParameter(key: string, value: unknown): void {
    if (!this.data.llm.parameters) {
      this.data.llm.parameters = {};
    }
    this.data.llm.parameters[key] = value;
  }

  /**
   * Set runtime timeout
   */
  setTimeout(timeout: number): void {
    this.data.runtime.timeout = Math.max(1, timeout);
  }

  /**
   * Set max iterations
   */
  setMaxIterations(maxIterations: number): void {
    this.data.runtime.max_iterations = Math.max(1, maxIterations);
  }

  /**
   * Set retry policy
   */
  setRetryPolicy(policy: RuntimeConfig['retry_policy']): void {
    this.data.runtime.retry_policy = policy;
  }

  /**
   * Set error handling strategy
   */
  setErrorHandling(strategy: string): void {
    this.data.runtime.error_handling = strategy;
  }

  /**
   * Get estimated cost per request (rough estimate)
   */
  getEstimatedCostPerRequest(): number {
    // Rough cost estimates per 1K tokens
    const costPer1K: Record<string, number> = {
      'gpt-4': 0.03,
      'gpt-4o': 0.005,
      'gpt-3.5-turbo': 0.0015,
      'claude-3-opus': 0.015,
      'claude-3-5-sonnet': 0.003,
      'claude-3-sonnet': 0.003,
      'claude-3-haiku': 0.00025,
    };

    const modelCost = costPer1K[this.data.llm.model] || 0.01;
    return (this.data.llm.max_tokens / 1000) * modelCost;
  }

  /**
   * Check if configuration is valid
   */
  isValid(): boolean {
    return (
      this.data.llm.provider.length > 0 &&
      this.data.llm.model.length > 0 &&
      this.data.llm.temperature >= 0 &&
      this.data.llm.temperature <= 2 &&
      this.data.llm.max_tokens > 0 &&
      this.data.runtime.timeout > 0 &&
      this.data.runtime.max_iterations > 0
    );
  }

  // Getters
  get llm(): Readonly<LLMConfig> { return this.data.llm; }
  get runtime(): Readonly<RuntimeConfig> { return this.data.runtime; }

  toData(): AgentExecutionData {
    return { ...this.data };
  }
}

export function validateExecution(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Execution must be an object'] };
  }
  const exec = data as Record<string, unknown>;
  
  if (!exec.llm || typeof exec.llm !== 'object') {
    errors.push('Execution must have llm object');
  } else {
    const llm = exec.llm as Record<string, unknown>;
    if (!llm.provider) errors.push('LLM must have provider');
    if (!llm.model) errors.push('LLM must have model');
  }
  
  if (!exec.runtime || typeof exec.runtime !== 'object') {
    errors.push('Execution must have runtime object');
  }
  
  return { valid: errors.length === 0, errors };
}
