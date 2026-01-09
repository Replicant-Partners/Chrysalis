/**
 * BaseBridge - Abstract base class for agent bridges
 * 
 * Provides common functionality for all agent bridges:
 * - Event handling
 * - Status management
 * - Retry logic
 * - Error handling
 * 
 * @module agents/bridges/BaseBridge
 */

import {
  IAgentBridge,
  BridgeConfig,
  BridgeStatus,
  BridgeEvent,
  BridgeEventType,
  BridgeEventHandler,
  AgentInfo,
  AgentMessage,
  AgentResponse,
  AgentContext,
  AgentTool,
  AgentCapability,
  AgentType
} from './types';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Abstract base class for agent bridges
 */
export abstract class BaseBridge implements IAgentBridge {
  protected config: BridgeConfig;
  protected status: BridgeStatus = 'disconnected';
  protected eventHandlers: Map<BridgeEventType, Set<BridgeEventHandler>> = new Map();
  protected tools: Map<string, AgentTool> = new Map();
  protected retryCount: number = 0;
  protected lastError?: Error;
  
  constructor(config: BridgeConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      ...config
    };
  }
  
  // ============================================================================
  // Identity (abstract - must be implemented by subclasses)
  // ============================================================================
  
  get id(): string {
    return this.config.id;
  }
  
  abstract get info(): AgentInfo;
  
  /**
   * Get the agent type
   */
  abstract get agentType(): AgentType;
  
  /**
   * Get the agent capabilities
   */
  abstract get capabilities(): AgentCapability[];
  
  // ============================================================================
  // Connection (abstract - must be implemented by subclasses)
  // ============================================================================
  
  /**
   * Connect to the agent
   */
  abstract connect(): Promise<void>;
  
  /**
   * Disconnect from the agent
   */
  abstract disconnect(): Promise<void>;
  
  /**
   * Get current connection status
   */
  getStatus(): BridgeStatus {
    return this.status;
  }
  
  /**
   * Update status and emit event
   */
  protected setStatus(status: BridgeStatus): void {
    const previous = this.status;
    this.status = status;
    
    if (previous !== status) {
      this.emit({
        type: 'status_change',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { previous, current: status }
      });
    }
  }
  
  // ============================================================================
  // Messaging (abstract - must be implemented by subclasses)
  // ============================================================================
  
  /**
   * Send a message to the agent
   */
  abstract send(message: AgentMessage, context?: AgentContext): Promise<AgentResponse>;
  
  /**
   * Stream responses from the agent (optional)
   */
  stream?(message: AgentMessage, context?: AgentContext): AsyncIterable<AgentResponse>;
  
  // ============================================================================
  // Events
  // ============================================================================
  
  /**
   * Subscribe to bridge events
   */
  on(eventType: BridgeEventType, handler: BridgeEventHandler): () => void {
    const handlers = this.eventHandlers.get(eventType) ?? new Set();
    handlers.add(handler);
    this.eventHandlers.set(eventType, handlers);
    
    return () => this.off(eventType, handler);
  }
  
  /**
   * Unsubscribe from bridge events
   */
  off(eventType: BridgeEventType, handler: BridgeEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  /**
   * Emit a bridge event
   */
  protected emit(event: BridgeEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Event handler error for ${event.type}:`, error);
        }
      }
    }
  }
  
  // ============================================================================
  // Tools
  // ============================================================================
  
  /**
   * Register a tool for the agent to use
   */
  registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }
  
  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): void {
    this.tools.delete(toolName);
  }
  
  /**
   * Get all registered tools
   */
  getTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Execute a tool by name
   */
  protected async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    
    if (!tool.handler) {
      throw new Error(`Tool ${toolName} has no handler`);
    }
    
    this.emit({
      type: 'tool_call',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: { toolName, args }
    });
    
    try {
      const result = await tool.handler(args);
      
      this.emit({
        type: 'tool_result',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { toolName, args, result, status: 'success' }
      });
      
      return result;
    } catch (error) {
      this.emit({
        type: 'tool_result',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { toolName, args, error, status: 'error' }
      });
      throw error;
    }
  }
  
  // ============================================================================
  // Retry Logic
  // ============================================================================
  
  /**
   * Execute with retry logic
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const maxRetries = this.config.maxRetries ?? 3;
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.retryCount = attempt;
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(
            `${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
            `retrying in ${delay}ms:`,
            lastError.message
          );
          await this.sleep(delay);
        }
      }
    }
    
    this.lastError = lastError;
    this.emit({
      type: 'error',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: { error: lastError, operation: operationName }
    });
    
    throw lastError;
  }
  
  /**
   * Execute with timeout
   */
  protected async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    const timeout = timeoutMs ?? this.config.timeout ?? 30000;
    
    return Promise.race([
      operation,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }
  
  /**
   * Sleep for a given number of milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  /**
   * Create a response object
   */
  protected createResponse(
    content: string,
    status: AgentResponse['status'] = 'success',
    metadata?: Record<string, unknown>
  ): AgentResponse {
    return {
      id: generateId(),
      content,
      timestamp: Date.now(),
      status,
      metadata,
      isComplete: true
    };
  }
  
  /**
   * Create an error response
   */
  protected createErrorResponse(error: Error | string): AgentResponse {
    const errorMessage = error instanceof Error ? error.message : error;
    return this.createResponse(
      `Error: ${errorMessage}`,
      'error',
      { error: errorMessage }
    );
  }
  
  /**
   * Format messages for the agent
   */
  protected formatMessages(
    message: AgentMessage,
    context?: AgentContext
  ): AgentMessage[] {
    const messages: AgentMessage[] = [];
    
    // Add system prompt if configured
    if (this.config.systemPrompt) {
      messages.push({
        id: 'system',
        content: this.config.systemPrompt,
        role: 'system',
        timestamp: Date.now()
      });
    }
    
    // Add conversation history from context
    if (context?.messages) {
      messages.push(...context.messages);
    }
    
    // Add memory context if available
    if (context?.memoryContext) {
      messages.push({
        id: 'memory-context',
        content: `[Memory Context]\n${context.memoryContext}`,
        role: 'system',
        timestamp: Date.now()
      });
    }
    
    // Add the current message
    messages.push(message);
    
    return messages;
  }
  
  // ============================================================================
  // Lifecycle
  // ============================================================================
  
  /**
   * Destroy the bridge and clean up resources
   */
  async destroy(): Promise<void> {
    await this.disconnect();
    this.eventHandlers.clear();
    this.tools.clear();
  }
}

/**
 * Factory function to create a bridge from config
 */
export type BridgeFactory = (config: BridgeConfig) => IAgentBridge;