/**
 * Shared HTTP Client Utility
 * 
 * Provides unified HTTP client functionality for A2A, MCP, and adapter components.
 * Addresses code duplication identified in code review.
 * 
 * Features:
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Streaming support
 * - Authentication header building
 * - Request/response interceptors
 * 
 * @module shared/http-client
 * @version 1.0.0
 */

import { encodeBasicAuth } from './encoding';

// ============================================================================
// Types
// ============================================================================

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Enable retry logic */
  enabled: boolean;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in milliseconds */
  baseDelay: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay?: number;
  /** Use exponential backoff */
  exponentialBackoff?: boolean;
  /** Retry on specific HTTP status codes */
  retryOnStatusCodes?: number[];
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** Authentication scheme */
  scheme: 'Bearer' | 'Basic' | 'APIKey' | 'Custom' | 'None';
  /** Bearer token */
  token?: string;
  /** Username for Basic auth */
  username?: string;
  /** Password for Basic auth */
  password?: string;
  /** API key value */
  apiKey?: string;
  /** Custom header name (for APIKey or Custom) */
  headerName?: string;
  /** Custom header value */
  customValue?: string;
}

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  /** Base URL for all requests */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Authentication configuration */
  auth?: AuthConfig;
  /** Default headers */
  headers?: Record<string, string>;
  /** Retry configuration */
  retry: RetryConfig;
  /** Enable debug logging */
  debug?: boolean;
  /** Logger function */
  logger?: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
}

/**
 * Request options
 */
export interface RequestOptions {
  /** HTTP method */
  method?: HttpMethod;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  /** Override timeout for this request */
  timeout?: number;
  /** Override retry config for this request */
  retry?: Partial<RetryConfig>;
  /** Request signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Request interceptor function
 */
export type RequestInterceptor = (
  url: string,
  options: RequestInit
) => Promise<{ url: string; options: RequestInit }> | { url: string; options: RequestInit };

/**
 * Response interceptor function
 */
export type ResponseInterceptor = (
  response: Response
) => Promise<Response> | Response;

/**
 * HTTP client error with additional context
 */
export class HttpClientError extends Error {
  readonly statusCode?: number;
  readonly statusText?: string;
  readonly url: string;
  readonly method: string;
  readonly retryCount: number;
  readonly response?: Response;

  constructor(
    message: string,
    details: {
      url: string;
      method: string;
      statusCode?: number;
      statusText?: string;
      retryCount?: number;
      response?: Response;
      cause?: Error;
    }
  ) {
    super(message, { cause: details.cause });
    this.name = 'HttpClientError';
    this.url = details.url;
    this.method = details.method;
    this.statusCode = details.statusCode;
    this.statusText = details.statusText;
    this.retryCount = details.retryCount ?? 0;
    this.response = details.response;
    
    Object.setPrototypeOf(this, HttpClientError.prototype);
  }

  /**
   * Check if error is a timeout error
   */
  isTimeout(): boolean {
    return this.message.includes('timeout') || this.message.includes('aborted');
  }

  /**
   * Check if error is a network error
   */
  isNetworkError(): boolean {
    return !this.statusCode && !this.isTimeout();
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 500;
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 400 && this.statusCode < 500;
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: HttpClientConfig = {
  timeout: 30000,
  retry: {
    enabled: true,
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBackoff: true,
    retryOnStatusCodes: [500, 502, 503, 504, 408, 429]
  }
};

// ============================================================================
// HTTP Client Class
// ============================================================================

/**
 * Unified HTTP client with retry logic, authentication, and streaming support.
 * 
 * @example
 * ```typescript
 * const client = new HttpClient({
 *   baseUrl: 'https://api.example.com',
 *   timeout: 10000,
 *   auth: { scheme: 'Bearer', token: 'your-token' },
 *   retry: { enabled: true, maxRetries: 3, baseDelay: 1000 }
 * });
 * 
 * // JSON request
 * const data = await client.json('/users', { method: 'GET' });
 * 
 * // Streaming request
 * const stream = await client.stream('/events', { method: 'GET' });
 * ```
 */
export class HttpClient {
  private config: HttpClientConfig;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(config?: Partial<HttpClientConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      retry: {
        ...DEFAULT_CONFIG.retry,
        ...config?.retry
      }
    };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Add a request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add a response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Clear all interceptors
   */
  clearInterceptors(): void {
    this.requestInterceptors = [];
    this.responseInterceptors = [];
  }

  /**
   * Make a request and parse JSON response
   */
  async json<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
    const response = await this.request(url, options);
    return response.json() as Promise<T>;
  }

  /**
   * Make a request and get text response
   */
  async text(url: string, options?: RequestOptions): Promise<string> {
    const response = await this.request(url, options);
    return response.text();
  }

  /**
   * Make a request and get ReadableStream response
   */
  async stream(url: string, options?: RequestOptions): Promise<ReadableStream<Uint8Array>> {
    const response = await this.request(url, {
      ...options,
      headers: {
        ...options?.headers,
        'Accept': 'text/event-stream, application/json'
      }
    });

    if (!response.body) {
      throw new HttpClientError('No response body for streaming', {
        url: this.buildUrl(url),
        method: options?.method || 'GET'
      });
    }

    return response.body;
  }

  /**
   * Make a raw HTTP request with retry logic
   */
  async request(url: string, options?: RequestOptions): Promise<Response> {
    const fullUrl = this.buildUrl(url, options?.params);
    const method = options?.method || 'GET';
    const requestOptions = this.buildRequestOptions(options);
    
    // Apply request interceptors
    let finalUrl = fullUrl;
    let finalOptions = requestOptions;
    
    for (const interceptor of this.requestInterceptors) {
      const result = await interceptor(finalUrl, finalOptions);
      finalUrl = result.url;
      finalOptions = result.options;
    }

    const retryConfig = {
      ...this.config.retry,
      ...options?.retry
    };

    const maxAttempts = retryConfig.enabled ? retryConfig.maxRetries + 1 : 1;
    let lastError: Error | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      retryCount = attempt;
      
      try {
        this.log('debug', `Request attempt ${attempt + 1}: ${method} ${finalUrl}`);
        
        let response = await this.executeRequest(finalUrl, finalOptions, options?.timeout);

        // Apply response interceptors
        for (const interceptor of this.responseInterceptors) {
          response = await interceptor(response);
        }

        // Check if we should retry based on status code
        if (
          retryConfig.enabled &&
          retryConfig.retryOnStatusCodes?.includes(response.status) &&
          attempt < maxAttempts - 1
        ) {
          lastError = new HttpClientError(`Server returned ${response.status}`, {
            url: finalUrl,
            method,
            statusCode: response.status,
            statusText: response.statusText,
            retryCount,
            response
          });
          
          await this.delay(this.calculateDelay(attempt, retryConfig));
          continue;
        }

        // Don't retry on client errors
        if (response.status >= 400 && response.status < 500) {
          throw new HttpClientError(`Client error: ${response.status} ${response.statusText}`, {
            url: finalUrl,
            method,
            statusCode: response.status,
            statusText: response.statusText,
            retryCount,
            response
          });
        }

        // Don't retry successful responses
        if (response.ok) {
          return response;
        }

        // Server error without retry
        throw new HttpClientError(`Server error: ${response.status} ${response.statusText}`, {
          url: finalUrl,
          method,
          statusCode: response.status,
          statusText: response.statusText,
          retryCount,
          response
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry HttpClientError with 4xx status
        if (error instanceof HttpClientError && error.isClientError()) {
          throw error;
        }

        // Check if we should retry
        if (attempt < maxAttempts - 1 && retryConfig.enabled) {
          this.log('warn', `Request failed (attempt ${attempt + 1}): ${lastError.message}`);
          await this.delay(this.calculateDelay(attempt, retryConfig));
          continue;
        }
      }
    }

    // All retries exhausted
    throw new HttpClientError(
      `Request failed after ${retryCount + 1} attempts: ${lastError?.message || 'Unknown error'}`,
      {
        url: finalUrl,
        method,
        retryCount,
        cause: lastError
      }
    );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Execute a single HTTP request with timeout
   */
  private async executeRequest(
    url: string,
    options: RequestInit,
    timeoutMs?: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = timeoutMs ?? this.config.timeout;
    
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      // Merge signals if one was provided
      const signal = options.signal
        ? this.mergeAbortSignals(options.signal, controller.signal)
        : controller.signal;

      return await fetch(url, {
        ...options,
        signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Build full URL with base URL and query params
   */
  private buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
    let url = path;
    
    // Add base URL if path is relative
    if (this.config.baseUrl && !path.startsWith('http://') && !path.startsWith('https://')) {
      url = `${this.config.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    }

    // Add query parameters
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        searchParams.set(key, String(value));
      }
      url += (url.includes('?') ? '&' : '?') + searchParams.toString();
    }

    return url;
  }

  /**
   * Build RequestInit options from RequestOptions
   */
  private buildRequestOptions(options?: RequestOptions): RequestInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...this.config.headers,
      ...options?.headers
    };

    // Add auth header
    const authHeader = this.buildAuthHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const init: RequestInit = {
      method: options?.method || 'GET',
      headers,
      signal: options?.signal
    };

    // Add body if present
    if (options?.body !== undefined) {
      init.body = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
    }

    return init;
  }

  /**
   * Build authorization header based on config
   */
  private buildAuthHeader(): string | undefined {
    const auth = this.config.auth;
    if (!auth || auth.scheme === 'None') {
      return undefined;
    }

    switch (auth.scheme) {
      case 'Bearer':
        return auth.token ? `Bearer ${auth.token}` : undefined;
      
      case 'Basic':
        if (auth.username && auth.password) {
          return `Basic ${encodeBasicAuth(auth.username, auth.password)}`;
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

  /**
   * Calculate delay for retry with optional exponential backoff
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay;
    
    if (config.exponentialBackoff) {
      delay = Math.min(
        config.baseDelay * Math.pow(2, attempt),
        config.maxDelay ?? 30000
      );
      // Add jitter (±10%)
      delay = delay * (0.9 + Math.random() * 0.2);
    }

    return Math.round(delay);
  }

  /**
   * Merge two AbortSignals
   */
  private mergeAbortSignals(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
    const controller = new AbortController();
    
    const abort = () => controller.abort();
    
    signal1.addEventListener('abort', abort);
    signal2.addEventListener('abort', abort);
    
    return controller.signal;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log message
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    if (this.config.debug || level === 'error' || level === 'warn') {
      if (this.config.logger) {
        this.config.logger(level, `[HttpClient] ${message}`);
      } else {
        const prefix = `[HttpClient] [${level.toUpperCase()}]`;
        if (level === 'error') {
          console.error(`${prefix} ${message}`);
        } else if (level === 'warn') {
          console.warn(`${prefix} ${message}`);
        } else {
          console.log(`${prefix} ${message}`);
        }
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new HTTP client instance
 */
export function createHttpClient(config?: Partial<HttpClientConfig>): HttpClient {
  return new HttpClient(config);
}

/**
 * Create an HTTP client with default JSON API settings
 */
export function createJsonApiClient(baseUrl: string, auth?: AuthConfig): HttpClient {
  return new HttpClient({
    baseUrl,
    auth,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
}

/**
 * Create an HTTP client for streaming endpoints
 */
export function createStreamClient(baseUrl: string, auth?: AuthConfig): HttpClient {
  return new HttpClient({
    baseUrl,
    auth,
    timeout: 120000, // Longer timeout for streams
    headers: {
      'Accept': 'text/event-stream, application/json'
    }
  });
}

// ============================================================================
// Exports
// ============================================================================

export default HttpClient;
