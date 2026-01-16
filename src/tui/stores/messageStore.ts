/**
 * Message Store (Zustand)
 *
 * Manages conversation messages in the TUI.
 *
 * @module tui/stores/messageStore
 */

import { create } from 'zustand';
import type { AgentMessage, UserMessage, SystemMessage, Message, ToolExecution } from '../types/messages';

/**
 * Generate unique message ID
 */
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Message store state
 */
interface MessageState {
  /** All messages in conversation */
  messages: Message[];

  /** Currently streaming message ID (if any) */
  streamingMessageId: string | null;

  /** Total token count */
  totalTokens: number;

  /** Total cost estimate */
  totalCost: number;
}

/**
 * Message store actions
 */
interface MessageActions {
  /** Add a new agent message */
  addAgentMessage: (message: Omit<AgentMessage, 'id' | 'timestamp'>) => string;

  /** Add a new user message */
  addUserMessage: (content: string, isCommand?: boolean) => string;

  /** Add a system notification */
  addSystemMessage: (type: SystemMessage['type'], content: string) => string;

  /** Update streaming message content */
  updateStreaming: (messageId: string, content: string) => void;

  /** Complete streaming message */
  completeStreaming: (messageId: string, metrics?: AgentMessage['metrics']) => void;

  /** Add tool execution to message */
  addToolExecution: (messageId: string, tool: ToolExecution) => void;

  /** Update tool execution status */
  updateToolExecution: (
    messageId: string,
    toolId: string,
    update: Partial<ToolExecution>
  ) => void;

  /** Remove last message (undo) */
  undoLastMessage: () => void;

  /** Clear all messages */
  clearMessages: () => void;

  /** Get message by ID */
  getMessage: (id: string) => Message | undefined;

  /** Get all agent messages */
  getAgentMessages: () => AgentMessage[];
}

/**
 * Combined store type
 */
type MessageStore = MessageState & MessageActions;

/**
 * Create message store
 */
export const useMessageStore = create<MessageStore>((set, get) => ({
  // Initial state
  messages: [],
  streamingMessageId: null,
  totalTokens: 0,
  totalCost: 0,

  // Actions
  addAgentMessage: (message) => {
    const id = generateId();
    const newMessage: AgentMessage = {
      ...message,
      id,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
      streamingMessageId: message.streaming ? id : state.streamingMessageId,
    }));

    return id;
  },

  addUserMessage: (content, isCommand = false) => {
    const id = generateId();
    const newMessage: UserMessage = {
      id,
      content,
      timestamp: new Date(),
      isCommand,
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
    }));

    return id;
  },

  addSystemMessage: (type, content) => {
    const id = generateId();
    const newMessage: SystemMessage = {
      id,
      type,
      content,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
    }));

    return id;
  },

  updateStreaming: (messageId, content) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId && 'agentId' in msg
          ? { ...msg, content }
          : msg
      ),
    }));
  },

  completeStreaming: (messageId, metrics) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId && 'agentId' in msg
          ? { ...msg, streaming: false, metrics }
          : msg
      ),
      streamingMessageId: state.streamingMessageId === messageId
        ? null
        : state.streamingMessageId,
      totalTokens: metrics
        ? state.totalTokens + (metrics.inputTokens || 0) + (metrics.outputTokens || 0)
        : state.totalTokens,
      totalCost: metrics
        ? state.totalCost + (metrics.cost || 0)
        : state.totalCost,
    }));
  },

  addToolExecution: (messageId, tool) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === messageId && 'agentId' in msg) {
          const agentMsg = msg as AgentMessage;
          return {
            ...agentMsg,
            toolCalls: [...(agentMsg.toolCalls || []), tool],
          };
        }
        return msg;
      }),
    }));
  },

  updateToolExecution: (messageId, toolId, update) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === messageId && 'agentId' in msg) {
          const agentMsg = msg as AgentMessage;
          return {
            ...agentMsg,
            toolCalls: agentMsg.toolCalls?.map((tool) =>
              tool.id === toolId ? { ...tool, ...update } : tool
            ),
          };
        }
        return msg;
      }),
    }));
  },

  undoLastMessage: () => {
    set((state) => ({
      messages: state.messages.slice(0, -1),
    }));
  },

  clearMessages: () => {
    set({
      messages: [],
      streamingMessageId: null,
      totalTokens: 0,
      totalCost: 0,
    });
  },

  getMessage: (id) => {
    return get().messages.find((msg) => msg.id === id);
  },

  getAgentMessages: () => {
    return get().messages.filter(
      (msg): msg is AgentMessage => 'agentId' in msg
    );
  },
}));

export type { MessageStore };
