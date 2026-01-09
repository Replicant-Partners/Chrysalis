/**
 * Anthropic Provider
 * 
 * LLM provider implementation for Anthropic Claude API.
 * Supports Claude 3.5, Claude 3, and Claude 2 models.
 * 
 * @module AnthropicProvider
 */

import axios from 'axios';
import { BaseProvider } from './BaseProvider';
import {
  ProviderId,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  Message,
  ToolCall
} from '../types';
import { calculateCost } from '../../../utils/CostControl';

/**
 * Anthropic-specific message format
 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
    content?: string;
  }>;
}

/**
 * Anthropic API response format
 */
interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic streaming event types
 */
interface AnthropicStreamEvent {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop' | 'ping';
  message?: Partial<AnthropicResponse>;
  index?: number;
  content_block?: {
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
  delta?: {
    type?: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  usage?: {
    output_tokens: number;
  };
}

/**
 * Anthropic Provider implementation
 */
export class AnthropicProvider extends BaseProvider {
  readonly id: ProviderId = 'anthropic';
  
  constructor(config?: Partial<ProviderConfig>) {
    super({
      id: 'anthropic',
      apiKey: config?.apiKey,
      baseUrl: config?.baseUrl ?? 'https://api.anthropic.com/v1',
      defaultModel: config?.defaultModel ?? 'claude-sonnet-4-20250514',
      models: config?.models ?? [
        'claude-sonnet-4-20250514',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ],
      enabled: config?.enabled ?? true,
      priority: config?.priority ?? 2,
      rateLimit: config?.rateLimit
    });
  }
  
  protected getApiKey(): string | undefined {
    return this.config.apiKey ?? process.env.ANTHROPIC_API_KEY;
  }
  
  protected getBaseUrl(): string {
    return this.config.baseUrl ?? 'https://api.anthropic.com/v1';
  }
  
  /**
   * Check if Anthropic API is available
   */
  async isAvailable(): Promise<boolean> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return false;
    }
    
    // Anthropic doesn't have a simple health check endpoint
    // We'll verify the API key format is valid
    return apiKey.startsWith('sk-ant-');
  }
  
  /**
   * Convert internal message format to Anthropic format
   * Anthropic requires alternating user/assistant messages
   */
  private toAnthropicMessages(messages: Message[]): { system: string | null; messages: AnthropicMessage[] } {
    let system: string | null = null;
    const anthropicMessages: AnthropicMessage[] = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        // Anthropic uses a separate system parameter
        system = msg.content;
        continue;
      }
      
      if (msg.role === 'tool') {
        // Tool results need to be part of a user message
        const lastMsg = anthropicMessages[anthropicMessages.length - 1];
        if (lastMsg && lastMsg.role === 'user' && Array.isArray(lastMsg.content)) {
          lastMsg.content.push({
            type: 'tool_result',
            tool_use_id: msg.toolCallId,
            content: msg.content
          });
        } else {
          anthropicMessages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: msg.toolCallId,
              content: msg.content
            }]
          });
        }
        continue;
      }
      
      if (msg.role === 'assistant' && msg.toolCalls) {
        // Assistant message with tool calls
        const content: Array<{
          type: 'text' | 'tool_use';
          text?: string;
          id?: string;
          name?: string;
          input?: Record<string, unknown>;
        }> = [];
        
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        
        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments)
          });
        }
        
        anthropicMessages.push({ role: 'assistant', content });
        continue;
      }
      
      // Regular user or assistant message
      anthropicMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }
    
    // Ensure messages alternate properly
    return { system, messages: this.normalizeMessageOrder(anthropicMessages) };
  }
  
  /**
   * Ensure messages alternate between user and assistant
   */
  private normalizeMessageOrder(messages: AnthropicMessage[]): AnthropicMessage[] {
    if (messages.length === 0) return messages;
    
    const normalized: AnthropicMessage[] = [];
    let lastRole: 'user' | 'assistant' | null = null;
    
    for (const msg of messages) {
      if (lastRole === msg.role) {
        // Same role in sequence - merge if possible
        const lastMsg = normalized[normalized.length - 1];
        if (typeof lastMsg.content === 'string' && typeof msg.content === 'string') {
          lastMsg.content = `${lastMsg.content}\n${msg.content}`;
        } else {
          // Insert a placeholder to maintain alternation
          normalized.push({
            role: msg.role === 'user' ? 'assistant' : 'user',
            content: '(continuing...)'
          });
          normalized.push(msg);
        }
      } else {
        normalized.push(msg);
      }
      lastRole = msg.role;
    }
    
    // Ensure first message is from user
    if (normalized.length > 0 && normalized[0].role !== 'user') {
      normalized.unshift({ role: 'user', content: '(starting conversation)' });
    }
    
    return normalized;
  }
  
  /**
   * Complete a request
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }
    
    const model = request.model ?? this.config.defaultModel;
    const { system, messages } = this.toAnthropicMessages(request.messages);
    
    const payload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7
    };
    
    if (system) {
      payload.system = system;
    }
    
    if (request.stop) {
      payload.stop_sequences = request.stop;
    }
    
    if (request.tools && request.tools.length > 0) {
      payload.tools = request.tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
      }));
    }
    
    try {
      const response = await axios.post<AnthropicResponse>(
        `${this.getBaseUrl()}/messages`,
        payload,
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = response.data;
      
      // Extract text content
      let content = '';
      const toolCalls: ToolCall[] = [];
      
      for (const block of data.content) {
        if (block.type === 'text' && block.text) {
          content += block.text;
        } else if (block.type === 'tool_use' && block.id && block.name) {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {})
            }
          });
        }
      }
      
      // Map stop reason
      const finishReasonMap: Record<string, 'stop' | 'length' | 'tool_calls'> = {
        'end_turn': 'stop',
        'max_tokens': 'length',
        'stop_sequence': 'stop',
        'tool_use': 'tool_calls'
      };
      
      const estimatedCost = calculateCost(
        data.usage.input_tokens,
        data.usage.output_tokens,
        model
      );
      
      return {
        content,
        model: data.model,
        finishReason: data.stop_reason ? finishReasonMap[data.stop_reason] ?? 'stop' : 'stop',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        },
        estimatedCost,
        provider: this.id,
        id: data.id
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message ?? error.message;
        throw new Error(`Anthropic API error: ${message}`);
      }
      throw error;
    }
  }
  
  /**
   * Stream a completion
   */
  async *stream(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }
    
    const model = request.model ?? this.config.defaultModel;
    const { system, messages } = this.toAnthropicMessages(request.messages);
    
    const payload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      stream: true
    };
    
    if (system) {
      payload.system = system;
    }
    
    if (request.stop) {
      payload.stop_sequences = request.stop;
    }
    
    if (request.tools && request.tools.length > 0) {
      payload.tools = request.tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
      }));
    }
    
    try {
      const response = await axios.post(
        `${this.getBaseUrl()}/messages`,
        payload,
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );
      
      let buffer = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let currentToolCall: Partial<ToolCall> | null = null;
      
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (!data) continue;
            
            try {
              const event: AnthropicStreamEvent = JSON.parse(data);
              
              switch (event.type) {
                case 'message_start':
                  if (event.message?.usage) {
                    inputTokens = event.message.usage.input_tokens;
                  }
                  break;
                  
                case 'content_block_start':
                  if (event.content_block?.type === 'tool_use') {
                    currentToolCall = {
                      id: event.content_block.id,
                      type: 'function',
                      function: {
                        name: event.content_block.name ?? '',
                        arguments: ''
                      }
                    };
                  }
                  break;
                  
                case 'content_block_delta':
                  if (event.delta?.type === 'text_delta' && event.delta.text) {
                    yield {
                      content: event.delta.text,
                      done: false
                    };
                  } else if (event.delta?.type === 'input_json_delta' && event.delta.partial_json && currentToolCall?.function) {
                    currentToolCall.function.arguments += event.delta.partial_json;
                    yield {
                      content: '',
                      done: false,
                      toolCallsDelta: [currentToolCall]
                    };
                  }
                  break;
                  
                case 'content_block_stop':
                  currentToolCall = null;
                  break;
                  
                case 'message_delta':
                  if (event.usage) {
                    outputTokens = event.usage.output_tokens;
                  }
                  if (event.delta?.stop_reason) {
                    const finishReasonMap: Record<string, 'stop' | 'length' | 'tool_calls'> = {
                      'end_turn': 'stop',
                      'max_tokens': 'length',
                      'stop_sequence': 'stop',
                      'tool_use': 'tool_calls'
                    };
                    yield {
                      content: '',
                      done: true,
                      finishReason: finishReasonMap[event.delta.stop_reason] ?? 'stop',
                      usage: {
                        promptTokens: inputTokens,
                        completionTokens: outputTokens,
                        totalTokens: inputTokens + outputTokens
                      }
                    };
                  }
                  break;
                  
                case 'message_stop':
                  yield {
                    content: '',
                    done: true,
                    usage: {
                      promptTokens: inputTokens,
                      completionTokens: outputTokens,
                      totalTokens: inputTokens + outputTokens
                    }
                  };
                  break;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message ?? error.message;
        throw new Error(`Anthropic streaming error: ${message}`);
      }
      throw error;
    }
  }
}