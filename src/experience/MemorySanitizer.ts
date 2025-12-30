/**
 * Basic content sanitizer for memory ingest.
 * Blocks obvious script/HTML and control chars; trims excessively long inputs.
 */

export interface SanitizeResult {
  ok: boolean;
  content: string;
  reason?: string;
}

export interface SanitizerOptions {
  maxLength?: number;
  blockHtml?: boolean;
  blockScripts?: boolean;
}

const DEFAULT_MAX = 4000;

export function defaultMemorySanitizer(content: string, _source: string, opts?: SanitizerOptions): SanitizeResult {
  const maxLength = opts?.maxLength ?? DEFAULT_MAX;
  const blockHtml = opts?.blockHtml ?? true;
  const blockScripts = opts?.blockScripts ?? true;

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
  const cleaned = content.replace(/[\u0000-\u001f\u007f]/g, '');

  return { ok: true, content: cleaned };
}
