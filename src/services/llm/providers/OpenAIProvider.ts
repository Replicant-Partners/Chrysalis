/**
 * OpenAI Provider
 * 
 * LLM provider implementation for OpenAI API.
 * Supports GPT-4o, GPT-4, GPT-3.5-turbo models.
 * 
 * @module OpenAIProvider
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
 * OpenAI-specific message format
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * OpenAI API response format
 */
interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI streaming chunk format
 */
interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Provider implementation
 */
export class OpenAIProvider extends BaseProvider {
  readonly id: ProviderId = 'openai';
  
  constructor(config?: Partial<ProviderConfig>) {
    super({
      id: 'openai',
      apiKey: config?.apiKey,
      baseUrl: config?.baseUrl,
      defaultModel: config?.defaultModel ?? 'gpt-4o-mini',
      models: config?.models ?? [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo'
      ],
      enabled: config?.enabled ?? true,
      priority: config?.priority ?? 1,
      rateLimit: config?.rateLimit
    });
  }
  
  /**
   * Check if OpenAI API is available
   */
  async isAvailable(): Promise<boolean> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return false;
    }
    
    try {
      const response = await axios.get(`${this.getBaseUrl()}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
  
  /**
   * Convert internal message format to OpenAI format
   */
  private toOpenAIMessages(messages: Message[]): OpenAIMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
      ...(msg.toolCalls && {
        tool_calls: msg.toolCalls.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: tc.function
        }))
      })
    }));
  }
  
  /**
   * Complete a request
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    const model = request.model ?? this.config.defaultModel;
    
    const payload: Record<string, unknown> = {
      model,
      messages: this.toOpenAIMessages(request.messages),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096
    };
    
    if (request.stop) {
      payload.stop = request.stop;
    }
    
    if (request.tools && request.tools.length > 0) {
      payload.tools = request.tools;
      if (request.toolChoice) {
        payload.tool_choice = request.toolChoice;
      }
    }
    
    try {
      const response = await axios.post<OpenAIChatResponse>(
        `${this.getBaseUrl()}/chat/completions`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = response.data;
      const choice = data.choices[0];
      
      // Convert tool calls if present
      let toolCalls: ToolCall[] | undefined;
      if (choice.message.tool_calls) {
        toolCalls = choice.message.tool_calls.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: tc.function
        }));
      }
      
      const estimatedCost = calculateCost(
        data.usage.prompt_tokens,
        data.usage.completion_tokens,
        model
      );
      
      return {
        content: choice.message.content ?? '',
        model: data.model,
        finishReason: choice.finish_reason,
        toolCalls,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        },
        estimatedCost,
        provider: this.id,
        id: data.id
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message ?? error.message;
        throw new Error(`OpenAI API error: ${message}`);
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
      throw new Error('OpenAI API key not configured');
    }
    
    const model = request.model ?? this.config.defaultModel;
    
    const payload: Record<string, unknown> = {
      model,
      messages: this.toOpenAIMessages(request.messages),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      stream: true,
      stream_options: { include_usage: true }
    };
    
    if (request.stop) {
      payload.stop = request.stop;
    }
    
    if (request.tools && request.tools.length > 0) {
      payload.tools = request.tools;
      if (request.toolChoice) {
        payload.tool_choice = request.toolChoice;
      }
    }
    
    try {
      const response = await axios.post(
        `${this.getBaseUrl()}/chat/completions`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );
      
      let buffer = '';
      let toolCallsAccumulator: Map<number, Partial<ToolCall>> = new Map();
      
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              continue;
            }
            
            try {
              const parsed: OpenAIStreamChunk = JSON.parse(data);
              const choice = parsed.choices[0];
              
              if (!choice) continue;
              
              // Handle tool calls
              let toolCallsDelta: Partial<ToolCall>[] | undefined;
              if (choice.delta.tool_calls) {
                toolCallsDelta = [];
                for (const tc of choice.delta.tool_calls) {
                  const existing = toolCallsAccumulator.get(tc.index) ?? {};
                  if (tc.id) existing.id = tc.id;
                  if (tc.type) existing.type = tc.type;
                  if (tc.function) {
                    if (!existing.function) {
                      existing.function = { name: '', arguments: '' };
                    }
                    if (tc.function.name) existing.function.name = tc.function.name;
                    if (tc.function.arguments) existing.function.arguments += tc.function.arguments;
                  }
                  toolCallsAccumulator.set(tc.index, existing);
                  toolCallsDelta.push(existing);
                }
              }
              
              const chunk: CompletionChunk = {
                content: choice.delta.content ?? '',
                done: choice.finish_reason !== null,
                finishReason: choice.finish_reason ?? undefined,
                toolCallsDelta
              };
              
              // Include usage on final chunk
              if (parsed.usage && choice.finish_reason !== null) {
                chunk.usage = {
                  promptTokens: parsed.usage.prompt_tokens,
                  completionTokens: parsed.usage.completion_tokens,
                  totalTokens: parsed.usage.total_tokens
                };
              }
              
              yield chunk;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message ?? error.message;
        throw new Error(`OpenAI streaming error: ${message}`);
      }
      throw error;
    }
  }
}