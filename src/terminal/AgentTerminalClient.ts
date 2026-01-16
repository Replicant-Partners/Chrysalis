import { ChrysalisTerminal } from './ChrysalisTerminal';
import { ChatMessage, ChatPaneState } from './protocols';
import { AgentMemoryAdapter } from '../memory/AgentMemoryAdapter';
import { AgentLLMClient, AgentClientConfig } from '../services/llm/AgentLLMClient';
import { GatewayLLMClient } from '../services/gateway/GatewayLLMClient';

export interface AgentTerminalConfig {
  agentId: string;
  agentName: string;
  systemPrompt?: string;
  terminal?: ChrysalisTerminal;
  sessionId?: string;
  gatewayClient?: GatewayLLMClient;
  memory?: AgentMemoryAdapter;
  autoRespond?: boolean;
  respondToFrame?: 'left' | 'right' | 'both';
  includeMemoryContext?: boolean;
  maxHistoryMessages?: number;
}

export interface AgentMessageHandler {
  (message: ChatMessage): Promise<string | void> | string | void;
}

/**
 * Lean AgentTerminalClient: chat only, no widgets.
 */
export class AgentTerminalClient {
  private terminal: ChrysalisTerminal;
  private config: AgentTerminalConfig;
  private memory?: AgentMemoryAdapter;
  private llmClient?: AgentLLMClient;
  private unsubscribers: (() => void)[] = [];

  constructor(config: AgentTerminalConfig) {
    this.config = {
      autoRespond: false,
      respondToFrame: 'left',
      includeMemoryContext: false,
      maxHistoryMessages: 50,
      ...config
    };

    this.terminal = config.terminal || new ChrysalisTerminal({
      sessionName: 'Chrysalis Terminal'
    });

    this.memory = config.memory;
    if (config.gatewayClient) {
      this.llmClient = new AgentLLMClient(config.gatewayClient, {
        agentId: config.agentId,
        agentName: config.agentName,
        systemPrompt: config.systemPrompt,
        tools: []
      });
    }

    if (this.config.autoRespond) {
      this.initializeAutoRespond();
    }
  }

  destroy(): void {
    this.unsubscribers.forEach(fn => fn());
    this.terminal.destroy();
  }

  sendMessage(frame: 'left' | 'right', content: string, opts?: Partial<ChatMessage>): ChatMessage {
    return this.terminal.sendMessage(frame, content, {
      senderId: this.config.agentId,
      senderName: this.config.agentName,
      senderType: 'agent',
      ...opts
    });
  }

  getMessages(frame: 'left' | 'right', limit?: number): ChatMessage[] {
    return this.terminal.getMessages(frame, limit ?? this.config.maxHistoryMessages);
  }

  setTyping(frame: 'left' | 'right', isTyping: boolean): void {
    this.terminal.setTyping(frame, isTyping, this.config.agentId);
  }

  onMessage(handler: AgentMessageHandler): () => void {
    const unsub = this.terminal.on('chat:message', async (event) => {
      const payload = event.payload as any;
      if (!payload || payload.message.senderId === this.config.agentId) return;
      const result = await handler(payload.message);
      if (typeof result === 'string') {
        this.sendMessage('left', result);
      }
    });
    this.unsubscribers.push(unsub);
    return unsub;
  }

  private initializeAutoRespond(): void {
    this.onMessage(async (msg) => {
      if (!this.llmClient) return;

      const history = this.getMessages('left', this.config.maxHistoryMessages);
      const context = history.map(m => `${m.senderName}: ${m.content}`).join('\n');
      const response = await this.llmClient.chat(`${context}\nUser: ${msg.content}`);
      if (response?.content) {
        this.sendMessage('left', response.content);
      }
    });
  }

  /**
   * Minimal chat helper to align with AgentChatController expectations.
   * Uses the configured LLM client when available, otherwise echoes the prompt.
   */
  async chat(userMessage: string, options?: { systemPrompt?: string; includeMemoryContext?: boolean }): Promise<{ content: string }> {
    if (this.llmClient) {
      if (options?.systemPrompt) {
        this.llmClient.setSystemPrompt(options.systemPrompt);
      }
      const response = await this.llmClient.chat(userMessage, {
        metadata: options?.includeMemoryContext ? { includeMemory: true } : undefined
      });
      return { content: response.content };
    }

    // Fallback echo to avoid throwing during lean mode
    return { content: userMessage };
  }

  getChatPane(frame: 'left' | 'right'): ChatPaneState {
    return frame === 'left'
      ? this.terminal.getSession().left
      : this.terminal.getSession().right;
  }

  getTerminal(): ChrysalisTerminal {
    return this.terminal;
  }
}

export function createAgentTerminalClient(config: AgentTerminalConfig): AgentTerminalClient {
  return new AgentTerminalClient(config);
}
