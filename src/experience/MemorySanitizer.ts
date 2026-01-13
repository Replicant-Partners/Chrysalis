/**
 * Memory Sanitizer for memory ingest.
 * 
 * Provides two levels of protection:
 * 1. XSS/Injection: Blocks script tags, HTML, javascript: URLs
 * 2. PII Detection: Redacts emails, phones, SSNs, credit cards, IPs
 * 
 * Aligned with Python memory_system/sanitization.py for cross-language consistency.
 */

export interface SanitizeResult {
  ok: boolean;
  content: string;
  reason?: string;
  piiDetected?: string[];
}

export interface SanitizerOptions {
  maxLength?: number;
  blockHtml?: boolean;
  blockScripts?: boolean;
  redactPii?: boolean;
}

const DEFAULT_MAX = 4000;

/**
 * PII patterns aligned with Python memory_system/sanitization.py
 */
const PII_PATTERNS: Record<string, RegExp> = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  credit_card: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ipv4: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
};

/**
 * Detect and redact PII from content
 * Returns the sanitized content and list of detected PII types
 */
export function sanitizePii(content: string): { content: string; detected: string[] } {
  const detected: string[] = [];
  let sanitized = content;

  for (const [piiType, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern.test(sanitized)) {
      if (!detected.includes(piiType)) {
        detected.push(piiType);
      }
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, `[REDACTED ${piiType.toUpperCase()}]`);
    }
  }

  return { content: sanitized, detected };
}

/**
 * Default memory sanitizer with XSS protection and optional PII redaction
 */
export function defaultMemorySanitizer(content: string, _source: string, opts?: SanitizerOptions): SanitizeResult {
  const maxLength = opts?.maxLength ?? DEFAULT_MAX;
  const blockHtml = opts?.blockHtml ?? true;
  const blockScripts = opts?.blockScripts ?? true;
  const redactPii = opts?.redactPii ?? true;

  if (!content || !content.trim()) {
    return { ok: false, content, reason: 'empty' };
  }

  if (content.length > maxLength) {
    return { ok: false, content: content.slice(0, maxLength), reason: 'too_long' };
  }

  if (blockHtml && /<\s*script/i.test(content)) {
    return { ok: false, content, reason: 'script_tag' };
  }

  if (blockScripts && /\bjavascript:/i.test(content)) {
    return { ok: false, content, reason: 'javascript_url' };
  }

  if (blockHtml && /<[^>]+>/.test(content)) {
    return { ok: false, content, reason: 'html_tag' };
  }

  // Strip control chars except whitespace
  let cleaned = content.replace(/[\u0000-\u001f\u007f]/g, '');

  // Redact PII if enabled
  let piiDetected: string[] | undefined;
  if (redactPii) {
    const piiResult = sanitizePii(cleaned);
    cleaned = piiResult.content;
    if (piiResult.detected.length > 0) {
      piiDetected = piiResult.detected;
    }
  }

  return { ok: true, content: cleaned, piiDetected };
}

/**
 * Validate and sanitize metadata values (mirrors Python validate_metadata)
 */
export function sanitizeMetadata(
  metadata: Record<string, unknown>
): { metadata: Record<string, unknown>; piiDetected: string[] } {
  const sanitized: Record<string, unknown> = {};
  const allDetected: string[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      const result = sanitizePii(value);
      sanitized[key] = result.content;
      allDetected.push(...result.detected);
    } else {
      sanitized[key] = value;
    }
  }

  return { metadata: sanitized, piiDetected: [...new Set(allDetected)] };
}
