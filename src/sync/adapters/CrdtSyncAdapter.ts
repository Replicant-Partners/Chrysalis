/**
 * CRDT Sync Adapter
 *
 * Interface for SyncedStore/Yjs integration without forcing the dependency.
 * Provides interface for ExperienceSyncManager public/shared collaboration channels.
 *
 * NOTE: SyncedStoreCrdtAdapter is NOT implemented. All methods throw NotImplementedError.
 * Real implementation requires SyncedStore/Yjs WebSocket provider integration.
 */

import { validateId, validateWebSocketUrl, MAX_ID_LENGTH } from './validation';

export class NotImplementedError extends Error {
  constructor(operation: string) {
    super(`${operation} is not implemented`);
    this.name = 'NotImplementedError';
  }
}

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
 * Unimplemented SyncedStore/Yjs adapter.
 *
 * This adapter is NOT functional. All sync operations throw NotImplementedError.
 * Implementation requires SyncedStore/Yjs with WebSocket provider integration.
 *
 * @throws {NotImplementedError} All sync methods throw - no silent failures
 */
export class SyncedStoreCrdtAdapter implements CrdtSyncAdapter {
  private readonly _serverUrl: string;

  constructor(serverUrl: string) {
    validateWebSocketUrl(serverUrl, 'Server URL');
    this._serverUrl = serverUrl;
  }

  async join(opts: CrdtJoinOptions): Promise<void> {
    validateId(opts.channelId, 'Channel ID', MAX_ID_LENGTH);
    if (opts.role && !['viewer', 'editor'].includes(opts.role)) {
      throw new Error('Invalid role. Expected "viewer" or "editor"');
    }
    throw new NotImplementedError('CRDT sync requires SyncedStore/Yjs integration');
  }

  async update(change: CrdtUpdate): Promise<void> {
    validateId(change.docId, 'Document ID', MAX_ID_LENGTH);
    throw new NotImplementedError('CRDT sync requires SyncedStore/Yjs integration');
  }

  async snapshot(docId: string): Promise<CrdtSnapshot> {
    validateId(docId, 'Document ID', MAX_ID_LENGTH);
    throw new NotImplementedError('CRDT sync requires SyncedStore/Yjs integration');
  }

  async close(): Promise<void> {
    return;
  }

  get serverUrl(): string {
    return this._serverUrl;
  }
}
