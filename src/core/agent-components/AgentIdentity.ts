/**
 * Agent Identity Component
 * 
 * Manages the immutable core identity of an agent.
 * Identity is cryptographically bound and cannot change after creation.
 * 
 * Single Responsibility: Agent identification and fingerprinting
 */

import { createHash, randomUUID } from 'crypto';

/**
 * Core identity fields (immutable after creation)
 */
export interface AgentIdentityData {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Role or designation */
  designation: string;
  /** Biography or description */
  bio: string | string[];
  /** Cryptographic fingerprint (SHA-384) */
  fingerprint: string;
  /** Creation timestamp */
  created: string;
  /** Schema version */
  version: string;
}

/**
 * Identity creation options
 */
export interface IdentityOptions {
  name: string;
  designation?: string;
  bio?: string | string[];
  version?: string;
}

/**
 * Agent Identity Manager
 * 
 * Handles creation, validation, and fingerprinting of agent identity.
 */
export class AgentIdentity {
  private readonly data: Readonly<AgentIdentityData>;

  private constructor(data: AgentIdentityData) {
    this.data = Object.freeze(data);
  }

  /**
   * Create a new agent identity
   */
  static create(options: IdentityOptions): AgentIdentity {
    const id = randomUUID();
    const created = new Date().toISOString();
    
    const data: AgentIdentityData = {
      id,
      name: options.name,
      designation: options.designation || 'AI Agent',
      bio: options.bio || '',
      fingerprint: '', // Will be computed
      created,
      version: options.version || '1.0.0',
    };

    // Compute fingerprint
    data.fingerprint = AgentIdentity.computeFingerprint(data);

    return new AgentIdentity(data);
  }

  /**
   * Restore identity from existing data
   */
  static fromData(data: AgentIdentityData): AgentIdentity {
    // Validate fingerprint
    const expectedFingerprint = AgentIdentity.computeFingerprint({
      ...data,
      fingerprint: '',
    });

    if (data.fingerprint && data.fingerprint !== expectedFingerprint) {
      throw new Error('Identity fingerprint mismatch - data may be tampered');
    }

    return new AgentIdentity(data);
  }

  /**
   * Compute SHA-384 fingerprint of identity data
   */
  static computeFingerprint(data: Omit<AgentIdentityData, 'fingerprint'> & { fingerprint?: string }): string {
    const canonical = JSON.stringify({
      id: data.id,
      name: data.name,
      designation: data.designation,
      bio: data.bio,
      created: data.created,
      version: data.version,
    });

    return createHash('sha384').update(canonical).digest('hex');
  }

  /**
   * Verify identity integrity
   */
  verify(): boolean {
    const expected = AgentIdentity.computeFingerprint({
      ...this.data,
      fingerprint: '',
    });
    return this.data.fingerprint === expected;
  }

  // Getters (read-only access)
  get id(): string { return this.data.id; }
  get name(): string { return this.data.name; }
  get designation(): string { return this.data.designation; }
  get bio(): string | string[] { return this.data.bio; }
  get fingerprint(): string { return this.data.fingerprint; }
  get created(): string { return this.data.created; }
  get version(): string { return this.data.version; }

  /**
   * Export identity data
   */
  toData(): AgentIdentityData {
    return { ...this.data };
  }

  /**
   * Create a display string
   */
  toString(): string {
    return `${this.name} (${this.id.slice(0, 8)}...)`;
  }
}

/**
 * Validate identity data structure
 */
export function validateIdentity(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Identity must be an object'] };
  }

  const identity = data as Record<string, unknown>;

  if (!identity.id || typeof identity.id !== 'string') {
    errors.push('Identity must have a string id');
  }

  if (!identity.name || typeof identity.name !== 'string') {
    errors.push('Identity must have a string name');
  }

  if (!identity.fingerprint || typeof identity.fingerprint !== 'string') {
    errors.push('Identity must have a string fingerprint');
  }

  return { valid: errors.length === 0, errors };
}
