/**
 * A2A Client Constants
 * 
 * @module a2a-client/a2a/constants
 */

/** Maximum number of sessions to track */
export const MAX_SESSIONS = 1000;

/** Session time-to-live in milliseconds (24 hours) */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Session cleanup interval in milliseconds (1 hour) */
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
