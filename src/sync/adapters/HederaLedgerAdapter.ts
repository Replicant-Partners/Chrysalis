/**
 * Hedera Ledger Adapter (stub)
 *
 * Intended for Hedera subnet/mainnet integration without forcing the dependency.
 * Provides interface + placeholder implementation for secure commits and queries.
 */

import {
  validateExtendedId,
  validateHexString,
  validateHttpUrl,
  MAX_ID_LENGTH,
  MAX_HASH_LENGTH,
  MAX_PUBLIC_KEY_LENGTH,
} from './validation';

export interface LedgerCommitRequest {
  type: string;
  hash: string;
  metadata?: Record<string, unknown>;
  payloadUri?: string; // off-ledger encrypted payload location
}

export interface LedgerCommitResponse {
  txId: string;
  hash: string;
}

export interface LedgerQueryResponse {
  txId: string;
  status: 'pending' | 'confirmed' | 'failed';
  hash?: string;
  block?: number;
}

export interface LedgerKeyRotateRequest {
  agentId: string;
  newPublicKey: string;
}

export interface LedgerAdapter {
  commit(req: LedgerCommitRequest): Promise<LedgerCommitResponse>;
  query(ref: { txId?: string; hash?: string }): Promise<LedgerQueryResponse>;
  keyRotate(req: LedgerKeyRotateRequest): Promise<LedgerCommitResponse>;
}

/**
 * Placeholder Hedera adapter. Replace with Hedera SDK client calls.
 *
 * NOTE: This is a stub implementation. The endpoint and network are validated
 * and stored for future use when the real Hedera SDK integration is implemented.
 */
export class HederaLedgerAdapter implements LedgerAdapter {
  // Stored for future implementation (will be used for Hedera SDK client)
  private readonly _endpoint: string;
  private readonly _network: 'subnet' | 'mainnet';

  constructor(opts: { endpoint: string; network?: 'subnet' | 'mainnet' }) {
    validateHttpUrl(opts.endpoint, 'Endpoint');
    this._endpoint = opts.endpoint;
    this._network = opts.network ?? 'subnet';
    // Note: Configuration is validated and stored for future Hedera SDK client
  }

  /** Get the configured endpoint (for debugging/testing) */
  get endpoint(): string {
    return this._endpoint;
  }

  /** Get the configured network (for debugging/testing) */
  get network(): 'subnet' | 'mainnet' {
    return this._network;
  }

  async commit(req: LedgerCommitRequest): Promise<LedgerCommitResponse> {
    if (!req.type || typeof req.type !== 'string') {
      throw new Error('Commit type is required');
    }
    validateHexString(req.hash, 'Hash', MAX_HASH_LENGTH);
    if (req.payloadUri) {
      validateHttpUrl(req.payloadUri, 'Payload URI');
    }
    // TODO: integrate Hedera SDK for submitTransaction
    return { txId: `stub-${Date.now()}`, hash: req.hash };
  }

  async query(ref: { txId?: string; hash?: string }): Promise<LedgerQueryResponse> {
    if (!ref.txId && !ref.hash) {
      throw new Error('Either txId or hash is required for query');
    }
    if (ref.txId) {
      validateExtendedId(ref.txId, 'Transaction ID', MAX_ID_LENGTH);
    }
    if (ref.hash) {
      validateHexString(ref.hash, 'Hash', MAX_HASH_LENGTH);
    }
    // TODO: integrate Hedera SDK for queryTransaction/record
    return { txId: ref.txId || '', status: 'pending', hash: ref.hash };
  }

  async keyRotate(req: LedgerKeyRotateRequest): Promise<LedgerCommitResponse> {
    validateExtendedId(req.agentId, 'Agent ID', MAX_ID_LENGTH);
    validateHexString(req.newPublicKey, 'Public key', MAX_PUBLIC_KEY_LENGTH);
    // TODO: integrate Hedera SDK for key update transaction
    return { txId: `keyrotate-${Date.now()}`, hash: req.newPublicKey };
  }
}
