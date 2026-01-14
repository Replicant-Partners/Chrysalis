/**
 * CRDT Sync Adapter (stub)
 *
 * Intended for SyncedStore/Yjs integration without forcing the dependency.
 * Provides interface + placeholder implementation to wire into ExperienceSyncManager
 * for public/shared collaboration channels.
 */

import { validateId, validateWebSocketUrl, MAX_ID_LENGTH } from './validation';

export interface CrdtJoinOptions {
  channelId: string;
  role?: 'viewer' | 'editor';
  redact?: boolean;
}

export interface CrdtUpdate {
  docId: string;
  payload: unknown;
}

export interface CrdtSnapshot {
  docId: string;
  hash: string;
  snapshot: unknown;
  version?: number;
}

export interface CrdtSyncAdapter {
  join(opts: CrdtJoinOptions): Promise<void>;
  update(change: CrdtUpdate): Promise<void>;
  snapshot(docId: string): Promise<CrdtSnapshot>;
  close(): Promise<void>;
}

/**
 * Placeholder SyncedStore/Yjs adapter.
 * Replace stubs with real SyncedStore wiring (WebSocket provider + syncedStore docs).
 *
 * NOTE: This is a stub implementation. The serverUrl is validated and stored
 * for future use when the real Yjs/SyncedStore integration is implemented.
 */
export class SyncedStoreCrdtAdapter implements CrdtSyncAdapter {
  // Stored for future implementation (will be used for WebSocket connection)
  private readonly _serverUrl: string;
  private _connected = false;

  constructor(serverUrl: string) {
    validateWebSocketUrl(serverUrl, 'Server URL');
    this._serverUrl = serverUrl;
    // Note: URL is validated and stored for future WebSocket connection
  }

  async join(opts: CrdtJoinOptions): Promise<void> {
    validateId(opts.channelId, 'Channel ID', MAX_ID_LENGTH);
    if (opts.role && !['viewer', 'editor'].includes(opts.role)) {
      throw new Error('Invalid role. Expected "viewer" or "editor"');
    }
    // TODO: initialize WebSocket provider to this._serverUrl + syncedStore doc for channel
    this._connected = true;
    return;
  }

  async update(change: CrdtUpdate): Promise<void> {
    if (!this._connected) throw new Error('CRDT adapter not joined');
    validateId(change.docId, 'Document ID', MAX_ID_LENGTH);
    // TODO: apply Yjs update to doc
    return;
  }

  async snapshot(docId: string): Promise<CrdtSnapshot> {
    if (!this._connected) throw new Error('CRDT adapter not joined');
    validateId(docId, 'Document ID', MAX_ID_LENGTH);
    // TODO: compute hash of doc state; return snapshot
    return { docId, hash: '', snapshot: {}, version: 0 };
  }

  async close(): Promise<void> {
    this._connected = false;
  }

  /** Get the configured server URL (for debugging/testing) */
  get serverUrl(): string {
    return this._serverUrl;
  }
}
