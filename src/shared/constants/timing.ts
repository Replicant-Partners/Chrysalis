/**
 * Timing Constants
 *
 * Named constants for time durations used throughout the codebase.
 * Using named constants instead of magic numbers improves:
 * - Readability: `SYNC_INTERVAL_MS` vs `60000`
 * - Maintainability: Change in one place
 * - Searchability: Find all usages easily
 *
 * @module shared/constants/timing
 */

// ============================================================================
// Time Unit Multipliers (for calculations)
// ============================================================================

/** Milliseconds in one second */
export const MS_PER_SECOND = 1000;
/** Milliseconds in one minute */
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
/** Milliseconds in one hour */
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
/** Milliseconds in one day */
export const MS_PER_DAY = 24 * MS_PER_HOUR;

// ============================================================================
// Sync Intervals
// ============================================================================

/** Default sync interval (1 hour) */
export const DEFAULT_SYNC_INTERVAL_MS = MS_PER_HOUR;
/** Streaming sync check interval (5 seconds) */
export const STREAMING_CHECK_INTERVAL_MS = 5 * MS_PER_SECOND;
/** Lumped sync batch interval (5 minutes) */
export const LUMPED_BATCH_INTERVAL_MS = 5 * MS_PER_MINUTE;
/** Check-in sync interval (1 hour) */
export const CHECKIN_INTERVAL_MS = MS_PER_HOUR;

// ============================================================================
// Health Check & Monitoring
// ============================================================================

/** Health check interval (1 minute) */
export const HEALTH_CHECK_INTERVAL_MS = MS_PER_MINUTE;
/** Metrics collection interval (30 seconds) */
export const METRICS_INTERVAL_MS = 30 * MS_PER_SECOND;
/** Liveness probe timeout (10 seconds) */
export const LIVENESS_TIMEOUT_MS = 10 * MS_PER_SECOND;

// ============================================================================
// Network & Retry
// ============================================================================

/** Default HTTP request timeout (30 seconds) */
export const HTTP_TIMEOUT_MS = 30 * MS_PER_SECOND;
/** Retry backoff base (1 second) */
export const RETRY_BACKOFF_BASE_MS = MS_PER_SECOND;
/** Maximum retry backoff (30 seconds) */
export const RETRY_BACKOFF_MAX_MS = 30 * MS_PER_SECOND;
/** Circuit breaker reset timeout (60 seconds) */
export const CIRCUIT_BREAKER_RESET_MS = MS_PER_MINUTE;

// ============================================================================
// Buffer & History Limits
// ============================================================================

/** Maximum events to keep in history */
export const MAX_EVENT_HISTORY = 1000;
/** Maximum log entries to buffer */
export const MAX_LOG_BUFFER = 500;
/** Maximum memories in working memory */
export const MAX_WORKING_MEMORY = 100;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse a time string like "5m", "1h", "30s" to milliseconds.
 *
 * @param timeStr - Time string with unit suffix (ms, s, m, h, d)
 * @param defaultMs - Default value if parsing fails
 * @returns Milliseconds
 *
 * @example
 * parseTimeString("5m") // 300000
 * parseTimeString("1h") // 3600000
 * parseTimeString("30s") // 30000
 */
export function parseTimeString(timeStr: string, defaultMs: number = DEFAULT_SYNC_INTERVAL_MS): number {
  const match = timeStr.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return defaultMs;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'ms': return value;
    case 's': return value * MS_PER_SECOND;
    case 'm': return value * MS_PER_MINUTE;
    case 'h': return value * MS_PER_HOUR;
    case 'd': return value * MS_PER_DAY;
    default: return defaultMs;
  }
}

/**
 * Format milliseconds as a human-readable duration.
 *
 * @param ms - Duration in milliseconds
 * @returns Human-readable string like "5m", "1h 30m"
 */
export function formatDuration(ms: number): string {
  if (ms < MS_PER_SECOND) return `${ms}ms`;
  if (ms < MS_PER_MINUTE) return `${Math.round(ms / MS_PER_SECOND)}s`;
  if (ms < MS_PER_HOUR) return `${Math.round(ms / MS_PER_MINUTE)}m`;
  if (ms < MS_PER_DAY) {
    const hours = Math.floor(ms / MS_PER_HOUR);
    const mins = Math.round((ms % MS_PER_HOUR) / MS_PER_MINUTE);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(ms / MS_PER_DAY);
  const hours = Math.round((ms % MS_PER_DAY) / MS_PER_HOUR);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}
