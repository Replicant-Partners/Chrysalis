/**
 * Agent Chat Integration Service
 * 
 * Connects awakened agents to chat sessions, enabling:
 * - Agents to receive and respond to messages
 * - Multi-agent conversations in the same chat
 * - Agent-to-agent communication
 * - Memory persistence of conversations
 * 
 * Works with:
 * - AgentLifecycleManager for agent state
 * - ChatPane for UI integration
 * - MemU for conversation memory
 */

import { 
  AgentLifecycleManager, 
  ActiveAgentRuntime,
  IAgentBridgeFactory
} from '../terminal/protocols/agent-lifecycle-manager';
import { AgentCanvasManager } from '../terminal/protocols/agent-canvas-manager';
import { CanvasAgent } from '../terminal/protocols/agent-canvas';

// =============================================================================
// Types
// =============================================================================

/**
 * Chat message structure
 */
export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderType: 'user' | 'agent' | 'system';
  senderName: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  replyTo?: string;
  isStreaming?: boolean;
}

/**
 * Chat session structure
 */
export interface ChatSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  participants: ChatParticipant[];
  messages: ChatMessage[];
  metadata?: Record<string, unknown>;
}

/**
 * Chat participant (user or agent)
 */
export interface ChatParticipant {
  id: string;
  type: 'user' | 'agent';
  name: string;
  avatar?: string;
  isActive: boolean;
  joinedAt: number;
}

/**
 * Agent response context
 */
export interface AgentResponseContext {
  sessionId: string;
  recentMessages: ChatMessage[];
  mentionedAgentIds: string[];
  userContext?: Record<string, unknown>;
}

/**
 * Chat integration event types
 */
export type ChatIntegrationEventType =
  | 'session:created'
  | 'session:joined'
  | 'session:left'
  | 'message:sent'
  | 'message:received'
  | 'agent:responding'
  | 'agent:responded'
  | 'agent:error';

/**
 * Chat integration event
 */
export interface ChatIntegrationEvent {
  type: ChatIntegrationEventType;
  sessionId: string;
  agentId?: string;
  message?: ChatMessage;
  error?: Error;
  timestamp: number;
}

/**
 * Event listener
 */
export type ChatIntegrationEventListener = (event: ChatIntegrationEvent) => void;

/**
 * Configuration for chat integration
 */
export interface ChatIntegrationConfig {
  /** Maximum messages to include in context */
  maxContextMessages: number;
  /** Timeout for agent responses (ms) */
  responseTimeout: number;
  /** Enable agent-to-agent communication */
  enableAgentToAgent: boolean;
  /** Cooldown between agent responses (ms) */
  responseCooldown: number;
  /** Default system prompt additions */
  systemPromptAdditions?: string;
  /** Maximum messages per session (prevents unbounded memory growth) */
  maxMessagesPerSession: number;
  /** Whether to archive old messages to agent memory when truncating */
  archiveOldMessages: boolean;
}

const DEFAULT_CONFIG: ChatIntegrationConfig = {
  maxContextMessages: 20,
  responseTimeout: 60000,
  enableAgentToAgent: true,
  responseCooldown: 500,
  maxMessagesPerSession: 500,
  archiveOldMessages: true,
};

// =============================================================================
// Agent Chat Integration Service
// =============================================================================

/**
 * AgentChatIntegration manages agent participation in chat sessions
 */
export class AgentChatIntegration {
  private config: ChatIntegrationConfig;
  private lifecycleManager: AgentLifecycleManager;
  private canvasManager: AgentCanvasManager;
  private sessions: Map<string, ChatSession> = new Map();
  private listeners: Map<string, Set<ChatIntegrationEventListener>> = new Map();
  private responseQueue: Map<string, Promise<void>> = new Map();
  private lastResponseTime: Map<string, number> = new Map();

  constructor(
    lifecycleManager: AgentLifecycleManager,
    canvasManager: AgentCanvasManager,
    config: Partial<ChatIntegrationConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lifecycleManager = lifecycleManager;
    this.canvasManager = canvasManager;
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * Create a new chat session
   */
  createSession(name: string = 'New Chat'): ChatSession {
    const session: ChatSession = {
      id: this.generateId('session'),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      participants: [{
        id: 'user',
        type: 'user',
        name: 'User',
        isActive: true,
        joinedAt: Date.now()
      }],
      messages: []
    };

    this.sessions.set(session.id, session);

    this.emit({
      type: 'session:created',
      sessionId: session.id,
      timestamp: Date.now()
    });

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove all agents from session
    for (const participant of session.participants) {
      if (participant.type === 'agent') {
        this.lifecycleManager.leaveChatSession(participant.id, sessionId);
      }
    }

    this.sessions.delete(sessionId);
  }

  // ===========================================================================
  // Agent Participation
  // ===========================================================================

  /**
   * Add an agent to a chat session
   */
  joinSession(agentId: string, sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const runtime = this.lifecycleManager.getRuntime(agentId);
    if (!runtime) {
      console.warn(`Agent ${agentId} is not awake, cannot join session`);
      return false;
    }

    const agent = this.canvasManager.getAgent(agentId);
    if (!agent) return false;

    // Check if already in session
    if (session.participants.some(p => p.id === agentId)) {
      return true;
    }

    // Add participant
    session.participants.push({
      id: agentId,
      type: 'agent',
      name: agent.name,
      avatar: this.getAgentAvatar(agent),
      isActive: true,
      joinedAt: Date.now()
    });

    session.updatedAt = Date.now();

    // Register with lifecycle manager
    this.lifecycleManager.joinChatSession(agentId, sessionId);

    this.emit({
      type: 'session:joined',
      sessionId,
      agentId,
      timestamp: Date.now()
    });

    // Send system message
    this.addSystemMessage(sessionId, `${agent.name} joined the conversation`);

    return true;
  }

  /**
   * Remove an agent from a chat session
   */
  leaveSession(agentId: string, sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const participantIndex = session.participants.findIndex(p => p.id === agentId);
    if (participantIndex === -1) return false;

    const participant = session.participants[participantIndex];
    session.participants.splice(participantIndex, 1);
    session.updatedAt = Date.now();

    // Unregister from lifecycle manager
    this.lifecycleManager.leaveChatSession(agentId, sessionId);

    this.emit({
      type: 'session:left',
      sessionId,
      agentId,
      timestamp: Date.now()
    });

    // Send system message
    this.addSystemMessage(sessionId, `${participant.name} left the conversation`);

    return true;
  }

  /**
   * Get agents in a session
   * Uses batch lookup for efficiency (avoids N+1 pattern)
   */
  getSessionAgents(sessionId: string): CanvasAgent[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const agentIds = session.participants
      .filter(p => p.type === 'agent')
      .map(p => p.id);
    
    // Use batch lookup instead of N individual getAgent() calls
    return this.canvasManager.getAgentsByIds(agentIds);
  }

  // ===========================================================================
  // Messaging
  // ===========================================================================

  /**
   * Send a user message and get agent responses
   * Enforces message bounds to prevent unbounded memory growth
   */
  async sendUserMessage(
    sessionId: string,
    content: string,
    mentionedAgentIds?: string[]
  ): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: this.generateId('msg'),
      sessionId,
      senderId: 'user',
      senderType: 'user',
      senderName: 'User',
      content,
      timestamp: Date.now(),
      metadata: { mentionedAgentIds }
    };

    // Add to session
    session.messages.push(userMessage);
    session.updatedAt = Date.now();

    // MEMORY SAFETY: Enforce message bounds
    await this.enforceMessageBounds(session);

    this.emit({
      type: 'message:sent',
      sessionId,
      message: userMessage,
      timestamp: Date.now()
    });

    // Get agent responses
    const responses: ChatMessage[] = [];
    const agents = this.getSessionAgents(sessionId);
    
    // Determine which agents should respond
    const respondingAgents = mentionedAgentIds?.length
      ? agents.filter(a => mentionedAgentIds.includes(a.id))
      : agents; // All agents respond if no specific mention

    // Get responses from each agent
    for (const agent of respondingAgents) {
      try {
        const response = await this.getAgentResponse(agent.id, sessionId, userMessage);
        if (response) {
          responses.push(response);
        }
      } catch (error) {
        console.error(`Error getting response from agent ${agent.id}:`, error);
        this.emit({
          type: 'agent:error',
          sessionId,
          agentId: agent.id,
          error: error instanceof Error ? error : new Error(String(error)),
          timestamp: Date.now()
        });
      }
    }

    return responses;
  }

  /**
   * Get response from a specific agent
   */
  async getAgentResponse(
    agentId: string,
    sessionId: string,
    triggerMessage: ChatMessage
  ): Promise<ChatMessage | null> {
    const runtime = this.lifecycleManager.getRuntime(agentId);
    if (!runtime) {
      console.warn(`Agent ${agentId} is not awake`);
      return null;
    }

    const agent = this.canvasManager.getAgent(agentId);
    if (!agent) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check cooldown
    const lastResponse = this.lastResponseTime.get(`${agentId}-${sessionId}`) || 0;
    const timeSinceLastResponse = Date.now() - lastResponse;
    if (timeSinceLastResponse < this.config.responseCooldown) {
      await new Promise(resolve => 
        setTimeout(resolve, this.config.responseCooldown - timeSinceLastResponse)
      );
    }

    // Build context
    const context = this.buildAgentContext(session, agent);

    // Emit responding event
    this.emit({
      type: 'agent:responding',
      sessionId,
      agentId,
      timestamp: Date.now()
    });

    try {
      // Get response from lifecycle manager
      const responseContent = await Promise.race([
        this.lifecycleManager.sendMessage(agentId, triggerMessage.content, context),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Response timeout')), this.config.responseTimeout)
        )
      ]) as string;

      // Create response message
      const responseMessage: ChatMessage = {
        id: this.generateId('msg'),
        sessionId,
        senderId: agentId,
        senderType: 'agent',
        senderName: agent.name,
        content: responseContent,
        timestamp: Date.now(),
        replyTo: triggerMessage.id
      };

      // Add to session
      session.messages.push(responseMessage);
      session.updatedAt = Date.now();
      this.lastResponseTime.set(`${agentId}-${sessionId}`, Date.now());

      // Add to agent memory
      await this.lifecycleManager.addMemory(
        agentId,
        `[Chat ${session.name}] User: ${triggerMessage.content}\nMe: ${responseContent}`,
        0.6
      );

      this.emit({
        type: 'agent:responded',
        sessionId,
        agentId,
        message: responseMessage,
        timestamp: Date.now()
      });

      this.emit({
        type: 'message:received',
        sessionId,
        message: responseMessage,
        timestamp: Date.now()
      });

      return responseMessage;

    } catch (error) {
      this.emit({
        type: 'agent:error',
        sessionId,
        agentId,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      });
      return null;
    }
  }

  /**
   * Add a system message to session
   */
  addSystemMessage(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const message: ChatMessage = {
      id: this.generateId('msg'),
      sessionId,
      senderId: 'system',
      senderType: 'system',
      senderName: 'System',
      content,
      timestamp: Date.now()
    };

    session.messages.push(message);
    session.updatedAt = Date.now();

    // MEMORY SAFETY: Enforce message bounds (fire and forget for system messages)
    this.enforceMessageBounds(session).catch(e =>
      console.error('Failed to enforce message bounds:', e)
    );

    this.emit({
      type: 'message:received',
      sessionId,
      message,
      timestamp: Date.now()
    });
  }

  // ===========================================================================
  // Memory Bounds Management
  // ===========================================================================

  /**
   * Enforce message bounds on a session to prevent unbounded memory growth
   * Archives old messages to agent memory if configured
   */
  private async enforceMessageBounds(session: ChatSession): Promise<void> {
    if (session.messages.length <= this.config.maxMessagesPerSession) {
      return;
    }

    const excessCount = session.messages.length - this.config.maxMessagesPerSession;
    const messagesToRemove = session.messages.slice(0, excessCount);

    // Archive to agent memories if configured
    if (this.config.archiveOldMessages && messagesToRemove.length > 0) {
      await this.archiveMessagesToAgentMemory(session, messagesToRemove);
    }

    // Truncate messages
    session.messages = session.messages.slice(-this.config.maxMessagesPerSession);
  }

  /**
   * Archive messages to participating agent memories
   */
  private async archiveMessagesToAgentMemory(
    session: ChatSession,
    messages: ChatMessage[]
  ): Promise<void> {
    // Get participating agents
    const agentParticipants = session.participants.filter(p => p.type === 'agent');
    if (agentParticipants.length === 0) return;

    // Create summary of archived messages
    const summary = this.summarizeMessages(messages);
    if (!summary) return;

    // Add to each agent's memory
    for (const participant of agentParticipants) {
      try {
        await this.lifecycleManager.addMemory(
          participant.id,
          `[Archived conversation from ${session.name}]: ${summary}`,
          0.4 // Lower importance for archived content
        );
      } catch (e) {
        // Don't fail the whole operation if one agent fails
        console.warn(`Failed to archive to agent ${participant.id}:`, e);
      }
    }
  }

  /**
   * Create a summary of messages for archival
   */
  private summarizeMessages(messages: ChatMessage[]): string | null {
    if (messages.length === 0) return null;

    // Simple summarization: first and last message with count
    const first = messages[0];
    const last = messages[messages.length - 1];
    const count = messages.length;

    if (count === 1) {
      return `${first.senderName}: "${this.truncateContent(first.content, 100)}"`;
    }

    return `${count} messages from ${first.senderName} to ${last.senderName}. ` +
           `First: "${this.truncateContent(first.content, 50)}" ... ` +
           `Last: "${this.truncateContent(last.content, 50)}"`;
  }

  /**
   * Truncate content to max length with ellipsis
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength - 3) + '...';
  }

  // ===========================================================================
  // Agent-to-Agent Communication
  // ===========================================================================

  /**
   * Enable agent-to-agent messaging
   */
  async sendAgentToAgentMessage(
    fromAgentId: string,
    toAgentId: string,
    sessionId: string,
    content: string
  ): Promise<ChatMessage | null> {
    if (!this.config.enableAgentToAgent) {
      console.warn('Agent-to-agent communication is disabled');
      return null;
    }

    const fromAgent = this.canvasManager.getAgent(fromAgentId);
    const toRuntime = this.lifecycleManager.getRuntime(toAgentId);

    if (!fromAgent || !toRuntime) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Create message
    const message: ChatMessage = {
      id: this.generateId('msg'),
      sessionId,
      senderId: fromAgentId,
      senderType: 'agent',
      senderName: fromAgent.name,
      content,
      timestamp: Date.now(),
      metadata: { toAgentId }
    };

    session.messages.push(message);
    session.updatedAt = Date.now();

    this.emit({
      type: 'message:sent',
      sessionId,
      agentId: fromAgentId,
      message,
      timestamp: Date.now()
    });

    // Get response from target agent
    return this.getAgentResponse(toAgentId, sessionId, message);
  }

  // ===========================================================================
  // Context Building
  // ===========================================================================

  /**
   * Build context for agent response
   */
  private buildAgentContext(session: ChatSession, agent: CanvasAgent): Record<string, unknown> {
    const recentMessages = session.messages.slice(-this.config.maxContextMessages);
    
    // Format conversation history
    const conversationHistory = recentMessages.map(msg => ({
      role: msg.senderType === 'user' ? 'user' : msg.senderId === agent.id ? 'assistant' : 'other',
      name: msg.senderName,
      content: msg.content,
      timestamp: msg.timestamp
    }));

    // Get other participants
    const otherParticipants = session.participants
      .filter(p => p.id !== agent.id)
      .map(p => ({ id: p.id, name: p.name, type: p.type }));

    // Build system context additions
    const systemContext = this.config.systemPromptAdditions || '';
    const participantContext = otherParticipants.length > 0
      ? `\n\nOther participants in this conversation: ${otherParticipants.map(p => p.name).join(', ')}`
      : '';

    return {
      sessionId: session.id,
      sessionName: session.name,
      conversationHistory,
      participants: otherParticipants,
      systemContext: systemContext + participantContext,
      agentId: agent.id,
      agentName: agent.name
    };
  }

  /**
   * Get agent avatar from spec
   */
  private getAgentAvatar(agent: CanvasAgent): string | undefined {
    const importMeta = agent.spec._import_metadata;
    if (importMeta && typeof importMeta === 'object') {
      const avatar = (importMeta as Record<string, unknown>).avatar;
      if (avatar && typeof avatar === 'object') {
        return (avatar as Record<string, unknown>).type as string;
      }
    }
    return undefined;
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to events
   */
  on(eventType: ChatIntegrationEventType | '*', listener: ChatIntegrationEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Emit event
   */
  private emit(event: ChatIntegrationEvent): void {
    this.listeners.get(event.type)?.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error(`Error in chat integration event listener:`, e);
      }
    });

    this.listeners.get('*')?.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error(`Error in chat integration wildcard listener:`, e);
      }
    });
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract mentioned agent IDs from message
   */
  extractMentions(content: string, sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const mentions: string[] = [];
    const agents = session.participants.filter(p => p.type === 'agent');

    for (const agent of agents) {
      // Check for @mentions
      if (content.toLowerCase().includes(`@${agent.name.toLowerCase()}`)) {
        mentions.push(agent.id);
      }
      // Check for name references
      if (content.toLowerCase().includes(agent.name.toLowerCase())) {
        mentions.push(agent.id);
      }
    }

    return [...new Set(mentions)];
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Destroy the service
   */
  destroy(): void {
    // Remove all agents from all sessions
    for (const session of this.sessions.values()) {
      for (const participant of session.participants) {
        if (participant.type === 'agent') {
          this.lifecycleManager.leaveChatSession(participant.id, session.id);
        }
      }
    }

    this.sessions.clear();
    this.listeners.clear();
    this.responseQueue.clear();
    this.lastResponseTime.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an agent chat integration service
 */
export function createAgentChatIntegration(
  lifecycleManager: AgentLifecycleManager,
  canvasManager: AgentCanvasManager,
  config?: Partial<ChatIntegrationConfig>
): AgentChatIntegration {
  return new AgentChatIntegration(lifecycleManager, canvasManager, config);
}

// =============================================================================
// React Hook
// =============================================================================

/**
 * Hook for using agent chat integration in React components
 */
export interface UseAgentChatResult {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  participants: ChatParticipant[];
  createSession: (name?: string) => ChatSession;
  selectSession: (sessionId: string) => void;
  sendMessage: (content: string) => Promise<ChatMessage[]>;
  addAgent: (agentId: string) => boolean;
  removeAgent: (agentId: string) => boolean;
  isAgentResponding: boolean;
}

// Note: The actual React hook implementation would require React imports
// and would be in a separate file for proper React integration