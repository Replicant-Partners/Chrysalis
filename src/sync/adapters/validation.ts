/**
 * Shared Validation Utilities for Sync Adapters
 *
 * Provides consistent input validation for IDs, URLs, and hex strings
 * across all sync adapter implementations.
 *
 * @module sync/adapters/validation
 */

// ============================================================================
// Constants
// ============================================================================

/** Maximum allowed ID length for most identifiers */
export const MAX_ID_LENGTH = 128;

/** Maximum allowed hash length (SHA-384 = 96 hex chars, with margin) */
export const MAX_HASH_LENGTH = 128;

/** Maximum allowed public key length (Ed25519 = 64 hex chars, with margin) */
export const MAX_PUBLIC_KEY_LENGTH = 256;

/** Allowed characters in IDs: alphanumeric, dash, underscore */
export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Extended ID pattern: also allows dots (for transaction IDs, etc.) */
export const EXTENDED_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

/** Hex string pattern for hashes and keys */
export const HEX_PATTERN = /^[a-fA-F0-9]+$/;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a simple ID (channel ID, document ID).
 * Allows: alphanumeric, dash, underscore
 *
 * @param id - The ID to validate
 * @param label - Human-readable label for error messages
 * @param maxLength - Maximum allowed length (default: 128)
 * @throws Error if validation fails
 */
export function validateId(id: string, label: string, maxLength: number = MAX_ID_LENGTH): void {
  if (!id || typeof id !== 'string') {
    throw new Error(`${label} is required and must be a string`);
  }
  if (id.length > maxLength) {
    throw new Error(`${label} exceeds maximum length of ${maxLength}`);
  }
  if (!ID_PATTERN.test(id)) {
    throw new Error(`${label} contains invalid characters. Allowed: alphanumeric, dash, underscore`);
  }
}

/**
 * Validates an extended ID (transaction ID, agent ID).
 * Allows: alphanumeric, dots, dashes, underscores
 *
 * @param id - The ID to validate
 * @param label - Human-readable label for error messages
 * @param maxLength - Maximum allowed length (default: 128)
 * @throws Error if validation fails
 */
export function validateExtendedId(id: string, label: string, maxLength: number = MAX_ID_LENGTH): void {
  if (!id || typeof id !== 'string') {
    throw new Error(`${label} is required and must be a string`);
  }
  if (id.length > maxLength) {
    throw new Error(`${label} exceeds maximum length of ${maxLength}`);
  }
  if (!EXTENDED_ID_PATTERN.test(id)) {
    throw new Error(`${label} contains invalid characters. Allowed: alphanumeric, dot, dash, underscore`);
  }
}

/**
 * Validates a hex string (hash, public key).
 *
 * @param value - The hex string to validate
 * @param label - Human-readable label for error messages
 * @param maxLength - Maximum allowed length
 * @throws Error if validation fails
 */
export function validateHexString(value: string, label: string, maxLength: number): void {
  if (!value || typeof value !== 'string') {
    throw new Error(`${label} is required and must be a string`);
  }
  if (value.length > maxLength) {
    throw new Error(`${label} exceeds maximum length of ${maxLength}`);
  }
  if (!HEX_PATTERN.test(value)) {
    throw new Error(`${label} must be a valid hex string`);
  }
}

/**
 * Validates an HTTP/HTTPS URL.
 *
 * @param url - The URL to validate
 * @param label - Human-readable label for error messages (default: "URL")
 * @throws Error if validation fails
 */
export function validateHttpUrl(url: string, label: string = 'URL'): void {
  if (!url || typeof url !== 'string') {
    throw new Error(`${label} is required`);
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`${label} has invalid protocol: ${parsed.protocol}. Expected http or https`);
    }
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(`${label} is invalid: ${url}`);
    }
    throw e;
  }
}

/**
 * Validates a WebSocket URL (ws:// or wss://).
 * Also accepts http/https as they can upgrade to WebSocket.
 *
 * @param url - The URL to validate
 * @param label - Human-readable label for error messages (default: "WebSocket URL")
 * @throws Error if validation fails
 */
export function validateWebSocketUrl(url: string, label: string = 'WebSocket URL'): void {
  if (!url || typeof url !== 'string') {
    throw new Error(`${label} is required`);
  }
  try {
    const parsed = new URL(url);
    if (!['ws:', 'wss:', 'http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`${label} has invalid protocol: ${parsed.protocol}. Expected ws, wss, http, or https`);
    }
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(`${label} is invalid: ${url}`);
    }
    throw e;
  }
}

// ============================================================================
// Validation Result Type (for non-throwing validation)
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Safe validation that returns a result instead of throwing.
 * Useful for batch validation or when you want to collect all errors.
 */
export function safeValidateId(id: string, label: string, maxLength?: number): ValidationResult {
  try {
    validateId(id, label, maxLength);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}
