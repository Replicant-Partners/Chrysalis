/**
 * RPC and HTTP Handling
 * 
 * JSON-RPC request/response handling and HTTP fetch with retry.
 * 
 * @module a2a-client/a2a/rpc
 */

import { encodeBasicAuth } from '../../shared/encoding';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  A2AAuthConfig,
  A2A_ERROR_CODES
} from '../types';
import { parseStreamEvent, ValidatedStreamEvent } from '../schemas';
import { A2AError } from './error';

export interface RpcConfig {
  timeout?: number;
  retryEnabled?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  auth?: A2AAuthConfig;
}

export interface RpcStats {
  streamEventsReceived: number;
  streamEventsInvalid: number;
}

export interface RpcEvents {
  onLog?: (level: 'debug' | 'info' | 'error', message: string) => void;
  onStreamValidationError?: (error: unknown, rawData: string) => void;
  onStreamParseError?: (error: unknown, rawData: string) => void;
}

export class RpcClient {
  private requestId: number = 0;
  private config: RpcConfig;
  private stats: RpcStats = {
    streamEventsReceived: 0,
    streamEventsInvalid: 0
  };
  private events: RpcEvents;
  
  constructor(config: RpcConfig, events: RpcEvents = {}) {
    this.config = {
      timeout: 30000,
      retryEnabled: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
    this.events = events;
  }
  
  async rpc<T>(agentUrl: string, method: string, params?: unknown): Promise<T> {
    const response = await this.httpRequest<JsonRpcResponse<T>>(
      agentUrl,
      this.createRequest(method, params)
    );
    
    if (response.error) {
      throw new A2AError(response.error.code, response.error.message, response.error.data);
    }
    
    return response.result as T;
  }
  
  async streamRpc(agentUrl: string, method: string, params?: unknown): Promise<ReadableStream<Uint8Array>> {
    const response = await this.postRequest(agentUrl, this.createRequest(method, params));
    
    if (!response.body) {
      throw new A2AError(A2A_ERROR_CODES.INTERNAL_ERROR, 'No response body for streaming');
    }
    
    return response.body;
  }
  
  async *parseStreamEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<ValidatedStreamEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            const event = this.parseAndValidateEvent(line);
            if (event) {
              yield event;
            }
          }
        }
      }
      
      if (buffer.trim()) {
        const event = this.parseAndValidateEvent(buffer);
        if (event) {
          yield event;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  getStats(): RpcStats {
    return { ...this.stats };
  }
  
  updateConfig(config: Partial<RpcConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  private parseAndValidateEvent(line: string): ValidatedStreamEvent | null {
    this.stats.streamEventsReceived++;
    
    try {
      const parsed = JSON.parse(line);
      const result = parseStreamEvent(parsed);
      
      if (result.success && result.data) {
        return result.data;
      }
      
      this.stats.streamEventsInvalid++;
      this.events.onLog?.('error', `Invalid stream event schema: ${result.error?.message}`);
      this.events.onStreamValidationError?.(result.error, line);
      
      return null;
    } catch (e) {
      this.stats.streamEventsInvalid++;
      this.events.onLog?.('error', `Failed to parse stream event JSON: ${line}`);
      this.events.onStreamParseError?.(e, line);
      
      return null;
    }
  }
  
  private createRequest(method: string, params?: unknown): JsonRpcRequest {
    return {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params
    };
  }
  
  private async postRequest(agentUrl: string, request: JsonRpcRequest): Promise<Response> {
    return this.fetchWithRetry(agentUrl, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(request),
    });
  }
  
  private async httpRequest<T>(agentUrl: string, request: JsonRpcRequest): Promise<T> {
    const response = await this.postRequest(agentUrl, request);
    return response.json() as Promise<T>;
  }
  
  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error | undefined;
    const maxRetries = this.config.retryEnabled ? (this.config.maxRetries || 3) : 1;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.status >= 400 && response.status < 500) {
          return response;
        }
        
        if (response.status >= 500) {
          lastError = new Error(`Server error: ${response.status}`);
          await this.sleep(this.config.retryDelay || 1000);
          continue;
        }
        
        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          await this.sleep(this.config.retryDelay || 1000);
        }
      }
    }
    
    throw A2AError.from(lastError, A2A_ERROR_CODES.INTERNAL_ERROR);
  }
  
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...this.config.headers
    };
    
    if (this.config.auth) {
      const authHeader = this.buildAuthHeader(this.config.auth);
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
    }
    
    return headers;
  }
  
  private buildAuthHeader(auth: A2AAuthConfig): string | undefined {
    switch (auth.scheme) {
      case 'Bearer':
        return auth.token ? `Bearer ${auth.token}` : undefined;
      
      case 'Basic':
        if (auth.username && auth.password) {
          const credentials = encodeBasicAuth(auth.username, auth.password);
          return `Basic ${credentials}`;
        }
        return undefined;
      
      case 'APIKey':
        return auth.apiKey;
      
      case 'Custom':
        return auth.customValue;
      
      default:
        return undefined;
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
