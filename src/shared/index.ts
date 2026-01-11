/**
 * Shared Utilities Module
 * 
 * Central export point for all shared utilities used across the Chrysalis platform.
 * 
 * @module shared
 * @version 1.0.0
 */

// Encoding utilities
export {
  base64Encode,
  base64Decode,
  encodeBasicAuth,
  isBrowser,
  isNode
} from './encoding';

// HTTP client
export {
  HttpClient,
  HttpClientError,
  createHttpClient,
  createJsonApiClient,
  createStreamClient,
  type HttpMethod,
  type HttpClientConfig,
  type RequestOptions,
  type RetryConfig,
  type AuthConfig,
  type RequestInterceptor,
  type ResponseInterceptor
} from './http-client';

// Rate limiter
export {
  RateLimiter,
  RateLimitExceededError,
  createRateLimiter,
  createRateLimitHeaders,
  type RateLimiterConfig,
  type RateLimitResult
} from './rate-limiter';
