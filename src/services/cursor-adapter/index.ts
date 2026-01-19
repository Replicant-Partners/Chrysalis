/**
 * Cursor Adapter Service Exports
 *
 * This module provides the Cursor Adapter service that bridges
 * system agents to the Cursor IDE agent for complex reasoning tasks.
 *
 * @module services/cursor-adapter
 */

export {
  CursorAdapterServer,
  type CursorRequest,
  type CursorResponse,
  type CursorAdapterConfig,
} from './CursorAdapter';

export default CursorAdapterServer;
