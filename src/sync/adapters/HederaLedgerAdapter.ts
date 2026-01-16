/**
 * Hedera Ledger Adapter
 *
 * Intended for Hedera subnet/mainnet integration without forcing the dependency.
 * Provides interface for secure commits and queries.
 *
 * NOTE: Methods throw NotImplementedError until Hedera SDK is integrated.
 * Do not catch and ignore these errors - they indicate required integration work.
 */

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

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
 * Hedera adapter for ledger operations.
 *
 * All mutation methods throw NotImplementedError until Hedera SDK is integrated.
 * Configuration is validated at construction time.
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
    throw new NotImplementedError('Hedera SDK integration required for ledger commits');
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
    throw new NotImplementedError('Hedera SDK integration required for ledger queries');
  }

  async keyRotate(req: LedgerKeyRotateRequest): Promise<LedgerCommitResponse> {
    validateExtendedId(req.agentId, 'Agent ID', MAX_ID_LENGTH);
    validateHexString(req.newPublicKey, 'Public key', MAX_PUBLIC_KEY_LENGTH);
    throw new NotImplementedError('Hedera SDK integration required for key rotation');
  }
}
