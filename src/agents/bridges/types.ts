/**
 * Agent Bridge Types
 * 
 * Defines the common interface for connecting various AI agents
 * to the ChrysalisTerminal system.
 * 
 * Supported agent types:
 * - Serena (oraios/serena) - MCP-based code agent
 * - ElizaOS - Character-based conversational agents  
 * - DirectLLM - Claude, GPT, Ollama via API
 * - CrewAI - Multi-agent crews
 * - Custom - User-defined agents
 * 
 * @module agents/bridges/types
 */

/**
 * Agent bridge connection status
 */
export type BridgeStatus = 
  | 'disconnected'
  | 'connecting' 
  | 'connected'
  | 'error'
  | 'reconnecting';

/**
 * Agent capability categories
 */
export type AgentCapability =
  | 'chat'              // Can engage in conversation
  | 'code'              // Can read/write code
  | 'file_operations'   // Can read/write files
  | 'shell'             // Can execute shell commands
  | 'memory'            // Has persistent memory
  | 'search'            // Can search the web/docs
  | 'vision'            // Can process images
  | 'tools'             // Can use external tools
  | 'multi_turn'        // Maintains conversation context
  | 'streaming';        // Supports streaming responses

/**
 * Agent type identifier
 */
export type AgentType =
  | 'serena'
  | 'eliza'
  | 'direct_llm'
  | 'crew_ai'
  | 'custom';

/**
 * Message sent to an agent
 */
export interface AgentMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;
  metadata?: Record<string, unknown>;
  attachments?: Array<{
    type: 'file' | 'image' | 'code';
    content: string;
    mimeType?: string;
    filename?: string;
  }>;
}

/**
 * Response from an agent
 */
export interface AgentResponse {
  id: string;
  content: string;
  timestamp: number;
  status: 'success' | 'error' | 'partial';
  metadata?: Record<string, unknown>;
  
  // For tool-using agents
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>;
  
  // For streaming responses
  isComplete?: boolean;
  
  // Cost tracking
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

/**
 * Agent bridge configuration
 */
export interface BridgeConfig {
  id: string;
  name: string;
  type: AgentType;
  enabled: boolean;
  
  // Connection settings
  endpoint?: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  
  // Agent-specific config
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  
  // Serena-specific
  projectPath?: string;
  languages?: string[];
  
  // ElizaOS-specific
  characterFile?: string;
  evaluatorMode?: string;
  
  // Custom config
  custom?: Record<string, unknown>;
}

/**
 * Agent information
 */
export interface AgentInfo {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  capabilities: AgentCapability[];
  status: BridgeStatus;
  version?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Event emitted by agent bridges
 */
export interface BridgeEvent {
  type: BridgeEventType;
  bridgeId: string;
  timestamp: number;
  payload: unknown;
}

export type BridgeEventType =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'message'
  | 'response'
  | 'stream_chunk'
  | 'stream_end'
  | 'tool_call'
  | 'tool_result'
  | 'status_change';

export type BridgeEventHandler = (event: BridgeEvent) => void;

/**
 * Tool definition for tool-using agents
 */
export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
  handler?: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Context provided to agents for responses
 */
export interface AgentContext {
  // Conversation history
  messages: AgentMessage[];
  
  // Memory context from MemU
  memoryContext?: string;
  
  // Available tools
  tools?: AgentTool[];
  
  // Current terminal state
  terminalState?: {
    sessionId: string;
    widgets: unknown[];
    participants: unknown[];
  };
  
  // Custom context
  custom?: Record<string, unknown>;
}

/**
 * Abstract agent bridge interface
 * 
 * All agent bridges must implement this interface to connect
 * to the ChrysalisTerminal system.
 */
export interface IAgentBridge {
  // Identity
  readonly id: string;
  readonly info: AgentInfo;
  
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): BridgeStatus;
  
  // Messaging
  send(message: AgentMessage, context?: AgentContext): Promise<AgentResponse>;
  stream?(message: AgentMessage, context?: AgentContext): AsyncIterable<AgentResponse>;
  
  // Events
  on(eventType: BridgeEventType, handler: BridgeEventHandler): () => void;
  off(eventType: BridgeEventType, handler: BridgeEventHandler): void;
  
  // Tools (optional)
  registerTool?(tool: AgentTool): void;
  unregisterTool?(toolName: string): void;
  getTools?(): AgentTool[];
  
  // Lifecycle
  destroy(): Promise<void>;
}

/**
 * Registry for managing multiple agent bridges
 */
export interface IAgentRegistry {
  register(bridge: IAgentBridge): void;
  unregister(bridgeId: string): void;
  get(bridgeId: string): IAgentBridge | undefined;
  list(): AgentInfo[];
  findByType(type: AgentType): IAgentBridge[];
  findByCapability(capability: AgentCapability): IAgentBridge[];
}
