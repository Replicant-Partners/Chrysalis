// @ts-nocheck
/**
 * ApiKeyRegistry - logical registry for API key metadata and access scoping.
 *
 * Complements ApiKeyWallet (which stores encrypted secrets) by providing
 * contextual metadata: allowed personas/agents, scope, rate limits, and tags.
 * Does NOT store raw secrets; only references wallet key IDs.
 *
 * Typical flow:
 * - Register key metadata with a wallet keyId and provider.
 * - Query allowed keys per persona/agent/service to hydrate runtime env.
 * - Optionally resolve secrets via ApiKeyWallet when authorized.
 */

import { ApiKeyProvider, ApiKeyWallet } from './ApiKeyWallet';
import { createLogger } from '../shared/logger';

export type ApiKeyScope = 'global' | 'persona' | 'service';

export interface ApiKeyRegistryRecord {
  /** Logical registry ID (distinct from wallet keyId) */
  id: string;
  /** Wallet key provider enum (openai, anthropic, etc.) */
  provider: ApiKeyProvider;
  /** Reference to the wallet keyId (no secret stored here) */
  keyId: string;
  /** Human-readable description/context */
  description: string;
  /** Scope of use */
  scope: ApiKeyScope;
  /** Allowed agent bridge IDs (optional) */
  allowedAgents?: string[];
  /** Allowed persona IDs (optional) */
  allowedPersonas?: string[];
  /** Optional rate limit hints */
  rateLimit?: { rpm?: number; tpm?: number };
  /** Optional expiration */
  expiresAt?: Date;
  /** Tags for grouping/filtering */
  tags?: string[];
  /** Creation timestamp */
  createdAt: Date;
}

type KeyRegistryEventType = 'key:registered' | 'key:unregistered';

export interface KeyRegistryEvent {
  type: KeyRegistryEventType;
  keyId: string;
  timestamp: number;
  payload?: unknown;
}

export type KeyRegistryEventHandler = (event: KeyRegistryEvent) => void;

export class ApiKeyRegistry {
  private records: Map<string, ApiKeyRegistryRecord> = new Map();
  private eventHandlers: Map<KeyRegistryEventType, Set<KeyRegistryEventHandler>> = new Map();
  private log = createLogger('api-key-registry');

  register(record: ApiKeyRegistryRecord): void {
    if (this.records.has(record.id)) {
      throw new Error(`Key registry id '${record.id}' already exists`);
    }
    this.records.set(record.id, record);
    this.emit({
      type: 'key:registered',
      keyId: record.id,
      timestamp: Date.now(),
      payload: { provider: record.provider, scope: record.scope }
    });
  }

  unregister(id: string): void {
    if (!this.records.has(id)) return;
    this.records.delete(id);
    this.emit({ type: 'key:unregistered', keyId: id, timestamp: Date.now() });
  }

  get(id: string): ApiKeyRegistryRecord | undefined {
    return this.records.get(id);
  }

  list(): ApiKeyRegistryRecord[] {
    return Array.from(this.records.values());
  }

  findByProvider(provider: ApiKeyProvider): ApiKeyRegistryRecord[] {
    return this.list().filter(r => r.provider === provider);
  }

  findAllowedForPersona(personaId: string): ApiKeyRegistryRecord[] {
    return this.list().filter(r =>
      r.scope === 'global' ||
      (r.allowedPersonas?.includes(personaId) ?? false)
    );
  }

  findAllowedForAgent(agentId: string): ApiKeyRegistryRecord[] {
    return this.list().filter(r =>
      r.scope === 'global' ||
      (r.allowedAgents?.includes(agentId) ?? false)
    );
  }

  /**
   * Resolve secrets for a persona using an ApiKeyWallet (must be unlocked).
   * Returns provider -> apiKey map for keys that are both registered and authorized.
   */
  async resolveKeysForPersona(wallet: ApiKeyWallet, personaId: string): Promise<Record<string, string>> {
    const authorized = this.findAllowedForPersona(personaId);
    const result: Record<string, string> = {};
    for (const rec of authorized) {
      const secret = wallet.getKeyById(rec.keyId);
      if (secret) {
        result[rec.provider] = secret;
      }
    }
    return result;
  }

  on(eventType: KeyRegistryEventType, handler: KeyRegistryEventHandler): () => void {
    const handlers = this.eventHandlers.get(eventType) ?? new Set();
    handlers.add(handler);
    this.eventHandlers.set(eventType, handlers);
    return () => this.off(eventType, handler);
  }

  off(eventType: KeyRegistryEventType, handler: KeyRegistryEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: KeyRegistryEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          this.log.error('key registry event handler error', { event: event.type, error });
        }
      }
    }
  }
}

let globalKeyRegistry: ApiKeyRegistry | undefined;

export function getApiKeyRegistry(): ApiKeyRegistry {
  if (!globalKeyRegistry) {
    globalKeyRegistry = new ApiKeyRegistry();
  }
  return globalKeyRegistry;
}

export function createApiKeyRegistry(): ApiKeyRegistry {
  return new ApiKeyRegistry();
}
