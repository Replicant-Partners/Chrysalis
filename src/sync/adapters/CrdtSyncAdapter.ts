/**
 * CRDT Sync Adapter (stub)
 *
 * Intended for SyncedStore/Yjs integration without forcing the dependency.
 * Provides interface + placeholder implementation to wire into ExperienceSyncManager
 * for public/shared collaboration channels.
 */

export interface CrdtJoinOptions {
  channelId: string;
  role?: 'viewer' | 'editor';
  redact?: boolean;
}

export interface CrdtUpdate {
  docId: string;
  payload: any;
}

export interface CrdtSnapshot {
  docId: string;
  hash: string;
  snapshot: any;
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
 */
export class SyncedStoreCrdtAdapter implements CrdtSyncAdapter {
  private readonly serverUrl: string;
  private connected = false;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async join(_opts: CrdtJoinOptions): Promise<void> {
    // TODO: initialize WebSocket provider + syncedStore doc for channel
    this.connected = true;
    return;
  }

  async update(_change: CrdtUpdate): Promise<void> {
    if (!this.connected) throw new Error('CRDT adapter not joined');
    // TODO: apply Yjs update to doc
    return;
  }

  async snapshot(docId: string): Promise<CrdtSnapshot> {
    if (!this.connected) throw new Error('CRDT adapter not joined');
    // TODO: compute hash of doc state; return snapshot
    return { docId, hash: '', snapshot: {}, version: 0 };
  }

  async close(): Promise<void> {
    this.connected = false;
  }
}
