/**
 * Cost Control System
 * 
 * Provides token counting, budget limits, and cost attribution:
 * - Estimate token counts for text
 * - Track costs per agent/operation
 * - Enforce budget limits
 * - Log cost metrics
 * 
 * @module CostControl
 * @version 1.0.0
 * @status Implemented
 * 
 * HIGH-009: Cost control now formally implemented.
 * 
 * User Value: Prevents unexpected costs from runaway API calls,
 * enables fair cost allocation across agents.
 */

import { createLogger } from '../shared/logger';
const costLog = createLogger('cost-control');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Model pricing information
 */
export interface ModelPricing {
  /** Model identifier */
  modelId: string;
  
  /** Cost per 1K input tokens (USD) */
  inputCostPer1K: number;
  
  /** Cost per 1K output tokens (USD) */
  outputCostPer1K: number;
  
  /** Cost per embedding request */
  embeddingCostPer1K?: number;
  
  /** Maximum context length */
  contextLimit: number;
}

/**
 * Token usage record
 */
export interface TokenUsage {
  /** Input tokens consumed */
  inputTokens: number;
  
  /** Output tokens generated */
  outputTokens: number;
  
  /** Embedding tokens (if applicable) */
  embeddingTokens?: number;
  
  /** Total tokens */
  totalTokens: number;
  
  /** Estimated cost in USD */
  estimatedCost: number;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  /** Maximum daily spend (USD) */
  dailyLimit: number;
  
  /** Maximum monthly spend (USD) */
  monthlyLimit: number;
  
  /** Per-operation limit (USD) */
  perOperationLimit?: number;
  
  /** Warning threshold (0-1, e.g., 0.8 = warn at 80%) */
  warningThreshold: number;
  
  /** Action when limit exceeded */
  onLimitExceeded: 'block' | 'warn' | 'allow';
}

/**
 * Cost tracking entry
 */
export interface CostEntry {
  /** Unique entry ID */
  id: string;
  
  /** Agent or operation identifier */
  agentId: string;
  
  /** Operation type */
  operation: 'llm' | 'embedding' | 'completion' | 'chat';
  
  /** Model used */
  modelId: string;
  
  /** Token usage */
  usage: TokenUsage;
  
  /** Timestamp */
  timestamp: Date;
  
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Budget status
 */
export interface BudgetStatus {
  /** Current daily spend */
  dailySpend: number;
  
  /** Current monthly spend */
  monthlySpend: number;
  
  /** Daily limit */
  dailyLimit: number;
  
  /** Monthly limit */
  monthlyLimit: number;
  
  /** Percentage of daily limit used */
  dailyPercentage: number;
  
  /** Percentage of monthly limit used */
  monthlyPercentage: number;
  
  /** Whether budget is exceeded */
  isExceeded: boolean;
  
  /** Whether warning threshold is reached */
  isWarning: boolean;
}

/**
 * Budget event for notifications
 */
export interface BudgetEvent {
  type: 'warning' | 'exceeded' | 'reset';
  level: 'daily' | 'monthly';
  currentSpend: number;
  limit: number;
  percentage: number;
  message: string;
  timestamp: Date;
}

export type BudgetListener = (event: BudgetEvent) => void;

// =============================================================================
// MODEL PRICING REGISTRY
// =============================================================================

/**
 * Known model pricing (as of 2024-2025)
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI GPT-4
  'gpt-4o': {
    modelId: 'gpt-4o',
    inputCostPer1K: 0.0025,
    outputCostPer1K: 0.01,
    contextLimit: 128000
  },
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    inputCostPer1K: 0.00015,
    outputCostPer1K: 0.0006,
    contextLimit: 128000
  },
  'gpt-4-turbo': {
    modelId: 'gpt-4-turbo',
    inputCostPer1K: 0.01,
    outputCostPer1K: 0.03,
    contextLimit: 128000
  },
  'gpt-4': {
    modelId: 'gpt-4',
    inputCostPer1K: 0.03,
    outputCostPer1K: 0.06,
    contextLimit: 8192
  },
  
  // OpenAI GPT-3.5
  'gpt-3.5-turbo': {
    modelId: 'gpt-3.5-turbo',
    inputCostPer1K: 0.0005,
    outputCostPer1K: 0.0015,
    contextLimit: 16384
  },
  
  // OpenAI Embeddings
  'text-embedding-3-small': {
    modelId: 'text-embedding-3-small',
    inputCostPer1K: 0.00002,
    outputCostPer1K: 0,
    embeddingCostPer1K: 0.00002,
    contextLimit: 8191
  },
  'text-embedding-3-large': {
    modelId: 'text-embedding-3-large',
    inputCostPer1K: 0.00013,
    outputCostPer1K: 0,
    embeddingCostPer1K: 0.00013,
    contextLimit: 8191
  },
  
  // Anthropic Claude
  'claude-3-5-sonnet': {
    modelId: 'claude-3-5-sonnet',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    contextLimit: 200000
  },
  'claude-3-opus': {
    modelId: 'claude-3-opus',
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.075,
    contextLimit: 200000
  },
  'claude-3-haiku': {
    modelId: 'claude-3-haiku',
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.00125,
    contextLimit: 200000
  },
  
  // Local/Free models
  'local': {
    modelId: 'local',
    inputCostPer1K: 0,
    outputCostPer1K: 0,
    contextLimit: 4096
  }
};

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Estimate token count for text using character-based heuristics.
 * 
 * For accurate counts, use a proper tokenizer like tiktoken.
 * This provides a reasonable approximation (~90% accuracy for English).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  
  // Heuristics based on typical tokenization patterns:
  // - Average English word: ~4 characters, ~1.3 tokens
  // - Spaces and punctuation: ~1 token each
  // - Special characters and numbers may have higher token counts
  
  // Simple approximation: ~4 characters per token for English
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  
  // Weighted average: more weight on character count
  const charBasedEstimate = Math.ceil(charCount / 4);
  const wordBasedEstimate = Math.ceil(wordCount * 1.3);
  
  return Math.max(charBasedEstimate, wordBasedEstimate);
}

/**
 * Calculate cost for token usage
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string
): number {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) {
    costLog.warn(`Unknown model: ${modelId}, using zero cost`);
    return 0;
  }
  
  const inputCost = (inputTokens / 1000) * pricing.inputCostPer1K;
  const outputCost = (outputTokens / 1000) * pricing.outputCostPer1K;
  
  return inputCost + outputCost;
}

/**
 * Calculate embedding cost
 */
export function calculateEmbeddingCost(
  tokens: number,
  modelId: string
): number {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing || !pricing.embeddingCostPer1K) {
    return 0;
  }
  
  return (tokens / 1000) * pricing.embeddingCostPer1K;
}

// =============================================================================
// COST CONTROLLER
// =============================================================================

/**
 * Manages cost tracking and budget enforcement
 */
export class CostController {
  private entries: CostEntry[] = [];
  private budget: BudgetConfig;
  private listeners: Set<BudgetListener> = new Set();
  private idCounter = 0;
  private lastDailyReset: Date;
  private lastMonthlyReset: Date;
  private log = createLogger('cost-control');
  
  constructor(budget: Partial<BudgetConfig> = {}) {
    this.budget = {
      dailyLimit: budget.dailyLimit ?? 10.00,    // $10/day default
      monthlyLimit: budget.monthlyLimit ?? 100.00, // $100/month default
      perOperationLimit: budget.perOperationLimit ?? 1.00, // $1/operation default
      warningThreshold: budget.warningThreshold ?? 0.8, // 80% warning
      onLimitExceeded: budget.onLimitExceeded ?? 'warn'
    };
    
    this.lastDailyReset = this.getStartOfDay();
    this.lastMonthlyReset = this.getStartOfMonth();
  }
  
  // ===========================================================================
  // PUBLIC API
  // ===========================================================================
  
  /**
   * Track token usage for an operation
   */
  trackUsage(
    agentId: string,
    operation: CostEntry['operation'],
    modelId: string,
    inputTokens: number,
    outputTokens: number = 0,
    metadata?: Record<string, unknown>
  ): CostEntry {
    const estimatedCost = operation === 'embedding'
      ? calculateEmbeddingCost(inputTokens, modelId)
      : calculateCost(inputTokens, outputTokens, modelId);
    
    const entry: CostEntry = {
      id: `cost-${++this.idCounter}-${Date.now()}`,
      agentId,
      operation,
      modelId,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCost
      },
      timestamp: new Date(),
      metadata
    };
    
    // Check reset needed
    this.checkAndReset();
    
    // Add entry
    this.entries.push(entry);
    
    // Check budget
    this.checkBudget();
    
    return entry;
  }
  
  /**
   * Track usage from text inputs/outputs
   */
  trackTextUsage(
    agentId: string,
    operation: CostEntry['operation'],
    modelId: string,
    inputText: string,
    outputText: string = '',
    metadata?: Record<string, unknown>
  ): CostEntry {
    const inputTokens = estimateTokenCount(inputText);
    const outputTokens = estimateTokenCount(outputText);
    
    return this.trackUsage(agentId, operation, modelId, inputTokens, outputTokens, metadata);
  }
  
  /**
   * Check if an operation would exceed budget
   */
  wouldExceedBudget(estimatedCost: number): boolean {
    this.checkAndReset();
    
    const status = this.getBudgetStatus();
    
    // Check per-operation limit
    if (this.budget.perOperationLimit && estimatedCost > this.budget.perOperationLimit) {
      return true;
    }
    
    // Check daily limit
    if (status.dailySpend + estimatedCost > this.budget.dailyLimit) {
      return true;
    }
    
    // Check monthly limit
    if (status.monthlySpend + estimatedCost > this.budget.monthlyLimit) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if operation can proceed based on budget policy
   */
  canProceed(estimatedCost: number): {
    allowed: boolean;
    reason?: string;
  } {
    if (!this.wouldExceedBudget(estimatedCost)) {
      return { allowed: true };
    }
    
    switch (this.budget.onLimitExceeded) {
      case 'allow':
        return { allowed: true };
        
      case 'warn':
        this.log.warn('Budget limit exceeded', { estimatedCost });
        return { allowed: true };
        
      case 'block':
      default:
        return {
          allowed: false,
          reason: `Budget limit exceeded. Operation would cost $${estimatedCost.toFixed(4)}`
        };
    }
  }
  
  /**
   * Get current budget status
   */
  getBudgetStatus(): BudgetStatus {
    this.checkAndReset();
    
    const now = new Date();
    const todayStart = this.getStartOfDay();
    const monthStart = this.getStartOfMonth();
    
    const dailySpend = this.entries
      .filter(e => e.timestamp >= todayStart)
      .reduce((sum, e) => sum + e.usage.estimatedCost, 0);
    
    const monthlySpend = this.entries
      .filter(e => e.timestamp >= monthStart)
      .reduce((sum, e) => sum + e.usage.estimatedCost, 0);
    
    const dailyPercentage = (dailySpend / this.budget.dailyLimit) * 100;
    const monthlyPercentage = (monthlySpend / this.budget.monthlyLimit) * 100;
    
    return {
      dailySpend,
      monthlySpend,
      dailyLimit: this.budget.dailyLimit,
      monthlyLimit: this.budget.monthlyLimit,
      dailyPercentage,
      monthlyPercentage,
      isExceeded: dailySpend >= this.budget.dailyLimit || monthlySpend >= this.budget.monthlyLimit,
      isWarning: dailyPercentage >= this.budget.warningThreshold * 100 || 
                 monthlyPercentage >= this.budget.warningThreshold * 100
    };
  }
  
  /**
   * Get usage by agent
   */
  getUsageByAgent(agentId?: string): Map<string, TokenUsage> {
    const usage = new Map<string, TokenUsage>();
    
    const entries = agentId 
      ? this.entries.filter(e => e.agentId === agentId)
      : this.entries;
    
    for (const entry of entries) {
      const existing = usage.get(entry.agentId) || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      };
      
      usage.set(entry.agentId, {
        inputTokens: existing.inputTokens + entry.usage.inputTokens,
        outputTokens: existing.outputTokens + entry.usage.outputTokens,
        totalTokens: existing.totalTokens + entry.usage.totalTokens,
        estimatedCost: existing.estimatedCost + entry.usage.estimatedCost
      });
    }
    
    return usage;
  }
  
  /**
   * Get usage by model
   */
  getUsageByModel(): Map<string, TokenUsage> {
    const usage = new Map<string, TokenUsage>();
    
    for (const entry of this.entries) {
      const existing = usage.get(entry.modelId) || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      };
      
      usage.set(entry.modelId, {
        inputTokens: existing.inputTokens + entry.usage.inputTokens,
        outputTokens: existing.outputTokens + entry.usage.outputTokens,
        totalTokens: existing.totalTokens + entry.usage.totalTokens,
        estimatedCost: existing.estimatedCost + entry.usage.estimatedCost
      });
    }
    
    return usage;
  }
  
  /**
   * Get cost report for a time period
   */
  getCostReport(startDate?: Date, endDate?: Date): {
    totalCost: number;
    totalTokens: number;
    operationCount: number;
    byAgent: Map<string, TokenUsage>;
    byModel: Map<string, TokenUsage>;
    byOperation: Map<string, TokenUsage>;
  } {
    const entries = this.entries.filter(e => {
      if (startDate && e.timestamp < startDate) return false;
      if (endDate && e.timestamp > endDate) return false;
      return true;
    });
    
    const byOperation = new Map<string, TokenUsage>();
    for (const entry of entries) {
      const existing = byOperation.get(entry.operation) || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      };
      
      byOperation.set(entry.operation, {
        inputTokens: existing.inputTokens + entry.usage.inputTokens,
        outputTokens: existing.outputTokens + entry.usage.outputTokens,
        totalTokens: existing.totalTokens + entry.usage.totalTokens,
        estimatedCost: existing.estimatedCost + entry.usage.estimatedCost
      });
    }
    
    return {
      totalCost: entries.reduce((sum, e) => sum + e.usage.estimatedCost, 0),
      totalTokens: entries.reduce((sum, e) => sum + e.usage.totalTokens, 0),
      operationCount: entries.length,
      byAgent: this.getUsageByAgent(),
      byModel: this.getUsageByModel(),
      byOperation
    };
  }
  
  /**
   * Update budget configuration
   */
  updateBudget(config: Partial<BudgetConfig>): void {
    this.budget = { ...this.budget, ...config };
    this.checkBudget();
  }
  
  /**
   * Add budget event listener
   */
  addListener(listener: BudgetListener): void {
    this.listeners.add(listener);
  }
  
  /**
   * Remove budget event listener
   */
  removeListener(listener: BudgetListener): void {
    this.listeners.delete(listener);
  }
  
  /**
   * Clear history (for testing or reset)
   */
  clearHistory(): void {
    this.entries = [];
  }
  
  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================
  
  private checkAndReset(): void {
    const now = new Date();
    const todayStart = this.getStartOfDay();
    const monthStart = this.getStartOfMonth();
    
    // Check daily reset
    if (todayStart > this.lastDailyReset) {
      this.lastDailyReset = todayStart;
      this.emitEvent({
        type: 'reset',
        level: 'daily',
        currentSpend: 0,
        limit: this.budget.dailyLimit,
        percentage: 0,
        message: 'Daily budget has been reset',
        timestamp: now
      });
    }
    
    // Check monthly reset
    if (monthStart > this.lastMonthlyReset) {
      this.lastMonthlyReset = monthStart;
      // Clear old entries (keep last 30 days for reporting)
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      this.entries = this.entries.filter(e => e.timestamp > cutoff);
      
      this.emitEvent({
        type: 'reset',
        level: 'monthly',
        currentSpend: 0,
        limit: this.budget.monthlyLimit,
        percentage: 0,
        message: 'Monthly budget has been reset',
        timestamp: now
      });
    }
  }
  
  private checkBudget(): void {
    const status = this.getBudgetStatus();
    
    // Check daily limit
    if (status.dailySpend >= this.budget.dailyLimit) {
      this.emitEvent({
        type: 'exceeded',
        level: 'daily',
        currentSpend: status.dailySpend,
        limit: this.budget.dailyLimit,
        percentage: status.dailyPercentage,
        message: `Daily budget exceeded: $${status.dailySpend.toFixed(2)} of $${this.budget.dailyLimit.toFixed(2)}`,
        timestamp: new Date()
      });
    } else if (status.dailyPercentage >= this.budget.warningThreshold * 100) {
      this.emitEvent({
        type: 'warning',
        level: 'daily',
        currentSpend: status.dailySpend,
        limit: this.budget.dailyLimit,
        percentage: status.dailyPercentage,
        message: `Daily budget warning: ${status.dailyPercentage.toFixed(1)}% used`,
        timestamp: new Date()
      });
    }
    
    // Check monthly limit
    if (status.monthlySpend >= this.budget.monthlyLimit) {
      this.emitEvent({
        type: 'exceeded',
        level: 'monthly',
        currentSpend: status.monthlySpend,
        limit: this.budget.monthlyLimit,
        percentage: status.monthlyPercentage,
        message: `Monthly budget exceeded: $${status.monthlySpend.toFixed(2)} of $${this.budget.monthlyLimit.toFixed(2)}`,
        timestamp: new Date()
      });
    } else if (status.monthlyPercentage >= this.budget.warningThreshold * 100) {
      this.emitEvent({
        type: 'warning',
        level: 'monthly',
        currentSpend: status.monthlySpend,
        limit: this.budget.monthlyLimit,
        percentage: status.monthlyPercentage,
        message: `Monthly budget warning: ${status.monthlyPercentage.toFixed(1)}% used`,
        timestamp: new Date()
      });
    }
  }
  
  private emitEvent(event: BudgetEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
  
  private getStartOfDay(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  
  private getStartOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let defaultController: CostController | null = null;

/**
 * Get the default cost controller instance
 */
export function getCostController(): CostController {
  if (!defaultController) {
    defaultController = new CostController();
  }
  return defaultController;
}

/**
 * Create a custom cost controller
 */
export function createCostController(
  budget?: Partial<BudgetConfig>
): CostController {
  return new CostController(budget);
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Create cost tracking middleware for LLM calls
 */
export function createCostTrackingMiddleware(
  controller: CostController = getCostController()
) {
  return async <T>(
    agentId: string,
    modelId: string,
    inputText: string,
    operation: () => Promise<{ result: T; outputText?: string }>
  ): Promise<{ result: T; cost: CostEntry } | null> => {
    // Estimate cost before operation
    const inputTokens = estimateTokenCount(inputText);
    const estimatedCost = calculateCost(inputTokens, inputTokens, modelId); // Assume output ~= input
    
    // Check budget
    const { allowed, reason } = controller.canProceed(estimatedCost);
    if (!allowed) {
      controller['log']?.warn('Operation blocked', { reason });
      return null;
    }
    
    // Execute operation
    const { result, outputText } = await operation();
    
    // Track actual usage
    const cost = controller.trackTextUsage(
      agentId,
      'completion',
      modelId,
      inputText,
      outputText || ''
    );
    
    return { result, cost };
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default CostController;
